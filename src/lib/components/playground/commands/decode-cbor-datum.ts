import Binary from "@lucide/svelte/icons/binary";
import type { Command } from "./types";

export const decodeCborDatumCommand: Command = {
  id: "decode-cbor-datum",
  label: "CBOR Datum Decoder",
  group: "Tools",
  icon: Binary,
  keywords: ["cbor", "datum", "decode", "plutus", "data"],
  run: (ctx) => {
    ctx.openCborDatumDecoder();
  },
};
