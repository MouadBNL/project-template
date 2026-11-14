/**
 * `pnpm test:postgres`: everything PGlite cannot vouch for, on a real Postgres server.
 *
 *   1. starts a throwaway container (`E2E_POSTGRES_IMAGE`, default postgres:18) under a name of
 *      its own, published on a random free port of 127.0.0.1,
 *   2. runs the database and API test suites on it (`TEST_DATABASE_URL`: each test worker gets its
 *      own database there, and requests within a test run on parallel connections, so races
 *      really race),
 *   3. runs the end-to-end suite with the API on Postgres (`E2E_DATABASE_URL`), which migrates an
 *      empty database as it starts,
 *   4. removes the container, also when a step fails or the run is interrupted.
 *
 * Needs Docker. Not part of `pnpm check`. Touches no other container.
 */
import { execFile, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { childEnv, env } from "./env.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const run = promisify(execFile);
const container = `app-test-postgres-${randomBytes(4).toString("hex")}`;
const USER = "app";

async function docker(...args: string[]): Promise<string> {
  const { stdout } = await run("docker", args);
  return stdout.trim();
}

/** Runs a command with the terminal attached; rejects when it fails. */
async function step(
  title: string,
  [command, ...args]: readonly [string, ...string[]],
  extra: Record<string, string>,
  cwd = REPO,
) {
  console.info(`\n▶ ${title}`);
  const child = spawn(command, args, { cwd, env: childEnv(extra), stdio: "inherit" });
  const code = await new Promise<number | null>((resolve) => child.once("exit", resolve));
  if (code !== 0) throw new Error(`${title}: exited with ${String(code)}`);
}

async function ready(): Promise<void> {
  // Over TCP inside the container: the image's first-start init server listens on a socket only.
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await docker("exec", container, "pg_isready", "-h", "127.0.0.1", "-U", USER);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Postgres in ${container} did not become ready`);
}

async function createDatabase(name: string): Promise<void> {
  await docker("exec", container, "createdb", "-h", "127.0.0.1", "-U", USER, name);
}

async function remove(): Promise<void> {
  await run("docker", ["rm", "--force", container]).catch(() => undefined);
}

async function main(): Promise<void> {
  console.info(`Starting ${env.E2E_POSTGRES_IMAGE} as ${container}`);
  await docker(
    "run",
    "--detach",
    "--rm",
    "--name",
    container,
    "--publish",
    "127.0.0.1::5432",
    "--env",
    `POSTGRES_USER=${USER}`,
    "--env",
    `POSTGRES_PASSWORD=${USER}`,
    env.E2E_POSTGRES_IMAGE,
  );
  const published = await docker("port", container, "5432/tcp");
  const port = published.split(":").at(-1) ?? "";
  const server = `postgres://${USER}:${USER}@127.0.0.1:${port}`;
  await ready();

  const test = ["test", "--no-cache", "--no-fsModuleCache"];
  const onServer = { TEST_DATABASE_URL: `${server}/${USER}` };
  await step("packages/db tests on Postgres", ["vp", "-C", "packages/db", ...test], onServer);
  await step("apps/api tests on Postgres", ["vp", "-C", "apps/api", ...test], onServer);

  await createDatabase("e2e");
  await step(
    "end-to-end suite with the API on Postgres",
    ["playwright", "test"],
    { E2E_DATABASE_URL: `${server}/e2e` },
    path.join(REPO, "e2e"),
  );
}

process.once("SIGINT", () => void remove().then(() => process.exit(130)));
process.once("SIGTERM", () => void remove().then(() => process.exit(143)));
try {
  await main();
  console.info("\nAll Postgres checks passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await remove();
}
