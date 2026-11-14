/**
 * The errors every service shares, declared once. A service returns them; the router maps them
 * all with `respond` (`orpc/procedures.ts`) and maps only its own errors by hand.
 *
 *   if (lifecycle.isShuttingDown()) return unavailable("shutting_down");
 */
import type { UNAVAILABLE_REASONS } from "@app/contracts";
import { err, type Err } from "@app/result";

export type UnavailableReason = (typeof UNAVAILABLE_REASONS)[number];

/** The server cannot serve right now, and saying why is safe (the contract's `SERVICE_UNAVAILABLE`). */
export type Unavailable = { readonly type: "unavailable"; readonly reason: UnavailableReason };

/** The errors `respond` maps for every procedure. */
export type SharedError = Unavailable;

export const unavailable = (reason: UnavailableReason): Err<Unavailable> =>
  err({ type: "unavailable", reason });
