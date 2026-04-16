import { describe, expect, it } from "vitest";
import { parse } from "../plutus";
import { uplcToNash } from "./transform";
import { formatNash } from "./format";
import { parseNash } from "./parse";
import type { Name } from "../plutus/types";
import type { NashTerm } from "./types";

function nashFromUplc(source: string): NashTerm<Name> {
  const program = parse(source);
  return uplcToNash(program.term);
}

describe("formatNash", () => {
  it("formats a single-binding let compactly when it fits", () => {
    const nash = nashFromUplc("(program 1.0.0 [(lam x x) (con integer 42)])");
    const result = formatNash(nash, { maxWidth: 80 });
    expect(result).toBe("(let [x (con integer 42)] x)");
  });

  it("formats a multi-binding let compactly when it fits", () => {
    const nash = nashFromUplc(
      "(program 1.0.0 [(lam x [(lam y y) (con integer 2)]) (con integer 1)])",
    );
    const result = formatNash(nash, { maxWidth: 200 });
    expect(result).toBe("(let [x (con integer 1) y (con integer 2)] y)");
  });

  it("breaks multi-binding let across lines when too wide", () => {
    const nash = nashFromUplc(
      "(program 1.0.0 [(lam longVariableName [(lam anotherLongVariable anotherLongVariable) (con integer 222222222)]) (con integer 111111111)])",
    );
    const result = formatNash(nash, { maxWidth: 40 });
    expect(result).toBe(
      [
        "(let",
        "  [longVariableName (con integer 111111111)",
        "   anotherLongVariable (con integer 222222222)]",
        "  anotherLongVariable)",
      ].join("\n"),
    );
  });

  it("flattens left-nested applies", () => {
    const nash = nashFromUplc("(program 1.0.0 [[[f a] b] c])");
    const result = formatNash(nash, { maxWidth: 80 });
    expect(result).toBe("[f a b c]");
  });

  it("breaks flattened apply across lines when too wide", () => {
    const nash = nashFromUplc(
      "(program 1.0.0 [[(force (force (builtin ifThenElse))) (con integer 1)] (con integer 2)])",
    );
    const result = formatNash(nash, { maxWidth: 30 });
    expect(result).toContain("\n");
    expect(result).toContain("[");
  });

  it("formats constants same as UPLC", () => {
    const nash = nashFromUplc("(program 1.0.0 (con integer 42))");
    const result = formatNash(nash, { maxWidth: 80 });
    expect(result).toBe("(con integer 42)");
  });

  it("round-trips through parse and format", () => {
    const source = "(program 1.0.0 (let [x (con integer 42)] x))";
    const program = parseNash(source);
    const formatted = formatNash(program.term, { maxWidth: 80 });
    expect(formatted).toBe("(let [x (con integer 42)] x)");
  });
});

describe("formatNash bare builtin sugar", () => {
  it("sugars canonical 0-force builtin in apply head", () => {
    const nash = nashFromUplc(
      "(program 1.0.0 [(builtin addInteger) x (con integer 1)])",
    );
    expect(formatNash(nash, { maxWidth: 80 })).toBe(
      "[addInteger x (con integer 1)]",
    );
  });

  it("sugars canonical 1-force builtin ifThenElse in apply head", () => {
    const nash = nashFromUplc(
      "(program 1.0.0 [(force (builtin ifThenElse)) c t f])",
    );
    expect(formatNash(nash, { maxWidth: 80 })).toBe("[ifThenElse c t f]");
  });

  it("sugars canonical 2-force builtin fstPair in apply head", () => {
    const nash = nashFromUplc(
      "(program 1.0.0 [(force (force (builtin fstPair))) p])",
    );
    expect(formatNash(nash, { maxWidth: 80 })).toBe("[fstPair p]");
  });

  it("sugars standalone 0-force builtin", () => {
    const nash = nashFromUplc("(program 1.0.0 (builtin addInteger))");
    expect(formatNash(nash, { maxWidth: 80 })).toBe("addInteger");
  });

  it("sugars standalone 1-force builtin", () => {
    const nash = nashFromUplc("(program 1.0.0 (force (builtin ifThenElse)))");
    expect(formatNash(nash, { maxWidth: 80 })).toBe("ifThenElse");
  });

  it("over-forced 0-force builtin: bare name with extra (force …) wrapper", () => {
    const nash = nashFromUplc("(program 1.0.0 (force (builtin addInteger)))");
    expect(formatNash(nash, { maxWidth: 80 })).toBe("(force addInteger)");
  });

  it("under-forced 1-force builtin stays in explicit (builtin F) form", () => {
    const nash = nashFromUplc("(program 1.0.0 (builtin ifThenElse))");
    expect(formatNash(nash, { maxWidth: 80 })).toBe("(builtin ifThenElse)");
  });

  it("under-forced 2-force builtin with 1 force stays fully explicit", () => {
    const nash = nashFromUplc("(program 1.0.0 (force (builtin chooseList)))");
    expect(formatNash(nash, { maxWidth: 80 })).toBe(
      "(force (builtin chooseList))",
    );
  });

  it("breaks sugared apply head across lines when narrow", () => {
    const nash = nashFromUplc(
      "(program 1.0.0 [(builtin addInteger) (con integer 111111) (con integer 222222)])",
    );
    expect(formatNash(nash, { maxWidth: 30 })).toBe(
      ["[addInteger", "  (con integer 111111)", "  (con integer 222222)]"].join(
        "\n",
      ),
    );
  });

  it("sugars partial application of a builtin", () => {
    const nash = nashFromUplc("(program 1.0.0 [(builtin addInteger) x])");
    expect(formatNash(nash, { maxWidth: 80 })).toBe("[addInteger x]");
  });
});
