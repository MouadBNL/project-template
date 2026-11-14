import type { ContractRouterClient } from "@orpc/contract";
import { system } from "./system.ts";

/** The whole API. `apps/api` implements it, `apps/web` is typed from it. Add a module per key. */
export const contract = {
  system,
};

/** Type of a client for the whole API, used by `apps/web` and API tests. */
export type ApiClient = ContractRouterClient<typeof contract>;

export { SERVICE_UNAVAILABLE, UNAVAILABLE_REASONS } from "./errors.ts";
