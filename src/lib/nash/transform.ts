import type { Name, Term } from "../plutus/types";
import type { NashTerm, LetBinding } from "./types";

// ---------------------------------------------------------------------------
// UPLC → Nash
// ---------------------------------------------------------------------------
//
// Stack discipline: work stack is LIFO. Pushing A then B means B is executed
// first. Its result lands deeper in the value stack. A executes second, its
// result is on top. Builders pop the value stack accordingly.
//
// Convention for multi-child nodes: push children so that they are visited in
// forward order (child 0 first). That means child 0 pushed LAST on the work
// stack (popped first). Its value ends up deepest. The builder pops from the
// top (last child first) and reverses.

export function uplcToNash(root: Term<Name>): NashTerm<Name> {
  type Frame =
    | { kind: "visit"; term: Term<Name> }
    | { kind: "build-lambda"; parameter: Name }
    | { kind: "build-apply" }
    | { kind: "build-delay" }
    | { kind: "build-force" }
    | { kind: "build-constr"; index: number; count: number }
    | { kind: "build-case"; branchCount: number }
    | {
        kind: "build-let-finish";
        names: Name[];
        bindingCount: number;
      }
    | { kind: "build-extra-applies"; count: number };

  const stack: Frame[] = [{ kind: "visit", term: root }];
  const values: NashTerm<Name>[] = [];

  while (stack.length > 0) {
    const frame = stack.pop()!;

    switch (frame.kind) {
      case "visit": {
        const term = frame.term;

        if (term.tag === "apply") {
          // Collect left-nested apply chain.
          const args: Term<Name>[] = [];
          let cursor: Term<Name> = term;
          while (cursor.tag === "apply") {
            args.push(cursor.argument);
            cursor = cursor.function;
          }
          // args = [argN, ..., arg2, arg1] (reverse order), cursor = base function

          if (cursor.tag === "lambda") {
            // Collect lambda chain from the base function.
            const params: Name[] = [];
            let lambdaCursor: Term<Name> = cursor;
            while (lambdaCursor.tag === "lambda") {
              params.push(lambdaCursor.parameter);
              lambdaCursor = lambdaCursor.body;
            }

            const k = Math.min(args.length, params.length);

            // Continue collecting interleaved Apply(Lambda) from inner body
            let innerBody: Term<Name> = lambdaCursor;
            const extraParams: Name[] = [];
            const extraArgs: Term<Name>[] = [];
            while (
              innerBody.tag === "apply" &&
              innerBody.function.tag === "lambda"
            ) {
              extraParams.push(innerBody.function.parameter);
              extraArgs.push(innerBody.argument);
              innerBody = innerBody.function.body;
            }

            // Build binding lists
            const bindingNames: Name[] = [];
            const bindingValues: Term<Name>[] = [];
            for (let i = 0; i < k; i++) {
              bindingNames.push(params[i]!);
              bindingValues.push(args[args.length - 1 - i]!);
            }
            for (let i = 0; i < extraParams.length; i++) {
              bindingNames.push(extraParams[i]!);
              bindingValues.push(extraArgs[i]!);
            }

            const extraApplyCount = args.length - k;

            // Re-wrap unmatched lambdas into the body
            const unmatchedParams = params.slice(k);
            let body: Term<Name> = innerBody;
            for (let i = unmatchedParams.length - 1; i >= 0; i--) {
              body = { tag: "lambda", parameter: unmatchedParams[i]!, body };
            }

            // Push frames. Execution order (from stack top):
            //   1. visit binding values (v0, v1, ..., vN-1)
            //   2. visit body
            //   3. build-let-finish (pops body then values)
            //   4. if extra applies: visit extra args, then build-extra-applies

            if (extraApplyCount > 0) {
              stack.push({
                kind: "build-extra-applies",
                count: extraApplyCount,
              });
              // Extra args: args[0..extraApplyCount-1] (these are the outermost)
              // Push so they're visited after the let is built
              // Visit order: extraArg0, extraArg1, ..., so push in reverse
              for (let i = 0; i < extraApplyCount; i++) {
                stack.push({
                  kind: "visit",
                  term: args[extraApplyCount - 1 - i]!,
                });
              }
            }

            stack.push({
              kind: "build-let-finish",
              names: bindingNames,
              bindingCount: bindingValues.length,
            });

            // Visit body BEFORE bindings → body result is deeper in value stack
            // Push body first (executed later), then bindings (executed first)
            stack.push({ kind: "visit", term: body });
            // Push binding values so v0 is visited first (pushed last)
            for (let i = 0; i < bindingValues.length; i++) {
              stack.push({ kind: "visit", term: bindingValues[i]! });
            }

            continue;
          }

          // Not a lambda base — regular binary apply.
          // Push so function is visited first (pushed last)
          stack.push({ kind: "build-apply" });
          stack.push({ kind: "visit", term: term.argument });
          stack.push({ kind: "visit", term: term.function });
          continue;
        }

        switch (term.tag) {
          case "var":
            values.push({ tag: "var", name: term.name });
            break;
          case "lambda":
            stack.push({ kind: "build-lambda", parameter: term.parameter });
            stack.push({ kind: "visit", term: term.body });
            break;
          case "constant":
            values.push(term);
            break;
          case "builtin":
            values.push(term);
            break;
          case "delay":
            stack.push({ kind: "build-delay" });
            stack.push({ kind: "visit", term: term.term });
            break;
          case "force":
            stack.push({ kind: "build-force" });
            stack.push({ kind: "visit", term: term.term });
            break;
          case "constr":
            stack.push({
              kind: "build-constr",
              index: term.index,
              count: term.fields.length,
            });
            // Push so field 0 is visited first (pushed last)
            for (let i = 0; i < term.fields.length; i++) {
              stack.push({ kind: "visit", term: term.fields[i]! });
            }
            break;
          case "case":
            stack.push({
              kind: "build-case",
              branchCount: term.branches.length,
            });
            // Push so constr is visited first (pushed last), then branches in order
            for (let i = 0; i < term.branches.length; i++) {
              stack.push({ kind: "visit", term: term.branches[i]! });
            }
            stack.push({ kind: "visit", term: term.constr });
            break;
          case "error":
            values.push({ tag: "error" });
            break;
        }
        break;
      }

      case "build-lambda": {
        const body = values.pop()!;
        values.push({ tag: "lambda", parameter: frame.parameter, body });
        break;
      }

      case "build-apply": {
        // function was visited first → deeper in value stack
        // argument was visited second → on top
        const arg = values.pop()!;
        const fn = values.pop()!;
        values.push({ tag: "apply", function: fn, argument: arg });
        break;
      }

      case "build-delay": {
        values.push({ tag: "delay", term: values.pop()! });
        break;
      }

      case "build-force": {
        values.push({ tag: "force", term: values.pop()! });
        break;
      }

      case "build-constr": {
        // Fields visited in forward order (f0 first → deepest). Pop gives reverse.
        const fields: NashTerm<Name>[] = [];
        for (let i = 0; i < frame.count; i++) {
          fields.push(values.pop()!);
        }
        values.push({ tag: "constr", index: frame.index, fields });
        break;
      }

      case "build-case": {
        // constr visited first (deepest), then branches in order
        // Pop: last branch first → reverse, then constr
        const branches: NashTerm<Name>[] = [];
        for (let i = 0; i < frame.branchCount; i++) {
          branches.push(values.pop()!);
        }
        const constr = values.pop()!;
        values.push({ tag: "case", constr, branches });
        break;
      }

      case "build-let-finish": {
        // Binding values visited first (v0 deepest), body visited last (on top)
        const body = values.pop()!;
        const bValues: NashTerm<Name>[] = [];
        for (let i = 0; i < frame.bindingCount; i++) {
          bValues.push(values.pop()!);
        }
        const bindings: LetBinding<Name>[] = [];
        for (let i = 0; i < frame.names.length; i++) {
          bindings.push({ name: frame.names[i]!, value: bValues[i]! });
        }

        values.push({ tag: "let", bindings, body });
        break;
      }

      case "build-extra-applies": {
        // Extra args visited after the let, in forward order (arg0 deepest)
        // Pop: last arg first → reverse, then let
        const extraArgs: NashTerm<Name>[] = [];
        for (let i = 0; i < frame.count; i++) {
          extraArgs.push(values.pop()!);
        }
        let result = values.pop()!; // the let term
        for (const arg of extraArgs) {
          result = { tag: "apply", function: result, argument: arg };
        }
        values.push(result);
        break;
      }
    }
  }

  return values[0]!;
}

