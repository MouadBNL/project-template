import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import { err, ok, type Result } from "./result.ts";

type NotFound = { readonly type: "not_found"; readonly id: string };

function find(id: string): Result<number, NotFound> {
  return id === "42" ? ok(42) : err({ type: "not_found", id });
}

describe("ok", () => {
  it("wraps a value", () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
  });

  it("can carry no value", () => {
    expect(ok()).toEqual({ ok: true, value: undefined });
  });
});

describe("err", () => {
  it("wraps a tagged error and keeps the tag literal", () => {
    const e = err({ type: "conflict", field: "email" });
    expect(e).toEqual({ ok: false, error: { type: "conflict", field: "email" } });
    expectTypeOf(e.error.type).toEqualTypeOf<"conflict">();
  });
});

describe("Result", () => {
  it("narrows on ok", () => {
    const found = find("42");
    expect(found.ok).toBe(true);
    if (found.ok) expectTypeOf(found.value).toEqualTypeOf<number>();
  });

  it("narrows on !ok", () => {
    const missing = find("7");
    expect(missing).toEqual({ ok: false, error: { type: "not_found", id: "7" } });
    if (!missing.ok) expectTypeOf(missing.error).toEqualTypeOf<NotFound>();
  });
});
