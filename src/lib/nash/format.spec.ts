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
