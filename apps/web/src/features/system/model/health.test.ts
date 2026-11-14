import { describe, expect, it } from "vite-plus/test";
import { describeHealthFailure, type HealthFailure } from "./health.ts";

describe("describeHealthFailure", () => {
  it.each<[HealthFailure, string]>([
    [
      { type: "service_unavailable", reason: "shutting_down" },
      "The API is restarting. Try again in a moment.",
    ],
    [
      { type: "service_unavailable", reason: "database_unavailable" },
      "The API cannot reach its database.",
    ],
    [{ type: "unreachable" }, "The API does not answer."],
    [{ type: "unexpected" }, "The API answered something this page does not understand."],
  ])("words %j", (failure, words) => {
    expect(describeHealthFailure(failure)).toBe(words);
  });
});
