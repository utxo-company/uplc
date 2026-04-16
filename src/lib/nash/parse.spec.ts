import { describe, expect, it } from "vitest";
import { parseNash } from "./parse";
import { assertTag } from "./test-util";

describe("parseNash", () => {
  it("parses a single-binding let", () => {
    const program = parseNash("(program 1.0.0 (let [x (con integer 42)] x))");
    const { term } = program;
    assertTag(term, "let");
    expect(term.bindings).toHaveLength(1);
    expect(term.bindings[0]!.name.text).toBe("x");
    expect(term.bindings[0]!.value.tag).toBe("constant");
    expect(term.body.tag).toBe("var");
  });

  it("parses a single-binding let with apply body", () => {
    const program = parseNash(
      "(program 1.0.0 (let [x (con integer 42)] [f x]))",
    );
    const { term } = program;
    assertTag(term, "let");
    expect(term.bindings).toHaveLength(1);
    expect(term.body.tag).toBe("apply");
  });

  it("parses multi-binding let", () => {
    const program = parseNash(
      "(program 1.0.0 (let [x (con integer 1) y (con integer 2)] [x y]))",
    );
    const { term } = program;
    assertTag(term, "let");
    expect(term.bindings).toHaveLength(2);
    expect(term.bindings[0]!.name.text).toBe("x");
    expect(term.bindings[1]!.name.text).toBe("y");
    expect(term.body.tag).toBe("apply");
  });

  it("parses nested lets", () => {
    const program = parseNash(
      "(program 1.0.0 (let [x (con integer 1)] (let [y (con integer 2)] [x y])))",
    );
    const { term: outer } = program;
    assertTag(outer, "let");
    expect(outer.bindings).toHaveLength(1);
    const { body: inner } = outer;
    assertTag(inner, "let");
    expect(inner.bindings).toHaveLength(1);
  });

  it("parses flattened apply (left-folds)", () => {
    const program = parseNash("(program 1.0.0 [f a b c])");
    // Should left-fold into Apply(Apply(Apply(f, a), b), c)
    const { term } = program;
    assertTag(term, "apply");
    const { argument, function: fn } = term;
    assertTag(argument, "var");
    expect(argument.name.text).toBe("c");
    expect(fn.tag).toBe("apply");
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
    const { term } = program;
    assertTag(term, "let");
    expect(term.bindings[0]!.value.tag).toBe("apply");
  });
});

describe("parseNash bare builtin sugar", () => {
  it("resolves bare addInteger (0-force builtin) to BuiltinTerm", () => {
    const program = parseNash(
      "(program 1.0.0 [addInteger (con integer 1) (con integer 2)])",
    );
    // [[(builtin addInteger) 1] 2]
    const { term: outer } = program;
    assertTag(outer, "apply");
    const { function: inner } = outer;
    assertTag(inner, "apply");
    expect(inner.function).toEqual({ tag: "builtin", function: "addInteger" });
  });

  it("resolves bare ifThenElse (1-force builtin) with auto-force wrap", () => {
    const program = parseNash("(program 1.0.0 ifThenElse)");
    expect(program.term).toEqual({
      tag: "force",
      term: { tag: "builtin", function: "ifThenElse" },
    });
  });

  it("resolves bare fstPair (2-force builtin) with two force wraps", () => {
    const program = parseNash("(program 1.0.0 fstPair)");
    expect(program.term).toEqual({
      tag: "force",
      term: {
        tag: "force",
        term: { tag: "builtin", function: "fstPair" },
      },
    });
  });

  it("lam parameter shadows builtin name in its body", () => {
    const program = parseNash("(program 1.0.0 (lam addInteger addInteger))");
    const { term: lam } = program;
    assertTag(lam, "lambda");
    const { body } = lam;
    assertTag(body, "var");
    expect(body.name.text).toBe("addInteger");
    expect(body.name.unique).toBe(lam.parameter.unique);
  });

  it("let binding shadows builtin name in the body", () => {
    const program = parseNash(
      "(program 1.0.0 (let [addInteger (con integer 1)] addInteger))",
    );
    const { term } = program;
    assertTag(term, "let");
    expect(term.body.tag).toBe("var");
    expect(term.bindings[0]!.value.tag).toBe("constant");
  });

  it("earlier let binding of a non-builtin does not shadow builtin in later binding's value", () => {
    const program = parseNash(
      "(program 1.0.0 (let [x (con integer 1) y addInteger] y))",
    );
    const { term } = program;
    assertTag(term, "let");
    expect(term.bindings[1]!.value).toEqual({
      tag: "builtin",
      function: "addInteger",
    });
  });

  it("explicit (builtin F) does NOT auto-insert forces", () => {
    const program = parseNash("(program 1.0.0 (builtin ifThenElse))");
    expect(program.term).toEqual({ tag: "builtin", function: "ifThenElse" });
  });

  it("unknown identifier becomes free var (no parse error)", () => {
    const program = parseNash("(program 1.0.0 someFreeVar)");
    expect(program.term.tag).toBe("var");
  });

  it("partial application of a builtin parses", () => {
    const program = parseNash("(program 1.0.0 [addInteger x])");
    const { term } = program;
    assertTag(term, "apply");
    expect(term.function).toEqual({ tag: "builtin", function: "addInteger" });
    expect(term.argument.tag).toBe("var");
  });
});
