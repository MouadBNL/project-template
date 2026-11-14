import { fromPromise } from "@app/result";
import { queryOptions } from "@tanstack/react-query";
import { failureOf } from "../../../lib/api-failure.ts";
import { api } from "../../../lib/orpc.ts";
import { unwrapForQuery } from "../../../lib/query.adapter.ts";
import type { HealthFailure } from "../model/health.ts";

/**
 * API health. Query options live here so the route loader can start the request
 * (`prefetchQuery`) and the component can read it (`useQuery`) with one key. A failure is a
 * `HealthFailure` value on the query (`query.error`), typed from the contract.
 */
export const healthQuery = queryOptions<
  Awaited<ReturnType<typeof api.system.health>>,
  HealthFailure
>({
  queryKey: ["system", "health"],
  queryFn: async () =>
    unwrapForQuery(await fromPromise(() => api.system.health(), failureOf("system.health"))),
  staleTime: 10_000,
  // The page shows what the API says now; "Check again" asks again.
  retry: false,
});
