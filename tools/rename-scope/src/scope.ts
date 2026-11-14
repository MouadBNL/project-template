import { err, fromThrowable, ok, type Result } from "@app/result";
import * as z from "zod";

/** Why a rename cannot start. */
export type ScopeProblem =
  | { readonly type: "invalid_name"; readonly name: string }
  | { readonly type: "no_scope" }
  | { readonly type: "mixed_scopes"; readonly scopes: readonly string[] }
  | { readonly type: "same_scope"; readonly scope: string };

/**
 * A name npm accepts both as a scope (`@<name>/x`) and as an unscoped package name: lower case
 * letters, digits, `-`, `.` and `_`, starting with a letter or digit.
 */
const NAME = /^[a-z0-9][a-z0-9._-]{0,49}$/u;

/** The new name, without the `@` a user may type: `acme` and `@acme` are the same. */
export function validateName(input: string): Result<string, ScopeProblem> {
  const name = input.startsWith("@") ? input.slice(1) : input;
  return NAME.test(name) ? ok(name) : err({ type: "invalid_name", name: input });
}

const Manifest = z.object({ name: z.string() });

/** `JSON.parse` as a value: a file that is not JSON is `invalid_json`. */
export const parseJson = (text: string): Result<unknown, { readonly type: "invalid_json" }> =>
  fromThrowable(
    (): unknown => JSON.parse(text),
    () => ({ type: "invalid_json" }) as const,
  );

/** The one scope every workspace package's `name` shares (`<scope>` of `@<scope>/api`). */
export function currentScope(manifests: readonly unknown[]): Result<string, ScopeProblem> {
  const scopes = new Set<string>();
  for (const manifest of manifests) {
    const parsed = Manifest.safeParse(manifest);
    const scope = parsed.success ? /^@(?<scope>[^/]+)\//u.exec(parsed.data.name) : null;
    if (scope?.groups?.["scope"] !== undefined) scopes.add(scope.groups["scope"]);
  }
  const [only, ...others] = scopes;
  if (only === undefined) return err({ type: "no_scope" });
  if (others.length > 0) return err({ type: "mixed_scopes", scopes: [...scopes].toSorted() });
  return ok(only);
}

const escape = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

/**
 * `text` with every `@<from>/` package reference turned into `@<to>/`. A reference starts the
 * word: `"@app/ui"`, `` `@app/db/testing` ``, `import "@app/ui/styles.css"`; `user@app/x` (an
 * address) is left alone, as is the bare word `app`.
 */
export function renameScopeIn(text: string, from: string, to: string): string {
  return text.replaceAll(new RegExp(`(?<![\\w.@-])@${escape(from)}/`, "gu"), `@${to}/`);
}

const RootManifest = z.looseObject({ name: z.string() });

/**
 * The root `package.json` with its `name` set to `to`, keeping every other byte (key order,
 * formatting); `null` when it has no `name`.
 */
export function renameRoot(json: string, to: string): string | null {
  const read = parseJson(json);
  const parsed = read.ok ? RootManifest.safeParse(read.value) : undefined;
  if (parsed?.success !== true) return null;
  const pattern = new RegExp(`("name"\\s*:\\s*)"${escape(parsed.data.name)}"`, "u");
  return json.replace(pattern, `$1"${to}"`);
}
