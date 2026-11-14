/**
 * Renames the package scope for a new project: every `@app/*` becomes `@<name>/*` (package names,
 * imports, configs, docs) and the root package is named `<name>`.
 *
 *   node tools/rename-scope/src/main.ts acme
 *
 * Then run `vp install` (it relinks the workspace packages under their new names) and
 * `pnpm check`.
 */
import path from "node:path";
import { renameScope, type RenameFailure } from "./rename-scope.ts";

const REPO = path.resolve(import.meta.dirname, "../../..");

function describeFailure(failure: RenameFailure): string {
  let text: string;
  switch (failure.type) {
    case "invalid_name":
      text = `"${failure.name}" is not a valid name: use lower case letters, digits, "-", "." or "_", starting with a letter or digit (at most 50 characters), e.g. "acme".`;
      break;
    case "same_scope":
      text = `the packages are already named @${failure.scope}/*.`;
      break;
    case "no_scope":
      text =
        "no workspace package has a scoped name (@<scope>/<name>), so there is no scope to rename.";
      break;
    case "mixed_scopes":
      text = `the workspace packages use several scopes (${failure.scopes.map((scope) => `@${scope}`).join(", ")}); rename them to one by hand first.`;
      break;
    case "no_root_manifest":
      text = "there is no package.json with a name at the repository root.";
      break;
    case "format_failed":
      text = `renamed, but formatting the changed files failed (${String(failure.cause)}); run \`pnpm fix\` once \`vp install\` has run.`;
      break;
    case "io_failed":
      text = `could not read or write ${failure.path}: ${String(failure.cause)}`;
      break;
  }
  return `rename-scope: ${text}`;
}

const [name] = process.argv.slice(2);
if (name === undefined) {
  console.error(
    "Usage: node tools/rename-scope/src/main.ts <name>   (e.g. acme: the packages become @acme/*)",
  );
  process.exitCode = 1;
} else {
  const renamed = await renameScope(REPO, name);
  if (renamed.ok) {
    const { from, to, files } = renamed.value;
    console.info(
      `Renamed @${from}/* to @${to}/* and the root package to "${to}" in ${String(files.length)} files:`,
    );
    for (const file of files) console.info(`  ${file}`);
    console.info(
      "\nNext: run `vp install` (relinks the workspace packages under their new names), then `pnpm check`.",
    );
  } else {
    console.error(describeFailure(renamed.error));
    process.exitCode = 1;
  }
}
