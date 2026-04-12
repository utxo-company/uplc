import {
  HighlightStyle,
  LanguageSupport,
  StreamLanguage,
  syntaxHighlighting,
  type StreamParser,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const KEYWORDS = new Set([
  "lam",
  "delay",
  "force",
  "builtin",
  "con",
  "error",
  "program",
  "constr",
  "case",
]);

const BOOLS = new Set(["True", "False"]);

// Constant type names that appear after `con` (e.g. `(con integer 42)`) and
// Plutus Data tags (I/B/List/Map/Constr). Rendered as typeName.
const TYPES = new Set([
  "integer",
  "bytestring",
  "string",
  "bool",
  "unit",
  "data",
  "list",
  "pair",
  "array",
  "value",
  "bls12_381_G1_element",
  "bls12_381_G2_element",
  "bls12_381_mlresult",
  "I",
  "B",
  "List",
  "Map",
  "Constr",
]);

interface State {
  inComment: boolean;
}

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_']/.test(ch);
}

function isIdentCont(ch: string): boolean {
  return /[A-Za-z0-9_'-]/.test(ch);
}

const parser: StreamParser<State> = {
  startState: () => ({ inComment: false }),

  token(stream) {
    if (stream.eatSpace()) return null;

    // Line comment: -- to end of line
    if (stream.match("--")) {
      stream.skipToEnd();
      return "lineComment";
    }

    const ch = stream.peek();
    if (ch === null || ch === undefined) return null;

    // Bytestring literal: #deadbeef
    if (ch === "#") {
      stream.next();
      stream.eatWhile(/[0-9a-fA-F]/);
      return "literal";
    }

    // String literal
    if (ch === '"') {
      stream.next();
      let escaped = false;
      while (!stream.eol()) {
        const c = stream.next();
        if (escaped) {
          escaped = false;
          continue;
        }
        if (c === "\\") {
          escaped = true;
          continue;
        }
        if (c === '"') break;
      }
      return "string";
    }

    // Signed / unsigned number, including 0x hex literals
    if (
      /[0-9]/.test(ch) ||
      ((ch === "-" || ch === "+") &&
        /[0-9]/.test(stream.string[stream.pos + 1] ?? ""))
    ) {
      stream.next();
      if (stream.string[stream.pos - 1] === "0" && stream.peek() === "x") {
        stream.next();
        stream.eatWhile(/[0-9a-fA-F]/);
      } else {
        stream.eatWhile(/[0-9]/);
      }
      return "number";
    }

    // Brackets — CodeMirror highlights via matchBrackets; we still tag them.
    if (ch === "(" || ch === ")") {
      stream.next();
      return "paren";
    }
    if (ch === "[" || ch === "]") {
      stream.next();
      return "bracket";
    }
    if (ch === "," || ch === ".") {
      stream.next();
      return "punctuation";
    }

    // Identifier / keyword
    if (isIdentStart(ch)) {
      let ident = "";
      while (!stream.eol()) {
        const c = stream.peek();
        if (c !== null && c !== undefined && isIdentCont(c)) {
          ident += stream.next();
        } else {
          break;
        }
      }
      if (KEYWORDS.has(ident)) return "keyword";
      if (BOOLS.has(ident)) return "bool";
      if (TYPES.has(ident)) return "typeName";
      return "variableName";
    }

    // Unknown character — advance to avoid infinite loops.
    stream.next();
    return null;
  },

  languageData: {
    commentTokens: { line: "--" },
    closeBrackets: { brackets: ["(", "[", '"'] },
  },
};

const tokenTable = {
  lineComment: t.lineComment,
  literal: t.literal,
  string: t.string,
  number: t.number,
  paren: t.paren,
  bracket: t.bracket,
  punctuation: t.punctuation,
  keyword: t.keyword,
  bool: t.bool,
  typeName: t.typeName,
  variableName: t.variableName,
};

export const uplcLanguage = StreamLanguage.define({
  ...parser,
  tokenTable,
});

// Highlight colors wired to the app's oklch palette from src/routes/layout.css.
// Using the existing CSS vars keeps light/dark mode in sync with the rest of
// the shell with zero extra work.
export const uplcHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "var(--primary)", fontWeight: "600" },
  { tag: t.typeName, color: "var(--chart-2)" },
  { tag: t.bool, color: "var(--chart-3)" },
  { tag: t.number, color: "var(--chart-4)" },
  { tag: t.literal, color: "var(--chart-4)" },
  { tag: t.string, color: "var(--chart-3)" },
  { tag: t.variableName, color: "var(--foreground)" },
  { tag: t.lineComment, color: "var(--muted-foreground)", fontStyle: "italic" },
  {
    tag: [t.paren, t.bracket, t.punctuation],
    color: "var(--muted-foreground)",
  },
]);

export function uplc(): LanguageSupport {
  return new LanguageSupport(uplcLanguage, [
    syntaxHighlighting(uplcHighlightStyle),
  ]);
}
