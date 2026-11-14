import type { ApiFailure } from "../../../lib/api-failure.ts";

/** How asking the API for its health can fail: what `system.health` declares, and any call meets. */
export type HealthFailure = ApiFailure<"system.health">;

type Unavailable = Extract<HealthFailure, { readonly type: "service_unavailable" }>;

/** One wording per reason and per failure: a new one in the contract does not compile until worded. */
const UNAVAILABLE: Record<Unavailable["reason"], string> = {
  shutting_down: "The API is restarting. Try again in a moment.",
  database_unavailable: "The API cannot reach its database.",
};
const FAILURES: Record<Exclude<HealthFailure, Unavailable>["type"], string> = {
  unreachable: "The API does not answer.",
  invalid_input: "The API answered something this page does not understand.",
  unexpected: "The API answered something this page does not understand.",
};

/** Why the API is not healthy, in the user's words. */
export function describeHealthFailure(failure: HealthFailure): string {
  return failure.type === "service_unavailable"
    ? UNAVAILABLE[failure.reason]
    : FAILURES[failure.type];
}
