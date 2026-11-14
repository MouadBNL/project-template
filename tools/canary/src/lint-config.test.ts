import { describe, expect, it } from "vite-plus/test";
import { readLintSettings } from "./lint-config.ts";

describe("readLintSettings", () => {
  it("collects every rule turned on, in lint.rules or an override, and the options", () => {
    const settings = readLintSettings({
      lint: {
        options: { typeCheck: true, reportUnusedDisableDirectives: "error" },
        jsPlugins: [{ name: "repo", specifier: "./plugin.ts" }, "vite-plus/oxlint-plugin"],
        rules: {
          "repo/no-throw": "error",
          "eslint/no-debugger": ["error"],
          "max-lines": ["error", { max: 3 }],
          "react/react-in-jsx-scope": "off",
        },
        overrides: [{ rules: { "repo/no-throw": "off", "vitest/no-focused-tests": "error" } }, {}],
      },
    });
    expect([...(settings?.enabled ?? [])].toSorted()).toEqual([
      "max-lines",
      "no-debugger",
      "repo/no-throw",
      "type-check",
      "unused-disable-directive",
      "vitest/no-focused-tests",
    ]);
    expect(settings?.jsPlugins).toEqual([
      { name: "repo", specifier: "./plugin.ts" },
      { name: undefined, specifier: "vite-plus/oxlint-plugin" },
    ]);
  });

  it("leaves out the options the config does not set", () => {
    expect([...(readLintSettings({ lint: {} })?.enabled ?? ["none read"])]).toEqual([]);
  });

  it("returns null for a config without a lint block", () => {
    expect(readLintSettings({ fmt: {} })).toBeNull();
  });
});
