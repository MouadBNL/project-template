/**
 * Every table. drizzle-kit reads this file (`drizzle.config.ts`) to generate migrations.
 *
 * The template has no tables yet. The first one goes in a file of its own next to this one
 * (`src/schema/<name>.ts`), exported from here and re-exported by `src/index.ts`
 * (`export * from "./schema/index.ts"`) so repos import it from `@app/db`; then
 * `pnpm -C packages/db generate` writes its migration to `migrations/`, which
 * `createDb().migrate()` applies at startup.
 */

/** The Postgres schema the tables live in: what drizzle-kit diffs and the test reset empties. */
export const DB_SCHEMA = "public";
