import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end coverage for the post-payment cart-reset contract.
 *
 * Stripe's Payment Element redirects the browser to `return_url` after a
 * successful confirmation, so the inline `clearCart()` call inside the
 * checkout React tree never runs. The OrderConfirmation page is the
 * canonical place where the cart is reset on a committed payment intent.
 *
 * These tests deliberately avoid driving Stripe Elements (flaky in headless
 * CI and out of scope of our app code). Instead they seed a real cart,
 * navigate directly to the post-redirect URL Stripe would land on, and
 * assert the cart-clear contract from the user's perspective.
 */

const PRIMED_CART_PATH = "/product/merino-everyday-crew";

async function addMerinoCrewToCart(page: Page): Promise<void> {
  await page.goto(PRIMED_CART_PATH);
  await page.getByTestId("pdp-variant-selector").waitFor({ state: "visible" });
  await page.getByTestId("pdp-select-size").selectOption("M");
  await page.getByTestId("pdp-add-to-cart").click();
}

async function readPersistedCartLength(page: Page): Promise<number> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("cartItems");
    if (!raw) return 0;
    try {
      const parsed = JSON.parse(raw) as { items?: unknown[] };
      return Array.isArray(parsed.items) ? parsed.items.length : 0;
    } catch {
      return 0;
    }
  });
}

test.describe("Stripe return → cart reset", () => {
  test("succeeded redirect empties the cart and the bag page reflects it", async ({ page }) => {
    await addMerinoCrewToCart(page);
    expect(await readPersistedCartLength(page)).toBeGreaterThan(0);

    // Mimic the URL Stripe redirects to after a successful Payment Element confirmation.
    await page.goto(
      "/order-confirmation?payment_intent=pi_e2e_succeeded&payment_intent_client_secret=pi_e2e_succeeded_secret_x&redirect_status=succeeded",
    );

    await expect
      .poll(() => readPersistedCartLength(page), { timeout: 10_000 })
      .toBe(0);

    await page.goto("/cart");
    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
  });

  test("processing redirect also clears the cart (intent committed, settlement pending)", async ({ page }) => {
    await addMerinoCrewToCart(page);
    expect(await readPersistedCartLength(page)).toBeGreaterThan(0);

    await page.goto(
      "/order-confirmation?payment_intent=pi_e2e_processing&redirect_status=processing",
    );

    await expect
      .poll(() => readPersistedCartLength(page), { timeout: 10_000 })
      .toBe(0);
  });

  test("failed redirect preserves the cart so the shopper can retry", async ({ page }) => {
    await addMerinoCrewToCart(page);
    const beforeLen = await readPersistedCartLength(page);
    expect(beforeLen).toBeGreaterThan(0);

    await page.goto(
      "/order-confirmation?payment_intent=pi_e2e_failed&redirect_status=failed",
    );

    // Give the OrderConfirmation effects + CartProvider catalog hydration time to settle.
    await page.waitForTimeout(1500);

    expect(await readPersistedCartLength(page)).toBe(beforeLen);

    await page.goto("/cart");
    await expect(page.getByText(/your cart is empty/i)).toHaveCount(0);
  });

  test("direct navigation to /order-confirmation without Stripe params does not touch the cart", async ({ page }) => {
    await addMerinoCrewToCart(page);
    const beforeLen = await readPersistedCartLength(page);
    expect(beforeLen).toBeGreaterThan(0);

    await page.goto("/order-confirmation");
    await page.waitForTimeout(1000);

    expect(await readPersistedCartLength(page)).toBe(beforeLen);
  });

  test("idempotent: revisiting the same successful confirmation URL does not wipe a freshly-added item", async ({ page }) => {
    await addMerinoCrewToCart(page);

    await page.goto(
      "/order-confirmation?payment_intent=pi_e2e_idem&redirect_status=succeeded",
    );
    await expect
      .poll(() => readPersistedCartLength(page), { timeout: 10_000 })
      .toBe(0);

    // Shopper continues shopping, adds another item, then somehow lands on the
    // same confirmation URL again (browser back / deep link).
    await addMerinoCrewToCart(page);
    expect(await readPersistedCartLength(page)).toBeGreaterThan(0);

    await page.goto(
      "/order-confirmation?payment_intent=pi_e2e_idem&redirect_status=succeeded",
    );
    await page.waitForTimeout(1000);

    expect(await readPersistedCartLength(page)).toBeGreaterThan(0);
  });
});

test.describe("CheckoutPage gate against an empty cart", () => {
  test("navigating to /checkout with an empty cart bounces back to /cart", async ({ page }) => {
    await page.goto("/cart");
    await page.evaluate(() => window.localStorage.removeItem("cartItems"));

    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
  });
});
