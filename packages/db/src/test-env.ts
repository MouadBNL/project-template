/**
 * The only place in packages/db that reads `process.env` (as `apps/<app>/src/env.ts` in the
 * apps), for the test harness only (`testing.ts`).
 */
import * as z from "zod";

const TestEnvSchema = z.object({
  /** A throwaway Postgres server to run the tests on instead of PGlite (`pnpm test:postgres`). */
  TEST_DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
});

export const testEnv = TestEnvSchema.parse(process.env);
