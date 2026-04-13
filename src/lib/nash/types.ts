import type {
  ConstantTerm,
  BuiltinTerm,
  ErrorTerm,
  Version,
} from "../plutus/types";

// --- Program ---

export interface NashProgram<Binder> {
  readonly version: Version;
  readonly term: NashTerm<Binder>;
}

// --- NashTerm (discriminated union) ---
// Mirrors UPLC Term<Binder> but children reference NashTerm, and adds LetTerm.

export type NashTerm<Binder> =
  | NashVarTerm<Binder>
  | NashLambdaTerm<Binder>
  | NashApplyTerm<Binder>
  | ConstantTerm
  | BuiltinTerm
  | NashDelayTerm<Binder>
  | NashForceTerm<Binder>
  | NashConstrTerm<Binder>
  | NashCaseTerm<Binder>
  | ErrorTerm
  | LetTerm<Binder>;

export interface NashVarTerm<Binder> {
  readonly tag: "var";
  readonly name: Binder;
}

export interface NashLambdaTerm<Binder> {
  readonly tag: "lambda";
  readonly parameter: Binder;
  readonly body: NashTerm<Binder>;
}

export interface NashApplyTerm<Binder> {
  readonly tag: "apply";
  readonly function: NashTerm<Binder>;
  readonly argument: NashTerm<Binder>;
}

export interface NashDelayTerm<Binder> {
  readonly tag: "delay";
  readonly term: NashTerm<Binder>;
}

export interface NashForceTerm<Binder> {
  readonly tag: "force";
  readonly term: NashTerm<Binder>;
}

export interface NashConstrTerm<Binder> {
  readonly tag: "constr";
  readonly index: number;
  readonly fields: ReadonlyArray<NashTerm<Binder>>;
}

export interface NashCaseTerm<Binder> {
  readonly tag: "case";
  readonly constr: NashTerm<Binder>;
  readonly branches: ReadonlyArray<NashTerm<Binder>>;
}

// --- Let (Nash-only) ---

export interface LetBinding<Binder> {
  readonly name: Binder;
  readonly value: NashTerm<Binder>;
}

export interface LetTerm<Binder> {
  readonly tag: "let";
  readonly bindings: ReadonlyArray<LetBinding<Binder>>;
  readonly body: NashTerm<Binder>;
}
