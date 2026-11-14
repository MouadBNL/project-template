import { err, fromThrowable, ok, type Result } from "@app/result";
import * as z from "zod";
import type { Finding } from "./judge.ts";
import { configId, registryId, reportedId } from "./rule-id.ts";

/** What `vp lint` printed, when it is not the JSON the canary expects. */
export type UnreadableOutput = { readonly type: "unreadable_output"; readonly output: string };

const Report = z.object({
  diagnostics: z.array(
    z.object({ code: z.string().optional(), message: z.string(), filename: z.string() }),
  ),
});
const Registry = z.array(z.object({ scope: z.string(), value: z.string() }));
const Plugin = z.object({
  meta: z.object({ name: z.string().optional() }).optional(),
  rules: z.record(z.string(), z.unknown()),
});

function parseJson<T>(output: string, schema: z.ZodType<T>): Result<T, UnreadableOutput> {
  const parsed = fromThrowable(
    (): unknown => JSON.parse(output),
    () => ({ type: "unreadable_output", output }) as const,
  );
  if (!parsed.ok) return parsed;
  const checked = schema.safeParse(parsed.value);
  return checked.success ? ok(checked.data) : err({ type: "unreadable_output", output });
}

/** `vp lint --format=json`: each diagnostic with its rule named as the config names it. */
export function readFindings(output: string): Result<Finding[], UnreadableOutput> {
  const report = parseJson(output, Report);
  if (!report.ok) return report;
  return ok(
    report.value.diagnostics.map(({ code, message, filename }) => ({
      path: filename.split("\\").join("/"),
      rule: reportedId(code, message),
      message,
    })),
  );
}

/** `vp lint --rules --format=json`: every built-in rule oxlint has. */
export function readRegistry(output: string): Result<string[], UnreadableOutput> {
  const registry = parseJson(output, Registry);
  if (!registry.ok) return registry;
  return ok(registry.value.map(({ scope, value }) => registryId(scope, value)));
}

/**
 * The rule ids a JS plugin module defines, under the name the config gives it (or its own
 * `meta.name`); `null` when the module is not a plugin.
 */
export function pluginRules(configName: string | undefined, module: unknown): string[] | null {
  const plugin = Plugin.safeParse(
    typeof module === "object" && module !== null && "default" in module ? module.default : module,
  );
  if (!plugin.success) return null;
  const name = configName ?? plugin.data.meta?.name;
  if (name === undefined) return null;
  return Object.keys(plugin.data.rules).map((rule) => configId(name, rule));
}

/** The `packages:` globs of pnpm-workspace.yaml (`apps/*`, `e2e`). */
export function workspacePatterns(yaml: string): string[] {
  const patterns: string[] = [];
  let inPackages = false;
  for (const line of yaml.split("\n")) {
    if (/^\S/u.test(line)) inPackages = line.startsWith("packages:");
    const item = /^\s+-\s+["']?(?<glob>[^"'\s]+)["']?\s*$/u.exec(line)?.groups?.["glob"];
    if (inPackages && item !== undefined) patterns.push(item);
  }
  return patterns;
}
