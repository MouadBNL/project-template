/**
 * The rename's IO: listing the repository's text files, reading and writing them, formatting
 * them. An adapter because the filesystem and child processes throw.
 */
import { execFile } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { err, ok, type Result } from "@app/result";

export type FormatFailed = { readonly type: "format_failed"; readonly cause: unknown };

/**
 * Formats `files` with the repository's own formatter (`vp fmt`, root vite.config.ts): a longer
 * or shorter scope shifts the columns of Markdown tables and the wrapping of long lines.
 */
export async function formatWithVp(
  root: string,
  files: readonly string[],
): Promise<Result<void, FormatFailed>> {
  try {
    const vp = path.join(root, "node_modules/.bin/vp");
    await promisify(execFile)(vp, ["fmt", "--no-error-on-unmatched-pattern", ...files], {
      cwd: root,
    });
    return ok();
  } catch (cause) {
    return err({ type: "format_failed", cause });
  }
}

export type TreeFailure = {
  readonly type: "io_failed";
  readonly path: string;
  readonly cause: unknown;
};

/** Installed, generated or local-only directories: nothing in them is the project's own text. */
const SKIPPED = new Set([
  "node_modules",
  ".git",
  "dist",
  ".data",
  ".vitest",
  ".tanstack",
  "test-results",
  "playwright-report",
]);

async function walk(root: string, dir: string, files: string[]): Promise<void> {
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory() && !SKIPPED.has(entry.name)) await walk(root, relative, files);
    else if (entry.isFile()) files.push(relative.split(path.sep).join("/"));
  }
}

/** Every file of the tree at `root` outside SKIPPED, as repo-relative paths with `/`. */
export async function listFiles(root: string): Promise<Result<string[], TreeFailure>> {
  const files: string[] = [];
  try {
    await walk(root, "", files);
    return ok(files.toSorted());
  } catch (cause) {
    return err({ type: "io_failed", path: root, cause });
  }
}

/** A file's text, or `null` for a binary file (one with a NUL byte). */
export async function readText(
  root: string,
  file: string,
): Promise<Result<string | null, TreeFailure>> {
  try {
    const bytes = await readFile(path.join(root, file));
    return ok(bytes.includes(0) ? null : bytes.toString("utf8"));
  } catch (cause) {
    return err({ type: "io_failed", path: file, cause });
  }
}

export async function writeText(
  root: string,
  file: string,
  text: string,
): Promise<Result<void, TreeFailure>> {
  try {
    await writeFile(path.join(root, file), text);
    return ok();
  } catch (cause) {
    return err({ type: "io_failed", path: file, cause });
  }
}
