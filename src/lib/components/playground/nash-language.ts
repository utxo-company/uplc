// Nash CodeMirror language mode — extends UPLC highlighting with `let` and a
// distinct tag for binding-vector brackets. `[` and `]` are tracked on a single
// stack (same idea as parser paren-matching): each open pushes a kind, each
// close pops it. The only extra state is a one-token "expecting binding vector"
// flag set by the `let` keyword.

import {
  HighlightStyle,
  LanguageSupport,
  StreamLanguage,
  syntaxHighlighting,
  type StreamParser,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { isDefaultFunction } from "../../plutus/types";

const KEYWORDS = new Set([
  "lam",
  "let",
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

type BracketKind = "apply" | "binding";

interface State {
  inComment: boolean;
  expectingBindingVector: boolean;
  bracketStack: BracketKind[];
}

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_']/.test(ch);
}

function isIdentCont(ch: string): boolean {
  return /[A-Za-z0-9_'-]/.test(ch);
}

const parser: StreamParser<State> = {
  startState: () => ({
    inComment: false,
    expectingBindingVector: false,
    bracketStack: [],
  }),

  copyState: (s) => ({
    inComment: s.inComment,
    expectingBindingVector: s.expectingBindingVector,
    bracketStack: s.bracketStack.slice(),
  }),

  token(stream, state) {
    if (stream.eatSpace()) return null;

    // Comments don't end the "expecting binding vector" grace period — a `let`
    // followed by `-- note\n [x 1] x` still tags the `[` as a binding bracket.
    if (stream.match("--")) {
      stream.skipToEnd();
      return "lineComment";
    }

    const ch = stream.peek();
    if (ch === null || ch === undefined) return null;

    // Brackets — push on open, pop on close, same shape as paren matching.
    // A `[` that immediately follows `let` opens the binding vector; any other
    // `[` is the head of an apply chain.
    if (ch === "[") {
      stream.next();
      const kind: BracketKind = state.expectingBindingVector
        ? "binding"
        : "apply";
      state.expectingBindingVector = false;
      state.bracketStack.push(kind);
      return kind === "binding" ? "bindingBracket" : "bracket";
    }
    if (ch === "]") {
      stream.next();
      state.expectingBindingVector = false;
      const kind = state.bracketStack.pop();
      return kind === "binding" ? "bindingBracket" : "bracket";
    }

    // Anything else cancels a pending `let`.
    state.expectingBindingVector = false;

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

    if (ch === "(" || ch === ")") {
      stream.next();
      return "paren";
    }

    if (ch === "," || ch === ".") {
      stream.next();
      return "punctuation";
    }

    // Identifier / keyword — `let` arms the binding-vector expectation.
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
      if (ident === "let") {
        state.expectingBindingVector = true;
        return "keyword";
      }
      if (KEYWORDS.has(ident)) return "keyword";
      if (BOOLS.has(ident)) return "bool";
      if (TYPES.has(ident)) return "typeName";
      if (isDefaultFunction(ident)) return "builtinName";
      return "variableName";
    }

    // Unknown character
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
  bindingBracket: t.special(t.bracket),
  punctuation: t.punctuation,
  keyword: t.keyword,
  bool: t.bool,
  typeName: t.typeName,
  variableName: t.variableName,
  builtinName: t.function(t.variableName),
};

export const nashLanguage = StreamLanguage.define({
  ...parser,
  tokenTable,
});

export const nashHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "var(--primary)", fontWeight: "600" },
  { tag: t.typeName, color: "var(--chart-2)" },
  { tag: t.bool, color: "var(--chart-3)" },
  { tag: t.number, color: "var(--chart-4)" },
  { tag: t.literal, color: "var(--chart-4)" },
  { tag: t.string, color: "var(--chart-3)" },
  {
    tag: t.function(t.variableName),
    color: "var(--chart-5)",
    fontWeight: "500",
  },
  { tag: t.variableName, color: "var(--foreground)" },
  { tag: t.lineComment, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: t.special(t.bracket), color: "var(--primary)", fontWeight: "600" },
  {
    tag: [t.paren, t.bracket, t.punctuation],
    color: "var(--muted-foreground)",
  },
]);

export function nash(): LanguageSupport {
  return new LanguageSupport(nashLanguage, [
    syntaxHighlighting(nashHighlightStyle),
  ]);
}
