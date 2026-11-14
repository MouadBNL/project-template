import type { ApiClient } from "@app/contracts";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

/**
 * The API, typed from the contract only: apps/web never imports apps/api. Same-origin `/rpc`;
 * the Vite dev server (and `vite preview`) proxies it to the API.
 *
 * `api.system.health()` resolves with the output or rejects with an `ORPCError`; a feature's
 * `api/` folder calls it through `fromPromise(..., failureOf("system.health"))` (lib/api-failure.ts),
 * so the rest of the app sees failures as values.
 */
export const api: ApiClient = createORPCClient(
  new RPCLink({
    // Resolved per call, so importing this module touches no browser global (Node tests import it),
    // and a test can stub the global `fetch` after importing it (testing/rpc-responses.ts).
    url: () => new URL("/rpc", window.location.origin),
    fetch: async (request, init) => fetch(request, init),
  }),
);
