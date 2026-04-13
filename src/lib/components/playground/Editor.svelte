<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { EditorState, type Extension } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  import { basicSetup } from "codemirror";
  import { uplc } from "./uplc-language";

  interface Props {
    value: string;
    onChange: (next: string) => void;
    language?: () => Extension;
  }

  let { value, onChange, language }: Props = $props();

  let host: HTMLDivElement;
  let view: EditorView | undefined;

  // Theme wired to the shadcn zinc/oklch palette from src/routes/layout.css.
  const theme = EditorView.theme({
    "&": {
      height: "100%",
      fontSize: "14px",
      backgroundColor: "var(--background)",
      color: "var(--foreground)",
    },
    ".cm-scroller": {
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    },
    ".cm-content": {
      caretColor: "var(--primary)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--background)",
      color: "var(--muted-foreground)",
      border: "none",
      borderRight: "1px solid var(--border)",
    },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in oklch, var(--muted) 40%, transparent)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "color-mix(in oklch, var(--muted) 40%, transparent)",
      color: "var(--foreground)",
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection":
      {
        backgroundColor:
          "color-mix(in oklch, var(--primary) 25%, transparent) !important",
      },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-cursor": {
      borderLeftColor: "var(--primary)",
    },
    ".cm-matchingBracket, .cm-nonmatchingBracket": {
      backgroundColor: "color-mix(in oklch, var(--primary) 15%, transparent)",
      outline: "none",
    },
  });

  onMount(() => {
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        language ? language() : uplc(),
        theme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
      ],
    });

    view = new EditorView({ state, parent: host });
  });

  // Sync external value changes (e.g. import commands) into the CodeMirror
  // doc. Skip when the doc already matches to avoid fighting user typing.
  $effect(() => {
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  });

  onDestroy(() => {
    view?.destroy();
  });
</script>

<div bind:this={host} class="h-full w-full"></div>
