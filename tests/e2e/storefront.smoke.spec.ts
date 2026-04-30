import { test, expect } from "@playwright/test";

test.describe("storefront smoke", () => {
  test("home renders hero brand copy", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /premium essentials/i }),
    ).toBeVisible();
  });

  test("shop route renders product list heading", async ({ page }) => {
    await page.goto("/products");
    await expect(
      page.getByRole("heading", { name: /product list/i }),
    ).toBeVisible();
  });

  test("women collection renders collection hero", async ({ page }) => {
    await page.goto("/women");
    await expect(
      page.getByRole("heading", { name: /empower your style/i }),
    ).toBeVisible();
  });

  test("mobile drawer navigates to Shop", async ({ page }) => {
    const vp = page.viewportSize();
    test.skip(!vp || vp.width >= 768, "narrow viewport only");

    await page.goto("/");
    await page.getByRole("button", { name: /toggle navigation menu/i }).click();
    await page.locator("ul.nav-links.open").getByRole("link", { name: /^shop$/i }).click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(
      page.getByRole("heading", { name: /product list/i }),
    ).toBeVisible();
  });

  test("after scrolling down, switching nav route scrolls back to top", async ({ page }) => {
    await page.goto("/products");
    await expect(
      page.getByRole("heading", { name: /product list/i }),
    ).toBeVisible();

    await page.evaluate(() => {
      const maxY = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      window.scrollTo(0, maxY);
    });
    await expect
      .poll(async () => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(150);

    const narrow = (page.viewportSize()?.width ?? 1280) < 768;
    if (narrow) {
      await page.getByRole("button", { name: /toggle navigation menu/i }).click();
      await page.locator("ul.nav-links.open").getByRole("link", { name: /^women$/i }).click();
    } else {
      await page.locator("nav.navbar").getByRole("link", { name: /^women$/i }).click();
    }

    await expect(page).toHaveURL(/\/women$/);
    await expect(
      page.getByRole("heading", { name: /empower your style/i }),
    ).toBeVisible();
    await expect
      .poll(async () => page.evaluate(() => window.scrollY))
      .toBeLessThan(80);
  });
});
