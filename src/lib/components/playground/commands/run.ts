import Play from "@lucide/svelte/icons/play";
import type { Command } from "./types";

export const runCommand: Command = {
  id: "run",
  label: "Run",
  group: "Actions",
  icon: Play,
  keywords: ["evaluate", "execute"],
  run: (ctx) => {
    ctx.runProgram();
  },
};
