import { fires, lines, passes, type Case } from "../case.ts";

const API = "apps/api/src/modules/canary-errors";

const CATCHING = lines(
  "export async function settle(run: () => Promise<number>): Promise<number> {",
  "  try {",
  "    return await run();",
  "  } catch (cause) {",
  '    throw new Error("failed", { cause });',
  "  }",
  "}",
  "export const orZero = (pending: Promise<number>): Promise<number> => pending.catch(() => 0);",
);

export const ERROR_CASES: readonly Case[] = [
  {
    convention: "errors are values: no throw, try/catch or .catch() outside *.adapter.ts",
    config: "`repo/no-throw` in lint.rules, and the override that turns it off for ADAPTERS only",
    samples: [
      fires(
        `${API}/halve.ts`,
        lines(
          "export function halve(n: number): number {",
          '  if (n % 2 === 1) throw new Error("odd");',
          "  return n / 2;",
          "}",
        ),
        "repo/no-throw",
      ),
      fires(
        "apps/web/src/features/canary-errors/api/parse.ts",
        lines(
          "export function parse(text: string): unknown {",
          "  try {",
          "    return JSON.parse(text);",
          "  } catch {",
          "    return null;",
          "  }",
          "}",
        ),
        "repo/no-throw",
      ),
      fires(
        "packages/result/src/canary-settle.ts",
        lines(
          "export const orZero = (pending: Promise<number>): Promise<number> => pending.catch(() => 0);",
        ),
        "repo/no-throw",
      ),
      fires(
        `${API}/halve.test.ts`,
        lines(
          'import { describe, expect, it } from "vite-plus/test";',
          'describe("halve", () => {',
          '  it("rejects odd numbers", () => {',
          "    expect(() => {",
          '      throw new Error("odd");',
          '    }).toThrow("odd");',
          "  });",
          "});",
        ),
        "repo/no-throw",
      ),
      passes(`${API}/settle.adapter.ts`, CATCHING),
      passes(
        `${API}/settle.adapter.test.ts`,
        lines(
          'import { describe, expect, it } from "vite-plus/test";',
          'import { settle } from "./settle.adapter.ts";',
          'describe("settle", () => {',
          '  it("wraps a rejection", async () => {',
          '    await expect(settle(() => Promise.reject(new Error("down")))).rejects.toThrow("failed");',
          "  });",
          "});",
        ),
      ),
    ],
  },
  {
    convention: "an adapter wraps third-party code and imports no API module or web feature",
    config: "the ADAPTERS zone of `repo/boundaries`",
    samples: [
      fires(
        "apps/api/src/orpc/canary.adapter.ts",
        lines(
          'import { limit } from "../modules/canary-adapted/index.ts";',
          "export const twice = (): number => limit * 2;",
        ),
        "repo/boundaries",
      ),
      passes("apps/api/src/modules/canary-adapted/index.ts", lines("export const limit = 3;")),
    ],
  },
  {
    convention: "callers handle every error variant: switches are exhaustive",
    config: "`typescript/switch-exhaustiveness-check` in lint.rules",
    samples: [
      fires(
        `${API}/describe.ts`,
        lines(
          'type Failure = { readonly type: "not_found" } | { readonly type: "conflict" };',
          "export function describe(failure: Failure): string {",
          "  switch (failure.type) {",
          '    case "not_found":',
          '      return "Not found.";',
          "  }",
          '  return "Unknown.";',
          "}",
        ),
        "typescript/switch-exhaustiveness-check",
      ),
      passes(
        `${API}/describe-all.ts`,
        lines(
          'type Failure = { readonly type: "not_found" } | { readonly type: "conflict" };',
          "export function describeAll(failure: Failure): string {",
          '  let text = "";',
          "  switch (failure.type) {",
          '    case "not_found":',
          '      text = "Not found.";',
          "      break;",
          '    case "conflict":',
          '      text = "Taken.";',
          "      break;",
          "  }",
          "  return text;",
          "}",
        ),
      ),
    ],
  },
  {
    convention: "process.env is read only in env.ts files and tool configs",
    config:
      "`repo/no-process-env` in lint.rules, and the override that turns it off for the env files and configs",
    samples: [
      fires(
        `${API}/port.ts`,
        lines('export const port = Number(process.env["API_PORT"]);'),
        "repo/no-process-env",
      ),
      passes("apps/api/src/env.ts", lines('export const port = Number(process.env["API_PORT"]);')),
      passes("e2e/src/env.ts", lines('export const port = Number(process.env["E2E_API_PORT"]);')),
      passes(
        "packages/db/src/test-env.ts",
        lines('export const url = process.env["DATABASE_URL"];'),
      ),
      passes(
        "apps/api/vite.config.ts",
        lines(
          'import { defineConfig } from "vite-plus";',
          'export default defineConfig({ test: { env: { TZ: process.env["TZ"] ?? "UTC" } } });',
        ),
      ),
    ],
  },
];
