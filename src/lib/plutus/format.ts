import type { Name, PlutusData, Term } from "./types";
import { prettyPrintNamed, printPlutusData } from "./pretty";

export interface FormatOptions {
  readonly maxWidth?: number;
  readonly baseIndent?: number;
}

// Width-aware pretty printer for named terms. Two iterative passes:
//   1. measure — compute each node's compact (single-line) width bottom-up and
//      store in a Map keyed by node identity. Walks both the term tree and
//      any PlutusData payloads inside `(con data ...)` constants.
//   2. emit    — walk the tree with an explicit stack. If `indent + compactW`
//      fits under `maxWidth`, emit the compact form; otherwise break the node
//      and recurse on its children at a deeper indent.
//
// Both passes use explicit work stacks so deeply nested Plutus scripts don't
// blow the JS call stack.
export function formatNamed(root: Term<Name>, options?: FormatOptions): string {
  const maxWidth = options?.maxWidth ?? 80;
  const baseIndent = options?.baseIndent ?? 0;

  const { termWidths, dataWidths } = measureWidths(root);
  return emit(root, termWidths, dataWidths, maxWidth, baseIndent);
}

// --- Measurement ----------------------------------------------------------

type MeasureFrame =
  | { kind: "visit-term"; term: Term<Name> }
  | { kind: "combine-term"; term: Term<Name>; arity: number }
  | { kind: "combine-term-data-constant"; term: Term<Name> }
  | { kind: "visit-data"; data: PlutusData }
  | { kind: "combine-data"; data: PlutusData; arity: number };

interface Widths {
  termWidths: Map<Term<Name>, number>;
  dataWidths: Map<PlutusData, number>;
}

