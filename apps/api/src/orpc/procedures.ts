/**
 * `respond`, which turns a service's `Result` into the procedure's output or its declared error.
 * Procedure bases (middlewares a handler starts from, e.g. one that requires a session) go here
 * too, next to it.
 *
 *   os.system.health.handler(async ({ context, errors }) =>
 *     respond(await checkHealth(context), errors),
 *   );
 *   os.things.create.handler(async ({ context, input, errors }) =>
 *     respond(await createThing(context, input), errors, (error) =>
 *       errors.CONFLICT({ data: { reason: error.type } }),
 *     ),
 *   );
 */
import type { SERVICE_UNAVAILABLE } from "@app/contracts";
import { UNAVAILABLE_REASONS } from "@app/contracts";
import type { Result, TaggedError } from "@app/result";
import { ORPCError, type ORPCErrorConstructorMap } from "@orpc/server";
import * as z from "zod";
import type { SharedError, Unavailable } from "../errors.ts";
import { orThrow } from "./result.adapter.ts";

type SharedErrorMap = ORPCErrorConstructorMap<{
  SERVICE_UNAVAILABLE: typeof SERVICE_UNAVAILABLE;
}>;

/** The constructor of `S` when `E` can hold `Error` (a procedure that never returns it needs none). */
type IfHolds<E, Error, S extends keyof SharedErrorMap> = [Extract<E, Error>] extends [never]
  ? unknown
  : Pick<SharedErrorMap, S>;

/** The constructors `respond` needs for the shared errors `E` can hold. */
type ErrorsFor<E> = IfHolds<E, Unavailable, "SERVICE_UNAVAILABLE">;

/** The errors a router maps itself: those of `E` that are not shared. */
type Own<E> = Exclude<E, SharedError>;
type OwnMapper<E> = [Own<E>] extends [never]
  ? []
  : [own: (error: Own<E>) => ORPCError<string, unknown>];

const SharedErrorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("unavailable"), reason: z.enum(UNAVAILABLE_REASONS) }),
]);

/**
 * An error the procedure does not declare: a bug, not something the caller can act on. An
 * undeclared 500, which `app.ts` logs as a defect.
 */
const defect = (error: TaggedError) => new ORPCError("INTERNAL_SERVER_ERROR", { cause: error });

/** The declared error for a shared one; a branch per variant of `SharedErrorSchema`. */
function sharedError(errors: Partial<SharedErrorMap>, error: z.infer<typeof SharedErrorSchema>) {
  if (errors.SERVICE_UNAVAILABLE !== undefined)
    return errors.SERVICE_UNAVAILABLE({ data: { reason: error.reason } });
  return defect(error);
}

/**
 * The service's value, or its error as the procedure's declared error: `Unavailable` ->
 * `SERVICE_UNAVAILABLE { reason }` (`src/errors.ts`). Every other error of the service goes to
 * `own`, which the type checker requires exactly when there is such an error; it maps them to the
 * procedure's own errors (usually `CONFLICT { reason }`). An error left unmapped is a defect.
 */
export function respond<T, E extends TaggedError>(
  result: Result<T, E>,
  errors: ErrorsFor<E>,
  ...own: OwnMapper<E>
): T;
export function respond<T>(
  result: Result<T, TaggedError>,
  errors: Partial<SharedErrorMap>,
  own?: (error: TaggedError) => ORPCError<string, unknown>,
): T {
  return orThrow(result, (error) => {
    const shared = SharedErrorSchema.safeParse(error);
    if (shared.success) return sharedError(errors, shared.data);
    return own === undefined ? defect(error) : own(error);
  });
}
