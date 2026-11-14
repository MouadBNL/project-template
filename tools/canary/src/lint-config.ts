import * as z from "zod";
import { normalizeConfigName, TYPE_CHECK, UNUSED_DIRECTIVE } from "./rule-id.ts";

const Rules = z.record(z.string(), z.unknown());

/** The part of the root `vite.config.ts` the canary reads (its default export). */
const LintConfig = z.object({
  lint: z.object({
    rules: Rules.default({}),
    overrides: z.array(z.object({ rules: Rules.default({}) })).default([]),
    jsPlugins: z
      .array(z.union([z.string(), z.object({ name: z.string(), specifier: z.string() })]))
      .default([]),
    options: z
      .object({
        typeCheck: z.boolean().default(false),
        reportUnusedDisableDirectives: z.string().optional(),
      })
      .prefault({}),
  }),
});

export type JsPlugin = { readonly name: string | undefined; readonly specifier: string };

export type LintSettings = {
  /** Every rule an entry of `lint.rules` or of an override turns on, as the config names it. */
  readonly enabled: ReadonlySet<string>;
  readonly jsPlugins: readonly JsPlugin[];
};

const OFF = new Set(["off", "allow", 0]);

/** Whether a rule entry (`"error"`, `["error", {...}]`, `"off"`) turns the rule on. */
function isOn(entry: unknown): boolean {
  const severity: unknown = Array.isArray(entry) ? entry[0] : entry;
  return (typeof severity === "string" || typeof severity === "number") && !OFF.has(severity);
}

/** Reads the root config's lint settings; `null` when its shape is not what the canary knows. */
export function readLintSettings(config: unknown): LintSettings | null {
  const parsed = LintConfig.safeParse(config);
  if (!parsed.success) return null;
  const { lint } = parsed.data;
  const enabled = new Set<string>();
  for (const rules of [lint.rules, ...lint.overrides.map((override) => override.rules)]) {
    for (const [name, entry] of Object.entries(rules))
      if (isOn(entry)) enabled.add(normalizeConfigName(name));
  }
  if (lint.options.typeCheck) enabled.add(TYPE_CHECK);
  const unused = lint.options.reportUnusedDisableDirectives;
  if (unused !== undefined && !OFF.has(unused)) enabled.add(UNUSED_DIRECTIVE);
  const jsPlugins = lint.jsPlugins.map((plugin) =>
    typeof plugin === "string"
      ? { name: undefined, specifier: plugin }
      : { name: plugin.name, specifier: plugin.specifier },
  );
  return { enabled, jsPlugins };
}
