import FileUp from "@lucide/svelte/icons/file-up";
import type { Command } from "./types";
import {
  bytesToHex,
  errorMessage,
  notifyError,
  notifySuccess,
  saveText,
} from "./_io";
import { sourceToFlat } from "./_program";

export const exportHexCommand: Command = {
  id: "export.hex",
  label: "Export to File (Hex)",
  group: "Export",
  icon: FileUp,
  keywords: ["save", "download", "hex", "flat"],
  run: (ctx) => {
    try {
      const flat = sourceToFlat(ctx.getSource());
      saveText("program.hex", bytesToHex(flat));
      notifySuccess("Exported hex file", "program.hex");
    } catch (err) {
      notifyError("Hex export failed", errorMessage(err));
    }
  },
};
