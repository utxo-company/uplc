import type { Component } from "svelte";

export type CommandGroup = "Actions" | "Tools" | "Import" | "Export";

export type ActiveTab = "source" | "nash";

export interface CommandContext {
  getSource: () => string;
  setSource: (next: string) => void;
  getActiveTab: () => ActiveTab;
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
