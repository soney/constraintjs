import { defaultEquals, type EqualityCheck } from "./util";

/**
 * An edit script that turns one array into another. Applying `removed`, then `added`, then `moved`
 * (each in order) to the old array produces the new one. See `cjs.arrayDiff`.
 */
export interface ArrayDiff<T = any> {
	/** Items to remove, back to front: remove the item at each `from` index, in order. */
	removed: Array<{ from: number; from_item: T }>;
	/** Items to insert after the removals, front to back: insert each `item` at index `to`, in order. */
	added: Array<{ item: T; to: number; to_item: T }>;
	/**
	 * Items to reposition after the additions, in order: take the item at `move_from` out of the
	 * array, then insert it at `insert_at`. `from` and `to` are the item's indices in the old and new
	 * arrays (`from` is undefined for an item that was just added).
	 */
	moved: Array<{ item: T; from: number | undefined; to: number; move_from: number; insert_at: number }>;
	/** Every item that is in both arrays, but at a different index. */
	index_changed: Array<{ item: T; from: number; to: number; from_item: T; to_item: T }>;
}

/**
 * Computes how to transform `from` into `to` with as few operations as practical: which items
 * were removed, which were added, and which have to move. This is used to keep DOM nodes in sync
 * with a model while touching as few of them as possible.
 *
 * @param equals - How to tell whether two items are the same (default: `===`)
 *
 * @example
 *     cjs.arrayDiff(["a", "b", "c"], ["c", "b", "d"]);
 *     // {
 *     //   removed: [{ from: 0, from_item: "a" }],
 *     //   added: [{ item: "d", to: 2, to_item: "d" }],
 *     //   moved: [{ item: "c", from: 2, to: 0, move_from: 1, insert_at: 0 }],
 *     //   index_changed: [{ item: "c", from: 2, to: 0, from_item: "c", to_item: "c" }]
 *     // }
 */
export function arrayDiff<T>(
	from: readonly T[],
	to: readonly T[],
	equals: EqualityCheck<T> = defaultEquals,
): ArrayDiff<T> {
	const sources = matchIndices(from, to, equals);

	const isKept = new Array<boolean>(from.length).fill(false);
	for (const source of sources) {
		if (source >= 0) isKept[source] = true;
	}

	const removed: ArrayDiff<T>["removed"] = [];
	for (let i = from.length - 1; i >= 0; i--) {
		if (!isKept[i]) removed.push({ from: i, from_item: from[i] as T });
	}

	const added: ArrayDiff<T>["added"] = [];
	const indexChanged: ArrayDiff<T>["index_changed"] = [];
	sources.forEach((source, target) => {
		const item = to[target] as T;
		if (source < 0) {
			added.push({ item, to: target, to_item: item });
		} else if (source !== target) {
			indexChanged.push({ item, from: source, to: target, from_item: from[source] as T, to_item: item });
		}
	});

	return { removed, added, moved: findMoves(from.length, sources, to), index_changed: indexChanged };
}

/**
 * Pairs up equal items in two arrays. Returns, for every index in `to`, the index of the
 * corresponding item in `from`, or -1 if the item is new. Duplicates are paired in order.
 */
export function matchIndices<T>(
	from: readonly T[],
	to: readonly T[],
	equals: EqualityCheck<T> = defaultEquals,
): number[] {
	const sources = new Array<number>(to.length).fill(-1);

	// Unchanged runs at the start and the end (the most common case) pair up directly
	let start = 0;
	while (start < from.length && start < to.length && equals(from[start] as T, to[start] as T)) {
		sources[start] = start;
		start++;
	}
	let fromEnd = from.length;
	let toEnd = to.length;
	while (fromEnd > start && toEnd > start && equals(from[fromEnd - 1] as T, to[toEnd - 1] as T)) {
		sources[--toEnd] = --fromEnd;
	}

	// Pair everything in between with the first equal item that hasn't been paired yet
	if (equals === defaultEquals) {
		// With ===, items can be looked up by value instead of comparing every pair
		const unpaired = new Map<T, number[]>(); // value -> its indices in `from`, last one first
		for (let i = fromEnd - 1; i >= start; i--) {
			const indices = unpaired.get(from[i] as T);
			if (indices) indices.push(i);
			else unpaired.set(from[i] as T, [i]);
		}
		for (let j = start; j < toEnd; j++) {
			const item = to[j] as T;
			if (item !== item) continue; // NaN is never === to anything, including itself
			const source = unpaired.get(item)?.pop();
			if (source !== undefined) sources[j] = source;
		}
	} else {
		const isPaired = new Array<boolean>(from.length).fill(false);
		for (let j = start; j < toEnd; j++) {
			for (let i = start; i < fromEnd; i++) {
				if (!isPaired[i] && equals(from[i] as T, to[j] as T)) {
					isPaired[i] = true;
					sources[j] = i;
					break;
				}
			}
		}
	}
	return sources;
}

