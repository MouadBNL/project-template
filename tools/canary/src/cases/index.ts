/**
 * Every canary case, and the rules the config turns on that no sample can trigger cleanly.
 *
 * To add a case (a new rule, boundary, or place a rule must apply): add a sample that violates it
 * at a path where it must apply, with the rule id it must report, and a compliant sample where
 * the config exempts it; run `node tools/canary/src/main.ts`; switch the rule off in
 * vite.config.ts and see the canary fail; switch it back on.
 */
import type { Case } from "../case.ts";
import type { Uncovered } from "../judge.ts";
import { BOUNDARY_CASES } from "./boundaries.ts";
import { COMPILER_CASES } from "./compiler.ts";
import { EFFECT_CASES } from "./effects.ts";
import { ERROR_CASES } from "./errors.ts";
import { HYGIENE_CASES } from "./hygiene.ts";
import { REACT_CASES } from "./react.ts";
import { SIZE_CASES } from "./sizes.ts";
import { TEST_CASES } from "./tests.ts";
import { TYPE_CASES } from "./types.ts";

export const CASES: readonly Case[] = [
  ...ERROR_CASES,
  ...EFFECT_CASES,
  ...REACT_CASES,
  ...COMPILER_CASES,
  ...BOUNDARY_CASES,
  ...TYPE_CASES,
  ...HYGIENE_CASES,
  ...TEST_CASES,
  ...SIZE_CASES,
];

export const UNCOVERED: readonly Uncovered[] = [
  {
    rule: "react/preserve-manual-memoization",
    reason:
      "it reports manual memoization the compiler could not keep; `repo/no-manual-memo` bans useMemo and useCallback, and every sample tried was reported by an earlier compiler rule (immutability, exhaustive-deps) instead",
  },
  {
    rule: "react/syntax",
    reason:
      "it reports code the React Compiler cannot parse; no sample tried both type-checks and reaches it (unsupported constructs are reported by `react/todo` or `react/unsupported-syntax`)",
  },
];
