import FileUp from "@lucide/svelte/icons/file-up";
import type { Command } from "./types";
import { errorMessage, notifyError, notifySuccess, saveBytes } from "./_io";
import { sourceToFlat } from "./_program";

export const exportFlatCommand: Command = {
  id: "export.flat",
  label: "Export to File (Flat)",
  group: "Export",
  icon: FileUp,
  keywords: ["save", "download", "binary", "flat"],
  run: (ctx) => {
    try {
      const flat = sourceToFlat(ctx.getSource());
      saveBytes("program.flat", flat);
      notifySuccess("Exported flat file", "program.flat");
    } catch (err) {
      notifyError("Flat export failed", errorMessage(err));
    }
  },
};
