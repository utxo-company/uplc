// Width-aware formatter for NashTerm. Same two-pass approach as the UPLC
// formatter (measure compact widths bottom-up, emit top-down), but with:
//   - `let` formatting with a Clojure-style binding vector
//   - Flattened left-nested apply chains: `[f a b c]` instead of `[[[f a] b] c]`

import type {
  DefaultFunction,
  Name,
  PlutusData,
  PlutusDataConstr,
  PlutusDataList,
  PlutusDataMap,
} from "../plutus/types";
import { defaultFunctionForceCount } from "../plutus/types";
import { prettyPrintNamed, printPlutusData } from "../plutus/pretty";
import type {
  NashCaseTerm,
  NashConstrTerm,
  NashDelayTerm,
  NashForceTerm,
  NashLambdaTerm,
  NashTerm,
} from "./types";

// Parent frames in the measurement walk only ever combine a fixed subset of
// terms/data, so we narrow the frame types to make each inner switch exhaustive.
type CombineTerm =
  | NashLambdaTerm<Name>
  | NashDelayTerm<Name>
  | NashForceTerm<Name>
  | NashConstrTerm<Name>
  | NashCaseTerm<Name>;
type CombineData = PlutusDataList | PlutusDataMap | PlutusDataConstr;

export interface FormatOptions {
  readonly maxWidth?: number;
  readonly baseIndent?: number;
}

