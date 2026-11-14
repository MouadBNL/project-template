import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { renderWithApp } from "../../../testing/render-with-app.tsx";
import { rpcError, rpcOutput } from "../../../testing/rpc-responses.ts";
import { SystemStatus } from "./system-status.tsx";

const healthy = () =>
  rpcOutput({ status: "ok", serverTime: "2026-01-01T12:00:00.000Z" }, ["serverTime"]);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SystemStatus", () => {
  it("shows a healthy API with its server time", async () => {
    vi.stubGlobal("fetch", async () => healthy());
    await renderWithApp(<SystemStatus />);
    expect(await screen.findByText("The API is healthy.")).toBeTruthy();
    expect(screen.getByText(/^Server time/).getAttribute("datetime")).toBe(
      "2026-01-01T12:00:00.000Z",
    );
  });

  it("words the declared error the API answers with", async () => {
    vi.stubGlobal("fetch", async () =>
      rpcError("SERVICE_UNAVAILABLE", 503, { reason: "database_unavailable" }),
    );
    await renderWithApp(<SystemStatus />);
    expect(await screen.findByText("The API cannot reach its database.")).toBeTruthy();
  });

  it("says so when the API does not answer, and checks again on request", async () => {
    const fetch = vi
      .fn<() => Promise<Response>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(healthy());
    vi.stubGlobal("fetch", fetch);
    await renderWithApp(<SystemStatus />);
    expect(await screen.findByText("The API does not answer.")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Check again" }));

    expect(await screen.findByText("The API is healthy.")).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
