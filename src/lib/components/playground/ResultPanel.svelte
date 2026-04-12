<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import type { RunResult, RunStage } from "./run";

  interface Props {
    result: RunResult | null;
  }

  let { result }: Props = $props();

  const stageLabel: Record<RunStage, string> = {
    parse: "Parse",
    convert: "Convert",
    evaluate: "Evaluate",
  };

  function formatBudget(n: bigint): string {
    return n.toLocaleString("en-US");
  }
</script>

<div class="flex h-full flex-col overflow-hidden">
  <div
    class="flex h-10 flex-none items-center justify-between border-b px-4 text-sm font-medium"
  >
    <span>Result</span>
    {#if result?.ok}
      <div class="flex items-center gap-2">
        <Badge variant="secondary">cpu {formatBudget(result.cpu)}</Badge>
        <Badge variant="secondary">mem {formatBudget(result.mem)}</Badge>
      </div>
    {:else if result && !result.ok}
      <Badge variant="destructive">
        {stageLabel[result.stage]} · {result.errorName}
      </Badge>
    {/if}
  </div>

  <div class="min-h-0 flex-1 overflow-auto">
    {#if !result}
      <div
        class="flex h-full items-center justify-center text-sm text-muted-foreground"
      >
        Press ⌘P or click Run to evaluate
      </div>
    {:else if result.ok}
      <pre
        class="m-0 h-full overflow-auto p-4 font-mono text-sm leading-relaxed break-all whitespace-pre-wrap">{result.term}</pre>
    {:else}
      <div class="space-y-3 p-4 font-mono text-sm">
        <div class="font-semibold text-destructive">
          {result.errorName}
        </div>
        <pre
          class="m-0 break-words whitespace-pre-wrap text-foreground">{result.message}</pre>
      </div>
    {/if}
  </div>
</div>
