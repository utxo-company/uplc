import type { Component } from "svelte";

export type CommandGroup = "Actions" | "Tools" | "Import" | "Export";

export interface CommandContext {
  getSource: () => string;
  setSource: (next: string) => void;
  runProgram: () => void;
  openCborDatumDecoder: () => void;
  openApplyArgDialog: () => void;
  openExportDialog: () => void;
}

export interface Command {
  id: string;
  label: string;
  group: CommandGroup;
  icon?: Component;
  keywords?: string[];
  shortcut?: string;
  run: (ctx: CommandContext) => void | Promise<void>;
}
