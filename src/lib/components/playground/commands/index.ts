import type { Command, CommandGroup } from "./types";
import { runCommand } from "./run";
import { formatCommand } from "./format";
import { applyArgCommand } from "./apply-arg";
import { decodeCborDatumCommand } from "./decode-cbor-datum";
import { importCommand } from "./import";
import { exportHexCommand } from "./export-hex";
import { exportFlatCommand } from "./export-flat";
import { exportCborHexCommand } from "./export-cbor-hex";

export type { Command, CommandContext, CommandGroup } from "./types";

export const commands: Command[] = [
  runCommand,
  formatCommand,
  applyArgCommand,
  decodeCborDatumCommand,
  importCommand,
  exportHexCommand,
  exportFlatCommand,
  exportCborHexCommand,
];

export const commandGroupOrder: CommandGroup[] = [
  "Actions",
  "Tools",
  "Import",
  "Export",
];
