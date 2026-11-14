/**
 * The canary: proves the root `vite.config.ts` still enforces every convention its lint rules
 * stand for. Run by this package's `test` script (so by `pnpm check`), or directly:
 *
 *   node tools/canary/src/main.ts
 *
 * Each case in `src/cases/` holds samples written at the paths they stand for: a violating one
 * must report exactly its expected rules, a compliant one nothing. They are linted together, in a
 * temporary copy of the repo's layout (`shadow.adapter.ts`), with the real root config.
 */
import path from "node:path";
import { runCanary, type CanaryFailure } from "./canary.ts";

const REPO = path.resolve(import.meta.dirname, "../../..");

function describeFailure(failure: CanaryFailure): string {
  let text: string;
  switch (failure.type) {
    case "setup_failed":
      text = `could not ${failure.step}: ${String(failure.cause)}`;
      break;
    case "unreadable_output":
      text = `vp lint did not print the JSON report the canary reads. It printed:\n${failure.output}`;
      break;
    case "unknown_config":
      text =
        "the root vite.config.ts has no `lint` block of the shape the canary reads (tools/canary/src/lint-config.ts).";
      break;
    case "not_a_plugin":
      text = `${failure.specifier}, named in lint.jsPlugins, does not export a lint plugin.`;
      break;
  }
  return `canary: ${text}`;
}

const started = performance.now();
const report = await runCanary(REPO);
const seconds = ((performance.now() - started) / 1000).toFixed(1);

if (!report.ok) {
  console.error(describeFailure(report.error));
  process.exitCode = 1;
} else if (report.value.problems.length > 0) {
  for (const problem of report.value.problems) console.error(`✗ ${problem}\n`);
  console.error(
    `canary: ${String(report.value.problems.length)} problem(s) in ${String(report.value.samples)} samples (${seconds} s). A guardrail the docs claim no longer holds as configured; fix vite.config.ts (or the case, if the case is wrong). Never relax a case to get green.`,
  );
  process.exitCode = 1;
} else {
  console.info(
    `canary: ${String(report.value.cases)} conventions, ${String(report.value.samples)} samples, every guardrail fires (${seconds} s).`,
  );
}
