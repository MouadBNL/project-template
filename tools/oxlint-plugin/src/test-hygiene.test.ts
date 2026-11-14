import { ruleTester } from "./rule-tester.ts";
import { testHygiene } from "./test-hygiene.ts";

const playwright = [{ playwright: true }];

ruleTester.run("test-hygiene", testHygiene, {
  valid: [
    // Vitest: an assertion that narrows, then the checks.
    "it('finds the row', () => { const row = find(); assert(row !== undefined); expect(row.id).toBe(1); });",
    // A return inside a helper function, not the test.
    "it('maps', () => { const f = (x) => { if (x) return 1; return 2; }; expect(f(true)).toBe(1); });",
    // A return that ends the test unconditionally is not an early exit.
    "it('returns', () => { expect(1).toBe(1); return; });",
    // Playwright rules are off unless asked for.
    "test.skip('later', async () => {});",
    {
      options: playwright,
      code: "test('opens the home page', async ({ page }) => { await page.goto('/'); await expect(page).toHaveTitle('x'); });",
    },
    {
      options: playwright,
      code: "test.describe('orders', () => { test('loads', async ({ page }) => { for (const n of ['a']) await expect(page.getByText(n)).toBeVisible(); }); });",
    },
    {
      options: playwright,
      code: "test('steps', async ({ page }) => { await test.step('open', async () => { await expect(page).toHaveURL('/'); }); });",
    },
    {
      options: playwright,
      code: "test.beforeEach(async ({ page }) => { await page.goto('/'); });",
    },
  ],
  invalid: [
    {
      code: "it('finds the row', () => { const row = find(); if (row === undefined) return; expect(row.id).toBe(1); });",
      errors: [{ messageId: "earlyReturn" }],
    },
    {
      code: "test.each([1])('n %i', (n) => { if (!n) { return; } expect(n).toBe(1); });",
      errors: [{ messageId: "earlyReturn" }],
    },
    {
      options: playwright,
      code: "test.only('x', async ({ page }) => { await expect(page).toHaveTitle('x'); });",
      errors: [{ messageId: "focused" }],
    },
    {
      options: playwright,
      code: "test.describe.only('x', () => {});",
      errors: [{ messageId: "focused" }],
    },
    {
      options: playwright,
      code: "test.skip('x', async ({ page }) => { await expect(page).toHaveTitle('x'); });",
      errors: [{ messageId: "disabled", data: { name: "skip" } }],
    },
    {
      options: playwright,
      code: "test.fixme('x', async ({ page }) => { await expect(page).toHaveTitle('x'); });",
      errors: [{ messageId: "disabled", data: { name: "fixme" } }],
    },
    {
      options: playwright,
      code: "test('x', async ({ page }) => { test.skip(isMobile, 'no'); await expect(page).toHaveTitle('x'); });",
      errors: [{ messageId: "disabled", data: { name: "skip" } }],
    },
    {
      options: playwright,
      code: "test('opens', async ({ page }) => { await page.goto('/'); });",
      errors: [{ messageId: "noExpect" }],
    },
    {
      options: playwright,
      code: "test('x', async ({ page }) => { if (page.url() === '/') await expect(page).toHaveTitle('x'); });",
      errors: [{ messageId: "conditionalExpect" }],
    },
    {
      options: playwright,
      code: "test('x', async ({ page }) => { ready && (await expect(page).toHaveTitle('x')); });",
      errors: [{ messageId: "conditionalExpect" }],
    },
    {
      options: playwright,
      code: "test('x', async ({ page }) => { const t = await page.title(); if (!t) return; await expect(page).toHaveTitle(t); });",
      errors: [{ messageId: "earlyReturn" }],
    },
  ],
});
