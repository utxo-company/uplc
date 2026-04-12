<script lang="ts">
  import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "$lib/components/ui/sonner";

  import "./layout.css";
  import favicon from "$lib/assets/favicon.svg";

  let { children } = $props();
</script>

<ModeWatcher />
<Toaster richColors position="bottom-right" />
<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
