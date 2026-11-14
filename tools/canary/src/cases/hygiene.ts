import { fires, lines, passes, type Case } from "../case.ts";

const AT = "apps/api/src/modules/canary-hygiene";

export const HYGIENE_CASES: readonly Case[] = [
  {
    convention: "no leftover debug output (console.info, warn and error stay allowed)",
    config: "`no-restricted-properties` (DEBUG_OUTPUT) in lint.rules",
    samples: [
      fires(
        `${AT}/debug.ts`,
        lines("export function trace(n: number): void {", "  console.log(n);", "}"),
        "no-restricted-properties",
      ),
      fires(
        "apps/web/src/lib/canary-debug.ts",
        lines("export function dump(n: number): void {", "  console.table([n]);", "}"),
        "no-restricted-properties",
      ),
      passes(
        `${AT}/report.ts`,
        lines(
          "export function report(n: number): void {",
          "  console.info(n);",
          "  console.error(n);",
          "}",
        ),
      ),
    ],
  },
  {
    convention: "named exports only (route files and tool configs excepted)",
    config: "`import/no-default-export` in lint.rules, and the DEFAULT_EXPORT_ALLOWED override",
    samples: [
      fires(
        `${AT}/default.ts`,
        lines("const limit = 3;", "export default limit;"),
        "import/no-default-export",
      ),
      passes(
        "apps/web/src/routes/canary-default.tsx",
        lines("export default function Page() {", "  return <p>Page</p>;", "}"),
      ),
      passes(
        "packages/db/drizzle.config.ts",
        lines('const config = { dialect: "postgresql" };', "export default config;"),
      ),
      passes(
        "e2e/playwright.config.ts",
        lines(
          'import { defineConfig } from "@playwright/test";',
          'export default defineConfig({ testDir: "tests" });',
        ),
      ),
    ],
  },
  {
    convention: "Vite+ imports: vite-plus, not vite or vitest",
    config: "`vite-plus/prefer-vite-plus-imports` in lint.rules",
    samples: [
      fires(
        "apps/web/vite.config.ts",
        lines(
          'import { defineConfig } from "vite";',
          "export default defineConfig({ server: { port: 5173 } });",
        ),
        "vite-plus/prefer-vite-plus-imports",
      ),
    ],
  },
  {
    convention: "one import per module, no side-effect import but a stylesheet",
    config: "`import/no-duplicates` and `import/no-unassigned-import` in lint.rules",
    samples: [
      fires(
        `${AT}/duplicates.ts`,
        lines(
          'import { ok } from "@app/result";',
          'import { err } from "@app/result";',
          'export const both = (): unknown => [ok(1), err({ type: "none" })];',
        ),
        "import/no-duplicates",
      ),
      fires(
        `${AT}/side-effect.ts`,
        lines('import "./report.ts";', "export const loaded = true;"),
        "import/no-unassigned-import",
      ),
      passes(
        "apps/web/src/canary-styles.ts",
        lines('import "./canary.css";', "export const styled = true;"),
      ),
      // The stylesheet the sample above imports (not linted).
      { path: "apps/web/src/canary.css", code: lines("p {", "  margin: 0;", "}"), reports: [] },
    ],
  },
  {
    convention: "file names are kebab-case (route files follow the router's syntax)",
    config: "the `unicorn/filename-case` override, which excludes apps/web/src/routes",
    samples: [
      fires(`${AT}/BadName.ts`, lines("export const named = true;"), "unicorn/filename-case"),
      passes(
        "apps/web/src/routes/$canaryId.tsx",
        lines('export const Route = { path: "/$canaryId" };'),
      ),
    ],
  },
  {
    convention: "the correctness and suspicious categories, and the oxc plugin, are on",
    config: "`categories` and `plugins` in lint",
    samples: [
      fires(
        `${AT}/debugger.ts`,
        lines("export function pause(): void {", "  debugger;", "}"),
        "no-debugger",
      ),
      fires(`${AT}/concat.ts`, lines('export const word = "a" + "b";'), "no-useless-concat"),
      fires(
        `${AT}/erasing.ts`,
        lines("export const none = (n: number): number => n * 0;"),
        "oxc/erasing-op",
      ),
    ],
  },
];
