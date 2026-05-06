import { describe, expect, it } from "vitest";
import {
  adminVariantTemplateFormSchema,
  destructiveEditRequiresAcknowledgement,
  formToVariantTemplate,
  isStructuralTemplateDestructive,
  variantsSatisfyTemplate,
  type VariantRowLite,
} from "./variantTemplateValidation";
import { type VariantTemplate } from "../domain/commerce/variantTemplate";

const T_ID = "11111111-1111-4111-8111-111111111111";
const AXIS_SIZE = "22222222-2222-4222-8222-222222222222";
const AXIS_CLR = "33333333-3333-4333-8333-333333333333";
const OPT_S = "44444444-4444-4444-8444-444444444444";
const OPT_M = "55555555-5555-4555-8555-555555555555";
const OPT_BLK = "66666666-6666-4666-8666-666666666666";

function baseTemplate(overrides: Partial<VariantTemplate> = {}): VariantTemplate {
  return {
    id: T_ID,
    name: "Denim",
    status: "draft",
    axes: [
      {
        id: AXIS_SIZE,
        axis_key: "size",
        label: "Size",
        sort_order: 0,
        options: [
          { id: OPT_S, option_key: "s", label: "S", sort_order: 0 },
          { id: OPT_M, option_key: "m", label: "M", sort_order: 1 },
        ],
      },
      {
        id: AXIS_CLR,
        axis_key: "color",
        label: "Color",
        sort_order: 1,
        options: [{ id: OPT_BLK, option_key: "black", label: "Black", sort_order: 0 }],
      },
    ],
    ...overrides,
  };
}

