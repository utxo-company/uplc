import {
  decodeFlatDeBruijn,
  deBruijnToName,
  encodeFlatDeBruijn,
  formatNamed,
  nameToDeBruijn,
  parse,
  type Program,
  type DeBruijn,
} from "$lib/plutus";
import { parseNash, formatNash } from "$lib/nash";
import {
  bytesToHex,
  errorMessage,
  hexToBytes,
  unwrapCborScript,
  wrapCborScript,
} from "./_io";

export type ProgramFormat = "CBOR hex" | "hex" | "flat";

export type ExportFormat = "hex" | "flat" | "cbor-hex";

export type EncodedProgram =
  | { kind: "text"; text: string }
  | { kind: "bytes"; bytes: Uint8Array };

export const exportFormatExtension: Record<ExportFormat, string> = {
  hex: ".hex",
  flat: ".flat",
  "cbor-hex": ".cbor.hex",
};

export const exportFormatLabel: Record<ExportFormat, string> = {
  hex: "Hex",
  flat: "Flat",
  "cbor-hex": "CBOR Hex",
};

// Encode the current source as the requested binary script format. Throws if
// the source does not parse / convert.
export function encodeProgramAs(
  source: string,
  format: ExportFormat,
): EncodedProgram {
  const flat = sourceToFlat(source);
  switch (format) {
    case "hex":
      return { kind: "text", text: bytesToHex(flat) };
    case "flat":
      return { kind: "bytes", bytes: flat };
    case "cbor-hex":
      return { kind: "text", text: bytesToHex(wrapCborScript(flat)) };
  }
}

// Wrap a decoded DeBruijn program as textual UPLC source the editor can hold.
// `deBruijnToName` assigns every binder a globally fresh name so the output
// round-trips cleanly through the parser even under nested shadowing;
// `formatNamed` then breaks long subterms across lines so deeply nested
// scripts stay readable.
export function programToSource(program: Program<DeBruijn>): string {
  const named = deBruijnToName(program);
  const { major, minor, patch } = named.version;
  const body = formatNamed(named.term, { maxWidth: 80, baseIndent: 2 });
  return `(program ${major}.${minor}.${patch}\n  ${body})\n`;
}

export function sourceToFlat(source: string): Uint8Array {
  const named = parse(source);
  const debruijn = nameToDeBruijn(named);
  return encodeFlatDeBruijn(debruijn);
}

export function flatToSource(bytes: Uint8Array): string {
  const program = decodeFlatDeBruijn(bytes);
  return programToSource(program);
}

// Re-format an existing source string. Parses, then emits via the
// width-aware formatter directly on the parsed Program<Name> so the user's
// chosen names are preserved (no DeBruijn round-trip).
export function formatSource(source: string): string {
  const parsed = parse(source);
  const { major, minor, patch } = parsed.version;
  const body = formatNamed(parsed.term, { maxWidth: 80, baseIndent: 2 });
  return `(program ${major}.${minor}.${patch}\n  ${body})\n`;
}

// Re-format Nash source. Parses as Nash, then emits via the Nash formatter.
export function formatNashSource(source: string): string {
  const parsed = parseNash(source);
  const { major, minor, patch } = parsed.version;
  const body = formatNash(parsed.term, { maxWidth: 80, baseIndent: 2 });
  return `(program ${major}.${minor}.${patch}\n  ${body})\n`;
}

// Try every supported binary script encoding (CBOR-wrapped hex, plain hex,
// raw flat) and return the first that decodes successfully along with the
// detected format. Throws with a per-format error breakdown if all fail.
export function autoDecodeProgram(picked: {
  name: string;
  bytes: Uint8Array;
}): { program: Program<DeBruijn>; format: ProgramFormat } {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(picked.bytes);

  const attempts: { format: ProgramFormat; getBytes: () => Uint8Array }[] = [
    { format: "CBOR hex", getBytes: () => unwrapCborScript(hexToBytes(text)) },
    { format: "hex", getBytes: () => hexToBytes(text) },
    { format: "flat", getBytes: () => picked.bytes },
  ];

  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      const bytes = attempt.getBytes();
      const program = decodeFlatDeBruijn(bytes);
      return { program, format: attempt.format };
    } catch (err) {
      errors.push(`${attempt.format}: ${errorMessage(err)}`);
    }
  }
  throw new Error(`Could not detect format. Tried — ${errors.join("; ")}`);
}
