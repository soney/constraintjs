// Shared helpers for the test suite (ported from the globals that the old QUnit suite defined in
// test/unit_tests/binding_tests.js, template_test.js and example_tests.js).

// From binding_tests.js. jsdom does not implement `innerText`, so this always ends up using `textContent`.
export const getTextContent = (node: any): string => {
	if (node.textContent || node.textContent === "") {
		return node.textContent;
	} else {
		return node.innerText;
	}
};

// From template_test.js
export const hasAttr = (elem: any, name: string): boolean => {
	if (elem.hasAttribute) {
		return elem.hasAttribute(name);
	} else {
		return elem.getAttribute(name);
	}
};

// Dispatches `ev` on `target` and rethrows the first exception thrown by an event listener. Like browsers,
// jsdom does not propagate listener exceptions out of dispatchEvent; it reports them through the window's
// "error" event. The old QUnit runner hooked window.onerror, so such an exception failed the running test;
// without this, Vitest would only report it as an unhandled error that isn't attributed to any test.
const dispatch = (target: EventTarget, ev: Event): void => {
	const errors: unknown[] = [];
	const onError = (e: ErrorEvent): void => {
		errors.push(e.error);
		e.preventDefault();
	};
	window.addEventListener("error", onError);
	try {
		target.dispatchEvent(ev);
	} finally {
		window.removeEventListener("error", onError);
	}
	if (errors.length > 0) {
		throw errors[0];
	}
};

// From example_tests.js (`emulate_mouse_event`). The old version used the deprecated
// document.createEvent("MouseEvent") + initMouseEvent(...) API (with an IE fireEvent fallback);
// this uses the MouseEvent constructor with the same parameters, except `view` (the old code passed
// `window`): under Vitest's jsdom environment the global `window` is not a jsdom Window object, so jsdom
// rejects it, and nothing reads it anyway.
export const emulateMouseEvent = (eventType: string, target: EventTarget): void => {
	const ev = new MouseEvent(eventType, {
		bubbles: true,
		cancelable: true,
		detail: 0,
		screenX: 0,
		screenY: 0,
		clientX: 80,
		clientY: 20,
		ctrlKey: false,
		altKey: false,
		shiftKey: false,
		metaKey: false,
		button: 0,
		relatedTarget: null,
	});
	dispatch(target, ev);
};

// From example_tests.js (`emulate_keyboard_event`). The old version used the deprecated
// document.createEvent("KeyboardEvent") + initKeyboardEvent/initKeyEvent API and then tried to assign
// `keyCode` (read-only in Chrome, hence the extra `keyCodeVal` expando that the "Cell" test's handler
// checks first); this uses the KeyboardEvent constructor's legacy `keyCode`/`which` members instead.
// (`view` is omitted for the same reason as in emulateMouseEvent.)
export const emulateKeyboardEvent = (eventClass: string, target: EventTarget, keyCode: number): void => {
	const ev = new KeyboardEvent(eventClass, {
		bubbles: true,
		cancelable: true,
		keyCode,
		which: keyCode,
	});
	if (ev.keyCode !== keyCode) {
		// In case the environment ignores the legacy `keyCode` member of KeyboardEventInit
		Object.defineProperty(ev, "keyCode", { value: keyCode });
	}
	dispatch(target, ev);
};
