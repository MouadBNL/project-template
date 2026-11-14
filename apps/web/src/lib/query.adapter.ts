import type { Result, TaggedError } from "@app/result";

/**
 * TanStack Query learns about a failed fetch only when the `queryFn` throws; it then stores the
 * error and exposes it as a value (`query.error`, or the route's errorComponent for a loader).
 * This is the one place that turns our `Result` into that throw: the value, or the error thrown
 * for the query to record. (The API's `orThrow` is another thing: it maps a service error to a
 * declared contract error.)
 *
 *   queryFn: async () => unwrapForQuery(await fromPromise(() => api.system.health(), failureOf("system.health")))
 */
export function unwrapForQuery<T>(result: Result<T, TaggedError>): T {
  if (!result.ok) throw result.error;
  return result.value;
}
