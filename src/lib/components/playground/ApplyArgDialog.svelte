<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import { Textarea } from "$lib/components/ui/textarea";
  import {
    deBruijnTermToName,
    formatNamed,
    parse,
    type Name,
    type Term,
  } from "$lib/plutus";
  import {
    errorMessage,
    notifyError,
    notifySuccess,
    pickFileAsBytes,
  } from "./commands/_io";
  import { autoDecodeProgram } from "./commands/_program";
  import FileDown from "@lucide/svelte/icons/file-down";
  import Eraser from "@lucide/svelte/icons/eraser";

  interface Props {
    open: boolean;
    getSource: () => string;
    setSource: (next: string) => void;
  }

  let { open = $bindable(), getSource, setSource }: Props = $props();

  let inputText = $state("");
  let errorText = $state<string | null>(null);

  // If the user pastes (or types) a complete `(program X.Y.Z ...)`, strip the
  // wrapper and replace the input with just the formatted body. Heuristic:
  // only attempt the parse when the literal substring "(program " is present,
  // so mid-typing of a bare term doesn't keep retrying parses.
  function handleInput(event: Event) {
    const value = (event.currentTarget as HTMLTextAreaElement).value;
    errorText = null;

    if (value.includes("(program ")) {
      try {
        const program = parse(value);
        inputText = formatNamed(program.term, { maxWidth: 80 });
        return;
      } catch {
        // Not a complete program — fall through and keep the raw text.
      }
    }
    inputText = value;
  }

  // Parse the textarea contents as a UPLC term. Try parsing as a full program
  // first (handles `(program X.Y.Z ...)`); if that fails, wrap the input in a
  // synthetic 1.1.0 program and parse again to support bare terms.
  function parseInputAsTerm(
    raw: string,
  ): { ok: true; term: Term<Name> } | { ok: false; error: string } {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return { ok: false, error: "Input is empty" };
    }

    try {
      return { ok: true, term: parse(trimmed).term };
    } catch {
      // fall through
    }

    try {
      return { ok: true, term: parse(`(program 1.1.0 ${trimmed})`).term };
    } catch (err) {
      return { ok: false, error: errorMessage(err) };
    }
  }

  async function loadFromFile() {
    try {
      const picked = await pickFileAsBytes(
        ".hex,.flat,.cbor,.txt,text/plain,application/octet-stream",
      );
      if (!picked) return;

      const { program, format } = autoDecodeProgram(picked);
      const named = deBruijnTermToName(program.term);
      inputText = formatNamed(named, { maxWidth: 80 });
      errorText = null;
      notifySuccess("Loaded term", `${picked.name} · ${format}`);
    } catch (err) {
      notifyError("Load failed", errorMessage(err));
    }
  }

  function clearInput() {
    inputText = "";
    errorText = null;
  }

  function applyArg() {
    const argResult = parseInputAsTerm(inputText);
    if (!argResult.ok) {
      errorText = argResult.error;
      return;
    }

    let currentProgram;
    try {
      currentProgram = parse(getSource());
    } catch (err) {
      errorText = `Current program does not parse: ${errorMessage(err)}`;
      return;
    }

    const applied: Term<Name> = {
      tag: "apply",
      function: currentProgram.term,
      argument: argResult.term,
    };

    const { major, minor, patch } = currentProgram.version;
    const body = formatNamed(applied, { maxWidth: 80, baseIndent: 2 });
    const newSource = `(program ${major}.${minor}.${patch}\n  ${body})\n`;

    setSource(newSource);
    notifySuccess("Applied argument");
    open = false;
    inputText = "";
    errorText = null;
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content
    class="max-h-[90vh] w-[95vw] max-w-[900px] gap-3 sm:max-w-[900px]"
  >
    <Dialog.Header>
      <Dialog.Title>Apply Argument</Dialog.Title>
      <Dialog.Description>
        Paste a UPLC term to apply as an argument to the current program. A full <code
          class="font-mono text-xs">(program X.Y.Z ...)</code
        > wrapper will be stripped automatically.
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex min-w-0 flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-muted-foreground">
          UPLC term
        </span>
        <div class="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onclick={loadFromFile}
            title="Load from file"
          >
            <FileDown />
            Load
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onclick={clearInput}
            disabled={inputText.length === 0}
            title="Clear input"
          >
            <Eraser />
            Clear
          </Button>
        </div>
      </div>
      <Textarea
        value={inputText}
        oninput={handleInput}
        placeholder="(con integer 42)"
        spellcheck={false}
        class="h-[55vh] resize-none font-mono text-xs"
      />
      {#if errorText}
        <p class="text-xs text-destructive">{errorText}</p>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
      <Button onclick={applyArg} disabled={inputText.trim().length === 0}>
        Apply
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
