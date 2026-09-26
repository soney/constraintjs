# Changelog

## Unreleased

ConstraintJS has been rewritten in TypeScript with modern tooling. The API is the same, apart from the
behavior changes listed below; most of them are bug fixes.

### Tooling

- The source is TypeScript (`src/`), built with [tsdown](https://tsdown.dev/) into `dist/`: an ES module
  (`import cjs from "constraintjs"`), a CommonJS module (`require("constraintjs")` still returns `cjs` itself),
  and a `<script>` bundle (`dist/constraintjs.global.js` and `.global.min.js`) that defines a global `cjs`.
  Built files are no longer committed; the old `build/` directory is replaced by `dist/`.
- Type declarations are generated from the source, replacing the hand-written `types/index.d.ts`. Types can be
  imported by name or used as `cjs.TypeName`, and `Constraint<T>` and friends are now generic.
- Tests use [Vitest](https://vitest.dev/) with jsdom instead of QUnit, and run with `npm test`. The Chrome
  extension that checked for memory leaks is replaced by garbage-collection tests (`test/memory.test.ts`).
- Grunt, JSHint, and the dox/Jade documentation generator are replaced by npm scripts, ESLint, Prettier, and
  TypeDoc (`npm run docs`).
- Support for old versions of Internet Explorer (`attachEvent`, `innerText`, and so on) was removed.

### Performance

- Faster across the board: in benchmarks (Node and Chrome), common operations run 1.2–11× faster than in
  0.9.8. For example, updating long dependency chains is about 4× faster, `unshift` and `shift` on large array
  constraints about 3.5×, updating large `{{#each}}` lists about 3.5×, and `cjs.arrayDiff` 6–11×.
- Constraints use less memory (a plain constraint takes about 40% less), because dependency maps and listener
  lists are only allocated when needed.

### Behavior changes

- `cjs(value)` only creates a map constraint for plain objects. Other objects (like dates, class instances, and
  array or map constraints) become the value of a regular constraint, instead of a map of their own properties.
- `onChange` listeners run at most once per batch, as documented. If a listener throws, the others still run,
  and the error is rethrown afterwards (an `AggregateError` if several threw). The private `cjs.__debug` flag
  was removed.
- `set(value, { silent: true })` updates the constraint's own value (without invalidating its dependents).
  Previously the constraint kept returning its old value.
- `cjs.bindAttr` removes an attribute whose value is `null` or `undefined`, and HTML5 boolean attributes
  (like `hidden` and `required`) are removed when falsy.
- `cjs.bindClass` splits space-separated class names, and ignores `null`, `undefined`, and `false`.
- `ArrayConstraint.prototype.setValue` only notifies constraints that read the items that actually changed.
- Using one `cjs.on(...)` event for several transitions no longer runs more than one transition per event.
  Events are created with `cjs.on` and `.guard`; the `cjs.CJSEvent` constructor (and its private `_fire`
  method) is no longer meant to be called directly.
- Templates:
  - `{{{html}}}` is parsed into DOM nodes in place, rather than rewriting the parent element's HTML (which
    escaped sibling elements and disconnected their bindings).
  - Constraints are unwrapped when reading properties (`{{obj.prop}}`), like they already were for plain
    names (`{{name}}`).
  - `&&` and `||` short-circuit.
  - `null` and `undefined` render as empty text.
  - `{{#with}}` renders again when its value changes.
  - `{{#each}}` over an object or map constraint also provides `@index`.
  - `{{#unless}}` can have `{{#elif}}` and `{{#else}}` branches.
  - A `<` that doesn't start a tag is treated as text, and unknown block helpers are reported with a clear error.
  - Template roots no longer get a `data-cjs-template-instance` attribute.
  - Custom partial callbacks are called with the partial's options object as `this`.
- `Constraint.prototype.prop` reads properties of falsy values other than `null` and `undefined` (so
  `cjs("").prop("length")` is `0` rather than `undefined`).
- `cjs.arrayDiff` no longer includes an undocumented `mapping` property in its result, and its `moved` list can
  include items that were just added (with `from` undefined).

### Fixes

- Constraints
  - `setOption` threw when given an object of options.
  - `set` ignored the documented `equals` option.
  - `add` started from `0`, so strings got a leading "0" (`cjs("10").add("px")` was `"010px"`).
  - A constraint kept reacting to a dependency it stopped reading until it recomputed a second time, causing
    extra recomputations and `onChange` calls.
  - An error thrown by a getter corrupted dependency tracking and left the constraint with a stale value.
  - An error thrown by an `onChange` listener stopped all later listeners from ever running.
  - Extra calls to `cjs.signal()` broke later `cjs.wait()` batches.
- Array constraints
  - When several constraints read a missing item, only the last one was notified when it was set.
  - `indexOf`, `indexWhere`, `some`, and friends threw on sparse arrays.
  - `splice` with an index past the end did nothing (it now appends, like `Array.prototype.splice`).
  - `slice` didn't update when items were added.
- Map constraints
  - Keys named like `Object.prototype` properties (`"constructor"`, `"toString"`, ...) threw.
  - `setHash` threw after a missing key had been read.
  - `put` with an index past the end left holes in `keys()`.
  - `setValueHash(false)` broke later calls to `put`.
  - Objects with a `length` property were treated as arrays (`cjs({ length: 2, x: 1 })` lost `x`).
  - `moveIndex` with out-of-range indices corrupted the map.
  - `getOrPut` could add a key twice if its `create` function set the key.
- `cjs.arrayDiff` produced incorrect results for many inputs (for example, when an item had to move later in
  the array). `bindChildren` and `{{#each}}` use it, so they could put nodes in the wrong order.
- Bindings
  - `bindValue` set `element.val` instead of `element.value`.
  - `bindChildren` never moved reordered children.
  - `bindAttr` and `bindCSS` never removed attributes or styles that were no longer bound; `bindCSS` supports
    custom properties (`--name`).
  - A throttled binding could update after being destroyed, and `throttle(0)` dropped a pending update.
  - `inputValue(...).destroy(true)` wasn't silent.
- FSMs and events
  - `off` never removed listeners.
  - Specs with several states (like `"a, b"`) threw.
  - Adding the first state to an empty FSM didn't update `getState()`.
  - `destroy` left DOM event listeners attached and kept its listeners.
  - Leaving a state didn't cancel `cjs.on("timeout")` timers.
  - Chained guards (`cjs.on("click").guard(a).guard(b)`) never fired.
- Templates
  - `{{#each}}` threw whenever items were reordered, and `@index` went wrong after items were removed.
  - `pauseTemplate`, `resumeTemplate`, and `destroyTemplate` didn't affect attribute bindings, so destroyed
    templates kept updating, and they were never garbage collected.
  - `{{#with}}` didn't update the blocks inside it.
  - Destroying a template didn't clean up `{{#fsm}}` states that weren't showing.
  - `{{{html}}}` threw inside blocks.
  - `class={{value}}` threw when the value wasn't a string.
  - `{{#elif}}` conditions didn't unwrap constraints.
  - `{{#each}}` over an empty object or map didn't show its `{{#else}}` block.
  - `data-cjs-on-*` listeners weren't removed when a template was destroyed.
  - Newlines inside `{{ }}` were a syntax error, string escapes like `\'` dropped characters, and array
    literals evaluated to `undefined`.
  - `cjs.createParsedConstraint` didn't support `this` or `./name`.
