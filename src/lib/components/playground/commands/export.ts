import FileUp from "@lucide/svelte/icons/file-up";
import type { Command } from "./types";

export const exportCommand: Command = {
  id: "export",
  label: "Export to File",
  group: "Export",
  icon: FileUp,
  keywords: ["save", "download", "hex", "flat", "cbor"],
  run: (ctx) => {
    ctx.openExportDialog();
  },
};
