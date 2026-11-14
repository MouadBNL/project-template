/**
 * The skeleton's journey: the production build loads, talks to the real API through the preview
 * server's proxy and shows it healthy; a pinned theme applies before the first paint after a
 * reload (the inline script in apps/web/index.html). Everything is found by role and accessible
 * name, as a user (or a screen reader) finds it.
 */
import { expect, test } from "@playwright/test";

test("the app loads and shows the API as healthy", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const status = page.getByRole("region", { name: "System status" }).getByRole("status");
  await expect(status).toHaveText(/The API is healthy\./);

  await page.getByRole("button", { name: "Check again" }).click();
  await expect(status).toHaveText(/The API is healthy\./);

  await page.getByRole("radio", { name: "Dark" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
});
