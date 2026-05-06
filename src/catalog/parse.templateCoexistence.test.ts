import { describe, expect, it } from "vitest";
import { computeOptionLayout, getPurchasableVariants } from "../components/ProductDetail/variantSelection";
import { parseStaticCatalogData } from "./parse";

const TEMPLATE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AXIS = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OPT_SMALL = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OPT_MED = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("parseStaticCatalogData mixed legacy + template fixtures", () => {
  it("parses a static templated product with PDP template slice aligned to option values", () => {
    const { bySlug } = parseStaticCatalogData([
      {
        id: 9001,
        supabase_product_id: "aaaaaaaa-0001-4000-8000-000000000001",
        slug: "fixture-templated-static",
        title: "Static template fixture",
        status: "active",
        variant_template_id: TEMPLATE_ID,
        variant_template: {
          id: TEMPLATE_ID,
          name: "Sized",
          axes: [
            {
              id: AXIS,
              axis_key: "size",
              label: "Size",
              sort_order: 0,
              options: [
                { id: OPT_SMALL, option_key: "small", label: "S", sort_order: 0 },
                { id: OPT_MED, option_key: "med", label: "M", sort_order: 1 },
              ],
            },
          ],
        },
        variants: [
          {
            sku: "FIX-TPL-S",
            price_cents: 1000,
            currency: "USD",
            inventory_quantity: 2,
            status: "active",
            template_option_values: [{ axis_id: AXIS, option_id: OPT_SMALL }],
          },
          {
            sku: "FIX-TPL-M",
            price_cents: 1000,
            currency: "USD",
            inventory_quantity: 2,
            status: "active",
            template_option_values: [{ axis_id: AXIS, option_id: OPT_MED }],
          },
        ],
      },
    ]);

    const detail = bySlug.get("fixture-templated-static");
    expect(detail?.variantTemplate?.id).toBe(TEMPLATE_ID);
    expect(detail?.product.variants[0]?.template_option_values).toEqual([
      { axis_id: AXIS, option_id: OPT_SMALL },
    ]);
  });

  it("Epic 9 pack path: detail without template uses legacy option layout (size-only surface)", () => {
    const { bySlug } = parseStaticCatalogData([
      {
        id: 101,
        slug: "boxer-briefs-pack",
        title: "Pack",
        status: "active",
        variants: [
          {
            sku: "ZLX-2PK-S",
            size: "S",
            color: null,
            price_cents: 2400,
            currency: "USD",
            inventory_quantity: 2,
            status: "active",
          },
          {
            sku: "ZLX-2PK-M",
            size: "M",
            color: null,
            price_cents: 2400,
            currency: "USD",
            inventory_quantity: 2,
            status: "active",
          },
        ],
      },
    ]);
    const detail = bySlug.get("boxer-briefs-pack");
    expect(detail?.variantTemplate).toBeFalsy();
    const purch = getPurchasableVariants(detail!.product.variants);
    const layout = computeOptionLayout(purch);
    expect(layout.surface).toBe("size");
    expect(layout.showColor).toBe(false);
  });
});
