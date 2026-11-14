/**
 * Test databases. `import { createTestDb } from "@app/db/testing"`.
 *
 *   const db = await createTestDb(); // empty, fully migrated, ~1 ms
 *
 * Booting PGlite is the expensive part (about 2.5 s: initdb inside WASM, then migrations), so
 * each test worker boots one in-memory PGlite on first use, from a migrated snapshot cached on
 * disk when there is one (~0.4 s, see `snapshot.adapter.ts`). Every `createTestDb()` call after
 * that empties all tables in a single round trip, which gives the caller the same state as a
 * freshly migrated database at a fraction of the cost. Packages that use this run Vitest with
 * `isolate: false` (see their `vite.config.ts`) so the worker, and therefore the PGlite instance,
 * is reused across test files.
 *
 * One database per worker means one test at a time per worker: do not use `.concurrent`, and
 * call `createTestDb()` in each test (or `beforeEach`), not once per file. A database from an
 * earlier call is emptied by the next one.
 *
 * Real Postgres (`pnpm test:postgres`): with `TEST_DATABASE_URL` set to a throwaway server, each
 * worker creates its own database there instead (`app_test_<random>`), migrates it and empties
 * it the same way. The connection is a pool, so concurrent requests in a test really run in
 * parallel. The role must be a superuser (the reset turns off foreign key triggers).
 */
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { assert } from "vite-plus/test";
import { createDb, fromPglite, type Database, type Db } from "./client.adapter.ts";
import { DB_SCHEMA } from "./schema/index.ts";
import { readSnapshot, writeSnapshot } from "./snapshot.adapter.ts";
import { testEnv } from "./test-env.ts";

let shared: Promise<Db> | undefined;

/** A migrated in-memory PGlite: from the on-disk snapshot when there is one, else from scratch. */
async function bootClient(): Promise<PGlite> {
  const snapshot = await readSnapshot();
  if (snapshot !== undefined) return PGlite.create({ loadDataDir: snapshot });
  const client = await PGlite.create();
  const migrated = await fromPglite(client).migrate();
  if (!migrated.ok) assert.fail(`test database migration failed: ${String(migrated.error.cause)}`);
  await writeSnapshot(await client.dumpDataDir("none"));
  return client;
}

/**
 * Deletes every row of every table of `DB_SCHEMA`, in one round trip: the tables the
 * migrations created and any a test created itself. `replica` turns off foreign key triggers for
 * the reset, so table order does not matter.
 */
const RESET = sql.raw(`do $$
declare t record;
begin
  perform set_config('session_replication_role', 'replica', true);
  for t in select tablename from pg_tables where schemaname = '${DB_SCHEMA}' loop
    execute format('delete from %I.%I', '${DB_SCHEMA}', t.tablename);
  end loop;
end $$;`);

async function open(databaseUrl: string): Promise<Database> {
  const opened = await createDb({ databaseUrl });
  if (!opened.ok) assert.fail(`cannot connect to TEST_DATABASE_URL: ${String(opened.error.cause)}`);
  return opened.value;
}

/** A fresh, migrated database of this worker's own on the `TEST_DATABASE_URL` server. */
async function bootPostgres(serverUrl: string): Promise<Db> {
  const name = `app_test_${randomUUID().replaceAll("-", "")}`;
  const server = await open(serverUrl);
  await server.db.execute(sql.raw(`create database ${name}`));
  await server.close();
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  const database = await open(url.href);
  const migrated = await database.migrate();
  if (!migrated.ok) assert.fail(`test database migration failed: ${String(migrated.error.cause)}`);
  return database.db;
}

async function boot(): Promise<Db> {
  const serverUrl = testEnv.TEST_DATABASE_URL;
  return serverUrl === undefined ? fromPglite(await bootClient()).db : bootPostgres(serverUrl);
}

/**
 * Boots the worker's database if it is not up yet. Packages call it from a setup file in a
 * `beforeAll` with a generous timeout (`src/test-setup.ts`), so the boot, which takes seconds on
 * a loaded machine, is not counted against the 5 s limit of whichever test happens to run first.
 *
 * @internal For tests only (the `@app/db/testing` entry).
 */
export async function bootTestDb(): Promise<void> {
  shared ??= boot();
  await shared;
}

/**
 * An empty, fully migrated database (the worker's shared one, reset).
 *
 * @internal For tests only (the `@app/db/testing` entry).
 */
export async function createTestDb(): Promise<Db> {
  shared ??= boot();
  const db = await shared;
  await db.execute(RESET);
  return db;
}

/**
 * A database whose server refuses every connection (nothing listens on port 1), for testing what
 * code does when the database is down. Opening it does not connect; every query fails.
 *
 * @internal For tests only (the `@app/db/testing` entry).
 */
export function unreachableDb(): Db {
  return drizzle({ client: new Pool({ connectionString: "postgres://app@127.0.0.1:1/app" }) });
}
