import { describe, expect, it } from "vite-plus/test";
import { sized } from "./case.ts";
import { CASES } from "./cases/index.ts";

const count = (text: string): number => text.trimEnd().split("\n").length;

describe("sized", () => {
  it("writes a file of exactly the lines asked for", () => {
    expect(count(sized({ file: 300 }))).toBe(300);
    expect(count(sized({ file: 300, fn: 65, complexity: 15 }))).toBe(300);
  });

  it("writes a function of exactly the lines and complexity asked for", () => {
    const code = sized({ file: 20, fn: 20, complexity: 16 });
    expect(count(code)).toBe(20);
    expect(code.match(/ {2}if \(/gu)).toHaveLength(15);
    expect(code.startsWith("export function sized(n: number): number {")).toBe(true);
  });
});

describe("CASES", () => {
  it("gives every sample its own path", () => {
    const paths = CASES.flatMap((item) => item.samples.map((sample) => sample.path));
    expect(new Set(paths).size).toBe(paths.length);
  });
});
