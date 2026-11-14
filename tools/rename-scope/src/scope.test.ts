import { describe, expect, it } from "vite-plus/test";
import { currentScope, renameRoot, renameScopeIn, validateName } from "./scope.ts";

describe("validateName", () => {
  it.each(["acme", "@acme", "acme-labs", "a1.b_c"])("accepts %j", (input) => {
    expect(validateName(input)).toEqual({ ok: true, value: input.replace(/^@/u, "") });
  });

  it.each(["", "Acme", "-acme", ".acme", "ac me", "acme/x", "@", "a".repeat(51)])(
    "rejects %j",
    (input) => {
      expect(validateName(input)).toEqual({
        ok: false,
        error: { type: "invalid_name", name: input },
      });
    },
  );
});

describe("currentScope", () => {
  it("is the scope the workspace packages share; unscoped ones do not count", () => {
    const manifests = [{ name: "@fixture/api" }, { name: "@fixture/ui" }, { name: "tool" }, 3];
    expect(currentScope(manifests)).toEqual({ ok: true, value: "fixture" });
  });

  it("refuses no scope and several scopes", () => {
    expect(currentScope([{ name: "tool" }])).toEqual({ ok: false, error: { type: "no_scope" } });
    expect(currentScope([{ name: "@b/x" }, { name: "@a/y" }])).toEqual({
      ok: false,
      error: { type: "mixed_scopes", scopes: ["a", "b"] },
    });
  });
});

describe("renameScopeIn", () => {
  it("renames each package reference, in code, JSON, CSS and prose", () => {
    const text = [
      'import { ok } from "@fixture/result";',
      '"@fixture/db": "workspace:*",',
      '@import "@fixture/ui/styles.css";',
      "See `@fixture/db/testing` and @fixture/ui.",
    ].join("\n");
    expect(renameScopeIn(text, "fixture", "acme")).toBe(
      [
        'import { ok } from "@acme/result";',
        '"@acme/db": "workspace:*",',
        '@import "@acme/ui/styles.css";',
        "See `@acme/db/testing` and @acme/ui.",
      ].join("\n"),
    );
  });

  it("leaves an address, a longer scope and the bare word alone", () => {
    const text = "user@fixture/x @fixtures/y fixture:theme @fixture";
    expect(renameScopeIn(text, "fixture", "acme")).toBe(text);
  });
});

describe("renameRoot", () => {
  it("renames the root package and keeps every other byte", () => {
    const json = '{\n  "name": "template",\n  "private": true,\n  "scripts": { "name": "x" }\n}\n';
    expect(renameRoot(json, "acme")).toBe(
      '{\n  "name": "acme",\n  "private": true,\n  "scripts": { "name": "x" }\n}\n',
    );
  });

  it("returns null without a name, or for text that is not JSON", () => {
    expect(renameRoot('{ "private": true }', "acme")).toBeNull();
    expect(renameRoot("{", "acme")).toBeNull();
  });
});