export function formatNash(
  root: NashTerm<Name>,
  options?: FormatOptions,
): string {
  const maxWidth = options?.maxWidth ?? 80;
  const baseIndent = options?.baseIndent ?? 0;

  const { termWidths, dataWidths } = measureWidths(root);
  return emit(root, termWidths, dataWidths, maxWidth, baseIndent);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Collect a left-nested apply chain: Apply(Apply(Apply(f, a), b), c) → [f, a, b, c]
function collectApplyChain(term: NashTerm<Name>): NashTerm<Name>[] {
  const args: NashTerm<Name>[] = [];
  let cursor: NashTerm<Name> = term;
  while (cursor.tag === "apply") {
    args.push(cursor.argument);
    cursor = cursor.function;
  }
  // args is [c, b, a], cursor is f
  args.reverse();
  return [cursor, ...args];
}

/** If `term` is a force chain around a BuiltinTerm with ≥ canonical forces,
 * return the bare-form render data. Null for under-forced or non-builtin. */
function analyzeForcedBuiltin(
  term: NashTerm<Name>,
): { function: DefaultFunction; extraForces: number } | null {
  let forces = 0;
  let cursor: NashTerm<Name> = term;
  while (cursor.tag === "force") {
    forces++;
    cursor = cursor.term;
  }
  if (cursor.tag !== "builtin") return null;
  const need = defaultFunctionForceCount(cursor.function);
  if (forces < need) return null;
  return { function: cursor.function, extraForces: forces - need };
}

// Compact (single-line) printing of a NashTerm<Name>. Used when the node fits
// within the line width. ConstantTerm is shared with UPLC, so we delegate to
// prettyPrintNamed; apply and let have Nash-specific forms.
function compactNash(term: NashTerm<Name>): string {
  type Frame =
    | { kind: "term"; term: NashTerm<Name> }
    | { kind: "str"; value: string };

  const parts: string[] = [];
  const stack: Frame[] = [{ kind: "term", term }];

  while (stack.length > 0) {
    const frame = stack.pop()!;

    if (frame.kind === "str") {
      parts.push(frame.value);
      continue;
    }

    const t = frame.term;
    switch (t.tag) {
      case "var":
        parts.push(t.name.text);
        break;
      case "lambda":
        stack.push({ kind: "str", value: ")" });
        stack.push({ kind: "term", term: t.body });
        stack.push({ kind: "str", value: `(lam ${t.parameter.text} ` });
        break;
      case "apply": {
        // Flatten left-nested apply chain
        const chain = collectApplyChain(t);
        stack.push({ kind: "str", value: "]" });
        for (let i = chain.length - 1; i >= 0; i--) {
          stack.push({ kind: "term", term: chain[i]! });
          if (i > 0) stack.push({ kind: "str", value: " " });
        }
        stack.push({ kind: "str", value: "[" });
        break;
      }
      case "delay":
        stack.push({ kind: "str", value: ")" });
        stack.push({ kind: "term", term: t.term });
        stack.push({ kind: "str", value: "(delay " });
        break;
      case "force": {
        const a = analyzeForcedBuiltin(t);
        if (a !== null) {
          for (let i = 0; i < a.extraForces; i++) parts.push("(force ");
          parts.push(a.function);
          for (let i = 0; i < a.extraForces; i++) parts.push(")");
        } else {
          stack.push({ kind: "str", value: ")" });
          stack.push({ kind: "term", term: t.term });
          stack.push({ kind: "str", value: "(force " });
        }
        break;
      }
      case "constr": {
        stack.push({ kind: "str", value: ")" });
        for (let i = t.fields.length - 1; i >= 0; i--) {
          stack.push({ kind: "term", term: t.fields[i]! });
          stack.push({ kind: "str", value: " " });
        }
        stack.push({ kind: "str", value: `(constr ${t.index}` });
        break;
      }
      case "case": {
        stack.push({ kind: "str", value: ")" });
        for (let i = t.branches.length - 1; i >= 0; i--) {
          stack.push({ kind: "term", term: t.branches[i]! });
          stack.push({ kind: "str", value: " " });
        }
        stack.push({ kind: "term", term: t.constr });
        stack.push({ kind: "str", value: "(case " });
        break;
      }
      case "constant":
        parts.push(prettyPrintNamed(t));
        break;
      case "builtin": {
        const a = analyzeForcedBuiltin(t);
        parts.push(a !== null ? a.function : `(builtin ${t.function})`);
        break;
      }
      case "error":
        parts.push("(error)");
        break;
      case "let": {
        const n = t.bindings.length;
        // (let [n0 v0 n1 v1 ...] BODY)
        stack.push({ kind: "str", value: ")" });
        stack.push({ kind: "term", term: t.body });
        stack.push({ kind: "str", value: " " });
        stack.push({ kind: "str", value: "]" });
        for (let i = n - 1; i >= 0; i--) {
          stack.push({ kind: "term", term: t.bindings[i]!.value });
          stack.push({
            kind: "str",
            value: `${t.bindings[i]!.name.text} `,
          });
          if (i > 0) stack.push({ kind: "str", value: " " });
        }
        stack.push({ kind: "str", value: "(let [" });
        break;
      }
    }
  }

  return parts.join("");
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

type MeasureFrame =
  | { kind: "visit-term"; term: NashTerm<Name> }
  | { kind: "combine-term"; term: CombineTerm; arity: number }
  | { kind: "combine-term-data-constant"; term: NashTerm<Name> }
  | { kind: "combine-apply-chain"; outerTerm: NashTerm<Name>; chainLen: number }
  | {
      kind: "combine-let";
      term: NashTerm<Name>;
      names: readonly string[];
    }
  | { kind: "visit-data"; data: PlutusData }
  | { kind: "combine-data"; data: CombineData; arity: number };

interface Widths {
  termWidths: Map<NashTerm<Name>, number>;
  dataWidths: Map<PlutusData, number>;
}

function measureWidths(root: NashTerm<Name>): Widths {
  const termWidths = new Map<NashTerm<Name>, number>();
  const dataWidths = new Map<PlutusData, number>();
  const widthStack: number[] = [];
  const stack: MeasureFrame[] = [{ kind: "visit-term", term: root }];

  while (stack.length > 0) {
    const frame = stack.pop()!;

    switch (frame.kind) {
      case "visit-term": {
        const t = frame.term;
        switch (t.tag) {
          case "var": {
            const w = t.name.text.length;
            termWidths.set(t, w);
            widthStack.push(w);
            break;
          }
          case "builtin": {
            const a = analyzeForcedBuiltin(t);
            const w = a !== null ? t.function.length : 10 + t.function.length;
            termWidths.set(t, w);
            widthStack.push(w);
            break;
          }
          case "error": {
            termWidths.set(t, 7); // "(error)"
            widthStack.push(7);
            break;
          }
          case "constant": {
            if (t.value.type === "data") {
              stack.push({ kind: "combine-term-data-constant", term: t });
              stack.push({ kind: "visit-data", data: t.value.value });
            } else {
              const w = prettyPrintNamed(t).length;
              termWidths.set(t, w);
              widthStack.push(w);
            }
            break;
          }
          case "lambda":
            stack.push({ kind: "combine-term", term: t, arity: 1 });
            stack.push({ kind: "visit-term", term: t.body });
            break;
          case "apply": {
            // Flatten apply chain for measurement
            const chain = collectApplyChain(t);
            stack.push({
              kind: "combine-apply-chain",
              outerTerm: t,
              chainLen: chain.length,
            });
            // Push all chain elements for measurement (reversed for correct stack order)
            for (let i = chain.length - 1; i >= 0; i--) {
              stack.push({ kind: "visit-term", term: chain[i]! });
            }
            break;
          }
          case "delay":
            stack.push({ kind: "combine-term", term: t, arity: 1 });
            stack.push({ kind: "visit-term", term: t.term });
            break;
          case "force": {
            const a = analyzeForcedBuiltin(t);
            if (a !== null) {
              // "(force " (7) + inner + ")" (1), per extraForces wrapper
              const w = 8 * a.extraForces + a.function.length;
              termWidths.set(t, w);
              widthStack.push(w);
            } else {
              stack.push({ kind: "combine-term", term: t, arity: 1 });
              stack.push({ kind: "visit-term", term: t.term });
            }
            break;
          }
          case "constr":
            stack.push({
              kind: "combine-term",
              term: t,
              arity: t.fields.length,
            });
            for (const f of t.fields)
              stack.push({ kind: "visit-term", term: f });
            break;
          case "case":
            stack.push({
              kind: "combine-term",
              term: t,
              arity: 1 + t.branches.length,
            });
            for (const b of t.branches)
              stack.push({ kind: "visit-term", term: b });
            stack.push({ kind: "visit-term", term: t.constr });
            break;
          case "let": {
            const names = t.bindings.map((b) => b.name.text);
            stack.push({ kind: "combine-let", term: t, names });
            // Push body then binding values
            stack.push({ kind: "visit-term", term: t.body });
            for (let i = t.bindings.length - 1; i >= 0; i--) {
              stack.push({ kind: "visit-term", term: t.bindings[i]!.value });
            }
            break;
          }
        }
        break;
      }

      case "combine-term": {
        const t = frame.term;
        const childW: number[] = [];
        for (let i = 0; i < frame.arity; i++) childW.push(widthStack.pop()!);
        let w: number;
        switch (t.tag) {
          case "lambda":
            // "(lam NAME BODY)" = 6 + nameLen + 1 + bodyW
            w = 7 + t.parameter.text.length + childW[0]!;
            break;
          case "delay":
          case "force":
            w = 8 + childW[0]!;
            break;
          case "constr": {
            const digits = String(t.index).length;
            let sum = 0;
            for (const fw of childW) sum += fw;
            w = 9 + digits + childW.length + sum;
            break;
          }
          case "case": {
            const cW = childW[childW.length - 1]!;
            let sumB = 0;
            for (let i = 0; i < childW.length - 1; i++) sumB += childW[i]!;
            const kB = childW.length - 1;
            w = 7 + cW + kB + sumB;
            break;
          }
        }
        termWidths.set(t, w);
        widthStack.push(w);
        break;
      }

      case "combine-apply-chain": {
        // [f a1 a2 ... aN] = 2 + sum(childWidths) + (N-1) spaces between
        const childW: number[] = [];
        for (let i = 0; i < frame.chainLen; i++) childW.push(widthStack.pop()!);
        let sum = 0;
        for (const cw of childW) sum += cw;
        // "[" + children separated by " " + "]" = 2 + sum + (N-1)
        const w = 2 + sum + (frame.chainLen - 1);
        termWidths.set(frame.outerTerm, w);
        widthStack.push(w);
        break;
      }

      case "combine-let": {
        // visit-term pushed body then bindings (in reverse), so body is on top,
        // followed by binding values in natural order down the stack.
        const bodyW = widthStack.pop()!;
        const n = frame.names.length;
        const valueWidths = new Array<number>(n);
        for (let i = n - 1; i >= 0; i--) {
          valueWidths[i] = widthStack.pop()!;
        }

        // "(let [n0 v0 n1 v1 ...] BODY)"
        // = 6 (prefix "(let [") + sum(nameLen + vW) + n (name/value space)
        //   + (n-1) (binding separators) + 1 ("]") + 1 (" ") + bodyW + 1 (")")
        // = 8 + sum(nameLen + vW) + 2n + bodyW
        let inner = 0;
        for (let i = 0; i < n; i++) {
          inner += frame.names[i]!.length + valueWidths[i]!;
        }
        const w = 8 + inner + 2 * n + bodyW;

        termWidths.set(frame.term, w);
        widthStack.push(w);
        break;
      }

      case "combine-term-data-constant": {
        const dataW = widthStack.pop()!;
        const w = 13 + dataW;
        termWidths.set(frame.term, w);
        widthStack.push(w);
        break;
      }

      case "visit-data": {
        const d = frame.data;
        switch (d.tag) {
          case "integer": {
            const w = 2 + String(d.value).length;
            dataWidths.set(d, w);
            widthStack.push(w);
            break;
          }
          case "bytestring": {
            const w = 3 + 2 * d.value.length;
            dataWidths.set(d, w);
            widthStack.push(w);
            break;
          }
          case "list":
            stack.push({
              kind: "combine-data",
              data: d,
              arity: d.values.length,
            });
            for (const v of d.values)
              stack.push({ kind: "visit-data", data: v });
            break;
          case "map":
            stack.push({
              kind: "combine-data",
              data: d,
              arity: 2 * d.entries.length,
            });
            for (const [k, v] of d.entries) {
              stack.push({ kind: "visit-data", data: v });
              stack.push({ kind: "visit-data", data: k });
            }
            break;
          case "constr":
            stack.push({
              kind: "combine-data",
              data: d,
              arity: d.fields.length,
            });
            for (const f of d.fields)
              stack.push({ kind: "visit-data", data: f });
            break;
        }
        break;
      }

      case "combine-data": {
        const d = frame.data;
        const childW: number[] = [];
        for (let i = 0; i < frame.arity; i++) childW.push(widthStack.pop()!);
        let w: number;
        switch (d.tag) {
          case "list": {
            let sum = 0;
            for (const cw of childW) sum += cw;
            const k = childW.length;
            w = k === 0 ? 7 : 7 + sum + 2 * (k - 1);
            break;
          }
          case "map": {
            let sum = 0;
            for (const cw of childW) sum += cw;
            const e = childW.length / 2;
            w = e === 0 ? 6 : 4 + 6 * e + sum;
            break;
          }
          case "constr": {
            const digits = String(d.index).length;
            let sum = 0;
            for (const cw of childW) sum += cw;
            const k = childW.length;
            w = k === 0 ? 10 + digits : 10 + digits + sum + 2 * (k - 1);
            break;
          }
        }
        dataWidths.set(d, w);
        widthStack.push(w);
        break;
      }
    }
  }

  return { termWidths, dataWidths };
}

// ---------------------------------------------------------------------------
// Emission
// ---------------------------------------------------------------------------

type EmitFrame =
  | { kind: "term"; term: NashTerm<Name>; indent: number }
  | { kind: "data"; data: PlutusData; indent: number }
  | { kind: "data-pair"; key: PlutusData; value: PlutusData; indent: number }
  | { kind: "str"; value: string }
  | { kind: "newline"; indent: number };

function emit(
  root: NashTerm<Name>,
  termWidths: Map<NashTerm<Name>, number>,
  dataWidths: Map<PlutusData, number>,
  maxWidth: number,
  baseIndent: number,
): string {
  const parts: string[] = [];
  const stack: EmitFrame[] = [{ kind: "term", term: root, indent: baseIndent }];

  while (stack.length > 0) {
    const frame = stack.pop()!;

    if (frame.kind === "str") {
      parts.push(frame.value);
      continue;
    }

    if (frame.kind === "newline") {
      parts.push("\n");
      if (frame.indent > 0) parts.push(" ".repeat(frame.indent));
      continue;
    }

    if (frame.kind === "term") {
      emitTerm(frame.term, frame.indent, parts, stack, termWidths, maxWidth);
      continue;
    }

    if (frame.kind === "data") {
      emitData(frame.data, frame.indent, parts, stack, dataWidths, maxWidth);
      continue;
    }

    // data-pair
    emitDataPair(
      frame.key,
      frame.value,
      frame.indent,
      parts,
      stack,
      dataWidths,
      maxWidth,
    );
  }

  return parts.join("");
}

function emitTerm(
  term: NashTerm<Name>,
  indent: number,
  parts: string[],
  stack: EmitFrame[],
  termWidths: Map<NashTerm<Name>, number>,
  maxWidth: number,
): void {
  const compactW = termWidths.get(term)!;

  if (indent + compactW <= maxWidth) {
    parts.push(compactNash(term));
    return;
  }

  // Sugar-aware: force-chains around builtins collapse to `(force^k name)`
  // and can't be broken further — emit compact regardless of width.
  const forcedBuiltin = analyzeForcedBuiltin(term);
  if (forcedBuiltin !== null) {
    parts.push(compactNash(term));
    return;
  }

  switch (term.tag) {
    case "var":
      parts.push(term.name.text);
      break;
    case "builtin":
      parts.push(`(builtin ${term.function})`);
      break;
    case "error":
      parts.push("(error)");
      break;
    case "constant": {
      if (term.value.type === "data") {
        const dataLineIndent = indent + 2;
        const dataIndent = dataLineIndent + 1;
        stack.push({ kind: "str", value: "))" });
        stack.push({
          kind: "data",
          data: term.value.value,
          indent: dataIndent,
        });
        stack.push({ kind: "str", value: "(" });
        stack.push({ kind: "newline", indent: dataLineIndent });
        stack.push({ kind: "str", value: "(con data" });
      } else {
        parts.push(prettyPrintNamed(term));
      }
      break;
    }
    case "lambda": {
      const childIndent = indent + 2;
      stack.push({ kind: "str", value: ")" });
      stack.push({ kind: "term", term: term.body, indent: childIndent });
      stack.push({ kind: "newline", indent: childIndent });
      stack.push({ kind: "str", value: `(lam ${term.parameter.text}` });
      break;
    }
    case "apply": {
      // Flatten apply chain
      const chain = collectApplyChain(term);
      // [f
      //   a1
      //   a2
      //   ...]
      const fnIndent = indent + 1;
      const argIndent = indent + 2;
      stack.push({ kind: "str", value: "]" });
      for (let i = chain.length - 1; i >= 1; i--) {
        stack.push({ kind: "term", term: chain[i]!, indent: argIndent });
        stack.push({ kind: "newline", indent: argIndent });
      }
      stack.push({ kind: "term", term: chain[0]!, indent: fnIndent });
      stack.push({ kind: "str", value: "[" });
      break;
    }
    case "delay":
    case "force": {
      const childIndent = indent + 2;
      const head = term.tag === "delay" ? "(delay" : "(force";
      stack.push({ kind: "str", value: ")" });
      stack.push({ kind: "term", term: term.term, indent: childIndent });
      stack.push({ kind: "newline", indent: childIndent });
      stack.push({ kind: "str", value: head });
      break;
    }
    case "constr": {
      const childIndent = indent + 2;
      stack.push({ kind: "str", value: ")" });
      for (let i = term.fields.length - 1; i >= 0; i--) {
        stack.push({
          kind: "term",
          term: term.fields[i]!,
          indent: childIndent,
        });
        stack.push({ kind: "newline", indent: childIndent });
      }
      stack.push({ kind: "str", value: `(constr ${term.index}` });
      break;
    }
    case "case": {
      const childIndent = indent + 2;
      const constrIndent = indent + 6;
      stack.push({ kind: "str", value: ")" });
      for (let i = term.branches.length - 1; i >= 0; i--) {
        stack.push({
          kind: "term",
          term: term.branches[i]!,
          indent: childIndent,
        });
        stack.push({ kind: "newline", indent: childIndent });
      }
      stack.push({ kind: "term", term: term.constr, indent: constrIndent });
      stack.push({ kind: "str", value: "(case " });
      break;
    }
    case "let": {
      // (let
      //   [x V0
      //    y V1]
      //   BODY)
      const n = term.bindings.length;
      const childIndent = indent + 2; // column of `[` and BODY
      const bindingsIndent = childIndent + 1; // column of the first char AFTER `[`
      stack.push({ kind: "str", value: ")" });
      stack.push({ kind: "term", term: term.body, indent: childIndent });
      stack.push({ kind: "newline", indent: childIndent });
      stack.push({ kind: "str", value: "]" });
      for (let i = n - 1; i >= 0; i--) {
        const binding = term.bindings[i]!;
        const namePrefix = `${binding.name.text} `;
        const valIndent = bindingsIndent + namePrefix.length;
        stack.push({ kind: "term", term: binding.value, indent: valIndent });
        stack.push({ kind: "str", value: namePrefix });
        if (i > 0) {
          stack.push({ kind: "newline", indent: bindingsIndent });
        }
      }
      stack.push({ kind: "str", value: "[" });
      stack.push({ kind: "newline", indent: childIndent });
      stack.push({ kind: "str", value: "(let" });
      break;
    }
  }
}

// --- Data emission (identical to UPLC formatter) ---

function emitData(
  data: PlutusData,
  indent: number,
  parts: string[],
  stack: EmitFrame[],
  dataWidths: Map<PlutusData, number>,
  maxWidth: number,
): void {
  const compactW = dataWidths.get(data)!;

  if (indent + compactW <= maxWidth) {
    parts.push(printPlutusData(data));
    return;
  }

  switch (data.tag) {
    case "integer":
    case "bytestring":
      parts.push(printPlutusData(data));
      break;
    case "list":
      pushDataItems(stack, "List [", data.values, indent);
      break;
    case "constr":
      pushDataItems(stack, `Constr ${data.index} [`, data.fields, indent);
      break;
    case "map":
      pushMapEntries(stack, data.entries, indent);
      break;
  }
}

function pushDataItems(
  stack: EmitFrame[],
  header: string,
  items: ReadonlyArray<PlutusData>,
  indent: number,
): void {
  if (items.length === 0) {
    stack.push({ kind: "str", value: `${header}]` });
    return;
  }
  const childIndent = indent + 2;
  stack.push({ kind: "str", value: "]" });
  stack.push({ kind: "newline", indent });
  for (let i = items.length - 1; i >= 0; i--) {
    stack.push({ kind: "data", data: items[i]!, indent: childIndent });
    stack.push({ kind: "newline", indent: childIndent });
    if (i > 0) stack.push({ kind: "str", value: "," });
  }
  stack.push({ kind: "str", value: header });
}

function pushMapEntries(
  stack: EmitFrame[],
  entries: ReadonlyArray<readonly [PlutusData, PlutusData]>,
  indent: number,
): void {
  if (entries.length === 0) {
    stack.push({ kind: "str", value: "Map []" });
    return;
  }
  const childIndent = indent + 2;
  stack.push({ kind: "str", value: "]" });
  stack.push({ kind: "newline", indent });
  for (let i = entries.length - 1; i >= 0; i--) {
    const [k, v] = entries[i]!;
    stack.push({
      kind: "data-pair",
      key: k,
      value: v,
      indent: childIndent,
    });
    if (i > 0) {
      stack.push({ kind: "newline", indent: childIndent });
      stack.push({ kind: "str", value: "," });
    } else {
      stack.push({ kind: "newline", indent: childIndent });
    }
  }
  stack.push({ kind: "str", value: "Map [" });
}

function emitDataPair(
  key: PlutusData,
  value: PlutusData,
  indent: number,
  parts: string[],
  stack: EmitFrame[],
  dataWidths: Map<PlutusData, number>,
  maxWidth: number,
): void {
  const kW = dataWidths.get(key)!;
  const vW = dataWidths.get(value)!;
  const compact = 4 + kW + vW;

  if (indent + compact <= maxWidth) {
    parts.push(`(${printPlutusData(key)}, ${printPlutusData(value)})`);
    return;
  }

  const valueIndent = indent + 2;
  stack.push({ kind: "str", value: ")" });
  stack.push({ kind: "data", data: value, indent: valueIndent });
  stack.push({ kind: "newline", indent: valueIndent });
  stack.push({ kind: "str", value: "," });
  stack.push({ kind: "data", data: key, indent: indent + 1 });
  stack.push({ kind: "str", value: "(" });
}
