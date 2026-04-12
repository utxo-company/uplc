<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import {
    encodeProgramAs,
    exportFormatExtension,
    exportFormatLabel,
    type ExportFormat,
  } from "./commands/_program";
  import {
    errorMessage,
    notifySuccess,
    saveBytes,
    saveText,
  } from "./commands/_io";

  interface Props {
    open: boolean;
    getSource: () => string;
  }

  let { open = $bindable(), getSource }: Props = $props();

  const FORMATS: ExportFormat[] = ["hex", "flat", "cbor-hex"];

  let format = $state<ExportFormat>("hex");
  let basename = $state("program");
  let errorText = $state<string | null>(null);

  const filename = $derived(`${basename}${exportFormatExtension[format]}`);

  function selectFormat(next: ExportFormat) {
    format = next;
    errorText = null;
  }

  function handleExport() {
    errorText = null;
    let encoded;
    try {
      encoded = encodeProgramAs(getSource(), format);
    } catch (err) {
      errorText = errorMessage(err);
      return;
    }

    try {
      if (encoded.kind === "text") {
        saveText(filename, encoded.text);
      } else {
        saveBytes(filename, encoded.bytes);
      }
      notifySuccess(
        "Exported file",
        `${filename} · ${exportFormatLabel[format]}`,
      );
      open = false;
    } catch (err) {
      errorText = errorMessage(err);
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-w-[480px] gap-4">
    <Dialog.Header>
      <Dialog.Title>Export Program</Dialog.Title>
      <Dialog.Description>
        Encode the current source as a binary script and download it.
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex flex-col gap-2">
      <span class="text-xs font-medium text-muted-foreground">Format</span>
      <div class="grid grid-cols-3 gap-2">
        {#each FORMATS as f (f)}
          <Button
            variant={format === f ? "default" : "outline"}
            size="sm"
            onclick={() => selectFormat(f)}
          >
            {exportFormatLabel[f]}
          </Button>
        {/each}
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <span class="text-xs font-medium text-muted-foreground">Filename</span>
      <div class="flex items-center gap-1">
        <Input
          bind:value={basename}
          spellcheck={false}
          class="font-mono text-xs"
        />
        <span class="font-mono text-xs text-muted-foreground">
          {exportFormatExtension[format]}
        </span>
      </div>
    </div>

    {#if errorText}
      <p class="text-xs text-destructive">{errorText}</p>
    {/if}

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
      <Button onclick={handleExport} disabled={basename.trim().length === 0}>
        Export
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
