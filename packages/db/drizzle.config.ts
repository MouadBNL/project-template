/**
 * drizzle-kit config. `pnpm -C packages/db generate` diffs `src/schema` against the committed
 * snapshots and writes a new SQL migration to `migrations/` (empty in the template, kept by its
 * `.gitkeep`). Generating needs no database; `createDb().migrate()` applies the migrations at
 * startup.
 */
import { defineConfig } from "drizzle-kit";
import { DB_SCHEMA } from "./src/schema/index.ts";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  schemaFilter: [DB_SCHEMA],
  out: "./migrations",
});
