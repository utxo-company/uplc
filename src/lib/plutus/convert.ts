import type { DeBruijn, Name, Program, Term } from "./types";

export class ConvertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConvertError";
  }
}

class BiMap {
  private uniqueToLevel = new Map<number, number>();
  private levelToUnique = new Map<number, number>();

  insert(unique: number, level: number): void {
    this.uniqueToLevel.set(unique, level);
    this.levelToUnique.set(level, unique);
  }

  remove(unique: number): void {
    const level = this.uniqueToLevel.get(unique);
    if (level !== undefined) {
      this.levelToUnique.delete(level);
    }
    this.uniqueToLevel.delete(unique);
  }

  getLevel(unique: number): number | undefined {
    return this.uniqueToLevel.get(unique);
  }
}

class Converter {
  private currentLevel = 0;
  private levels: BiMap[] = [new BiMap()];

  convertProgram(program: Program<Name>): Program<DeBruijn> {
    return {
      version: program.version,
      term: this.convertTerm(program.term),
    };
  }

  private convertTerm(term: Term<Name>): Term<DeBruijn> {
    switch (term.tag) {
      case "var":
        return { tag: "var", name: { index: this.getIndex(term.name.unique) } };

      case "lambda": {
        this.declareUnique(term.parameter.unique);
        const paramIndex = this.getIndex(term.parameter.unique);
        this.startScope();
        const body = this.convertTerm(term.body);
        this.endScope();
        this.removeUnique(term.parameter.unique);
        return {
          tag: "lambda",
          parameter: { index: paramIndex },
          body,
        };
      }

      case "apply":
        return {
          tag: "apply",
          function: this.convertTerm(term.function),
          argument: this.convertTerm(term.argument),
        };

      case "delay":
        return { tag: "delay", term: this.convertTerm(term.term) };

      case "force":
        return { tag: "force", term: this.convertTerm(term.term) };

      case "constr":
        return {
          tag: "constr",
          index: term.index,
          fields: term.fields.map((f) => this.convertTerm(f)),
        };

      case "case":
        return {
          tag: "case",
          constr: this.convertTerm(term.constr),
          branches: term.branches.map((b) => this.convertTerm(b)),
        };

      case "constant":
        return term;

      case "builtin":
        return term;

      case "error":
        return term;
    }
  }

  private declareUnique(unique: number): void {
    this.levels[this.currentLevel]!.insert(unique, this.currentLevel);
  }

  private removeUnique(unique: number): void {
    this.levels[this.currentLevel]!.remove(unique);
  }

  private startScope(): void {
    this.currentLevel++;
    this.levels.push(new BiMap());
  }

  private endScope(): void {
    this.currentLevel--;
    this.levels.pop();
  }

  private getIndex(unique: number): number {
    for (let i = this.levels.length - 1; i >= 0; i--) {
      const level = this.levels[i]!.getLevel(unique);
      if (level !== undefined) {
        return this.currentLevel - level;
      }
    }
    throw new ConvertError(`free unique ${unique}`);
  }
}

export function nameToDeBruijn(program: Program<Name>): Program<DeBruijn> {
  return new Converter().convertProgram(program);
}

// Reverse pass: rewrite a DeBruijn program to a named program, assigning each
// binder a globally fresh name so the result round-trips cleanly through the
// parser (which interns names by text, not by lexical scope). Implemented with
// an explicit work stack because real Plutus scripts nest thousands of terms
// deep and blow the JS call stack on a naive recursive walk.
type DenameFrame =
  | { kind: "visit"; term: Term<DeBruijn> }
  | { kind: "pop-scope" }
  | { kind: "build-lambda"; name: Name }
  | { kind: "build-apply" }
  | { kind: "build-delay" }
  | { kind: "build-force" }
  | { kind: "build-constr"; index: number; arity: number }
  | { kind: "build-case"; branchCount: number };

export function deBruijnToName(program: Program<DeBruijn>): Program<Name> {
  return { version: program.version, term: deBruijnTermToName(program.term) };
}

export function deBruijnTermToName(root: Term<DeBruijn>): Term<Name> {
  let counter = 0;
  const scope: Name[] = [];
  const results: Term<Name>[] = [];
  const stack: DenameFrame[] = [{ kind: "visit", term: root }];

  while (stack.length > 0) {
    const frame = stack.pop()!;

    switch (frame.kind) {
      case "visit": {
        const t = frame.term;
        switch (t.tag) {
          case "var": {
            const position = scope.length - t.name.index;
            if (position < 0 || position >= scope.length) {
              throw new ConvertError(`free DeBruijn index ${t.name.index}`);
            }
            results.push({ tag: "var", name: scope[position]! });
            break;
          }
          case "lambda": {
            const unique = counter++;
            const name: Name = { text: `v${unique}`, unique };
            scope.push(name);
            stack.push({ kind: "build-lambda", name });
            stack.push({ kind: "pop-scope" });
            stack.push({ kind: "visit", term: t.body });
            break;
          }
          case "apply": {
            stack.push({ kind: "build-apply" });
            stack.push({ kind: "visit", term: t.argument });
            stack.push({ kind: "visit", term: t.function });
            break;
          }
          case "delay": {
            stack.push({ kind: "build-delay" });
            stack.push({ kind: "visit", term: t.term });
            break;
          }
          case "force": {
            stack.push({ kind: "build-force" });
            stack.push({ kind: "visit", term: t.term });
            break;
          }
          case "constr": {
            stack.push({
              kind: "build-constr",
              index: t.index,
              arity: t.fields.length,
            });
            for (const field of t.fields) {
              stack.push({ kind: "visit", term: field });
            }
            break;
          }
          case "case": {
            stack.push({
              kind: "build-case",
              branchCount: t.branches.length,
            });
            for (const branch of t.branches) {
              stack.push({ kind: "visit", term: branch });
            }
            stack.push({ kind: "visit", term: t.constr });
            break;
          }
          case "constant":
            results.push({ tag: "constant", value: t.value });
            break;
          case "builtin":
            results.push({ tag: "builtin", function: t.function });
            break;
          case "error":
            results.push({ tag: "error" });
            break;
        }
        break;
      }
      case "pop-scope":
        scope.pop();
        break;
      case "build-lambda": {
        const body = results.pop()!;
        results.push({ tag: "lambda", parameter: frame.name, body });
        break;
      }
      case "build-apply": {
        const argument = results.pop()!;
        const fn = results.pop()!;
        results.push({ tag: "apply", function: fn, argument });
        break;
      }
      case "build-delay": {
        const inner = results.pop()!;
        results.push({ tag: "delay", term: inner });
        break;
      }
      case "build-force": {
        const inner = results.pop()!;
        results.push({ tag: "force", term: inner });
        break;
      }
      case "build-constr": {
        const fields: Term<Name>[] = [];
        for (let i = 0; i < frame.arity; i++) fields.push(results.pop()!);
        results.push({ tag: "constr", index: frame.index, fields });
        break;
      }
      case "build-case": {
        const branches: Term<Name>[] = [];
        for (let i = 0; i < frame.branchCount; i++)
          branches.push(results.pop()!);
        const constr = results.pop()!;
        results.push({ tag: "case", constr, branches });
        break;
      }
    }
  }

  return results.pop()!;
}
