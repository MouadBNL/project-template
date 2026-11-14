/**
 * A canary case: one convention, the samples that prove the root config enforces it, and where in
 * `vite.config.ts` it is configured (the failure message points there).
 *
 * Rule ids are written as the root config names them: `repo/no-throw`, `max-lines` (oxlint's
 * eslint rules have no prefix), `typescript/no-floating-promises`, `react/rules-of-hooks`. Two ids
 * stand for lint options rather than rules: `type-check` (`options.typeCheck`, a TypeScript
 * error) and `unused-disable-directive` (`options.reportUnusedDisableDirectives`).
 */

export type Sample = {
  /** Repo-relative path the sample stands for: the overrides and boundaries match on it. */
  readonly path: string;
  readonly code: string;
  /** Every rule the sample must report, and nothing else. Empty: it must lint clean. */
  readonly reports: readonly string[];
};

export type Case = {
  /** The convention, in words. */
  readonly convention: string;
  /** Where the root `vite.config.ts` configures it: what to check when the case fails. */
  readonly config: string;
  readonly samples: readonly Sample[];
};

/** A sample that must report exactly `rules`. */
export const fires = (path: string, code: string, ...rules: [string, ...string[]]): Sample => ({
  path,
  code,
  reports: rules,
});

/** A sample that must lint clean: the convention allows it at this path. */
export const passes = (path: string, code: string): Sample => ({ path, code, reports: [] });

/** Joins lines into a file's text. */
export const lines = (...text: string[]): string => `${text.join("\n")}\n`;

type Size = {
  /** Lines of the whole file (blank lines and comments not counted, none are generated). */
  readonly file: number;
  /** Lines of the exported function `sized`, 0 for none. */
  readonly fn?: number;
  /** Its cyclomatic complexity: one `if` per point above 1. */
  readonly complexity?: number;
};

const PADDING_FRAME = 2;
const FUNCTION_FRAME = 4;

/**
 * A file of exactly `file` lines holding a function of exactly `fn` lines with the given
 * complexity, and nothing any other rule reports: the size limits are probed at their edge.
 */
export function sized({ file, fn = 0, complexity = 1 }: Size): string {
  const body: string[] = [];
  if (fn > 0) {
    body.push("export function sized(n: number): number {", "  let total = n;");
    for (let point = 1; point < complexity; point += 1)
      body.push(`  if (n === ${String(point)}) total += ${String(point)};`);
    const padding = fn - FUNCTION_FRAME - (complexity - 1);
    for (let line = 0; line < padding; line += 1) body.push("  total += 1;");
    body.push("  return total;", "}");
  }
  const rest = file - body.length;
  if (rest > 0) {
    body.push("export const padding: readonly number[] = [");
    for (let line = 0; line < rest - PADDING_FRAME; line += 1) body.push(`  ${String(line)},`);
    body.push("];");
  }
  return lines(...body);
}
