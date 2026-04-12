<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import { Textarea } from "$lib/components/ui/textarea";
  import { decodePlutusData, plutusDataToConstantText } from "$lib/plutus";
  import type { PlutusData } from "$lib/plutus";
  import { PersistedState } from "runed";
  import {
    bytesToHex,
    errorMessage,
    hexToBytes,
    notifyError,
    notifySuccess,
    pickFileAsBytes,
  } from "./commands/_io";
  import Copy from "@lucide/svelte/icons/copy";
  import FileDown from "@lucide/svelte/icons/file-down";
  import Eraser from "@lucide/svelte/icons/eraser";

  interface Props {
    open: boolean;
  }

  let { open = $bindable() }: Props = $props();

  const cborInput = new PersistedState<string>(
    "playground:cbor-datum-decoder:input",
    "",
  );

  // Decode bytes as PlutusData. If the raw decode yields a top-level bytestring
  // whose payload is itself a valid PlutusData encoding, prefer the unwrapped
  // form — this transparently handles datums shipped inside a CBOR bytestring
  // wrapper (cardano-cli style) without changing the behavior for the common
  // case of raw on-chain datums.
  function decodeBytesToData(bytes: Uint8Array): PlutusData {
    const raw = decodePlutusData(bytes);
    if (raw.tag === "bytestring") {
      try {
        return decodePlutusData(raw.value);
      } catch {
        // Inner decode failed — the bytestring is a real datum value.
      }
    }
    return raw;
  }

  const decoded = $derived.by<
    { ok: true; text: string } | { ok: false; error: string } | null
  >(() => {
    const trimmed = cborInput.current.trim();
    if (trimmed.length === 0) return null;
    try {
      const bytes = hexToBytes(trimmed);
      const data = decodeBytesToData(bytes);
      return { ok: true, text: plutusDataToConstantText(data) };
    } catch (err) {
      return { ok: false, error: errorMessage(err) };
    }
  });

  const uplcText = $derived(decoded?.ok ? decoded.text : "");
  const errorText = $derived(decoded && !decoded.ok ? decoded.error : null);

  async function importFromFile() {
    try {
      const picked = await pickFileAsBytes(
        ".cbor,.hex,.txt,.datum,text/plain,application/octet-stream",
      );
      if (!picked) return;

      // If the file looks like hex text, keep it verbatim so the user sees the
      // exact characters they imported. Otherwise treat as raw bytes and render
      // them as hex.
      const asText = new TextDecoder("utf-8", { fatal: false })
        .decode(picked.bytes)
        .trim();
      const cleaned = asText.replace(/^0x/i, "").replace(/\s+/g, "");
      const looksLikeHex =
        cleaned.length > 0 &&
        cleaned.length % 2 === 0 &&
        /^[0-9a-fA-F]+$/.test(cleaned);

      cborInput.current = looksLikeHex ? asText : bytesToHex(picked.bytes);
      notifySuccess("Imported datum", picked.name);
    } catch (err) {
      notifyError("Import failed", errorMessage(err));
    }
  }

  async function copyOutput() {
    if (!uplcText) return;
    try {
      await navigator.clipboard.writeText(uplcText);
      notifySuccess("Copied to clipboard");
    } catch (err) {
      notifyError("Copy failed", errorMessage(err));
    }
  }

  function clearInput() {
    cborInput.current = "";
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content
    class="max-h-[90vh] w-[95vw] max-w-[1400px] gap-3 sm:max-w-[1400px]"
  >
    <Dialog.Header>
      <Dialog.Title>CBOR Datum Decoder</Dialog.Title>
      <Dialog.Description>
        Paste a CBOR-encoded Plutus datum (hex). The decoded UPLC constant
        appears on the right.
      </Dialog.Description>
    </Dialog.Header>

    <div class="grid gap-3 md:grid-cols-2">
      <div class="flex min-w-0 flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-muted-foreground">
            CBOR (hex)
          </span>
          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onclick={importFromFile}
              title="Import from file"
            >
              <FileDown />
              Import
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onclick={clearInput}
              disabled={cborInput.current.length === 0}
              title="Clear input"
            >
              <Eraser />
              Clear
            </Button>
          </div>
        </div>
        <Textarea
          bind:value={cborInput.current}
          placeholder="d8799f1864ff…"
          spellcheck={false}
          class="h-[65vh] resize-none font-mono text-xs"
        />
        {#if errorText}
          <p class="text-xs text-destructive">{errorText}</p>
        {/if}
      </div>

      <div class="flex min-w-0 flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-muted-foreground">
            UPLC constant
          </span>
          <Button
            variant="ghost"
            size="sm"
            onclick={copyOutput}
            disabled={uplcText.length === 0}
            title="Copy to clipboard"
          >
            <Copy />
            Copy
          </Button>
        </div>
        <Textarea
          value={uplcText}
          readonly
          placeholder="(con data (…))"
          spellcheck={false}
          class="h-[65vh] resize-none font-mono text-xs"
        />
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>
