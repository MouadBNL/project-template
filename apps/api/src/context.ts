/**
 * What every procedure receives as oRPC context.
 *
 * `Deps` are the long-lived dependencies: `main.ts` builds the real ones, tests build their own
 * (`src/testing/test-app.ts`). `createApp` hands them to the router for every request; a
 * per-request part (the caller's session, say) is added there, as `Context = Deps & { ... }`.
 */
import type { Db } from "@app/db";

export type Deps = {
  readonly lifecycle: Lifecycle;
  /** The one clock: code that needs the time takes it from here, so a test can pin it. */
  readonly now: () => Date;
  readonly db: Db;
};

export type Context = Deps;

type Lifecycle = {
  /** True once the process received SIGTERM/SIGINT and is draining. */
  readonly isShuttingDown: () => boolean;
};
