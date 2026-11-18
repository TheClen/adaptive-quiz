import type { ForbiddenConstruct } from "../prompts/index.js";

/**
 * Characters after which a `/` starts a regular expression literal rather than a
 * division: the end of nothing, an opening bracket, a separator or an operator.
 */
const REGEX_PRECEDERS = new Set("([{,;:=!&|?+-*%<>~^}");

/** Keywords after which a `/` starts a regular expression literal. */
const REGEX_KEYWORDS =
  /(?:^|[^\w$])(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/u;

/**
 * Replaces the contents of comments, string literals, template literal text and
 * regular expression literals with spaces, keeping quotes, line breaks and the code
 * of `${…}` substitutions. Offsets do not change.
 *
 * The static checks search the result, so a word in a comment or a string, such as
 * an action type `"fetch/started"` or a comment "do not export it", is not mistaken
 * for code. This is a scanner, not a parser: on code it cannot read, such as an
 * unterminated string, it masks to the end of the line or of the source. The checks
 * keep exercises portable and on topic (AC-3.7); the sandbox is the QuickJS runner,
 * which exposes no host objects (plan §9.2).
 */
export function maskLiterals(source: string): string {
  const out: string[] = [];
  /** Brace depths at which a template substitution `${` was opened. */
  const substitutions: number[] = [];
  let depth = 0;
  let index = 0;

  const keep = (text: string): void => {
    out.push(text);
  };
  const blank = (from: number, to: number): void => {
    for (let at = from; at < Math.min(to, source.length); at += 1) {
      out.push(source[at] === "\n" ? "\n" : " ");
    }
  };

  /** Scans template text from `from` to the closing backtick or the next `${`. */
  const scanTemplate = (from: number): number => {
    let at = from;
    while (at < source.length) {
      const char = source[at];
      if (char === "\\") {
        at += 2;
      } else if (char === "`") {
        blank(from, at);
        keep("`");
        return at + 1;
      } else if (char === "$" && source[at + 1] === "{") {
        blank(from, at);
        keep("${");
        depth += 1;
        substitutions.push(depth);
        return at + 2;
      } else {
        at += 1;
      }
    }
    blank(from, source.length);
    return source.length;
  };

  const startsRegex = (): boolean => {
    const before = out.join("").trimEnd();
    const last = before.at(-1);
    return last === undefined || REGEX_PRECEDERS.has(last) || REGEX_KEYWORDS.test(before);
  };

  while (index < source.length) {
    const char = source[index] ?? "";
    const next = source[index + 1];

    if (char === "/" && next === "/") {
      const end = source.indexOf("\n", index);
      const stop = end === -1 ? source.length : end;
      blank(index, stop);
      index = stop;
    } else if (char === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(index, stop);
      index = stop;
    } else if (char === '"' || char === "'") {
      let at = index + 1;
      while (at < source.length && source[at] !== char && source[at] !== "\n") {
        at += source[at] === "\\" ? 2 : 1;
      }
      const closed = source[at] === char;
      keep(char);
      blank(index + 1, at);
      if (closed) keep(char);
      index = closed ? at + 1 : at;
    } else if (char === "`") {
      keep("`");
      index = scanTemplate(index + 1);
    } else if (char === "/" && startsRegex()) {
      let at = index + 1;
      let inClass = false;
      while (at < source.length && source[at] !== "\n") {
        const current = source[at];
        if (current === "\\") {
          at += 2;
          continue;
        }
        at += 1;
        if (inClass) {
          if (current === "]") inClass = false;
        } else if (current === "[") {
          inClass = true;
        } else if (current === "/") {
          break;
        }
      }
      while (at < source.length && /[a-z]/u.test(source[at] ?? "")) at += 1;
      keep("/");
      blank(index + 1, at);
      index = at;
    } else if (char === "}" && substitutions.at(-1) === depth) {
      substitutions.pop();
      depth -= 1;
      keep("}");
      index = scanTemplate(index + 1);
    } else {
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      keep(char);
      index += 1;
    }
  }
  return out.join("");
}

/**
 * JSX: a fragment, a closing tag, a tag with no attribute, or a tag whose first
 * attribute has a value or is a spread. A comparison such as `a < b` or `i<n;` does
 * not match.
 */
const JSX =
  /<\/?>|<\/[A-Za-z][\w.]*\s*>|<[A-Za-z][\w.]*\s*\/?>|<[A-Za-z][\w.]*\s+(?:[A-Za-z_$][\w$-]*\s*=\s*["'{]|\{)/u;

/** The constructs exercise code must not use, in the order of plan §8.4 step 3. */
const FORBIDDEN: readonly (readonly [ForbiddenConstruct, RegExp])[] = [
  ["import", /\bimport\b/u],
  ["export", /\bexport\b/u],
  ["require", /\brequire\s*\(/u],
  ["jsx", JSX],
  ["hook", /\buse[A-Z][\w$]*\s*\(/u],
  ["react-namespace", /\bReact\s*\./u],
  ["document", /\bdocument\b/u],
  ["window", /\bwindow\b/u],
  ["fetch", /\bfetch\b/u],
  ["set-timeout", /\b(?:setTimeout|setInterval|setImmediate)\b/u],
  ["async", /\basync\b/u],
  ["await", /\bawait\b/u],
  ["math-random", /\bMath\s*\.\s*random\b/u],
  ["date-now", /\bDate\s*\.\s*now\b/u],
];

/**
 * The first construct of plan §8.4 step 3 that `source` uses outside comments and
 * literals, or `null` (AC-3.7).
 */
export function findForbiddenConstruct(source: string): ForbiddenConstruct | null {
  const code = maskLiterals(source);
  for (const [construct, pattern] of FORBIDDEN) {
    if (pattern.test(code)) return construct;
  }
  return null;
}
