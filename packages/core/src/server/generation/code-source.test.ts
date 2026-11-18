import { describe, expect, it } from "vitest";

import type { ForbiddenConstruct } from "../prompts/index.js";
import { findForbiddenConstruct, maskLiterals } from "./code-source.js";

describe("maskLiterals", () => {
  it("blanks comments and keeps offsets and line breaks", () => {
    const source = "const a = 1; // fetch it\n/* export\n */ const b = 2;";
    const masked = maskLiterals(source);

    expect(masked).toHaveLength(source.length);
    expect(masked).toBe(`const a = 1; ${" ".repeat(11)}\n${" ".repeat(9)}\n    const b = 2;`);
  });

  it("blanks string contents and keeps the quotes", () => {
    expect(maskLiterals(`f("window", 'it\\'s')`)).toBe(`f("      ", '     ')`);
  });

  it("keeps the code of template substitutions", () => {
    expect(maskLiterals("`a ${fetch(`b ${x}`)} c`")).toBe("`  ${fetch(`  ${x}`)}  `");
  });

  it("tracks braces inside substitutions", () => {
    expect(maskLiterals("`${{ a: 1 }.a} await`")).toBe("`${{ a: 1 }.a}      `");
  });

  it("blanks regular expression literals, not divisions", () => {
    expect(maskLiterals('const r = /"async"/g; const d = a / b / c;')).toBe(
      `const r = /${" ".repeat(9)}; const d = a / b / c;`,
    );
    expect(maskLiterals("return /[/]import/.test(s);")).toBe("return /          .test(s);");
  });

  it("masks an unterminated string to the end of its line", () => {
    expect(maskLiterals('const s = "import\nexport')).toBe('const s = "      \nexport');
  });
});

describe("findForbiddenConstruct", () => {
  const cases: readonly (readonly [string, ForbiddenConstruct])[] = [
    ['import { produce } from "immer";', "import"],
    ['const m = import("./m.js");', "import"],
    ["export function f() {}", "export"],
    ['const fs = require ("fs");', "require"],
    ["return <li>{todo.text}</li>;", "jsx"],
    ["return <Item />;", "jsx"],
    ["return <>{items}</>;", "jsx"],
    ['return <li className="done">x</li>', "jsx"],
    ["return <Item {...props} />;", "jsx"],
    ["const [todos, setTodos] = useState([]);", "hook"],
    ["const state = React.useReducer(reducer, []);", "hook"],
    ["return React.Children.count(children);", "react-namespace"],
    ["document.title = title;", "document"],
    ["return window.innerWidth;", "window"],
    ["return fetch(url);", "fetch"],
    ["setTimeout(() => done(), 0);", "set-timeout"],
    ["setInterval(tick, 1000);", "set-timeout"],
    ["async function load() {}", "async"],
    ["const run = async () => 1;", "async"],
    ["const value = await promise;", "await"],
    ["return Math.random() > 0.5;", "math-random"],
    ["return Date . now();", "date-now"],
  ];

  it.each(cases)("finds %j as %s", (source, construct) => {
    expect(findForbiddenConstruct(source)).toBe(construct);
  });

  it.each([
    "for (let i = 0; i<n; i++) total += i;",
    "return a < b && c > d;",
    "if (count <limit) return x;",
    'case "fetch/started": return state;',
    "// Do not import, export or fetch anything.\nreturn state;",
    "const message = `use ${user.name} window`;",
    "const reused = reuseItem(item);",
    "const documents = [];",
    "const pattern = /async|await/u;",
    "return new Date(0).getTime();",
  ])("accepts %j", (source) => {
    expect(findForbiddenConstruct(source)).toBeNull();
  });
});
