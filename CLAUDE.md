# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A web-based **playground / editor for Untyped Plutus Core (UPLC)**, built as a SvelteKit app deployed to Cloudflare Workers. The playground UI under `src/routes` is the product. A full TypeScript UPLC implementation (parser, name→DeBruijn, CEK machine, flat/CBOR codecs, pretty printer) lives inline at `src/lib/plutus` so the playground can parse and evaluate programs in the browser without a backend — but it's an internal dependency, not the headline feature. If a future task is ambiguous, assume it's about the editor experience unless it explicitly mentions the language implementation.

## Commands

Package manager is **pnpm** (workspace declared via `pnpm-workspace.yaml`). The Cloudflare adapter requires `wrangler types` to be run before type-checking or building.

- `pnpm dev` — start Vite dev server
- `pnpm build` — `wrangler types --check && vite build`
- `pnpm preview` — run the built worker via wrangler on port 4173
- `pnpm check` — wrangler types + svelte-kit sync + svelte-check
- `pnpm lint` — prettier --check + eslint
- `pnpm format` — prettier --write
- `pnpm test` — vitest (runs both `client` and `server` projects defined in `vite.config.ts`)
- `pnpm gen` — regenerate `worker-configuration.d.ts` from `wrangler.jsonc`

### Running a single test

Vitest is configured with two projects (`client` browser via Playwright/chromium, `server` node). Filter by file or test name:

```
pnpm test src/lib/plutus/conformance.spec.ts
pnpm test --project=server -t "Conformance"
```

### UPLC conformance tests

`src/lib/plutus/conformance.spec.ts` walks `src/lib/plutus/conformance/tests/` and runs every `.uplc` against its `.expected` and `.budget.expected` siblings. The test corpus is **not vendored** — fetch it with:

```
pnpm download:conformance
```

This pulls `IntersectMBO/plutus` master and copies `plutus-conformance/test-cases/uplc/evaluation` into the tests directory. Without this, the conformance suite reports a single skipped test.

## Architecture

### `src/routes` and `src/lib/components` — the playground

This is the main app. Standard SvelteKit. Svelte 5 **runes mode is forced** for all non-`node_modules` files (`svelte.config.js`). UI uses **shadcn-svelte** (`components.json`, style `lyra`, base color zinc, lucide icons); generated components land in `src/lib/components/ui` and the Tailwind entry is `src/routes/layout.css`. The `$lib` alias maps to `src/lib`; `cn`/utility helpers belong in `src/lib/utils.ts`. The editor calls into `$lib/plutus` for parsing and evaluation — that's the boundary to consume; don't duplicate language logic in route/component code.

**Always check shadcn-svelte before hand-rolling a UI component.** Browse the catalog at https://www.shadcn-svelte.com/docs/components and add anything that fits with `pnpm dlx shadcn-svelte@latest add <component>`. Only build a custom component when nothing in the registry covers the use case.

**NEVER edit the shadcn files in `src/lib/components/ui`.** They're managed by the shadcn-svelte CLI and must stay pristine so they can be re-added/upgraded cleanly. If you need to extend behavior, wrap them in a new component under `src/lib/components/` instead.

### `src/lib/plutus` — embedded UPLC implementation

Internal dependency the playground uses to run programs entirely in the browser (no backend round-trip). The pipeline is: **source text → `parse` → `nameToDeBruijn` → `CekMachine.run` → `prettyPrint`**. Public surface is re-exported from `src/lib/plutus/index.ts`; the playground (and any new code) should import from there rather than reaching into submodules.

- `lexer.ts` / `parse.ts` — tokenize and parse textual UPLC into a named-AST `Program`. Throws `ParseError`.
- `convert.ts` — `nameToDeBruijn` rewrites named variables to DeBruijn indices. Throws `ConvertError`.
- `types.ts` — the term/constant ADTs, `ExBudget`, `DefaultFunction`, arity tables (`defaultFunctionArity`, `defaultFunctionForceCount`), and constants like `I64_MAX` / `unlimitedBudget`. Most other modules pull their type definitions from here.
- `flat.ts` — flat (bit-level) encoding/decoding for DeBruijn programs.
- `cbor.ts` — CBOR encode/decode for `PlutusData`.
- `pretty.ts` — canonical pretty printer; conformance tests compare results by re-parsing both sides and pretty-printing, so output stability matters.
- `cek/` — the CEK machine:
  - `machine.ts` — main `CekMachine.run` loop. Tracks per-step counts (`STEP_*` indices) and only applies machine costs every `SLIPPAGE` (200) steps. `MACHINE_COSTS` is the per-step `ExBudget` table. Throws `EvaluationError` (also re-exported).
  - `value.ts`, `context.ts`, `discharge.ts` — runtime values, evaluation context/arg stack, value→term discharge.
  - `costing.ts`, `costs.ts`, `exmem.ts` — builtin cost model. `DEFAULT_BUILTIN_COSTS` + `evalBuiltinCost` + `computeArgSizes` work together to charge for builtin invocations.
  - `builtins/` — implementations of `DefaultFunction` builtins, dispatched from `callBuiltinImpl`.
  - `error.ts` — `EvaluationError`.
- `bench/plutus_use_cases.bench.ts` — vitest benchmarks for realistic UPLC programs.

When the CEK machine claims budget, it accumulates step counters and only debits `MACHINE_COSTS` in slippage-sized batches; conformance comparison clamps consumed cpu/mem to `I64_MAX` to match the Haskell `plutuz` reference. Keep that invariant when changing budgeting.

### Cloudflare / build

Adapter is `@sveltejs/adapter-cloudflare` targeting Workers. `worker-configuration.d.ts` is generated by `wrangler types` from `wrangler.jsonc` and is regenerated by `pnpm gen` and as part of `build` / `check`. Local preview uses `wrangler dev` against the built `_worker.js`.
