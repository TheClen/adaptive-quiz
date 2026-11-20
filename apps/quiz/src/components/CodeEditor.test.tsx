import { act, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "../testing/axe.js";
import { CodeEditor, EDITABLE_HINT, READ_ONLY_HINT } from "./CodeEditor.js";

const STARTER = "function sum(a, b) {\n  return 0;\n}";

function editable(): HTMLElement {
  return screen.getByRole("textbox", { name: "Your solution" });
}

/**
 * CodeMirror recognises Escape and Tab by the legacy `keyCode`, which jsdom leaves
 * at 0, so keydown events get the codes a browser sends before CodeMirror sees them.
 */
const KEY_CODES: Partial<Record<string, number>> = { Tab: 9, Escape: 27 };

function addBrowserKeyCode(event: KeyboardEvent): void {
  const keyCode = KEY_CODES[event.key];
  if (keyCode !== undefined) {
    Object.defineProperty(event, "keyCode", { value: keyCode });
  }
}

beforeAll(() => {
  document.addEventListener("keydown", addBrowserKeyCode, { capture: true });
});

afterAll(() => {
  document.removeEventListener("keydown", addBrowserKeyCode, { capture: true });
});

/** Focuses the editable area, as tabbing into it would. */
function focusEditor(): void {
  act(() => {
    editable().focus();
  });
}

describe("CodeEditor", () => {
  it('names the editable area "Your solution" and shows the starter code (AC-3.1)', () => {
    render(<CodeEditor initialCode={STARTER} />);

    const textbox = editable();
    expect(textbox.getAttribute("aria-multiline")).toBe("true");
    expect(textbox.getAttribute("contenteditable")).toBe("true");
    expect(textbox.textContent).toBe(STARTER.replaceAll("\n", ""));
    expect(screen.getByText("Your solution")).toBeDefined();
  });

  it("takes a custom label as its accessible name", () => {
    render(<CodeEditor initialCode={STARTER} label="Reference solution" />);

    expect(screen.getByRole("textbox", { name: "Reference solution" })).toBeDefined();
  });

  it("links the visible keyboard hint with aria-describedby (NFR-2)", () => {
    render(<CodeEditor initialCode={STARTER} />);

    const hint = screen.getByText(EDITABLE_HINT);
    expect(editable().getAttribute("aria-describedby")).toBe(hint.id);
  });

  it("highlights the code with the JavaScript grammar (AC-3.1)", () => {
    render(<CodeEditor initialCode={STARTER} />);

    const keywords = [...editable().querySelectorAll(".tok-keyword")].map(
      (node) => node.textContent,
    );
    expect(keywords).toEqual(["function", "return"]);
  });

  it("reports each change with the whole code", async () => {
    const onChange = vi.fn<(code: string) => void>();
    const user = userEvent.setup();
    render(<CodeEditor initialCode="" onChange={onChange} />);

    focusEditor();
    await user.keyboard("x");

    expect(onChange).toHaveBeenLastCalledWith("x");
  });

  it("indents with Tab rather than moving focus (NFR-2)", async () => {
    const onChange = vi.fn<(code: string) => void>();
    const user = userEvent.setup();
    render(
      <>
        <CodeEditor initialCode="" onChange={onChange} />
        <button type="button">Run tests</button>
      </>,
    );

    focusEditor();
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith("  ");
    expect(document.activeElement).toBe(editable());
  });

  it("lets focus leave with Escape then Tab (NFR-2)", async () => {
    const onChange = vi.fn<(code: string) => void>();
    const user = userEvent.setup();
    render(
      <>
        <CodeEditor initialCode={STARTER} onChange={onChange} />
        <button type="button">Run tests</button>
      </>,
    );

    focusEditor();
    await user.keyboard("{Escape}");
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Run tests" }));
  });

  describe("read-only mode", () => {
    it("marks the code read-only, keeps it focusable and says so (AC-3.3)", () => {
      render(<CodeEditor initialCode={STARTER} readOnly />);

      const textbox = editable();
      expect(textbox.getAttribute("aria-readonly")).toBe("true");
      expect(textbox.getAttribute("contenteditable")).toBe("true");
      expect(textbox.tabIndex).toBe(0);
      expect(textbox.getAttribute("aria-describedby")).toBe(screen.getByText(READ_ONLY_HINT).id);
      expect(screen.queryByText(EDITABLE_HINT)).toBeNull();
    });

    it("ignores typing, and Tab moves focus straight out", async () => {
      const onChange = vi.fn<(code: string) => void>();
      const user = userEvent.setup();
      render(
        <>
          <CodeEditor initialCode={STARTER} onChange={onChange} readOnly />
          <button type="button">Run tests</button>
        </>,
      );

      focusEditor();
      await user.keyboard("x");
      await user.tab();

      expect(onChange).not.toHaveBeenCalled();
      expect(editable().textContent).toBe(STARTER.replaceAll("\n", ""));
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Run tests" }));
    });

    it("freezes the code when readOnly turns on, keeping the edits", async () => {
      const onChange = vi.fn<(code: string) => void>();
      const user = userEvent.setup();
      const { rerender } = render(<CodeEditor initialCode="" onChange={onChange} />);

      focusEditor();
      await user.keyboard("a");
      rerender(<CodeEditor initialCode="" onChange={onChange} readOnly />);
      focusEditor();
      await user.keyboard("b");

      expect(editable().getAttribute("aria-readonly")).toBe("true");
      expect(editable().textContent).toBe("a");
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  it("has no axe violations, editable or read-only (NFR-2)", async () => {
    const { container, rerender } = render(<CodeEditor initialCode={STARTER} />);
    await expectNoAxeViolations(container);

    rerender(<CodeEditor initialCode={STARTER} readOnly />);
    await expectNoAxeViolations(container);
  });
});