describe("adminVariantTemplateFormSchema", () => {
  it("rejects duplicate axis keys", () => {
    const r = adminVariantTemplateFormSchema.safeParse({
      name: "X",
      status: "draft",
      axes: [
        {
          id: AXIS_SIZE,
          axis_key: "fit",
          label: null,
          sort_order: 0,
          options: [{ id: OPT_S, option_key: "a", label: null, sort_order: 0 }],
        },
        {
          id: AXIS_CLR,
          axis_key: "fit",
          label: null,
          sort_order: 1,
          options: [{ id: OPT_M, option_key: "b", label: null, sort_order: 0 }],
        },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("rejects unstable axis keys", () => {
    const r = adminVariantTemplateFormSchema.safeParse({
      name: "X",
      status: "draft",
      axes: [
        {
          id: AXIS_SIZE,
          axis_key: "Bad Key",
          label: null,
          sort_order: 0,
          options: [{ id: OPT_S, option_key: "a", label: null, sort_order: 0 }],
        },
      ],
    });
    expect(r.success).toBe(false);
  });
});

describe("variantsSatisfyTemplate", () => {
  const tpl = baseTemplate();

  it("allows distinct template option combinations", () => {
    const rows: VariantRowLite[] = [
      {
        sku: "A",
        template_option_values: [
          { axis_id: AXIS_SIZE, option_id: OPT_M },
          { axis_id: AXIS_CLR, option_id: OPT_BLK },
        ],
      },
      {
        sku: "B",
        template_option_values: [
          { axis_id: AXIS_SIZE, option_id: OPT_S },
          { axis_id: AXIS_CLR, option_id: OPT_BLK },
        ],
      },
    ];
    expect(variantsSatisfyTemplate(rows, tpl).ok).toBe(true);
  });

  it("rejects duplicate combination", () => {
    const combo = [
      { axis_id: AXIS_SIZE, option_id: OPT_M },
      { axis_id: AXIS_CLR, option_id: OPT_BLK },
    ];
    const rows: VariantRowLite[] = [
      { sku: "A", template_option_values: combo },
      { sku: "B", template_option_values: [...combo] },
    ];
    const r = variantsSatisfyTemplate(rows, tpl);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/same template combination/i);
  });

  it("rejects invalid option for axis", () => {
    const rows: VariantRowLite[] = [
      {
        sku: "A",
        template_option_values: [
          { axis_id: AXIS_SIZE, option_id: OPT_BLK },
          { axis_id: AXIS_CLR, option_id: OPT_BLK },
        ],
      },
    ];
    expect(variantsSatisfyTemplate(rows, tpl).ok).toBe(false);
  });

  it("rejects missing axis selection", () => {
    const rows: VariantRowLite[] = [
      {
        sku: "A",
        template_option_values: [{ axis_id: AXIS_SIZE, option_id: OPT_M }],
      },
    ];
    expect(variantsSatisfyTemplate(rows, tpl).ok).toBe(false);
  });

  it("supports a third axis when all rows specify option ids", () => {
    const axisFit = "77777777-7777-4777-8777-777777777777";
    const optSlim = "88888888-8888-4888-8888-888888888888";
    const tpl3 = baseTemplate({
      axes: [
        ...baseTemplate().axes,
        {
          id: axisFit,
          axis_key: "fit",
          label: "Fit",
          sort_order: 2,
          options: [{ id: optSlim, option_key: "slim", label: "Slim", sort_order: 0 }],
        },
      ],
    });
    const rows: VariantRowLite[] = [
      {
        sku: "A",
        template_option_values: [
          { axis_id: AXIS_SIZE, option_id: OPT_M },
          { axis_id: AXIS_CLR, option_id: OPT_BLK },
          { axis_id: axisFit, option_id: optSlim },
        ],
      },
    ];
    expect(variantsSatisfyTemplate(rows, tpl3).ok).toBe(true);
  });
});

describe("isStructuralTemplateDestructive", () => {
  it("detects axis removal", () => {
    const before = baseTemplate();
    const after = baseTemplate({
      axes: before.axes.filter((a) => a.id !== AXIS_CLR),
    });
    expect(isStructuralTemplateDestructive(before, after)).toBe(true);
  });

  it("detects axis key rename", () => {
    const before = baseTemplate();
    const after = structuredClone(before);
    after.axes[0]!.axis_key = "length";
    expect(isStructuralTemplateDestructive(before, after)).toBe(true);
  });

  it("detects removed option row", () => {
    const before = baseTemplate();
    const after = structuredClone(before);
    after.axes[0]!.options = after.axes[0]!.options.filter((o) => o.id !== OPT_S);
    expect(isStructuralTemplateDestructive(before, after)).toBe(true);
  });

  it("allows label and sort tweaks", () => {
    const before = baseTemplate();
    const after = structuredClone(before);
    after.axes[0]!.label = "Sized";
    after.axes[0]!.sort_order = 1;
    after.axes[1]!.sort_order = 0;
    after.axes[0]!.options[0]!.label = "Small";
    expect(isStructuralTemplateDestructive(before, after)).toBe(false);
  });
});

describe("destructiveEditRequiresAcknowledgement", () => {
  it("requires ack when structural change and assignments exist", () => {
    const before = baseTemplate();
    const after = structuredClone(before);
    after.axes[0]!.options = after.axes[0]!.options.filter((o) => o.id !== OPT_S);
    expect(destructiveEditRequiresAcknowledgement(before, after, 3)).toBe(true);
    expect(destructiveEditRequiresAcknowledgement(before, after, 0)).toBe(false);
  });

  it("requires ack when adding axis to assigned templates", () => {
    const before = baseTemplate();
    const after = structuredClone(before);
    after.axes.push({
      id: "77777777-7777-4777-8777-777777777777",
      axis_key: "rise",
      label: null,
      sort_order: 2,
      options: [{ id: OPT_BLK, option_key: "low", label: null, sort_order: 0 }],
    });
    expect(destructiveEditRequiresAcknowledgement(before, after, 1)).toBe(true);
    expect(destructiveEditRequiresAcknowledgement(before, after, 0)).toBe(false);
  });
});

describe("formToVariantTemplate", () => {
  it("drops blank labels to null", () => {
    const parsed = adminVariantTemplateFormSchema.parse({
      name: "T",
      status: "active",
      axes: [
        {
          id: AXIS_SIZE,
          axis_key: "size",
          label: "   ",
          sort_order: 0,
          options: [{ id: OPT_S, option_key: "s", label: "", sort_order: 0 }],
        },
      ],
    });
    const t = formToVariantTemplate(parsed, T_ID);
    expect(t.axes[0]!.label).toBeNull();
    expect(t.axes[0]!.options[0]!.label).toBeNull();
  });
});
