/**
 * Playwright `globalSetup`: brings up the whole app for the suite and returns its teardown.
 *
 *   1. a throwaway PGlite directory in the OS temp dir (or `E2E_DATABASE_URL`, a real Postgres),
 *   2. a production build of the web app into that temp dir (Vite's `build()`, in this process),
 *   3. the API (`node apps/api/src/main.ts`, a child process) on `E2E_API_PORT`, which migrates
 *      the database as it starts,
 *   4. `vite preview` of the build (in this process) on `E2E_WEB_PORT`, proxying `/rpc` to the
 *      API like the dev server does.
 *
 * Nothing is shared with `pnpm dev`: other ports, another database, `.env` is not read and the
 * apps' own settings are dropped from the inherited environment. Teardown stops only what this
 * file started: the preview server it holds, and the API child by its PID (SIGTERM, then SIGKILL
 * after a grace period); then it deletes the temp dir.
 *
 * An adapter: process and server management throws, and a failed start must tear down what is up.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";
import { API_URL, childEnv, env } from "./env.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const API_DIR = path.join(REPO, "apps/api");
const WEB_DIR = path.join(REPO, "apps/web");

/** Startup can be slow on a loaded machine (a cold build, PGlite's first boot). */
const START_TIMEOUT_MS = 90_000;
const STOP_GRACE_MS = 5_000;

export default async function globalSetup(): Promise<() => Promise<void>> {
  await assertFree(env.E2E_API_PORT, "E2E_API_PORT");
  await assertFree(env.E2E_WEB_PORT, "E2E_WEB_PORT");

  const runDir = await mkdtemp(path.join(tmpdir(), "app-e2e-"));
  const cleanups: (() => Promise<void>)[] = [() => rm(runDir, { recursive: true, force: true })];
  const teardown = async (): Promise<void> => {
    for (const cleanup of cleanups.toReversed()) await cleanup();
  };

  try {
    const database: Record<string, string> =
      env.E2E_DATABASE_URL === undefined
        ? { PGLITE_DATA_DIR: path.join(runDir, "pglite") }
        : { DATABASE_URL: env.E2E_DATABASE_URL };
    const apiEnv = childEnv({ ...database, API_PORT: String(env.E2E_API_PORT) });
    const outDir = path.join(runDir, "web");

    await build({ root: WEB_DIR, logLevel: "error", build: { outDir, emptyOutDir: true } });

    const api = spawnNode(["src/main.ts"], apiEnv);
    cleanups.push(() => stop(api));
    await listening(api, /api listening on/);

    const proxy = { "/rpc": { target: API_URL } };
    const web = await preview({
      root: WEB_DIR,
      logLevel: "warn",
      build: { outDir },
      preview: { port: env.E2E_WEB_PORT, strictPort: true, proxy },
    });
    cleanups.push(() => web.close());
  } catch (error) {
    await teardown();
    throw error;
  }
  return teardown;
}

function spawnNode(args: string[], childEnvironment: Record<string, string>): ChildProcess {
  return spawn(process.execPath, args, {
    cwd: API_DIR,
    env: childEnvironment,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Everything the child printed so far, for the error message when it fails. */
function collect(child: ChildProcess): () => string {
  let output = "";
  const append = (chunk: Buffer): void => {
    output = (output + chunk.toString()).slice(-8_000);
  };
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  return () => output;
}

/** Resolves once the child prints `ready`; rejects if it exits or takes too long first. */
async function listening(child: ChildProcess, ready: RegExp): Promise<void> {
  const output = collect(child);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`API not listening after ${String(START_TIMEOUT_MS)} ms:\n${output()}`));
    }, START_TIMEOUT_MS);
    child.stdout?.on("data", () => {
      if (ready.test(output())) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`API exited with ${String(code)} during startup:\n${output()}`));
    });
  });
  // From here on, only errors matter (a defect the API logs while a test runs).
  child.stderr?.on("data", (chunk: Buffer) => process.stderr.write(`[api] ${chunk.toString()}`));
}

/** SIGTERM to this child's PID, SIGKILL if it is still running after the grace period. */
async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), STOP_GRACE_MS);
  await exited;
  clearTimeout(timer);
}

async function assertFree(port: number, name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.once("error", () => {
      reject(new Error(`Port ${String(port)} is in use. Free it or set ${name} to another port.`));
    });
    server.listen(port, () => server.close(() => resolve()));
  });
}
