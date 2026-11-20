import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/*
 * jsdom does not lay out text, so `Range` has no geometry. CodeMirror measures text
 * ranges after each update; empty geometry lets it run (plan §9.5).
 */
if (typeof Range.prototype.getClientRects !== "function") {
  Range.prototype.getClientRects = function getClientRects() {
    return document.createElement("div").getClientRects();
  };
}
if (typeof Range.prototype.getBoundingClientRect !== "function") {
  Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return new DOMRect();
  };
}

afterEach(() => {
  cleanup();
});
