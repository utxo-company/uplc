import {
  CekMachine,
  I64_MAX,
  deBruijnTermToName,
  formatNamed,
  nameToDeBruijn,
  parse,
  unlimitedBudget,
} from "$lib/plutus";

export type RunStage = "parse" | "convert" | "evaluate";

export type RunResult =
  | { ok: true; term: string; cpu: bigint; mem: bigint }
  | { ok: false; stage: RunStage; errorName: string; message: string };

function clampI64(value: bigint): bigint {
  return value > I64_MAX ? I64_MAX : value;
}

function errorName(err: unknown): string {
  if (err instanceof Error && err.name) return err.name;
  return "Error";
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function runProgram(source: string): RunResult {
  let program;
  try {
    program = parse(source);
  } catch (err) {
    return {
      ok: false,
      stage: "parse",
      errorName: errorName(err),
      message: errorMessage(err),
    };
  }

  let dProgram;
  try {
    dProgram = nameToDeBruijn(program);
  } catch (err) {
    return {
      ok: false,
      stage: "convert",
      errorName: errorName(err),
      message: errorMessage(err),
    };
  }

  const initialBudget = unlimitedBudget();
  const machine = new CekMachine(initialBudget);
  let resultTerm;
  try {
    resultTerm = machine.run(dProgram.term);
  } catch (err) {
    return {
      ok: false,
      stage: "evaluate",
      errorName: errorName(err),
      message: errorMessage(err),
    };
  }

  const remaining = machine.remainingBudget;
  const cpu = clampI64(initialBudget.cpu - remaining.cpu);
  const mem = clampI64(initialBudget.mem - remaining.mem);

  const namedTerm = deBruijnTermToName(resultTerm);
  return {
    ok: true,
    term: formatNamed(namedTerm, { maxWidth: 80 }),
    cpu,
    mem,
  };
}
