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
