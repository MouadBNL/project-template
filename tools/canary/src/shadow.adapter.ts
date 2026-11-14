/**
 * The canary's IO: loading the root config and the lint plugins it names, building the shadow
 * tree the samples are linted in, running `vp lint` there, removing the tree.
 *
 * The shadow tree is a temporary directory outside the repository laid out like it: the root
 * `vite.config.ts`, `package.json` and tsconfigs, each workspace package's `package.json` and
 * tsconfigs, and the source of every local JS plugin, all copied byte for byte; `node_modules`
 * symlinked to the real ones. Each sample is written at the path it stands for, so the overrides'
 * globs, the boundaries rule (which resolves paths against the plugin's own location) and the
 * type-aware rules (the nearest tsconfig) see it exactly as they would see a file of the repo, and
 * nothing in the repo is touched: a running dev server, editor or `vp check` never sees a sample.
 * The tree is removed when the run ends, also when it fails or is interrupted.
 *
 * An adapter: the filesystem, dynamic imports and child processes throw.
 */
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { cp, glob, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { err, ok, type Result } from "@app/result";
import type { Sample } from "./case.ts";
import type { JsPlugin } from "./lint-config.ts";
import { workspacePatterns } from "./lint-output.ts";

export type SetupFailed = {
  readonly type: "setup_failed";
  readonly step: string;
  readonly cause: unknown;
};

/** Root files the lint run reads: the config, and what type-aware linting resolves through. */
const ROOT_FILES = ["vite.config.ts", "package.json", "tsconfig.json", "tsconfig.base.json"];
const LINTED = /\.tsx?$/u;

async function attempt<T>(step: string, run: () => Promise<T>): Promise<Result<T, SetupFailed>> {
  try {
    return ok(await run());
  } catch (cause) {
    return err({ type: "setup_failed", step, cause });
  }
}

/** The root `vite.config.ts`'s default export. */
export const loadRootConfig = (repo: string): Promise<Result<unknown, SetupFailed>> =>
  attempt("load vite.config.ts", async (): Promise<unknown> => {
    const module: unknown = await import(pathToFileURL(path.join(repo, "vite.config.ts")).href);
    return typeof module === "object" && module !== null && "default" in module
      ? module.default
      : module;
  });

/** A JS plugin's module: a relative specifier is resolved against the repo root, like oxlint does. */
export const loadPlugin = (repo: string, plugin: JsPlugin): Promise<Result<unknown, SetupFailed>> =>
  attempt(
    `load the lint plugin ${plugin.specifier}`,
    async (): Promise<unknown> =>
      import(
        plugin.specifier.startsWith(".")
          ? pathToFileURL(path.join(repo, plugin.specifier)).href
          : plugin.specifier
      ),
  );

type Run = { readonly code: number | null; readonly stdout: string; readonly stderr: string };

/** Runs the repo's `vp` in `cwd` and collects its output; a non-zero exit is not a failure. */
const vp = (
  repo: string,
  cwd: string,
  args: readonly string[],
): Promise<Result<Run, SetupFailed>> =>
  attempt(
    `run vp ${args.slice(0, 2).join(" ")}`,
    () =>
      new Promise<Run>((resolve, reject) => {
        const child = spawn(path.join(repo, "node_modules/.bin/vp"), args, { cwd });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
        child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
        child.once("error", reject);
        child.once("close", (code) => resolve({ code, stdout, stderr }));
      }),
  );

/** `vp lint --rules --format=json`: oxlint's built-in rules. */
export const listBuiltinRules = (repo: string): Promise<Result<Run, SetupFailed>> =>
  vp(repo, repo, ["lint", "--rules", "--format=json"]);

/** Copies what the lint run reads into `shadow` and links `node_modules`. */
async function mirror(repo: string, shadow: string, plugins: readonly JsPlugin[]): Promise<void> {
  const link = async (dir: string) =>
    symlink(path.join(repo, dir, "node_modules"), path.join(shadow, dir, "node_modules"), "dir");
  for (const file of ROOT_FILES) await cp(path.join(repo, file), path.join(shadow, file));
  await link(".");
  const yaml = await readFile(path.join(repo, "pnpm-workspace.yaml"), "utf8");
  for (const pattern of workspacePatterns(yaml)) {
    for await (const manifest of glob(`${pattern}/package.json`, { cwd: repo })) {
      const dir = path.dirname(manifest);
      await mkdir(path.join(shadow, dir), { recursive: true });
      for await (const file of glob(`${dir}/{package.json,tsconfig*.json}`, { cwd: repo }))
        await cp(path.join(repo, file), path.join(shadow, file));
      await link(dir).catch(() => undefined);
    }
  }
  for (const { specifier } of plugins) {
    if (!specifier.startsWith(".")) continue;
    const dir = path.dirname(specifier);
    await cp(path.join(repo, dir), path.join(shadow, dir), { recursive: true });
  }
}

async function write(shadow: string, samples: readonly Sample[]): Promise<void> {
  for (const { path: file, code } of samples) {
    await mkdir(path.dirname(path.join(shadow, file)), { recursive: true });
    await writeFile(path.join(shadow, file), code);
  }
}

/**
 * Lints every sample at its path in a fresh shadow tree with the root config; returns what
 * `vp lint --format=json` printed. The tree is gone when this returns, and on SIGINT/SIGTERM.
 */
export async function lintInShadow(
  repo: string,
  samples: readonly Sample[],
  plugins: readonly JsPlugin[],
): Promise<Result<Run, SetupFailed>> {
  const created = await attempt("create the shadow tree", () =>
    mkdtemp(path.join(tmpdir(), "canary-")),
  );
  if (!created.ok) return created;
  const shadow = created.value;
  const remove = () => rmSync(shadow, { recursive: true, force: true });
  const interrupted = (signal: NodeJS.Signals) => {
    remove();
    process.kill(process.pid, signal);
  };
  process.once("SIGINT", interrupted);
  process.once("SIGTERM", interrupted);
  try {
    const built = await attempt("build the shadow tree", async () => {
      await mirror(repo, shadow, plugins);
      await write(shadow, samples);
    });
    if (!built.ok) return built;
    const files = samples.map((sample) => sample.path).filter((file) => LINTED.test(file));
    return await vp(repo, shadow, ["lint", "-c", "vite.config.ts", "--format=json", ...files]);
  } finally {
    process.off("SIGINT", interrupted);
    process.off("SIGTERM", interrupted);
    remove();
  }
}
