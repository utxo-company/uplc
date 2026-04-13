import type { Command, CommandGroup } from "./types";
import { runCommand } from "./run";
import { formatCommand } from "./format";
import { applyArgCommand } from "./apply-arg";
import { decodeCborDatumCommand } from "./decode-cbor-datum";
import { importCommand } from "./import";
import { exportCommand } from "./export";

export type { ActiveTab, Command, CommandContext, CommandGroup } from "./types";

export const commands: Command[] = [
  runCommand,
  formatCommand,
  applyArgCommand,
  decodeCborDatumCommand,
  importCommand,
  exportCommand,
];

export const commandGroupOrder: CommandGroup[] = [
  "Actions",
  "Tools",
  "Import",
  "Export",
];
