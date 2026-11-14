import { ORPCError } from "@orpc/client";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import { failureOf, type ApiFailure } from "./api-failure.ts";

const declared = (code: string, status: number, data: unknown) =>
  new ORPCError(code, { status, data, defined: true });

describe("ApiFailure", () => {
  it("is typed from the contract: each declared code with its data, and what any call meets", () => {
    expectTypeOf<ApiFailure<"system.health">>().toEqualTypeOf<
      | ({ readonly type: "service_unavailable" } & {
          readonly reason: "shutting_down" | "database_unavailable";
        })
      | { readonly type: "invalid_input" }
      | { readonly type: "unreachable" }
      | { readonly type: "unexpected" }
    >();
  });
});

describe("failureOf", () => {
  const ofHealth = failureOf("system.health");

  it("reads an error the procedure declares, with its data", () => {
    expect(
      ofHealth(declared("SERVICE_UNAVAILABLE", 503, { reason: "database_unavailable" })),
    ).toEqual({ type: "service_unavailable", reason: "database_unavailable" });
  });

  it("does not trust data the declaration does not allow", () => {
    expect(ofHealth(declared("SERVICE_UNAVAILABLE", 503, { reason: "made_up" }))).toEqual({
      type: "unreachable",
    });
    expect(ofHealth(declared("CONFLICT", 409, { reason: "taken" }))).toEqual({
      type: "unexpected",
    });
  });

  it("names what any call can meet", () => {
    expect(ofHealth(declared("BAD_REQUEST", 400, { issues: [] }))).toEqual({
      type: "invalid_input",
    });
    expect(ofHealth(new TypeError("Failed to fetch"))).toEqual({ type: "unreachable" });
    expect(ofHealth(new ORPCError("BAD_GATEWAY", { status: 502 }))).toEqual({
      type: "unreachable",
    });
    expect(ofHealth(new ORPCError("INTERNAL_SERVER_ERROR", { status: 500 }))).toEqual({
      type: "unexpected",
    });
  });
});
