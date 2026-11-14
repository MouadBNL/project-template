/**
 * The API server: parse the environment, open and migrate the database it names, serve, and
 * drain on SIGTERM/SIGINT (health answers `shutting_down` while open requests finish).
 */
import { serve } from "@hono/node-server";
import { createDb } from "@app/db";
import { createApp } from "./app.ts";
import { loadEnv } from "./env.ts";

/** Prints why the process cannot start, and exits. */
function exitWith(message: string, cause?: unknown): never {
  if (cause === undefined) console.error(message);
  else console.error(message, cause);
  process.exit(1);
}

const env = loadEnv();
if (!env.ok) exitWith(`Invalid environment:\n${env.error.issues}`);
const config = env.value;

const opened = await createDb({
  databaseUrl: config.DATABASE_URL,
  dataDir: config.PGLITE_DATA_DIR,
});
if (!opened.ok) exitWith("Cannot open the database:", opened.error.cause);
const database = opened.value;

const migrated = await database.migrate();
if (!migrated.ok) exitWith("Database migration failed:", migrated.error.cause);

console.info(
  database.driver === "pglite"
    ? `database: PGlite in ${config.PGLITE_DATA_DIR}`
    : "database: Postgres (DATABASE_URL)",
);

let shuttingDown = false;
const app = createApp({
  lifecycle: { isShuttingDown: () => shuttingDown },
  now: () => new Date(),
  db: database.db,
});

const server = serve({ fetch: app.fetch, port: config.API_PORT }, (info) => {
  console.info(`api listening on http://localhost:${info.port}`);
});

function shutdown(): void {
  shuttingDown = true;
  server.close(() => {
    void database.close();
  });
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
