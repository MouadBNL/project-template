/**
 * Rule ids, in the form the root `vite.config.ts` writes them: `max-lines`, `typescript/x`,
 * `repo/x`. oxlint reports a diagnostic as `eslint(max-lines)`, `typescript(x)`, `repo(x)`, and
 * the two React hooks rules as `react-hooks(x)` although the config names them `react/x`.
 */

/** A TypeScript error reported through `options.typeCheck`. */
export const TYPE_CHECK = "type-check";
/** A disable comment that disables nothing, reported through `reportUnusedDisableDirectives`. */
export const UNUSED_DIRECTIVE = "unused-disable-directive";

/** Display scopes oxlint reports under another name than the config uses. */
const REPORTED_SCOPES: Readonly<Record<string, string>> = { "react-hooks": "react" };
/** Registry scopes (`vp lint --rules`) spelt otherwise in the config. */
const REGISTRY_SCOPES: Readonly<Record<string, string>> = {
  jsx_a11y: "jsx-a11y",
  react_perf: "react-perf",
};

const CODE = /^(?<scope>[\w-]+)\((?<rule>[^)]+)\)$/u;
const TS_ERROR = /^TS\d+$/u;

/** `scope` + `rule` as the config writes it: eslint's rules go without a prefix. */
export const configId = (scope: string, rule: string): string =>
  scope === "eslint" ? rule : `${scope}/${rule}`;

/** The config's name for a reported diagnostic. */
export function reportedId(code: string | undefined, message: string): string {
  if (code === undefined)
    return /^Unused \w+-disable directive/u.test(message)
      ? UNUSED_DIRECTIVE
      : `(no code) ${message}`;
  const match = CODE.exec(code);
  const scope = match?.groups?.["scope"];
  const rule = match?.groups?.["rule"];
  if (scope === undefined || rule === undefined) return code;
  if (scope === "typescript" && TS_ERROR.test(rule)) return TYPE_CHECK;
  return configId(REPORTED_SCOPES[scope] ?? scope, rule);
}

/** The config's name for an entry of `vp lint --rules --format=json`. */
export const registryId = (scope: string, rule: string): string =>
  configId(REGISTRY_SCOPES[scope] ?? scope, rule);

/** The config's name for a key of `lint.rules`: `eslint/x` and `x` are the same rule. */
export const normalizeConfigName = (name: string): string =>
  name.startsWith("eslint/") ? name.slice("eslint/".length) : name;
