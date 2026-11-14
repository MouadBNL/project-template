import { fires, lines, passes, type Case, type Sample } from "../case.ts";

const AT = "apps/api/src/modules/canary-tests";
const SPECS = "e2e/tests";

/** A Vitest file at `path` whose only test has `body`. */
const vitest = (
  path: string,
  opening: string,
  body: string[],
  ...rules: [string, ...string[]]
): Sample =>
  fires(
    path,
    lines(
      'import { describe, expect, it } from "vite-plus/test";',
      'describe("sum", () => {',
      `  ${opening}, () => {`,
      ...body.map((line) => `    ${line}`),
      "  });",
      "});",
    ),
    ...rules,
  );

const ASSERT = ["expect(1 + 1).toBe(2);"];

/** A Playwright spec with one test, opened by `opening` (`test("title"`, `test.only("title"`). */
const spec = (
  name: string,
  opening: string,
  body: string[],
  ...rules: [string, ...string[]]
): Sample =>
  fires(
    `${SPECS}/${name}.spec.ts`,
    lines(
      'import { expect, test } from "@playwright/test";',
      `${opening}, async ({ page }) => {`,
      ...body.map((line) => `  ${line}`),
      "});",
    ),
    ...rules,
  );

export const TEST_CASES: readonly Case[] = [
  {
    convention: "no .only or .skip, no duplicate title, every test asserts (Vitest)",
    config: "the vitest plugin and its rules in the TESTS override",
    samples: [
      vitest(`${AT}/focused.test.ts`, 'it.only("adds"', ASSERT, "vitest/no-focused-tests"),
      vitest(`${AT}/disabled.test.ts`, 'it.skip("adds"', ASSERT, "vitest/no-disabled-tests"),
      fires(
        `${AT}/silent.test.ts`,
        lines(
          'import { describe, it } from "vite-plus/test";',
          'describe("sum", () => {',
          '  it("adds", () => {',
          "    String(1 + 1);",
          "  });",
          "});",
        ),
        "vitest/expect-expect",
      ),
      fires(
        `${AT}/twice.test.ts`,
        lines(
          'import { describe, expect, it } from "vite-plus/test";',
          'describe("sum", () => {',
          '  it("adds", () => {',
          "    expect(1 + 1).toBe(2);",
          "  });",
          '  it("adds", () => {',
          "    expect(2 + 2).toBe(4);",
          "  });",
          "});",
        ),
        "vitest/no-identical-title",
      ),
      passes(
        "apps/web/src/features/canary-tests/model/sum.test.ts",
        lines(
          'import { describe, expect, it } from "vite-plus/test";',
          'describe("sum", () => {',
          '  it("adds", () => {',
          "    expect(1 + 1).toBe(2);",
          "  });",
          "});",
        ),
      ),
    ],
  },
  {
    convention: "no snapshots, no early return under a condition, no .concurrent (Vitest)",
    config:
      "`vitest/no-restricted-matchers`, `repo/test-hygiene` and TEST_PROPERTIES in the TESTS overrides",
    samples: [
      vitest(
        `${AT}/snapshot.test.ts`,
        'it("adds"',
        ["expect(1 + 1).toMatchSnapshot();"],
        "vitest/no-restricted-matchers",
      ),
      vitest(
        `${AT}/early-return.test.ts`,
        'it("finds the first"',
        ["const first = [1].at(0);", "if (first === undefined) return;", "expect(first).toBe(1);"],
        "repo/test-hygiene",
      ),
      vitest(
        `${AT}/concurrent.test.ts`,
        'it.concurrent("adds"',
        ASSERT,
        "no-restricted-properties",
      ),
    ],
  },
  {
    convention: "tests find elements by role and label, never by test id",
    config: "TEST_PROPERTIES (`no-restricted-properties`) in the override for TESTS and E2E_TESTS",
    samples: [
      fires(
        "apps/web/src/features/canary-tests/components/label.test.tsx",
        lines(
          'import { render, screen } from "@testing-library/react";',
          'import { describe, expect, it } from "vite-plus/test";',
          'describe("label", () => {',
          '  it("shows its text", () => {',
          "    render(<p>Text</p>);",
          '    expect(screen.getByTestId("label")).toBeTruthy();',
          "  });",
          "});",
        ),
        "no-restricted-properties",
      ),
      spec(
        "by-test-id",
        'test("shows the title"',
        ['await expect(page.getByTestId("title")).toBeVisible();'],
        "no-restricted-properties",
      ),
    ],
  },
  {
    convention: "Playwright: no .only or .skip, every test asserts, no assertion under a condition",
    config: "`repo/test-hygiene` with `playwright: true` in the E2E_TESTS override",
    samples: [
      spec(
        "focused",
        'test.only("loads"',
        ['await expect(page).toHaveTitle("App");'],
        "repo/test-hygiene",
      ),
      spec(
        "disabled",
        'test.skip("loads"',
        ['await expect(page).toHaveTitle("App");'],
        "repo/test-hygiene",
      ),
      fires(
        `${SPECS}/silent.spec.ts`,
        lines(
          'import { test } from "@playwright/test";',
          'test("loads", async ({ page }) => {',
          '  await page.goto("/");',
          "});",
        ),
        "repo/test-hygiene",
      ),
      spec(
        "conditional",
        'test("loads"',
        ['await page.goto("/");', 'if (page.url() !== "") await expect(page).toHaveTitle("App");'],
        "repo/test-hygiene",
      ),
      passes(
        `${SPECS}/loads.spec.ts`,
        lines(
          'import { expect, test } from "@playwright/test";',
          'test("loads", async ({ page }) => {',
          '  await page.goto("/");',
          '  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();',
          "});",
        ),
      ),
    ],
  },
];
