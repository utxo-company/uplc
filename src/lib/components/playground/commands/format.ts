import Sparkles from "@lucide/svelte/icons/sparkles";
import type { Command } from "./types";
import { errorMessage, notifyError, notifySuccess } from "./_io";
import { formatSource } from "./_program";

export const formatCommand: Command = {
  id: "format",
  label: "Format",
  group: "Actions",
  icon: Sparkles,
  keywords: ["pretty", "prettier", "indent", "reformat"],
  run: (ctx) => {
    try {
      const formatted = formatSource(ctx.getSource());
      ctx.setSource(formatted);
      notifySuccess("Formatted source");
    } catch (err) {
      notifyError("Format failed", errorMessage(err));
    }
  },
};
