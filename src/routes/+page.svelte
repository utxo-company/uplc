<script lang="ts">
  import Editor from "$lib/components/playground/Editor.svelte";
  import ResultPanel from "$lib/components/playground/ResultPanel.svelte";
  import CommandPalette from "$lib/components/playground/CommandPalette.svelte";
  import CborDatumDecoder from "$lib/components/playground/CborDatumDecoder.svelte";
  import ApplyArgDialog from "$lib/components/playground/ApplyArgDialog.svelte";
  import ExportDialog from "$lib/components/playground/ExportDialog.svelte";
  import {
    runProgram,
    runNashProgram,
    type RunResult,
  } from "$lib/components/playground/run";
  import type {
    CommandContext,
    ActiveTab,
  } from "$lib/components/playground/commands";
  import { Button } from "$lib/components/ui/button";
  import { Kbd } from "$lib/components/ui/kbd";
  import * as Resizable from "$lib/components/ui/resizable";
  import * as Tabs from "$lib/components/ui/tabs";
  import ThemeToggle from "$lib/components/theme-toggle.svelte";
  import { Play } from "@lucide/svelte";
  import { PersistedState } from "runed";

  import { parse, formatNamed } from "$lib/plutus";
  import { uplcToNash, formatNash, parseNash, nashToUplc } from "$lib/nash";
  import { nash } from "$lib/components/playground/nash-language";

  const DEFAULT_PROGRAM = `(program 1.0.0
  [(lam x x) (con integer 42)])
`;

  const sourceState = new PersistedState<string>(
    "playground:source",
    DEFAULT_PROGRAM,
  );
  const nashState = new PersistedState<string>("playground:nash", "");
  let activeTab = $state<ActiveTab>("source");
  let result = $state<RunResult | null>(null);
  let datumDecoderOpen = $state(false);
  let applyArgOpen = $state(false);
  let exportOpen = $state(false);
  let commandPaletteOpen = $state(false);

  function run() {
    if (activeTab === "nash") {
      result = runNashProgram(nashState.current);
    } else {
      result = runProgram(sourceState.current);
    }
  }

  function onTabChange(newTab: string) {
    if (newTab === activeTab) return;

    if (newTab === "nash") {
      // Sync: UPLC → Nash
      try {
        const program = parse(sourceState.current);
        const nashTerm = uplcToNash(program.term);
        const { major, minor, patch } = program.version;
        const body = formatNash(nashTerm, { maxWidth: 80, baseIndent: 2 });
        nashState.current = `(program ${major}.${minor}.${patch}\n  ${body})\n`;
      } catch (err) {
        result = {
          ok: false,
          stage: "parse",
          errorName: err instanceof Error ? err.name : "Error",
          message: err instanceof Error ? err.message : String(err),
        };
        return; // Don't switch tab
      }
    } else {
      // Sync: Nash → UPLC
      try {
        const nashProgram = parseNash(nashState.current);
        const uplcTerm = nashToUplc(nashProgram.term);
        const { major, minor, patch } = nashProgram.version;
        const body = formatNamed(uplcTerm, { maxWidth: 80, baseIndent: 2 });
        sourceState.current = `(program ${major}.${minor}.${patch}\n  ${body})\n`;
      } catch (err) {
        result = {
          ok: false,
          stage: "parse",
          errorName: err instanceof Error ? err.name : "Error",
          message: err instanceof Error ? err.message : String(err),
        };
        return; // Don't switch tab
      }
    }

    activeTab = newTab as ActiveTab;
  }

  function getSource(): string {
    return activeTab === "nash" ? nashState.current : sourceState.current;
  }

  function setSource(next: string): void {
    if (activeTab === "nash") {
      nashState.current = next;
    } else {
      sourceState.current = next;
    }
  }

  const ctx: CommandContext = {
    getSource,
    setSource,
    getActiveTab: () => activeTab,
    runProgram: run,
    openCborDatumDecoder: () => (datumDecoderOpen = true),
    openApplyArgDialog: () => (applyArgOpen = true),
    openExportDialog: () => (exportOpen = true),
  };
</script>

<div class="flex h-screen flex-col">
  <header
    class="flex h-12 flex-none items-center justify-between border-b px-4"
  >
    <div class="flex items-center gap-2">
      <img src="/logo.svg" alt="UPLC Playground" class="h-8 w-8" />
      <span class="text-sm font-semibold tracking-tight">UPLC Playground</span>
      <span class="text-xs text-muted-foreground">
        Untyped Plutus Core — parse, evaluate, inspect
      </span>
    </div>
    <div class="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onclick={() => (commandPaletteOpen = true)}
      >
        Commands
        <Kbd>⌘K</Kbd>
      </Button>
      <Button size="sm" onclick={run}>
        <Play />
        Run
      </Button>
      <ThemeToggle />
    </div>
  </header>

  <CommandPalette {ctx} bind:open={commandPaletteOpen} />
  <CborDatumDecoder bind:open={datumDecoderOpen} />
  <ApplyArgDialog
    bind:open={applyArgOpen}
    getSource={() => sourceState.current}
    setSource={(next) => (sourceState.current = next)}
  />
  <ExportDialog bind:open={exportOpen} getSource={() => sourceState.current} />

  <main class="min-h-0 flex-1">
    <Resizable.PaneGroup direction="horizontal">
      <Resizable.Pane defaultSize={60} minSize={30}>
        <div class="flex h-full flex-col">
          <div class="flex h-10 flex-none items-center border-b px-2">
            <Tabs.Root
              value={activeTab}
              onValueChange={onTabChange}
              class="flex items-center"
            >
              <Tabs.List>
                <Tabs.Trigger value="source">Source</Tabs.Trigger>
                <Tabs.Trigger value="nash">Nash</Tabs.Trigger>
              </Tabs.List>
            </Tabs.Root>
          </div>
          <div class="min-h-0 flex-1">
            {#if activeTab === "source"}
              <Editor
                value={sourceState.current}
                onChange={(next) => (sourceState.current = next)}
              />
            {:else}
              <Editor
                value={nashState.current}
                onChange={(next) => (nashState.current = next)}
                language={nash}
              />
            {/if}
          </div>
        </div>
      </Resizable.Pane>
      <Resizable.Handle withHandle />
      <Resizable.Pane defaultSize={40} minSize={20}>
        <ResultPanel {result} />
      </Resizable.Pane>
    </Resizable.PaneGroup>
  </main>
</div>
