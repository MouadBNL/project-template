import { describe, expect, it } from "vite-plus/test";
import { fromPromise, fromThrowable } from "./capture.adapter.ts";

const toInvalidJson = (cause: unknown) => ({ type: "invalid_json", cause }) as const;
const toUnavailable = (cause: unknown) => ({ type: "unavailable", cause }) as const;

describe("fromThrowable", () => {
  it("returns ok when the function returns", () => {
    expect(fromThrowable((): unknown => JSON.parse('{"a":1}'), toInvalidJson)).toEqual({
      ok: true,
      value: { a: 1 },
    });
  });

  it("returns the mapped error when the function throws", () => {
    const result = fromThrowable((): unknown => JSON.parse("{"), toInvalidJson);
    expect(result).toMatchObject({ ok: false, error: { type: "invalid_json" } });
    expect(result.ok ? undefined : result.error.cause).toBeInstanceOf(SyntaxError);
  });
});

describe("fromPromise", () => {
  it("returns ok when the promise resolves", async () => {
    expect(await fromPromise(async () => 1, toUnavailable)).toEqual({ ok: true, value: 1 });
  });

  it("returns the mapped error when the promise rejects", async () => {
    const cause = new Error("connection refused");
    expect(await fromPromise(() => Promise.reject(cause), toUnavailable)).toEqual({
      ok: false,
      error: { type: "unavailable", cause },
    });
  });

  it("captures a synchronous throw while creating the promise", async () => {
    const result = await fromPromise(
      (): Promise<unknown> => Promise.resolve(JSON.parse("{")),
      toUnavailable,
    );
    expect(result).toMatchObject({ ok: false, error: { type: "unavailable" } });
    expect(result.ok ? undefined : result.error.cause).toBeInstanceOf(SyntaxError);
  });
});