// Works out which items to move once the removals and additions are done. It leaves the largest
// possible set of items where they are, preferring to move newly added items over existing ones
// (moving an existing DOM node can reset its state, like focus or scroll position).
function findMoves<T>(fromLength: number, sources: readonly number[], to: readonly T[]): ArrayDiff<T>["moved"] {
	// Simulate the removals and additions. Items are identified by their index in `to`.
	const keptInOldOrder = new Array<number>(fromLength).fill(-1);
	sources.forEach((source, target) => {
		if (source >= 0) keptInOldOrder[source] = target;
	});
	const kept = keptInOldOrder.filter((target) => target >= 0);
	// Additions are inserted front to back, so each new item lands exactly at its final index,
	// and the kept items fill the other slots in their original order
	const order = sources.map((source, target) => (source < 0 ? target : -1));
	let nextKept = 0;
	for (let i = 0; i < order.length; i++) {
		if (order[i] === -1) order[i] = kept[nextKept++] as number;
	}

	if (order.every((target, i) => target === i)) return [];

	// Weights make length the priority (every weight exceeds the number of items), then prefer
	// keeping existing items in place
	const stay = heaviestIncreasingSubsequence(order, (target) => order.length + (sources[target]! >= 0 ? 2 : 1));

	// Move everything else, last to first, so that each item can be placed right before the item
	// that follows it in the new array (which is already in its final spot by then)
	const moved: ArrayDiff<T>["moved"] = [];
	for (let target = order.length - 1; target >= 0; target--) {
		if (stay.has(target)) continue;
		const moveFrom = order.indexOf(target);
		order.splice(moveFrom, 1);
		const insertAt = target + 1 < to.length ? order.indexOf(target + 1) : order.length;
		order.splice(insertAt, 0, target);
		const source = sources[target] as number;
		moved.push({
			item: to[target] as T,
			from: source >= 0 ? source : undefined,
			to: target,
			move_from: moveFrom,
			insert_at: insertAt,
		});
	}
	return moved;
}

// The values of `order` (a permutation of 0..n-1) that form the increasing subsequence with the
// greatest total weight. This is a weighted longest-increasing-subsequence search that uses a
// Fenwick tree of running maxima to run in O(n log n).
function heaviestIncreasingSubsequence(order: readonly number[], weight: (value: number) => number): Set<number> {
	const n = order.length;
	const chainWeight = new Array<number>(n).fill(0); // heaviest increasing chain ending at each position
	const previous = new Array<number>(n).fill(-1); // the position before it in that chain
	// tree[v] (1-based) holds the position of the heaviest chain seen so far ending in a value < v
	const tree = new Array<number>(n + 1).fill(-1);
	const heavier = (p: number, q: number): number => (q < 0 || (p >= 0 && chainWeight[p]! > chainWeight[q]!) ? p : q);

	order.forEach((value, position) => {
		let best = -1;
		for (let i = value; i > 0; i -= i & -i) best = heavier(tree[i]!, best);
		chainWeight[position] = weight(value) + (best >= 0 ? chainWeight[best]! : 0);
		previous[position] = best;
		for (let i = value + 1; i <= n; i += i & -i) tree[i] = heavier(position, tree[i]!);
	});

	let end = -1;
	for (let position = 0; position < n; position++) end = heavier(position, end);
	const values = new Set<number>();
	for (let position = end; position >= 0; position = previous[position]!) values.add(order[position]!);
	return values;
}