function measureWidths(root: Term<Name>): Widths {
  const termWidths = new Map<Term<Name>, number>();
  const dataWidths = new Map<PlutusData, number>();
  const widthStack: number[] = [];
  const stack: MeasureFrame[] = [{ kind: "visit-term", term: root }];

  while (stack.length > 0) {
    const frame = stack.pop()!;

    switch (frame.kind) {
      case "visit-term": {
        const t = frame.term;
        switch (t.tag) {
          case "var":
          case "builtin":
          case "error": {
            const w = prettyPrintNamed(t).length;
            termWidths.set(t, w);
            widthStack.push(w);
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
          case "apply":
            stack.push({ kind: "combine-term", term: t, arity: 2 });
            stack.push({ kind: "visit-term", term: t.argument });
            stack.push({ kind: "visit-term", term: t.function });
            break;
          case "delay":
          case "force":
            stack.push({ kind: "combine-term", term: t, arity: 1 });
            stack.push({ kind: "visit-term", term: t.term });
            break;
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
            // "(lam NAME BODY)" = 7 + nameLen + bodyW
            w = 7 + t.parameter.text.length + childW[0]!;
            break;
          case "apply":
            // "[F A]" = 3 + fnW + argW (function popped first → childW[1])
            w = 3 + childW[1]! + childW[0]!;
            break;
          case "delay":
          case "force":
            // "(delay X)" = 8 + X
            w = 8 + childW[0]!;
            break;
          case "constr": {
            const digits = String(t.index).length;
            let sum = 0;
            for (const fw of childW) sum += fw;
            // "(constr N)" with 0 fields = 9 + digits
            // "(constr N F0 ... Fk-1)" = 9 + digits + k + sumF
            w = 9 + digits + childW.length + sum;
            break;
          }
          case "case": {
            // childW = [b0, b1, ..., b_{k-1}, constr] (constr popped last)
            const cW = childW[childW.length - 1]!;
            let sumB = 0;
            for (let i = 0; i < childW.length - 1; i++) sumB += childW[i]!;
            const kB = childW.length - 1;
            w = 7 + cW + kB + sumB;
            break;
          }
          default:
            throw new Error(`format: unexpected combine-term for tag ${t.tag}`);
        }
        termWidths.set(t, w);
        widthStack.push(w);
        break;
      }

      case "combine-term-data-constant": {
        const dataW = widthStack.pop()!;
        // "(con data (X))" = 13 + dataW
        const w = 13 + dataW;
        termWidths.set(frame.term, w);
        widthStack.push(w);
        break;
      }

      case "visit-data": {
        const d = frame.data;
        switch (d.tag) {
          case "integer": {
            // "I N" = 2 + digits
            const w = 2 + String(d.value).length;
            dataWidths.set(d, w);
            widthStack.push(w);
            break;
          }
          case "bytestring": {
            // "B #abc..." = 3 + 2 * byteLen
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
            // "List []" = 7
            // "List [c0, ..., c_{k-1}]" = 7 + sum + 2*(k-1)
            let sum = 0;
            for (const cw of childW) sum += cw;
            const k = childW.length;
            w = k === 0 ? 7 : 7 + sum + 2 * (k - 1);
            break;
          }
          case "map": {
            // "Map []" = 6
            // "Map [(k0, v0), (k1, v1), ...]" = 4 + 6e + sum(kw+vw)
            let sum = 0;
            for (const cw of childW) sum += cw;
            const e = childW.length / 2;
            w = e === 0 ? 6 : 4 + 6 * e + sum;
            break;
          }
          case "constr": {
            // "Constr N []" = 10 + digits
            // "Constr N [f0, ..., f_{k-1}]" = 10 + digits + sum + 2*(k-1)
            const digits = String(d.index).length;
            let sum = 0;
            for (const cw of childW) sum += cw;
            const k = childW.length;
            w = k === 0 ? 10 + digits : 10 + digits + sum + 2 * (k - 1);
            break;
          }
          default:
            throw new Error(`format: unexpected combine-data for tag ${d.tag}`);
        }
        dataWidths.set(d, w);
        widthStack.push(w);
        break;
      }
    }
  }

  return { termWidths, dataWidths };
}

// --- Emission -------------------------------------------------------------

type EmitFrame =
  | { kind: "term"; term: Term<Name>; indent: number }
  | { kind: "data"; data: PlutusData; indent: number }
  | { kind: "data-pair"; key: PlutusData; value: PlutusData; indent: number }
  | { kind: "str"; value: string }
  | { kind: "newline"; indent: number };

function emit(
  root: Term<Name>,
  termWidths: Map<Term<Name>, number>,
  dataWidths: Map<PlutusData, number>,
  maxWidth: number,
  baseIndent: number,
): string {
  const parts: string[] = [];
  const stack: EmitFrame[] = [
    { kind: "term", term: root, indent: baseIndent },
  ];

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
  term: Term<Name>,
  indent: number,
  parts: string[],
  stack: EmitFrame[],
  termWidths: Map<Term<Name>, number>,
  maxWidth: number,
): void {
  const compactW = termWidths.get(term)!;

  if (indent + compactW <= maxWidth) {
    parts.push(prettyPrintNamed(term));
    return;
  }

  switch (term.tag) {
    case "var":
    case "builtin":
    case "error":
      // Atomic — no structure to break.
      parts.push(prettyPrintNamed(term));
      break;
    case "constant": {
      if (term.value.type === "data") {
        // Break: (con data\n  (DATA))
        const dataLineIndent = indent + 2;
        const dataIndent = dataLineIndent + 1; // account for the "(" before data
        stack.push({ kind: "str", value: "))" });
        stack.push({ kind: "data", data: term.value.value, indent: dataIndent });
        stack.push({ kind: "str", value: "(" });
        stack.push({ kind: "newline", indent: dataLineIndent });
        stack.push({ kind: "str", value: "(con data" });
      } else {
        // Non-data constants are atomic textually.
        parts.push(prettyPrintNamed(term));
      }
      break;
    }
    case "lambda": {
      // (lam NAME
      //   BODY)
      const childIndent = indent + 2;
      stack.push({ kind: "str", value: ")" });
      stack.push({ kind: "term", term: term.body, indent: childIndent });
      stack.push({ kind: "newline", indent: childIndent });
      stack.push({ kind: "str", value: `(lam ${term.parameter.text}` });
      break;
    }
    case "apply": {
      // [F
      //   A]
      const fnIndent = indent + 1; // function follows "[" on same line
      const argIndent = indent + 2;
      stack.push({ kind: "str", value: "]" });
      stack.push({ kind: "term", term: term.argument, indent: argIndent });
      stack.push({ kind: "newline", indent: argIndent });
      stack.push({ kind: "term", term: term.function, indent: fnIndent });
      stack.push({ kind: "str", value: "[" });
      break;
    }
    case "delay":
    case "force": {
      // (delay
      //   X)
      const childIndent = indent + 2;
      const head = term.tag === "delay" ? "(delay" : "(force";
      stack.push({ kind: "str", value: ")" });
      stack.push({ kind: "term", term: term.term, indent: childIndent });
      stack.push({ kind: "newline", indent: childIndent });
      stack.push({ kind: "str", value: head });
      break;
    }
    case "constr": {
      // (constr N
      //   F0
      //   F1)
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
      // (case C
      //   B0
      //   B1)
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
  }
}

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
      // Atomic.
      parts.push(printPlutusData(data));
      break;
    case "list":
      // List [
      //   v0,
      //   v1
      // ]
      pushDataItems(stack, "List [", data.values, indent);
      break;
    case "constr":
      // Constr N [
      //   f0,
      //   f1
      // ]
      pushDataItems(stack, `Constr ${data.index} [`, data.fields, indent);
      break;
    case "map":
      // Map [
      //   (k0, v0),
      //   (k1, v1)
      // ]
      pushMapEntries(stack, data.entries, indent);
      break;
  }
}

// Push frames for emitting an array-shaped data node ("List", "Constr N").
// Each item is followed by "," except the last; the closing "]" sits at the
// container's indent on its own line.
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
  // Compact pair: "(KEY, VALUE)" = 4 + kW + vW
  const kW = dataWidths.get(key)!;
  const vW = dataWidths.get(value)!;
  const compact = 4 + kW + vW;

  if (indent + compact <= maxWidth) {
    parts.push(`(${printPlutusData(key)}, ${printPlutusData(value)})`);
    return;
  }

  // Broken:
  //   (KEY,
  //     VALUE)
  const valueIndent = indent + 2;
  stack.push({ kind: "str", value: ")" });
  stack.push({ kind: "data", data: value, indent: valueIndent });
  stack.push({ kind: "newline", indent: valueIndent });
  stack.push({ kind: "str", value: "," });
  stack.push({ kind: "data", data: key, indent: indent + 1 });
  stack.push({ kind: "str", value: "(" });
}
