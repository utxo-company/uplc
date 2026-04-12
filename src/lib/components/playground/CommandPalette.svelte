<script lang="ts">
  import * as Command from "$lib/components/ui/command";
  import { Play } from "@lucide/svelte";

  interface Props {
    onRun: () => void;
  }

  let { onRun }: Props = $props();

  let open = $state(false);

  function handleKey(event: KeyboardEvent) {
    // Cmd/Ctrl+P — suppress the browser Print dialog and toggle the palette.
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
      event.preventDefault();
      open = !open;
    }
  }

  function runAndClose() {
    open = false;
    onRun();
  }
</script>

<svelte:document onkeydown={handleKey} />

<Command.Dialog bind:open>
  <Command.Input placeholder="Type a command..." />
  <Command.List>
    <Command.Empty>No commands found.</Command.Empty>
    <Command.Group heading="Actions">
      <Command.Item onSelect={runAndClose}>
        <Play />
        <span>Run</span>
      </Command.Item>
    </Command.Group>
  </Command.List>
</Command.Dialog>
