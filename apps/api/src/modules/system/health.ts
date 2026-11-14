import { ok, type Result } from "@app/result";
import type { Context } from "../../context.ts";
import { unavailable, type Unavailable } from "../../errors.ts";
import { pingDatabase } from "./system.repo.ts";

type Health = { readonly status: "ok"; readonly serverTime: Date };

/** Healthy when the server is not draining and its database answers. */
export async function checkHealth({
  lifecycle,
  now,
  db,
}: Context): Promise<Result<Health, Unavailable>> {
  if (lifecycle.isShuttingDown()) return unavailable("shutting_down");
  const pinged = await pingDatabase(db);
  if (!pinged.ok) return unavailable("database_unavailable");
  return ok({ status: "ok", serverTime: now() });
}
