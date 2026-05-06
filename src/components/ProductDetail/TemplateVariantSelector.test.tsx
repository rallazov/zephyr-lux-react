import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TemplateVariantSelector from "./TemplateVariantSelector";
import type { CatalogVariantAxis } from "../../catalog/types";
import type { ProductVariant } from "../../domain/commerce";

const AX1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AX2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const O1A = "11111111-1111-4111-8111-111111111111";
const O1B = "22222222-2222-4222-8222-222222222222";
const O2A = "33333333-3333-4333-8333-333333333333";

const axes: CatalogVariantAxis[] = [
  {
    id: AX1,
    axis_key: "waist",
    label: "Waist",
    sort_order: 0,
    options: [
      { id: O1A, option_key: "m", label: "M", sort_order: 0 },
      { id: O1B, option_key: "l", label: "L", sort_order: 1 },
    ],
  },
  {
    id: AX2,
    axis_key: "inseam",
    label: "Inseam",
    sort_order: 1,
    options: [{ id: O2A, option_key: "32", label: "32", sort_order: 0 }],
  },
];

function pv(sku: string, p: Array<{ axis: string; opt: string }>): ProductVariant {
  return {
    sku,
    price_cents: 100,
    currency: "usd",
    inventory_quantity: 2,
    status: "active",
    template_option_values: p.map((x) => ({ axis_id: x.axis, option_id: x.opt })),
  };
}

describe("TemplateVariantSelector", () => {
  it("disables inseam until waist is chosen (narrowing path)", async () => {
    const user = userEvent.setup();
    const purchasable = [
      pv("S1", [
        { axis: AX1, opt: O1A },
        { axis: AX2, opt: O2A },
      ]),
    ];
    const selected: Record<string, string | null> = { [AX1]: null, [AX2]: null };
    const onChange = vi.fn((axisId: string, optionId: string | null) => {
      selected[axisId] = optionId;
    });

    const { rerender } = render(
      <TemplateVariantSelector
        axes={axes}
        purchasable={purchasable}
        selected={{ ...selected }}
        onChange={onChange}
      />,
    );

    const inseam = screen.getByTestId("pdp-select-template-axis-inseam");
    expect(inseam).toBeDisabled();

    await user.selectOptions(screen.getByTestId("pdp-select-template-axis-waist"), O1A);

    rerender(
      <TemplateVariantSelector
        axes={axes}
        purchasable={purchasable}
        selected={{ [AX1]: O1A, [AX2]: null }}
        onChange={onChange}
      />,
    );

    expect(screen.getByTestId("pdp-select-template-axis-inseam")).not.toBeDisabled();
  });
});
