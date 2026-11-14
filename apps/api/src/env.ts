/**
 * The only place in apps/api that reads `process.env` (enforced by lint).
 * Everything else receives the parsed `Env` as an argument.
 */
import { fileURLToPath } from "node:url";
import { err, ok, type Result } from "@app/result";
import * as z from "zod";

/** Default PGlite data directory: `<repo>/.data/pglite` (git-ignored), one per worktree. */
const DEFAULT_PGLITE_DIR = fileURLToPath(new URL("../../../.data/pglite", import.meta.url));

const EnvSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  /** Real Postgres. When unset, the API runs on PGlite in `PGLITE_DATA_DIR`. */
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
  PGLITE_DATA_DIR: z.string().min(1).default(DEFAULT_PGLITE_DIR),
});

export type Env = z.infer<typeof EnvSchema>;

type InvalidEnv = { readonly type: "invalid_env"; readonly issues: string };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Result<Env, InvalidEnv> {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) return err({ type: "invalid_env", issues: z.prettifyError(parsed.error) });
  return ok(parsed.data);
}
