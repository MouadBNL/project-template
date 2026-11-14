/**
 * Bridge between our errors-as-values code and oRPC, which reports a
 * procedure's declared errors by throwing them. Handlers return
 * `orThrow(result, toContractError)` and never throw themselves.
 */
import type { Result, TaggedError } from "@app/result";
import type { ORPCError } from "@orpc/server";

export function orThrow<T, E extends TaggedError>(
  result: Result<T, E>,
  toContractError: (error: E) => ORPCError<string, unknown>,
): T {
  if (result.ok) return result.value;
  throw toContractError(result.error);
}
