import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import {
  CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { nash } from "./nash-language";
import { __test } from "./nash-completion";

function contextAt(
  doc: string,
  pos: number,
  explicit = false,
): CompletionContext {
  const state = EditorState.create({ doc, extensions: [nash()] });
  return new CompletionContext(state, pos, explicit);
}

// The source is synchronous, so casting out of the `| Promise<…>` union is safe.
function runSource(ctx: CompletionContext): CompletionResult | null {
  return __test.nashBuiltinSource(ctx) as CompletionResult | null;
}

describe("isBindingVectorBracket (the regex is the brittle part)", () => {
  it("true for bare `let [`", () => {
    const s = EditorState.create({ doc: "let [" });
    expect(__test.isBindingVectorBracket(s, 4)).toBe(true);
  });

  it("true across whitespace + line comments chained", () => {
    const s = EditorState.create({ doc: "let  -- a\n  -- b\n  [" });
    expect(__test.isBindingVectorBracket(s, 19)).toBe(true);
  });

  it("false when an identifier sits between `let` and `[`", () => {
    const s = EditorState.create({ doc: "let foo [" });
    expect(__test.isBindingVectorBracket(s, 8)).toBe(false);
  });
});

describe("nashBuiltinSource: `from` anchor", () => {
  it("anchors at start of typed prefix with no whitespace", () => {
    // "[ad" — bracket at 0, prefix starts at 1
    const res = runSource(contextAt("[ad", 3));
    expect(res).not.toBeNull();
    expect(res!.from).toBe(1);
  });

  it("anchors at start of typed prefix when whitespace follows `[`", () => {
    // "[   ad" — bracket at 0, whitespace 1-3, prefix at 4
    const res = runSource(contextAt("[   ad", 6));
    expect(res).not.toBeNull();
    expect(res!.from).toBe(4);
  });

  it("explicit (Ctrl+Space) on a bare word anchors at the word start", () => {
    // "ad" with cursor at 2, explicit — from should be 0
    const res = runSource(contextAt("ad", 2, true));
    expect(res).not.toBeNull();
    expect(res!.from).toBe(0);
  });
});
