/**
 * Errors several procedures can share, declared once. A procedure lists the errors it can return
 * in `.errors({...})`, reusing these definitions; on the client, `isDefinedError(error)` narrows
 * to them with a typed `code` and `data`.
 *
 *   const health = oc.output(HealthStatus).errors({ SERVICE_UNAVAILABLE });
 *
 * Add a shared error here when a second procedure needs it; an error only one procedure returns
 * can stay inline in its `.errors({...})`.
 */
import * as z from "zod";

/** Why the API cannot serve the request right now. */
export const UNAVAILABLE_REASONS = ["shutting_down", "database_unavailable"] as const;

/**
 * The server is up but cannot serve: it is draining before a restart, or its database does not
 * answer. Retrying later can succeed. The API returns it with `unavailable()` (`apps/api`).
 */
export const SERVICE_UNAVAILABLE = {
  status: 503,
  message: "The service is temporarily unavailable",
  data: z.object({ reason: z.enum(UNAVAILABLE_REASONS) }),
};
