<script lang="ts">
  import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "$lib/components/ui/sonner";

  import "./layout.css";

  let { children } = $props();
</script>

<ModeWatcher />
<Toaster richColors position="bottom-right" />
<svelte:head
  ><link rel="icon" type="image/png" href="/favicon.png" /></svelte:head
>
{@render children()}
