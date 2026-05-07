import { test, expect } from "@playwright/test";

/** Match `apiUrl` + `.env.e2e` / Playwright `webServer` (handlers on port 3333). */
const apiOrigin =
  process.env.PLAYWRIGHT_API_ORIGIN?.trim() || "http://127.0.0.1:3333";

test.describe("cart-quote API (direct)", () => {
  test("POST returns JSON quote for a known pack SKU", async ({ request }) => {
    const res = await request.post(`${apiOrigin}/api/cart-quote`, {
      data: { items: [{ sku: "ZLX-2PK-S", quantity: 1 }] },
    });
    const body = await res.json();
    expect(res.ok(), JSON.stringify(body)).toBeTruthy();
    expect(body).toMatchObject({
      currency: "usd",
      subtotal_cents: expect.any(Number),
      shipping_cents: expect.any(Number),
      tax_cents: expect.any(Number),
      total_cents: expect.any(Number),
    });
    expect(body.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sku: "ZLX-2PK-S",
          quantity: 1,
          unit_cents: expect.any(Number),
        }),
      ]),
    );
  });

  test("POST accepts legacy BLK-prefixed SKU and returns canonical line SKU", async ({
    request,
  }) => {
    const res = await request.post(`${apiOrigin}/api/cart-quote`, {
      data: { items: [{ sku: "ZLX-BLK-M", quantity: 1 }] },
    });
    const body = await res.json();
    expect(res.ok(), JSON.stringify(body)).toBeTruthy();
    expect(body.lines[0]).toMatchObject({ sku: "ZLX-2PK-M", quantity: 1 });
  });

  test("POST returns 400 for unknown SKU", async ({ request }) => {
    const res = await request.post(`${apiOrigin}/api/cart-quote`, {
      data: { items: [{ sku: "__UNKNOWN_SKU__", quantity: 1 }] },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ code: "UNKNOWN_SKU" });
    expect(typeof body.error).toBe("string");
  });
});

test.describe("cart quote in the UI", () => {
  test("bag loads server quote after add to cart (no quote error)", async ({ page }) => {
    await page.goto("/product/boxer-briefs");
    await page.getByTestId("pdp-variant-selector").waitFor({ state: "visible" });
    await page.getByTestId("pdp-select-size").selectOption("M");
    await page.getByTestId("pdp-add-to-cart").click();
    await page.goto("/cart");

    await expect(page.getByTestId("cart-quote-error")).toHaveCount(0);
    await expect(page.getByText(/Subtotal:/)).toBeVisible();
    await expect(page.getByText(/\$18\.99/).first()).toBeVisible({ timeout: 20_000 });
  });
});
