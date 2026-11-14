import type { Case, Sample } from "./case.ts";

/** One diagnostic of the lint run, its rule already named as the config names it. */
export type Finding = { readonly path: string; readonly rule: string; readonly message: string };

/** A rule turned on in the config that no sample can trigger cleanly, and why. */
export type Uncovered = { readonly rule: string; readonly reason: string };

export type Verdict = {
  readonly cases: readonly Case[];
  readonly uncovered: readonly Uncovered[];
  readonly findings: readonly Finding[];
  /** Every rule id that exists: oxlint's built-in rules, the JS plugins' rules, the options. */
  readonly known: ReadonlySet<string>;
  /** Every rule id the root config turns on. */
  readonly enabled: ReadonlySet<string>;
};

const CASES_DIR = "tools/canary/src/cases/";

/** Rule -> first message, per path. */
function byPath(findings: readonly Finding[]): Map<string, Map<string, string>> {
  const paths = new Map<string, Map<string, string>>();
  for (const { path, rule, message } of findings) {
    const rules = paths.get(path) ?? new Map<string, string>();
    if (!rules.has(rule)) rules.set(rule, message);
    paths.set(path, rules);
  }
  return paths;
}

function judgeSample(item: Case, sample: Sample, reported: ReadonlyMap<string, string>): string[] {
  const problems: string[] = [];
  const where = `This case is configured by ${item.config}.`;
  for (const rule of sample.reports) {
    if (!reported.has(rule))
      problems.push(
        `\`${rule}\` no longer fires on \`${sample.path}\` (${item.convention}). In vite.config.ts, \`${rule}\` must be on for this path and no later override may turn it off or exclude the path. ${where}`,
      );
  }
  for (const [rule, message] of reported) {
    if (sample.reports.includes(rule)) continue;
    problems.push(
      sample.reports.length === 0
        ? `\`${sample.path}\` must lint clean (${item.convention}), but \`${rule}\` reports: ${message} In vite.config.ts, an override may now apply \`${rule}\` to this path, or an exemption was lost. ${where}`
        : `\`${sample.path}\` (${item.convention}) also reports \`${rule}\`: ${message} A sample reports only what its case expects: fix the sample in ${CASES_DIR}, or expect \`${rule}\` there if it belongs to the convention.`,
    );
  }
  return problems;
}

function judgeNames({ cases, uncovered, known, enabled }: Verdict): string[] {
  const problems: string[] = [];
  const proven = new Set<string>();
  for (const item of cases) {
    for (const sample of item.samples) {
      for (const rule of sample.reports) {
        proven.add(rule);
        if (!known.has(rule))
          problems.push(
            `The case "${item.convention}" expects \`${rule}\` on \`${sample.path}\`, but no rule has that name (oxlint's rules, the config's JS plugins, \`type-check\`, \`unused-disable-directive\`). Fix the rule id in ${CASES_DIR}.`,
          );
      }
    }
  }
  const excused = new Set(uncovered.map((entry) => entry.rule));
  for (const rule of [...enabled].toSorted()) {
    if (!proven.has(rule) && !excused.has(rule))
      problems.push(
        `\`${rule}\` is turned on in vite.config.ts, but no canary case proves it fires. Add a case to ${CASES_DIR} with a sample that violates it at a path where it applies (if no sample can trigger it cleanly, list it in UNCOVERED with the reason).`,
      );
  }
  for (const { rule } of uncovered) {
    if (proven.has(rule))
      problems.push(`UNCOVERED lists \`${rule}\`, but a case proves it: remove it from UNCOVERED.`);
    else if (!enabled.has(rule))
      problems.push(
        `UNCOVERED lists \`${rule}\`, which vite.config.ts does not turn on: remove it from UNCOVERED.`,
      );
  }
  return problems;
}

/** Everything that is wrong, worded for whoever has to fix it; empty when every guardrail fires. */
export function judge(verdict: Verdict): string[] {
  const problems = judgeNames(verdict);
  const reported = byPath(verdict.findings);
  const seen = new Set<string>();
  for (const item of verdict.cases) {
    for (const sample of item.samples) {
      if (seen.has(sample.path))
        problems.push(`Two samples stand for \`${sample.path}\`: give each its own path.`);
      seen.add(sample.path);
      problems.push(...judgeSample(item, sample, reported.get(sample.path) ?? new Map()));
    }
  }
  for (const [path, rules] of reported) {
    if (!seen.has(path))
      problems.push(`\`${path}\` reports ${[...rules.keys()].join(", ")} but is not a sample.`);
  }
  return problems;
}
