import { describe, expect, it } from "vitest";
import { parseNash } from "./parse";
import type { Name } from "../plutus/types";
import type { LetTerm, NashTerm } from "./types";

describe("parseNash", () => {
  it("parses a single-binding let", () => {
    const program = parseNash("(program 1.0.0 (let [x (con integer 42)] x))");
    const term = program.term;
    expect(term.tag).toBe("let");
    const let_ = term as LetTerm<Name>;
    expect(let_.bindings).toHaveLength(1);
    expect(let_.bindings[0]!.name.text).toBe("x");
    expect(let_.bindings[0]!.value.tag).toBe("constant");
    expect(let_.body.tag).toBe("var");
  });

  it("parses a single-binding let with apply body", () => {
    const program = parseNash(
      "(program 1.0.0 (let [x (con integer 42)] [f x]))",
    );
    const term = program.term;
    expect(term.tag).toBe("let");
    const let_ = term as LetTerm<Name>;
    expect(let_.bindings).toHaveLength(1);
    expect(let_.body.tag).toBe("apply");
  });

  it("parses multi-binding let", () => {
    const program = parseNash(
      "(program 1.0.0 (let [x (con integer 1) y (con integer 2)] [x y]))",
    );
    const term = program.term;
    expect(term.tag).toBe("let");
    const let_ = term as LetTerm<Name>;
    expect(let_.bindings).toHaveLength(2);
    expect(let_.bindings[0]!.name.text).toBe("x");
    expect(let_.bindings[1]!.name.text).toBe("y");
    expect(let_.body.tag).toBe("apply");
  });

  it("parses nested lets", () => {
    const program = parseNash(
      "(program 1.0.0 (let [x (con integer 1)] (let [y (con integer 2)] [x y])))",
    );
    const outer = program.term as LetTerm<Name>;
    expect(outer.bindings).toHaveLength(1);
    expect(outer.body.tag).toBe("let");
    const inner = outer.body as LetTerm<Name>;
    expect(inner.bindings).toHaveLength(1);
  });

  it("parses flattened apply (left-folds)", () => {
    const program = parseNash("(program 1.0.0 [f a b c])");
    // Should left-fold into Apply(Apply(Apply(f, a), b), c)
    const term = program.term;
    expect(term.tag).toBe("apply");
    const outer = term as {
      tag: "apply";
      function: NashTerm<Name>;
      argument: NashTerm<Name>;
    };
    expect(outer.argument.tag).toBe("var");
    expect((outer.argument as { tag: "var"; name: Name }).name.text).toBe("c");
    expect(outer.function.tag).toBe("apply");
  });

  it("parses standard UPLC constructs unchanged", () => {
    const program = parseNash("(program 1.0.0 (lam x (force (delay x))))");
    expect(program.term.tag).toBe("lambda");
  });

  it("rejects let with empty binding vector", () => {
    expect(() => parseNash("(program 1.0.0 (let [] x))")).toThrow();
  });

  it("rejects let missing a body", () => {
    expect(() => parseNash("(program 1.0.0 (let []))")).toThrow();
  });

  it("parses let where binding value is complex", () => {
    const program = parseNash(
      "(program 1.0.0 (let [r [(builtin addInteger) (con integer 1) (con integer 2)]] r))",
    );
    const let_ = program.term as LetTerm<Name>;
    expect(let_.bindings[0]!.value.tag).toBe("apply");
  });
});
