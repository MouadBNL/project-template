import { ok, type Result } from "@app/result";
import { planRename, type PlanProblem } from "./plan.ts";
import {
  formatWithVp,
  listFiles,
  readText,
  writeText,
  type FormatFailed,
  type TreeFailure,
} from "./tree.adapter.ts";

export type RenameFailure = PlanProblem | TreeFailure | FormatFailed;

export type Renamed = { readonly from: string; readonly to: string; readonly files: string[] };

type Format = (root: string, files: readonly string[]) => Promise<Result<void, FormatFailed>>;

/**
 * Renames the package scope of the repository at `root` to `name`, in every text file that names
 * it, then formats the files it changed (`format`, the repo's `vp fmt` unless a test passes its
 * own). Everything is read and the whole change computed before the first write.
 */
export async function renameScope(
  root: string,
  name: string,
  format: Format = formatWithVp,
): Promise<Result<Renamed, RenameFailure>> {
  const listed = await listFiles(root);
  if (!listed.ok) return listed;
  const texts = new Map<string, string>();
  for (const file of listed.value) {
    const read = await readText(root, file);
    if (!read.ok) return read;
    if (read.value !== null) texts.set(file, read.value);
  }
  const plan = planRename(texts, name);
  if (!plan.ok) return plan;
  for (const [file, text] of plan.value.changes) {
    const written = await writeText(root, file, text);
    if (!written.ok) return written;
  }
  const files = [...plan.value.changes.keys()];
  const formatted = await format(root, files);
  if (!formatted.ok) return formatted;
  return ok({ from: plan.value.from, to: plan.value.to, files });
}
