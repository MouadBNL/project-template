import { describe, expect, it } from "vite-plus/test";
import { parseThemePreference, themeAttribute } from "./theme.ts";

describe("parseThemePreference", () => {
  it("reads a known value", () => {
    expect(parseThemePreference("dark")).toBe("dark");
  });

  it.each([null, "", "solarized"])("falls back to system for %j", (stored) => {
    expect(parseThemePreference(stored)).toBe("system");
  });
});

describe("themeAttribute", () => {
  it("pins light and dark, and removes the attribute for system", () => {
    expect(themeAttribute("light")).toBe("light");
    expect(themeAttribute("dark")).toBe("dark");
    expect(themeAttribute("system")).toBeNull();
  });
});
