import {
  decodeFlatDeBruijn,
  deBruijnToName,
  encodeFlatDeBruijn,
  nameToDeBruijn,
  parse,
  prettyPrintNamed,
  type Program,
  type DeBruijn,
} from "$lib/plutus";

// Wrap a decoded DeBruijn program as textual UPLC source the editor can hold.
// `deBruijnToName` assigns every binder a globally fresh name so the output
// round-trips cleanly through the parser even under nested shadowing.
export function programToSource(program: Program<DeBruijn>): string {
  const named = deBruijnToName(program);
  const { major, minor, patch } = named.version;
  return `(program ${major}.${minor}.${patch}\n  ${prettyPrintNamed(named.term)})\n`;
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
