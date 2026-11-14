import { unreachableDb } from "@app/db/testing";
import { isDefinedError, safe } from "@orpc/client";
import { describe, expect, it } from "vite-plus/test";
import { createTestApp } from "../../testing/test-app.ts";

const serverTime = new Date("2026-01-01T00:00:00.000Z");

describe("system.health", () => {
  it("reports ok with the server time, as a Date, over HTTP", async () => {
    const t = await createTestApp({ now: () => serverTime });
    const [error, data] = await safe(t.client.system.health());
    expect(error).toBeNull();
    expect(data).toEqual({ status: "ok", serverTime });
    expect(data?.serverTime).toBeInstanceOf(Date);
  });

  it("returns the declared SERVICE_UNAVAILABLE error while shutting down", async () => {
    const t = await createTestApp({ lifecycle: { isShuttingDown: () => true } });
    const [error] = await safe(t.client.system.health());
    expect(isDefinedError(error)).toBe(true);
    expect(error).toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      status: 503,
      data: { reason: "shutting_down" },
    });
  });

  it("returns SERVICE_UNAVAILABLE when the database does not answer", async () => {
    const t = await createTestApp({ db: unreachableDb() });
    const [error] = await safe(t.client.system.health());
    expect(isDefinedError(error)).toBe(true);
    expect(error).toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      status: 503,
      data: { reason: "database_unavailable" },
    });
  });
});
