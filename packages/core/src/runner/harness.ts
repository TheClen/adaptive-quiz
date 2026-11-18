/**
 * The part of the test harness that runs inside QuickJS (plan §9.1).
 *
 * It is evaluated in each fresh context before the exercise code, so it captures the
 * built-ins it relies on (`JSON.parse`, `Object.keys`, …) before that code can replace
 * them. The code could still change built-in prototypes to influence how its own result
 * is compared; doing so only fools the person who wrote it.
 *
 * The script evaluates to an object with two functions, which the host keeps as handles:
 *
 * - `runTest(fn, argsJson, expectedJson, checksImmutability)` calls `fn` with the parsed
 *   arguments and returns `true` when the test passes, or the failure reason (a string).
 * - `describeThrown(value)` describes a thrown value as "TypeError: message".
 *
 * Failure reasons are fixed templates. Each value they show is cut to
 * `MAX_VALUE_LENGTH` characters.
 *
 * This is a string, not a function serialised with `toString()`, so that no build step
 * or coverage tool can rewrite the code that runs in the sandbox.
 */
export const MAX_VALUE_LENGTH = 200;

export const HARNESS_SOURCE = `"use strict";
(() => {
  const parse = JSON.parse;
  const stringify = JSON.stringify;
  const keysOf = Object.keys;
  const protoOf = Object.getPrototypeOf;
  const hasOwn = Object.hasOwn;
  const isArray = Array.isArray;
  const apply = Reflect.apply;
  const toText = String;
  const sliceText = String.prototype.slice;
  const objectProto = Object.prototype;
  const LIMIT = ${String(MAX_VALUE_LENGTH)};
  const MAX_DEPTH = 10;
  const UNSHOWABLE = "a value that cannot be shown";

  const clip = (text) =>
    text.length <= LIMIT ? text : apply(sliceText, text, [0, LIMIT - 1]) + "…";

  const isPlainObject = (value) => {
    const proto = protoOf(value);
    return proto === objectProto || proto === null;
  };

  const className = (value) => {
    try {
      const name = value.constructor.name;
      if (typeof name === "string" && name !== "") return name;
    } catch {}
    return "Object";
  };

  // Shows a value as JSON with spaces after separators, for example [1, 2] or
  // {"id": 1}. Stops as soon as the text is longer than LIMIT.
  const show = (value) => {
    let out = "";
    const write = (text) => {
      out += text;
    };
    const full = () => out.length > LIMIT;
    const visit = (item, depth) => {
      if (full()) return;
      if (item === undefined) return write("undefined");
      if (item === null) return write("null");
      const type = typeof item;
      if (type === "string") return write(stringify(item));
      if (type === "number" || type === "boolean") return write(toText(item));
      if (type === "bigint") return write(toText(item) + "n");
      if (type === "symbol") return write("a symbol");
      if (type === "function") return write("a function");
      if (depth >= MAX_DEPTH) return write("…");
      if (isArray(item)) {
        write("[");
        for (let i = 0; i < item.length && !full(); i++) {
          if (i > 0) write(", ");
          visit(item[i], depth + 1);
        }
        return write("]");
      }
      if (!isPlainObject(item)) return write("an instance of " + className(item));
      const keys = keysOf(item);
      write("{");
      for (let i = 0; i < keys.length && !full(); i++) {
        if (i > 0) write(", ");
        write(stringify(keys[i]) + ": ");
        visit(item[keys[i]], depth + 1);
      }
      return write("}");
    };
    try {
      visit(value, 0);
    } catch {
      return UNSHOWABLE;
    }
    return clip(out);
  };

  // Deep structural equality with a JSON value. Arrays match arrays element by
  // element. Objects match plain objects with the same own enumerable keys, in any
  // order. Primitives match with ===. The recursion follows the expected value, which
  // is a finite tree, so a cyclic result cannot make it loop.
  const equals = (actual, expected) => {
    if (expected === null || typeof expected !== "object") return actual === expected;
    if (actual === null || typeof actual !== "object") return false;
    if (isArray(expected)) {
      if (!isArray(actual) || actual.length !== expected.length) return false;
      for (let i = 0; i < expected.length; i++) {
        if (!equals(actual[i], expected[i])) return false;
      }
      return true;
    }
    if (isArray(actual) || !isPlainObject(actual)) return false;
    const actualKeys = keysOf(actual);
    const expectedKeys = keysOf(expected);
    if (actualKeys.length !== expectedKeys.length) return false;
    for (let i = 0; i < expectedKeys.length; i++) {
      const key = expectedKeys[i];
      if (!hasOwn(actual, key) || !equals(actual[key], expected[key])) return false;
    }
    return true;
  };

  const describeThrown = (value) => {
    try {
      if (value !== null && typeof value === "object") {
        const name = value.name;
        const message = value.message;
        if (typeof name === "string" && typeof message === "string") {
          return clip(message === "" ? name : name + ": " + message);
        }
      }
    } catch {
      return UNSHOWABLE;
    }
    return show(value);
  };

  const runTest = (fn, argsJson, expectedJson, checksImmutability) => {
    const args = parse(argsJson);
    const expected = parse(expectedJson);
    let result;
    try {
      result = apply(fn, undefined, args);
    } catch (error) {
      return "Threw " + describeThrown(error);
    }
    let same;
    try {
      same = equals(result, expected);
    } catch (error) {
      return "Threw " + describeThrown(error);
    }
    if (!same) return "Expected " + show(expected) + " but got " + show(result);
    if (checksImmutability) {
      const original = parse(argsJson);
      for (let i = 0; i < original.length; i++) {
        let unchanged;
        try {
          unchanged = equals(args[i], original[i]);
        } catch {
          unchanged = false;
        }
        if (!unchanged) return "Changed its input (argument " + toText(i + 1) + ")";
      }
    }
    return true;
  };

  return { runTest, describeThrown };
})()`;
