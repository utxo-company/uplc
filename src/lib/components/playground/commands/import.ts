import FileDown from "@lucide/svelte/icons/file-down";
import type { Command } from "./types";
import {
  errorMessage,
  hexToBytes,
  notifyError,
  notifySuccess,
  pickFileAsBytes,
  unwrapCborScript,
} from "./_io";
import { flatToSource } from "./_program";

type Format = "CBOR hex" | "hex" | "flat";

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

      const text = new TextDecoder("utf-8", { fatal: false }).decode(
        picked.bytes,
      );

      // Ordered most-specific to least-specific. CBOR hex is the most
      // distinctive format (hex text + CBOR bytestring header); plain hex is
      // next; raw flat bytes are the fallback. First successful decode wins.
      const attempts: { format: Format; run: () => string }[] = [
        {
          format: "CBOR hex",
          run: () => flatToSource(unwrapCborScript(hexToBytes(text))),
        },
        {
          format: "hex",
          run: () => flatToSource(hexToBytes(text)),
        },
        {
          format: "flat",
          run: () => flatToSource(picked.bytes),
        },
      ];

      const errors: string[] = [];
      for (const attempt of attempts) {
        try {
          const source = attempt.run();
          ctx.setSource(source);
          notifySuccess("Imported file", `${picked.name} · ${attempt.format}`);
          return;
        } catch (err) {
          errors.push(`${attempt.format}: ${errorMessage(err)}`);
        }
      }

      notifyError(
        "Import failed",
        `Could not detect format. Tried — ${errors.join("; ")}`,
      );
    } catch (err) {
      notifyError("Import failed", errorMessage(err));
    }
  },
};
