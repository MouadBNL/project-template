/**
 * The only place in e2e/ that reads `process.env` (as `apps/<app>/src/env.ts` in the apps).
 * Defaults are ports nothing else in the repo uses, so the suite can run next to `pnpm dev`.
 */
import * as z from "zod";

const EnvSchema = z.object({
  E2E_API_PORT: z.coerce.number().int().min(1).max(65_535).default(3461),
  E2E_WEB_PORT: z.coerce.number().int().min(1).max(65_535).default(5461),
  /** Run the API on this Postgres instead of a throwaway PGlite (`pnpm test:postgres`). */
  E2E_DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
  /** Image of the throwaway server `pnpm test:postgres` starts. */
  E2E_POSTGRES_IMAGE: z.string().min(1).default("postgres:18"),
  CI: z.stringbool().default(false),
});

export const env = EnvSchema.parse(process.env);

export const API_URL = `http://localhost:${String(env.E2E_API_PORT)}`;
export const WEB_URL = `http://localhost:${String(env.E2E_WEB_PORT)}`;

/** The environment the suite's child processes start from: this one, minus the app's own settings. */
export function childEnv(overrides: Record<string, string>): Record<string, string> {
  const inherited = Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && !APP_SETTINGS.has(entry[0]),
  );
  return { ...Object.fromEntries(inherited), ...overrides };
}

/** Settings of apps/api and apps/web (`.env.example`); a developer's values must not leak in. */
const APP_SETTINGS = new Set(["API_PORT", "WEB_PORT", "DATABASE_URL", "PGLITE_DATA_DIR"]);
