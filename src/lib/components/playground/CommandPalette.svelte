<script lang="ts">
  import * as Command from "$lib/components/ui/command";
  import {
    commands,
    commandGroupOrder,
    type CommandContext,
    type CommandGroup,
    type Command as CommandDef,
  } from "./commands";

  interface Props {
    ctx: CommandContext;
    open?: boolean;
  }

  let { ctx, open = $bindable(false) }: Props = $props();

  function handleKey(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      open = !open;
    }
  }

  function runCommand(cmd: CommandDef) {
    open = false;
    void cmd.run(ctx);
  }

  const grouped = $derived.by(() => {
    const buckets: Record<string, CommandDef[]> = {};
    for (const cmd of commands) {
      (buckets[cmd.group] ??= []).push(cmd);
    }
    return commandGroupOrder
      .filter((group) => buckets[group])
      .map((group: CommandGroup) => ({ group, items: buckets[group]! }));
  });
</script>

<svelte:document onkeydown={handleKey} />

<Command.Dialog bind:open>
  <Command.Input placeholder="Type a command..." />
  <Command.List>
    <Command.Empty>No commands found.</Command.Empty>
    {#each grouped as { group, items } (group)}
      <Command.Group heading={group}>
        {#each items as cmd (cmd.id)}
          <Command.Item
            value={`${cmd.label} ${cmd.keywords?.join(" ") ?? ""}`}
            onSelect={() => runCommand(cmd)}
          >
            {#if cmd.icon}
              {@const Icon = cmd.icon}
              <Icon />
            {/if}
            <span>{cmd.label}</span>
            {#if cmd.shortcut}
              <Command.Shortcut>{cmd.shortcut}</Command.Shortcut>
            {/if}
          </Command.Item>
        {/each}
      </Command.Group>
    {/each}
  </Command.List>
</Command.Dialog>
