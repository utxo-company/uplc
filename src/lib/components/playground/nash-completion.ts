import {
  autocompletion,
  completionKeymap,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  type CompletionSource,
} from "@codemirror/autocomplete";
import { EditorView, keymap } from "@codemirror/view";
import type { EditorState, Extension } from "@codemirror/state";
import { BUILTIN_META } from "$lib/nash";
import { defaultFunctionArity, type DefaultFunction } from "$lib/plutus";

// Built once — the builtin set is static.
const OPTIONS: Completion[] = (
  Object.keys(BUILTIN_META) as DefaultFunction[]
).map((name) => ({
  label: name,
  type: "function",
  apply: `${name} `,
  detail: `· ${defaultFunctionArity(name)}  ${BUILTIN_META[name].category}`,
  info: BUILTIN_META[name].signature,
}));

// True if `[` at `bracketPos` is a binding-vector opener (immediately follows
// the `let` keyword, modulo whitespace and `-- …` line comments).
// Parallels the runtime `expectingBindingVector` flag in nash-language.ts.
function isBindingVectorBracket(
  state: EditorState,
  bracketPos: number,
): boolean {
  const text = state.sliceDoc(0, bracketPos);
  // Strip any run of whitespace and/or `-- …`-style line comments off the end.
  // `--[^\n]*` eats a comment body (not the trailing newline); the alternation
  // with `\s+` lets comment-with-newline pairs chain: `let -- a\n -- b\n [`.
  const trimmed = text.replace(/(\s+|--[^\n]*)+$/, "");
  return /\blet$/.test(trimmed);
}

const nashBuiltinSource: CompletionSource = (
  context: CompletionContext,
): CompletionResult | null => {
  // Suppress inside strings, line comments, bytestring literals.
  // `literal` is the token returned for `#hexhex` bytestring literals in nash-language.ts.
  if (context.tokenBefore(["string", "lineComment", "literal"])) return null;

  // Auto-trigger: `[` (maybe whitespace) + at least one word character.
  const autoMatch = context.matchBefore(/\[\s*\w+/);
  if (autoMatch) {
    const bracketPos = autoMatch.from;
    if (isBindingVectorBracket(context.state, bracketPos)) return null;
    // Find where the typed prefix starts (after `[` and any whitespace).
    const slice = context.state.sliceDoc(bracketPos, autoMatch.to);
    const leadLen = slice.match(/^\[\s*/)?.[0].length ?? 1;
    return {
      from: bracketPos + leadLen,
      options: OPTIONS,
      validFor: /^\w*$/,
    };
  }

  // Manual trigger (Ctrl+Space / Cmd+I): offer completions anchored at the word prefix.
  if (context.explicit) {
    const word = context.matchBefore(/\w*/);
    return {
      from: word?.from ?? context.pos,
      options: OPTIONS,
      validFor: /^\w*$/,
    };
  }
  return null;
};

// Popup/info-panel styling wired to the shadcn palette in src/routes/layout.css.
const completionTheme = EditorView.theme({
  ".cm-tooltip.cm-tooltip-autocomplete": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    boxShadow:
      "0 10px 15px -3px color-mix(in oklch, var(--foreground) 10%, transparent), 0 4px 6px -4px color-mix(in oklch, var(--foreground) 10%, transparent)",
    padding: "0.25rem",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    fontSize: "13px",
  },
  ".cm-tooltip-autocomplete > ul": {
    maxHeight: "16rem",
  },
  ".cm-tooltip-autocomplete > ul > li": {
    padding: "0.25rem 0.5rem",
    borderRadius: "calc(var(--radius) - 0.25rem)",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
  ".cm-completionLabel": {
    fontWeight: "500",
  },
  ".cm-completionMatchedText": {
    textDecoration: "none",
    color: "var(--primary)",
    fontWeight: "600",
  },
  ".cm-completionDetail": {
    color: "var(--muted-foreground)",
    fontStyle: "normal",
    marginLeft: "auto",
    fontSize: "12px",
  },
  ".cm-completionInfo": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "0.5rem 0.75rem",
    marginLeft: "0.25rem",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    fontSize: "12.5px",
    maxWidth: "28rem",
    boxShadow:
      "0 10px 15px -3px color-mix(in oklch, var(--foreground) 10%, transparent), 0 4px 6px -4px color-mix(in oklch, var(--foreground) 10%, transparent)",
  },
});

export function nashCompletion(): Extension {
  return [
    autocompletion({
      override: [nashBuiltinSource],
      activateOnTyping: true,
      activateOnTypingDelay: 50,
      closeOnBlur: true,
    }),
    keymap.of(completionKeymap),
    completionTheme,
  ];
}

export const __test = { nashBuiltinSource, isBindingVectorBracket, OPTIONS };
