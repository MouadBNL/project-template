import { onError, ORPCError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import type { Deps } from "./context.ts";
import { router } from "./router.ts";

/** Path prefix the RPC handler is mounted on. The web dev server proxies it. */
export const RPC_PREFIX = "/rpc";

/** Declared errors are expected, and so are oRPC's own 4xx; anything else is a defect. */
const isDefect = (error: unknown): boolean =>
  !(error instanceof ORPCError) || (!error.defined && error.status >= 500);

/**
 * The HTTP app: oRPC on `/rpc/*`.
 *
 * Defects (a bug, anything a `*.adapter.ts` rethrows) are handled here and only here: oRPC turns
 * one thrown inside a procedure into a 500 `INTERNAL_SERVER_ERROR`, Hono's `onError` does the
 * same for the rest, and both log it.
 */
export function createApp(deps: Deps): Hono {
  const handler = new RPCHandler(router, {
    clientInterceptors: [
      onError((error) => {
        if (isDefect(error)) console.error(error);
      }),
    ],
  });
  const app = new Hono();

  app.use(`${RPC_PREFIX}/*`, async (c, next) => {
    const { matched, response } = await handler.handle(c.req.raw, {
      prefix: RPC_PREFIX,
      context: deps,
    });
    if (matched) return c.newResponse(response.body, response);
    return next();
  });

  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}
