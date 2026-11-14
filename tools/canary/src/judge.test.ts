import { describe, expect, it } from "vite-plus/test";
import { fires, passes, type Case } from "./case.ts";
import { judge, type Finding, type Verdict } from "./judge.ts";

const THROWS = "apps/api/src/modules/x/x.service.ts";
const ADAPTER = "apps/api/src/modules/x/x.adapter.ts";

const noThrow: Case = {
  convention: "no throw outside adapters",
  config: "`repo/no-throw`",
  samples: [fires(THROWS, "throw 1;\n", "repo/no-throw"), passes(ADAPTER, "throw 1;\n")],
};

const verdict = (findings: Finding[], overrides: Partial<Verdict> = {}): Verdict => ({
  cases: [noThrow],
  uncovered: [],
  findings,
  known: new Set(["repo/no-throw", "no-debugger"]),
  enabled: new Set(["repo/no-throw"]),
  ...overrides,
});

const threw: Finding = { path: THROWS, rule: "repo/no-throw", message: "No throw." };

describe("judge", () => {
  it("finds nothing wrong when each sample reports exactly what it expects", () => {
    expect(judge(verdict([threw]))).toEqual([]);
  });

  it("names the rule, the path and the config to check when a rule stops firing", () => {
    expect(judge(verdict([]))).toEqual([
      "`repo/no-throw` no longer fires on `apps/api/src/modules/x/x.service.ts` (no throw outside adapters). In vite.config.ts, `repo/no-throw` must be on for this path and no later override may turn it off or exclude the path. This case is configured by `repo/no-throw`.",
    ]);
  });

  it("reports a compliant sample that a rule now reaches", () => {
    const [problem] = judge(
      verdict([threw, { path: ADAPTER, rule: "repo/no-throw", message: "No throw." }]),
    );
    expect(problem).toContain(
      "`apps/api/src/modules/x/x.adapter.ts` must lint clean (no throw outside adapters), but `repo/no-throw` reports: No throw.",
    );
  });

  it("reports what a violating sample reports besides its expected rules", () => {
    const [problem] = judge(
      verdict([threw, { path: THROWS, rule: "no-debugger", message: "No debugger." }]),
    );
    expect(problem).toContain("also reports `no-debugger`: No debugger.");
  });

  it("fails a case that names a rule that does not exist", () => {
    const misspelt: Case = { ...noThrow, samples: [fires(THROWS, "throw 1;\n", "repo/no-thorw")] };
    const problems = judge(
      verdict([{ ...threw, rule: "repo/no-thorw" }], { cases: [misspelt, noThrow] }),
    );
    expect(problems.filter((problem) => problem.includes("no rule has that name"))).toEqual([
      "The case \"no throw outside adapters\" expects `repo/no-thorw` on `apps/api/src/modules/x/x.service.ts`, but no rule has that name (oxlint's rules, the config's JS plugins, `type-check`, `unused-disable-directive`). Fix the rule id in tools/canary/src/cases/.",
    ]);
  });

  it("fails a rule the config turns on that no case proves, unless it is excused", () => {
    const enabled = new Set(["repo/no-throw", "no-debugger"]);
    expect(judge(verdict([threw], { enabled }))).toEqual([
      "`no-debugger` is turned on in vite.config.ts, but no canary case proves it fires. Add a case to tools/canary/src/cases/ with a sample that violates it at a path where it applies (if no sample can trigger it cleanly, list it in UNCOVERED with the reason).",
    ]);
    const uncovered = [{ rule: "no-debugger", reason: "cannot be triggered" }];
    expect(judge(verdict([threw], { enabled, uncovered }))).toEqual([]);
  });

  it("fails an excuse that is stale", () => {
    const uncovered = [
      { rule: "repo/no-throw", reason: "proven after all" },
      { rule: "no-debugger", reason: "not on" },
    ];
    expect(judge(verdict([threw], { uncovered }))).toEqual([
      "UNCOVERED lists `repo/no-throw`, but a case proves it: remove it from UNCOVERED.",
      "UNCOVERED lists `no-debugger`, which vite.config.ts does not turn on: remove it from UNCOVERED.",
    ]);
  });

  it("fails two samples at one path, and a finding on a path no sample stands for", () => {
    const twice: Case = { ...noThrow, samples: [...noThrow.samples, passes(ADAPTER, "")] };
    const stray: Finding = { path: "elsewhere.ts", rule: "no-debugger", message: "No debugger." };
    expect(judge(verdict([threw, stray], { cases: [twice] }))).toEqual([
      "Two samples stand for `apps/api/src/modules/x/x.adapter.ts`: give each its own path.",
      "`elsewhere.ts` reports no-debugger but is not a sample.",
    ]);
  });
});
