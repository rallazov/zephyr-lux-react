import { describe, expect, it } from "vitest";
import { adminSaveBundleSchema, bundleToRpcPayload } from "./validation";

const PID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AXIS = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OPT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("adminSaveBundleSchema template assign/clear coexistence", () => {
  it("allows clearing template_id while preserving legacy size/color on variants", () => {
    const parsed = adminSaveBundleSchema.parse({
      product: {
        id: PID,
        variant_template_id: null,
        slug: "legacy-ish",
        title: "Legacy",
        status: "draft",
      },
      variants: [
        {
          id: VID,
          sku: "LEG-1",
          size: "M",
          color: "Black",
          price_cents: 100,
          currency: "USD",
          inventory_quantity: 3,
          status: "active",
        },
      ],
      images: [],
      subscription_plans: [],
    });
    expect(parsed.product.variant_template_id).toBeNull();
    const payload = bundleToRpcPayload(parsed);
    const v = (payload.variants as { size?: string; color?: string }[])[0];
    expect(v?.size).toBe("M");
    expect(v?.color).toBe("Black");
  });

  it("requires template_option_values when product.variant_template_id is set", () => {
    const r = adminSaveBundleSchema.safeParse({
      product: {
        id: PID,
        variant_template_id: "11111111-1111-4111-8111-111111111111",
        slug: "templated-save",
        title: "Templated",
        status: "draft",
      },
      variants: [
        {
          id: VID,
          sku: "TPL-1",
          price_cents: 100,
          currency: "USD",
          inventory_quantity: 1,
          status: "active",
        },
      ],
      images: [],
      subscription_plans: [],
    });
    expect(r.success).toBe(false);
  });

  it("serializes coherent template bundles for RPC including option pairs", () => {
    const parsed = adminSaveBundleSchema.parse({
      product: {
        id: PID,
        variant_template_id: "11111111-1111-4111-8111-111111111111",
        slug: "templated-save-ok",
        title: "Templated OK",
        status: "draft",
      },
      variants: [
        {
          id: VID,
          sku: "TPL-1",
          template_option_values: [{ axis_id: AXIS, option_id: OPT }],
          price_cents: 100,
          currency: "USD",
          inventory_quantity: 1,
          status: "active",
        },
      ],
      images: [],
      subscription_plans: [],
    });
    const payload = bundleToRpcPayload(parsed);
    const v = (payload.variants as { template_option_values?: unknown }[])[0];
    expect(v?.template_option_values).toEqual([{ axis_id: AXIS, option_id: OPT }]);
  });
});
