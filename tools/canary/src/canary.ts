import { err, ok, type Result } from "@app/result";
import { CASES, UNCOVERED } from "./cases/index.ts";
import { judge } from "./judge.ts";
import { readLintSettings, type JsPlugin } from "./lint-config.ts";
import { pluginRules, readFindings, readRegistry, type UnreadableOutput } from "./lint-output.ts";
import { TYPE_CHECK, UNUSED_DIRECTIVE } from "./rule-id.ts";
import {
  lintInShadow,
  listBuiltinRules,
  loadPlugin,
  loadRootConfig,
  type SetupFailed,
} from "./shadow.adapter.ts";

export type CanaryFailure =
  | SetupFailed
  | UnreadableOutput
  | { readonly type: "unknown_config" }
  | { readonly type: "not_a_plugin"; readonly specifier: string };

export type CanaryReport = {
  readonly cases: number;
  readonly samples: number;
  readonly problems: readonly string[];
};

/** Every rule id that exists for this config: built-in, from its JS plugins, and the options. */
async function knownRules(
  repo: string,
  plugins: readonly JsPlugin[],
): Promise<Result<Set<string>, CanaryFailure>> {
  const builtin = await listBuiltinRules(repo);
  if (!builtin.ok) return builtin;
  const registry = readRegistry(builtin.value.stdout);
  if (!registry.ok) return registry;
  const known = new Set([...registry.value, TYPE_CHECK, UNUSED_DIRECTIVE]);
  for (const plugin of plugins) {
    const loaded = await loadPlugin(repo, plugin);
    if (!loaded.ok) return loaded;
    const rules = pluginRules(plugin.name, loaded.value);
    if (rules === null) return err({ type: "not_a_plugin", specifier: plugin.specifier });
    for (const rule of rules) known.add(rule);
  }
  return ok(known);
}

/** Lints every case's samples with the root config and judges what was reported. */
export async function runCanary(repo: string): Promise<Result<CanaryReport, CanaryFailure>> {
  const config = await loadRootConfig(repo);
  if (!config.ok) return config;
  const settings = readLintSettings(config.value);
  if (settings === null) return err({ type: "unknown_config" });
  const known = await knownRules(repo, settings.jsPlugins);
  if (!known.ok) return known;
  const samples = CASES.flatMap((item) => item.samples);
  const linted = await lintInShadow(repo, samples, settings.jsPlugins);
  if (!linted.ok) return linted;
  const findings = readFindings(linted.value.stdout);
  if (!findings.ok)
    return err({ ...findings.error, output: linted.value.stderr || linted.value.stdout });
  const problems = judge({
    cases: CASES,
    uncovered: UNCOVERED,
    findings: findings.value,
    known: known.value,
    enabled: settings.enabled,
  });
  return ok({ cases: CASES.length, samples: samples.length, problems });
}
