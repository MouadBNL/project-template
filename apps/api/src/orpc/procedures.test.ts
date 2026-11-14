import { SERVICE_UNAVAILABLE } from "@app/contracts";
import { err, fromThrowable, ok, type Result } from "@app/result";
import { createORPCErrorConstructorMap } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";
import * as z from "zod";
import { unavailable, type Unavailable } from "../errors.ts";
import { respond } from "./procedures.ts";

/** A procedure's error map: the shared error and one of its own, as a contract would declare. */
const errors = createORPCErrorConstructorMap({
  SERVICE_UNAVAILABLE,
  CONFLICT: { status: 409, data: z.object({ reason: z.literal("name_taken") }) },
});

/** What `respond` throws for `result` (oRPC reports declared errors by throwing them). */
function thrownBy(run: () => unknown) {
  const ran = fromThrowable(run, (cause) => ({ type: "thrown", cause }) as const);
  return ran.ok ? undefined : ran.error.cause;
}

type NameTaken = { readonly type: "name_taken" };

const found = (): Result<number, Unavailable> => ok(42);

describe("respond", () => {
  it("returns the value of an ok result", () => {
    expect(respond(found(), errors)).toBe(42);
  });

  it("turns unavailable into the declared SERVICE_UNAVAILABLE carrying the reason", () => {
    const down: Result<number, Unavailable> = unavailable("database_unavailable");
    expect(thrownBy(() => respond(down, errors))).toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      status: 503,
      defined: true,
      data: { reason: "database_unavailable" },
    });
  });

  it("hands every other error to the router's own mapping", () => {
    const taken: Result<number, NameTaken | Unavailable> = err({ type: "name_taken" });
    expect(
      thrownBy(() =>
        respond(taken, errors, (error) => errors.CONFLICT({ data: { reason: error.type } })),
      ),
    ).toMatchObject({
      code: "CONFLICT",
      status: 409,
      defined: true,
      data: { reason: "name_taken" },
    });
  });
});
