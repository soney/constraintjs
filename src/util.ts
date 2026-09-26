// Small helpers shared across modules

/** How two values are compared for equality. */
export type EqualityCheck<T = any> = (a: T, b: T) => boolean;

/** The default equality check: `===`. */
export const defaultEquals: EqualityCheck<unknown> = (a, b) => a === b;

/**
 * Returned from a `forEach` callback (on array and map constraints) to stop iterating early.
 */
export const BREAK: Readonly<object> = Object.freeze({});

export function isPositiveInteger(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// `background-color` -> `backgroundColor` (and `-ms-transform` -> `msTransform`)
export function camelCase(name: string): string {
	return name.replace(/^-ms-/, "ms-").replace(/-([a-z0-9])/gi, (_, letter: string) => letter.toUpperCase());
}
