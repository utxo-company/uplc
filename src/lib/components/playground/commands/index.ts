import type { Command, CommandGroup } from "./types";
import { runCommand } from "./run";
import { importCommand } from "./import";
import { exportHexCommand } from "./export-hex";
import { exportFlatCommand } from "./export-flat";
import { exportCborHexCommand } from "./export-cbor-hex";

export type { Command, CommandContext, CommandGroup } from "./types";

export const commands: Command[] = [
  runCommand,
  importCommand,
  exportHexCommand,
  exportFlatCommand,
  exportCborHexCommand,
];

export const commandGroupOrder: CommandGroup[] = [
  "Actions",
  "Import",
  "Export",
];
