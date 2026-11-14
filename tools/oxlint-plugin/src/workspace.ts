import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fromThrowable } from "@app/result";
import * as z from "zod";

/** Repo root, derived from this file's location: tools/oxlint-plugin/src. */
export const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

/** Must mirror `packages:` in pnpm-workspace.yaml. */
const WORKSPACE_DIRS = ["apps", "packages", "tools"];

const Manifest = z.object({ name: z.string() });

/** Workspace package name -> repo-relative directory, e.g. "@app/result" -> "packages/result". */
export function readWorkspacePackages(root: string = REPO_ROOT): Map<string, string> {
  const packages = new Map<string, string>();
  for (const group of WORKSPACE_DIRS) {
    const entries = fromThrowable(
      () => readdirSync(path.join(root, group)),
      () => ({ type: "missing_dir" }) as const,
    );
    if (!entries.ok) continue;
    for (const entry of entries.value) {
      const dir = `${group}/${entry}`;
      const manifest = fromThrowable(
        (): unknown => JSON.parse(readFileSync(path.join(root, dir, "package.json"), "utf8")),
        () => ({ type: "unreadable_manifest" }) as const,
      );
      if (!manifest.ok) continue;
      const parsed = Manifest.safeParse(manifest.value);
      if (parsed.success) packages.set(parsed.data.name, dir);
    }
  }
  return packages;
}
