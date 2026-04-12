import FileDown from "@lucide/svelte/icons/file-down";
import type { Command } from "./types";
import {
  errorMessage,
  notifyError,
  notifySuccess,
  pickFileAsBytes,
} from "./_io";
import { autoDecodeProgram, programToSource } from "./_program";

export const importCommand: Command = {
  id: "import",
  label: "Import from File",
  group: "Import",
  icon: FileDown,
  keywords: ["open", "load", "hex", "flat", "cbor", "auto"],
  run: async (ctx) => {
    try {
      const picked = await pickFileAsBytes(
        ".hex,.flat,.cbor,.txt,text/plain,application/octet-stream",
      );
      if (!picked) return;

      const { program, format } = autoDecodeProgram(picked);
      ctx.setSource(programToSource(program));
      notifySuccess("Imported file", `${picked.name} · ${format}`);
    } catch (err) {
      notifyError("Import failed", errorMessage(err));
    }
  },
};
