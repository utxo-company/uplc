<script lang="ts">
  import Editor from "$lib/components/playground/Editor.svelte";
  import ResultPanel from "$lib/components/playground/ResultPanel.svelte";
  import CommandPalette from "$lib/components/playground/CommandPalette.svelte";
  import { runProgram, type RunResult } from "$lib/components/playground/run";
  import type { CommandContext } from "$lib/components/playground/commands";
  import { Button } from "$lib/components/ui/button";
  import * as Resizable from "$lib/components/ui/resizable";
  import ThemeToggle from "$lib/components/theme-toggle.svelte";
  import { Play } from "@lucide/svelte";

  const DEFAULT_PROGRAM = `(program 1.0.0
  [(lam x x) (con integer 42)])
`;

  let source = $state(DEFAULT_PROGRAM);
  let result = $state<RunResult | null>(null);

  function run() {
    result = runProgram(source);
  }

  const ctx: CommandContext = {
    getSource: () => source,
    setSource: (next) => (source = next),
    runProgram: run,
  };
</script>

<div class="flex h-screen flex-col">
  <header
    class="flex h-12 flex-none items-center justify-between border-b px-4"
  >
    <div class="flex items-center gap-2">
      <span class="text-sm font-semibold tracking-tight">UPLC Playground</span>
      <span class="text-xs text-muted-foreground">
        Untyped Plutus Core — parse, evaluate, inspect
      </span>
    </div>
    <div class="flex items-center gap-2">
      <Button size="sm" onclick={run}>
        <Play />
        Run
      </Button>
      <ThemeToggle />
    </div>
  </header>

  <CommandPalette {ctx} />

  <main class="min-h-0 flex-1">
    <Resizable.PaneGroup direction="horizontal">
      <Resizable.Pane defaultSize={60} minSize={30}>
        <div class="flex h-full flex-col">
          <div
            class="flex h-10 flex-none items-center border-b px-4 text-sm font-medium"
          >
            Source
          </div>
          <div class="min-h-0 flex-1">
            <Editor value={source} onChange={(next) => (source = next)} />
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
