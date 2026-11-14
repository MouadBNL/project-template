/**
 * The whole API, in process, on a fresh test database. No port, no mocks.
 *
 *   const t = await createTestApp();
 *   const [error, data] = await safe(t.client.system.health());
 *
 * The client goes through the real Hono app (`app.fetch`): the oRPC handler and its serializer.
 * Override any dependency to put the app in the state a test needs: `{ now }` pins the clock,
 * `{ db: unreachableDb() }` takes the database away.
 */
import type { ApiClient } from "@app/contracts";
import { createTestDb } from "@app/db/testing";
import { createORPCClient, safe } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createApp, RPC_PREFIX } from "../app.ts";
import type { Deps } from "../context.ts";

/** Origin of every test request. */
const TEST_ORIGIN = "http://app.test";

export type TestApp = {
  /** A client of the whole API, typed from the contract. */
  readonly client: ApiClient;
};

export async function createTestApp(overrides: Partial<Deps> = {}): Promise<TestApp> {
  const app = createApp({
    lifecycle: { isShuttingDown: () => false },
    now: () => new Date(),
    db: overrides.db ?? (await createTestDb()),
    ...overrides,
  });
  const client: ApiClient = createORPCClient(
    new RPCLink({
      url: new URL(RPC_PREFIX, TEST_ORIGIN).href,
      fetch: async (request) => app.fetch(request),
    }),
  );
  return { client };
}

let warmed: Promise<void> | undefined;

/**
 * Once per worker: boots the test database and takes one request through every layer (the Hono
 * app, oRPC, Drizzle), so the first test of a worker does not pay for the warm-up. Called from
 * `src/test-setup.ts` in a `beforeAll` with its own generous limit.
 */
export async function warmUpTestApp(): Promise<void> {
  warmed ??= (async () => {
    const t = await createTestApp();
    await safe(t.client.system.health());
  })();
  await warmed;
}
