import { oc } from "@orpc/contract";
import * as z from "zod";
import { SERVICE_UNAVAILABLE } from "./errors.ts";

const HealthStatus = z.object({
  status: z.literal("ok"),
  /** A real `Date` on both ends: the RPC serializer preserves it over the wire. */
  serverTime: z.date(),
});

/**
 * `system.health`: liveness and readiness probe. Answers `ok` only when the server is not
 * shutting down and its database answers a query.
 *
 * Expected failures are part of the contract. Each key of `.errors()` is an error code the
 * client can narrow on with `isDefinedError`; `data` is validated on the server before it is sent.
 */
const health = oc.output(HealthStatus).errors({ SERVICE_UNAVAILABLE });

export const system = { health };
