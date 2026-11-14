import { describe, expect, it } from "vite-plus/test";
import { pluginRules, readFindings, readRegistry, workspacePatterns } from "./lint-output.ts";

describe("readFindings", () => {
  it("names each diagnostic's rule as the config does", () => {
    const output = JSON.stringify({
      diagnostics: [
        { code: "repo(no-throw)", message: "No throw.", filename: "a.ts" },
        { code: "react-hooks(rules-of-hooks)", message: "Hooks.", filename: "b.tsx" },
        { code: "typescript(TS2322)", message: "Not assignable.", filename: "c.ts" },
        {
          message: "Unused oxlint-disable directive (no problems were reported).",
          filename: "d.ts",
        },
      ],
      number_of_files: 4,
    });
    expect(readFindings(output)).toEqual({
      ok: true,
      value: [
        { path: "a.ts", rule: "repo/no-throw", message: "No throw." },
        { path: "b.tsx", rule: "react/rules-of-hooks", message: "Hooks." },
        { path: "c.ts", rule: "type-check", message: "Not assignable." },
        {
          path: "d.ts",
          rule: "unused-disable-directive",
          message: "Unused oxlint-disable directive (no problems were reported).",
        },
      ],
    });
  });

  it("returns what was printed when it is not the JSON report", () => {
    expect(readFindings("Error: config not found")).toEqual({
      ok: false,
      error: { type: "unreadable_output", output: "Error: config not found" },
    });
    expect(readFindings("{}")).toMatchObject({ ok: false });
  });
});

describe("readRegistry", () => {
  it("reads oxlint's rule list with the config's names", () => {
    const output = JSON.stringify([
      { scope: "eslint", value: "no-debugger", category: "correctness" },
      { scope: "jsx_a11y", value: "alt-text", category: "correctness" },
      { scope: "typescript", value: "no-explicit-any", category: "restriction" },
    ]);
    expect(readRegistry(output)).toEqual({
      ok: true,
      value: ["no-debugger", "jsx-a11y/alt-text", "typescript/no-explicit-any"],
    });
  });
});

describe("pluginRules", () => {
  const plugin = { meta: { name: "own" }, rules: { "no-throw": {}, boundaries: {} } };

  it("names a plugin's rules by the name the config gives it, else by its own", () => {
    expect(pluginRules("repo", { default: plugin })).toEqual(["repo/no-throw", "repo/boundaries"]);
    expect(pluginRules(undefined, plugin)).toEqual(["own/no-throw", "own/boundaries"]);
  });

  it("returns null for a module that is not a plugin", () => {
    expect(pluginRules("repo", { default: { rules: 3 } })).toBeNull();
    expect(pluginRules(undefined, { rules: {} })).toBeNull();
  });
});

describe("workspacePatterns", () => {
  it("reads the packages list and nothing after it", () => {
    const yaml = [
      "packages:",
      "  - apps/*",
      '  - "tools/*"',
      "  - e2e",
      "",
      "catalog:",
      "  - not-a-package",
    ].join("\n");
    expect(workspacePatterns(yaml)).toEqual(["apps/*", "tools/*", "e2e"]);
  });
});
