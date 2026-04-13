import { describe, expect, it } from "vitest";
import { parse, prettyPrintNamed } from "../plutus";
import type { Term, Name } from "../plutus";
import { uplcToNash, nashToUplc } from "./transform";
import type { NashTerm, LetTerm } from "./types";

// Helper: parse UPLC, transform to Nash, transform back, pretty-print both
// to verify semantic equivalence.
function roundTrip(source: string): { original: string; roundTripped: string } {
  const program = parse(source);
  const nash = uplcToNash(program.term);
  const back = nashToUplc(nash);
  return {
    original: prettyPrintNamed(program.term),
    roundTripped: prettyPrintNamed(back),
  };
}

describe("uplcToNash", () => {
  it("transforms Apply(Lambda(x, body), arg) into a single-binding let", () => {
    const program = parse("(program 1.0.0 [(lam x x) (con integer 42)])");
    const nash = uplcToNash(program.term);
    expect(nash.tag).toBe("let");
    const let_ = nash as LetTerm<Name>;
    expect(let_.bindings).toHaveLength(1);
    expect(let_.bindings[0]!.name.text).toBe("x");
    expect(let_.body.tag).toBe("var");
  });

  it("collapses interleaved Apply(Lambda) chain (Pattern A)", () => {
    const program = parse(
      "(program 1.0.0 [(lam x [(lam y y) (con integer 2)]) (con integer 1)])",
    );
    const nash = uplcToNash(program.term);
    expect(nash.tag).toBe("let");
    const let_ = nash as LetTerm<Name>;
    expect(let_.bindings).toHaveLength(2);
    expect(let_.bindings[0]!.name.text).toBe("x");
    expect(let_.bindings[1]!.name.text).toBe("y");
  });

  it("collapses multi-apply/multi-lambda chain (Pattern B)", () => {
    const program = parse(
      "(program 1.0.0 [[(lam a (lam b b)) (con integer 1)] (con integer 2)])",
    );
    const nash = uplcToNash(program.term);
    expect(nash.tag).toBe("let");
    const let_ = nash as LetTerm<Name>;
    expect(let_.bindings).toHaveLength(2);
    expect(let_.bindings[0]!.name.text).toBe("a");
    expect(let_.bindings[1]!.name.text).toBe("b");
  });

  it("does not collapse when Apply function is not a Lambda", () => {
    const program = parse("(program 1.0.0 [x (con integer 42)])");
    const nash = uplcToNash(program.term);
    expect(nash.tag).toBe("apply");
  });

  it("handles non-consecutive patterns as nested lets", () => {
    // Apply(Lambda(x, Force(Apply(Lambda(y, body), arg2))), arg1)
    const program = parse(
      "(program 1.0.0 [(lam x (force [(lam y y) (con integer 2)])) (con integer 1)])",
    );
    const nash = uplcToNash(program.term);
    expect(nash.tag).toBe("let");
    const outerLet = nash as LetTerm<Name>;
    expect(outerLet.bindings).toHaveLength(1);
    expect(outerLet.bindings[0]!.name.text).toBe("x");
    expect(outerLet.body.tag).toBe("force");
    const force = outerLet.body as { tag: "force"; term: NashTerm<Name> };
    expect(force.term.tag).toBe("let");
  });

  it("leaves non-apply terms unchanged", () => {
    const program = parse("(program 1.0.0 (con integer 42))");
    const nash = uplcToNash(program.term);
    expect(nash.tag).toBe("constant");
  });

  it("handles extra applies when more args than lambdas", () => {
    // Apply(Apply(Lambda(a, body), arg1), arg2) — 1 lambda, 2 applies
    const program = parse(
      "(program 1.0.0 [[(lam a a) (con integer 1)] (con integer 2)])",
    );
    const nash = uplcToNash(program.term);
    // Should be: Apply(Let([{a, 1}], a), 2)
    expect(nash.tag).toBe("apply");
    const apply = nash as {
      tag: "apply";
      function: NashTerm<Name>;
      argument: NashTerm<Name>;
    };
    expect(apply.function.tag).toBe("let");
  });
});

describe("nashToUplc", () => {
  it("desugars single-binding let into Apply(Lambda, value)", () => {
    const nashTerm: NashTerm<Name> = {
      tag: "let",
      bindings: [
        {
          name: { text: "x", unique: 0 },
          value: { tag: "constant", value: { type: "integer", value: 42n } },
        },
      ],
      body: { tag: "var", name: { text: "x", unique: 0 } },
    };
    const uplc = nashToUplc(nashTerm);
    expect(uplc.tag).toBe("apply");
    const apply = uplc as {
      tag: "apply";
      function: Term<Name>;
      argument: Term<Name>;
    };
    expect(apply.function.tag).toBe("lambda");
  });

  it("desugars multi-binding let into nested Apply(Lambda)", () => {
    const nashTerm: NashTerm<Name> = {
      tag: "let",
      bindings: [
        {
          name: { text: "x", unique: 0 },
          value: { tag: "constant", value: { type: "integer", value: 1n } },
        },
        {
          name: { text: "y", unique: 1 },
          value: { tag: "constant", value: { type: "integer", value: 2n } },
        },
      ],
      body: { tag: "var", name: { text: "y", unique: 1 } },
    };
    const uplc = nashToUplc(nashTerm);
    // Should be: Apply(Lambda(x, Apply(Lambda(y, y), 2)), 1)
    expect(uplc.tag).toBe("apply");
    const outer = uplc as {
      tag: "apply";
      function: Term<Name>;
      argument: Term<Name>;
    };
    expect(outer.function.tag).toBe("lambda");
    const lambda = outer.function as {
      tag: "lambda";
      parameter: Name;
      body: Term<Name>;
    };
    expect(lambda.parameter.text).toBe("x");
    expect(lambda.body.tag).toBe("apply");
  });
});

describe("round-trip", () => {
  it("preserves semantics for simple let", () => {
    const { original, roundTripped } = roundTrip(
      "(program 1.0.0 [(lam x x) (con integer 42)])",
    );
    expect(roundTripped).toBe(original);
  });

  it("preserves semantics for nested let", () => {
    const { original, roundTripped } = roundTrip(
      "(program 1.0.0 [(lam x [(lam y [x y]) (con integer 2)]) (con integer 1)])",
    );
    expect(roundTripped).toBe(original);
  });

  it("preserves semantics for non-let expressions", () => {
    const { original, roundTripped } = roundTrip(
      "(program 1.0.0 (force (delay (con integer 42))))",
    );
    expect(roundTripped).toBe(original);
  });

  it("preserves semantics for multi-apply/multi-lambda", () => {
    // Pattern B round-trips to Pattern A (interleaved) — that's ok
    const program = parse(
      "(program 1.0.0 [[(lam a (lam b [a b])) (con integer 1)] (con integer 2)])",
    );
    const nash = uplcToNash(program.term);
    const back = nashToUplc(nash);
    // The result should be an interleaved form
    const printed = prettyPrintNamed(back);
    expect(printed).toBe(
      "[(lam a [(lam b [a b]) (con integer 2)]) (con integer 1)]",
    );
  });
});
