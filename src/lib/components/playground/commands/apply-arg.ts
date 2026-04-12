import SquarePlus from "@lucide/svelte/icons/square-plus";
import type { Command } from "./types";

export const applyArgCommand: Command = {
  id: "apply-arg",
  label: "Apply Arg",
  group: "Actions",
  icon: SquarePlus,
  keywords: ["apply", "argument", "arg", "wrap"],
  run: (ctx) => {
    ctx.openApplyArgDialog();
  },
};
