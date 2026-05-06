import { describe, expect, it } from "vitest";
import type { ProductVariant } from "../../domain/commerce";
import type { CatalogVariantAxis } from "../../catalog/types";
import {
  allowedOptionIdsForAxisIndex,
  resolveTemplateSelection,
} from "./variantSelection";

const AX1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AX2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AX3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const O1A = "11111111-1111-4111-8111-111111111111";
const O1B = "22222222-2222-4222-8222-222222222222";
const O2A = "33333333-3333-4333-8333-333333333333";
const O2B = "44444444-4444-4444-8444-444444444444";
const O3A = "55555555-5555-4555-8555-555555555555";
const O3B = "66666666-6666-4666-8666-666666666666";

function v(
  sku: string,
  pairs: Array<{ axis: string; opt: string }>,
  inv = 1,
): ProductVariant {
  return {
    sku,
    price_cents: 100,
    currency: "usd",
    inventory_quantity: inv,
    status: "active",
    template_option_values: pairs.map((p) => ({ axis_id: p.axis, option_id: p.opt })),
  };
}

const axes: CatalogVariantAxis[] = [
  {
    id: AX1,
    axis_key: "a1",
    label: "A1",
    sort_order: 0,
    options: [
      { id: O1A, option_key: "a", label: "A", sort_order: 0 },
      { id: O1B, option_key: "b", label: "B", sort_order: 1 },
    ],
  },
  {
    id: AX2,
    axis_key: "a2",
    label: "A2",
    sort_order: 1,
    options: [
      { id: O2A, option_key: "x", label: "X", sort_order: 0 },
      { id: O2B, option_key: "y", label: "Y", sort_order: 1 },
    ],
  },
  {
    id: AX3,
    axis_key: "a3",
    label: "A3",
    sort_order: 2,
    options: [
      { id: O3A, option_key: "p", label: "P", sort_order: 0 },
      { id: O3B, option_key: "q", label: "Q", sort_order: 1 },
    ],
  },
];

describe("template variant selection", () => {
  it("narrows later axes after earlier selection (three axes)", () => {
    const purchasable = [
      v("S1", [
        { axis: AX1, opt: O1A },
        { axis: AX2, opt: O2A },
        { axis: AX3, opt: O3A },
      ]),
      v("S2", [
        { axis: AX1, opt: O1A },
        { axis: AX2, opt: O2B },
        { axis: AX3, opt: O3B },
      ]),
      v("S3", [
        { axis: AX1, opt: O1B },
        { axis: AX2, opt: O2A },
        { axis: AX3, opt: O3B },
      ]),
    ];
    const sel0 = allowedOptionIdsForAxisIndex(0, axes, {}, purchasable);
    expect(sel0.has(O1A) && sel0.has(O1B)).toBe(true);

    const selPartial = { [AX1]: O1A } as Record<string, string | null>;
    const sel1 = allowedOptionIdsForAxisIndex(1, axes, selPartial, purchasable);
    expect(sel1.has(O2A) && sel1.has(O2B)).toBe(true);

    const selPartial2 = { [AX1]: O1A, [AX2]: O2A } as Record<string, string | null>;
    const sel2 = allowedOptionIdsForAxisIndex(2, axes, selPartial2, purchasable);
    expect(sel2.has(O3A)).toBe(true);
    expect(sel2.has(O3B)).toBe(false);
  });

  it("resolveTemplateSelection finds purchasable variant", () => {
    const all = [
      v("S1", [
        { axis: AX1, opt: O1A },
        { axis: AX2, opt: O2A },
      ], 0),
      v("S2", [
        { axis: AX1, opt: O1A },
        { axis: AX2, opt: O2B },
      ], 3),
    ];
    const purchasable = all.filter((x) => x.inventory_quantity > 0);
    const selected = { [AX1]: O1A, [AX2]: O2B } as Record<string, string | null>;
    const r = resolveTemplateSelection(all, purchasable, axes.slice(0, 2), selected);
    expect(r.kind).toBe("purchasable");
    if (r.kind === "purchasable") expect(r.variant.sku).toBe("S2");
  });
});