// ---------------------------------------------------------------------------
// Nash → UPLC
// ---------------------------------------------------------------------------

export function nashToUplc(root: NashTerm<Name>): Term<Name> {
  type Frame =
    | { kind: "visit"; term: NashTerm<Name> }
    | { kind: "build-lambda"; parameter: Name }
    | { kind: "build-apply" }
    | { kind: "build-delay" }
    | { kind: "build-force" }
    | { kind: "build-constr"; index: number; count: number }
    | { kind: "build-case"; branchCount: number }
    | { kind: "build-let"; names: Name[]; count: number };

  const stack: Frame[] = [{ kind: "visit", term: root }];
  const values: Term<Name>[] = [];

  while (stack.length > 0) {
    const frame = stack.pop()!;

    switch (frame.kind) {
      case "visit": {
        const term = frame.term;
        switch (term.tag) {
          case "var":
            values.push({ tag: "var", name: term.name });
            break;
          case "lambda":
            stack.push({ kind: "build-lambda", parameter: term.parameter });
            stack.push({ kind: "visit", term: term.body });
            break;
          case "apply":
            stack.push({ kind: "build-apply" });
            stack.push({ kind: "visit", term: term.argument });
            stack.push({ kind: "visit", term: term.function });
            break;
          case "constant":
            values.push(term);
            break;
          case "builtin":
            values.push(term);
            break;
          case "delay":
            stack.push({ kind: "build-delay" });
            stack.push({ kind: "visit", term: term.term });
            break;
          case "force":
            stack.push({ kind: "build-force" });
            stack.push({ kind: "visit", term: term.term });
            break;
          case "constr":
            stack.push({
              kind: "build-constr",
              index: term.index,
              count: term.fields.length,
            });
            for (let i = 0; i < term.fields.length; i++) {
              stack.push({ kind: "visit", term: term.fields[i]! });
            }
            break;
          case "case":
            stack.push({
              kind: "build-case",
              branchCount: term.branches.length,
            });
            for (let i = 0; i < term.branches.length; i++) {
              stack.push({ kind: "visit", term: term.branches[i]! });
            }
            stack.push({ kind: "visit", term: term.constr });
            break;
          case "error":
            values.push({ tag: "error" });
            break;
          case "let": {
            const names = term.bindings.map((b) => b.name);
            stack.push({
              kind: "build-let",
              names,
              count: term.bindings.length,
            });
            // Visit body before bindings → body deeper in value stack
            stack.push({ kind: "visit", term: term.body });
            // Push bindings so v0 is visited first (pushed last)
            for (let i = 0; i < term.bindings.length; i++) {
              stack.push({ kind: "visit", term: term.bindings[i]!.value });
            }
            break;
          }
        }
        break;
      }

      case "build-lambda": {
        const body = values.pop()!;
        values.push({ tag: "lambda", parameter: frame.parameter, body });
        break;
      }

      case "build-apply": {
        const arg = values.pop()!;
        const fn = values.pop()!;
        values.push({ tag: "apply", function: fn, argument: arg });
        break;
      }

      case "build-delay":
        values.push({ tag: "delay", term: values.pop()! });
        break;

      case "build-force":
        values.push({ tag: "force", term: values.pop()! });
        break;

      case "build-constr": {
        const fields: Term<Name>[] = [];
        for (let i = 0; i < frame.count; i++) {
          fields.push(values.pop()!);
        }
        values.push({ tag: "constr", index: frame.index, fields });
        break;
      }

      case "build-case": {
        const branches: Term<Name>[] = [];
        for (let i = 0; i < frame.branchCount; i++) {
          branches.push(values.pop()!);
        }
        const constr = values.pop()!;
        values.push({ tag: "case", constr, branches });
        break;
      }

      case "build-let": {
        // body deeper, binding values on top (v0 deepest among them)
        const body = values.pop()!;
        const bValues: Term<Name>[] = [];
        for (let i = 0; i < frame.count; i++) {
          bValues.push(values.pop()!);
        }
        // Build nested Apply(Lambda(...), value) from right to left.
        let result = body;
        for (let i = frame.count - 1; i >= 0; i--) {
          result = {
            tag: "apply",
            function: {
              tag: "lambda",
              parameter: frame.names[i]!,
              body: result,
            },
            argument: bValues[i]!,
          };
        }
        values.push(result);
        break;
      }
    }
  }

  return values[0]!;
}
