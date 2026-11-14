import { err, ok, type Result } from "@app/result";
import {
  currentScope,
  parseJson,
  renameRoot,
  renameScopeIn,
  validateName,
  type ScopeProblem,
} from "./scope.ts";

export type PlanProblem = ScopeProblem | { readonly type: "no_root_manifest" };

export type Plan = {
  readonly from: string;
  readonly to: string;
  /** The files whose text changes, with their new text. */
  readonly changes: ReadonlyMap<string, string>;
};

const ROOT_MANIFEST = "package.json";

/**
 * What renaming the scope to `input` changes in a tree of text files (repo-relative path ->
 * text): every `@<scope>/` reference becomes `@<name>/`, and the root package is named `<name>`.
 * The current scope is the one the workspace packages' manifests share. Nothing is written here.
 */
export function planRename(
  texts: ReadonlyMap<string, string>,
  input: string,
): Result<Plan, PlanProblem> {
  const name = validateName(input);
  if (!name.ok) return name;
  const root = texts.get(ROOT_MANIFEST);
  if (root === undefined) return err({ type: "no_root_manifest" });
  const manifests = [...texts]
    .filter(([file]) => file.endsWith(`/${ROOT_MANIFEST}`))
    .map(([, text]) => parseJson(text))
    .flatMap((parsed) => (parsed.ok ? [parsed.value] : []));
  const scope = currentScope(manifests);
  if (!scope.ok) return scope;
  if (scope.value === name.value) return err({ type: "same_scope", scope: scope.value });

  const changes = new Map<string, string>();
  for (const [file, text] of texts) {
    const renamed = renameScopeIn(text, scope.value, name.value);
    const next = file === ROOT_MANIFEST ? renameRoot(renamed, name.value) : renamed;
    if (next === null) return err({ type: "no_root_manifest" });
    if (next !== text) changes.set(file, next);
  }
  return ok({ from: scope.value, to: name.value, changes });
}
