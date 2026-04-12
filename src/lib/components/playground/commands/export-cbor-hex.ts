import FileUp from "@lucide/svelte/icons/file-up";
import type { Command } from "./types";
import {
  bytesToHex,
  errorMessage,
  notifyError,
  notifySuccess,
  saveText,
  wrapCborScript,
} from "./_io";
import { sourceToFlat } from "./_program";

export const exportCborHexCommand: Command = {
  id: "export.cbor-hex",
  label: "Export to File (CBOR Hex)",
  group: "Export",
  icon: FileUp,
  keywords: ["save", "download", "cbor", "script", "cardano"],
  run: (ctx) => {
    try {
      const flat = sourceToFlat(ctx.getSource());
      const wrapped = wrapCborScript(flat);
      saveText("program.cbor.hex", bytesToHex(wrapped));
      notifySuccess("Exported CBOR hex file", "program.cbor.hex");
    } catch (err) {
      notifyError("CBOR hex export failed", errorMessage(err));
    }
  },
};
