/**
 * Opening and migrating the database. An adapter because the drivers throw
 * when they cannot connect or a migration fails; both become values here.
 *
 * - `databaseUrl` set: real Postgres through node-postgres (`pg`).
 * - otherwise PGlite (Postgres compiled to WASM, in process): on disk under
 *   `dataDir` when given (dev), in memory when not (tests, scripts).
 */
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { err, ok, type Result } from "@app/result";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import type { PgAsyncDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";

/** A Drizzle database on either driver. Repos take this. */
export type Db = PgAsyncDatabase<PgQueryResultHKT>;

export type DbConfig = {
  /** `postgres://...`. When set, connects to that server and ignores `dataDir`. */
  readonly databaseUrl?: string | undefined;
  /** PGlite data directory (created if missing). Omit for an in-memory database. */
  readonly dataDir?: string | undefined;
};

export type Database = {
  readonly db: Db;
  readonly driver: "postgres" | "pglite";
  /** Applies the migrations in `packages/db/migrations` that have not run yet. */
  readonly migrate: () => Promise<Result<void, MigrationFailed>>;
  readonly close: () => Promise<void>;
};

export type DbUnavailable = { readonly type: "db_unavailable"; readonly cause: unknown };
export type MigrationFailed = { readonly type: "migration_failed"; readonly cause: unknown };

export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../migrations", import.meta.url));

export async function createDb(config: DbConfig = {}): Promise<Result<Database, DbUnavailable>> {
  try {
    return ok(
      config.databaseUrl === undefined
        ? await openPglite(config.dataDir)
        : await openPostgres(config.databaseUrl),
    );
  } catch (cause) {
    return err({ type: "db_unavailable", cause });
  }
}

/** Wraps an already open PGlite (the test harness shares one per worker). */
export function fromPglite(client: PGlite): Database {
  const db = drizzlePglite({ client });
  return {
    db,
    driver: "pglite",
    migrate: () => attempt(() => migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER })),
    close: () => client.close(),
  };
}

async function openPglite(dataDir: string | undefined): Promise<Database> {
  if (dataDir === undefined) return fromPglite(await PGlite.create());
  await mkdir(dataDir, { recursive: true });
  return fromPglite(await PGlite.create({ dataDir }));
}

async function openPostgres(url: string): Promise<Database> {
  const pool = new Pool({ connectionString: url });
  // An idle connection the server drops (restart, shutdown, network) is emitted as an `error`
  // event on the pool, and an unhandled one kills the process. It is not this request's failure:
  // the next query reconnects, or fails and `tryQuery` reports it as `db_unavailable`.
  pool.on("error", (error) => {
    console.warn(`database: an idle connection was lost (${error.message})`);
  });
  // The pool connects lazily; fail here, at startup, rather than on the first request.
  const connection = await pool.connect();
  connection.release();
  const db = drizzleNodePg({ client: pool });
  return {
    db,
    driver: "postgres",
    migrate: () => attempt(() => migrateNodePg(db, { migrationsFolder: MIGRATIONS_FOLDER })),
    close: () => pool.end(),
  };
}

async function attempt(run: () => Promise<unknown>): Promise<Result<void, MigrationFailed>> {
  try {
    await run();
    return ok();
  } catch (cause) {
    return err({ type: "migration_failed", cause });
  }
}
