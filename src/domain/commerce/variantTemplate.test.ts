import { describe, expect, it } from "vitest";
import {
  variantTemplateAxisOptionSchema,
  variantTemplateAxisSchema,
  variantTemplateSchema,
  variantTemplateStatusSchema,
} from "./variantTemplate";
import { productSchema, productVariantSchema } from "./product";

const validUuid = "11111111-1111-4111-8111-111111111111";

const validTemplate = {
  id: validUuid,
  name: "Footwear matrix",
  status: "draft" as const,
  axes: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      axis_key: "size",
      label: "Size",
      sort_order: 0,
      options: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          option_key: "m",
          label: "M",
          sort_order: 0,
        },
      ],
    },
  ],
};

describe("variantTemplateStatusSchema", () => {
  it("accepts lifecycle values", () => {
    expect(variantTemplateStatusSchema.safeParse("active").success).toBe(true);
    expect(variantTemplateStatusSchema.safeParse("archived").success).toBe(true);
  });

  it("rejects unknown status", () => {
    expect(variantTemplateStatusSchema.safeParse("published").success).toBe(false);
  });
});

describe("variantTemplateAxisOptionSchema", () => {
  it("requires option_key", () => {
    const bad = {
      ...validTemplate.axes[0].options[0],
      option_key: "",
    };
    expect(variantTemplateAxisOptionSchema.safeParse(bad).success).toBe(false);
  });

  it("allows null label from database rows", () => {
    const row = {
      ...validTemplate.axes[0].options[0],
      label: null,
    };
    expect(variantTemplateAxisOptionSchema.safeParse(row).success).toBe(true);
  });

  it("rejects unstable option keys", () => {
    const bad = {
      ...validTemplate.axes[0].options[0],
      option_key: "Display Size",
    };
    expect(variantTemplateAxisOptionSchema.safeParse(bad).success).toBe(false);
  });
});

describe("variantTemplateAxisSchema", () => {
  it("requires non-empty axis_key", () => {
    const bad = {
      ...validTemplate.axes[0],
      axis_key: "",
      options: validTemplate.axes[0].options,
    };
    expect(variantTemplateAxisSchema.safeParse(bad).success).toBe(false);
  });

  it("allows null label from database rows", () => {
    const row = {
      ...validTemplate.axes[0],
      label: null,
      options: validTemplate.axes[0].options,
    };
    expect(variantTemplateAxisSchema.safeParse(row).success).toBe(true);
  });

  it("rejects whitespace axis keys", () => {
    const bad = {
      ...validTemplate.axes[0],
      axis_key: "   ",
      options: validTemplate.axes[0].options,
    };
    expect(variantTemplateAxisSchema.safeParse(bad).success).toBe(false);
  });
});

describe("variantTemplateSchema", () => {
  it("parses a valid nested template", () => {
    expect(() => variantTemplateSchema.parse(validTemplate)).not.toThrow();
  });

  it("rejects invalid nested uuid", () => {
    const bad = {
      ...validTemplate,
      axes: [
        {
          ...validTemplate.axes[0],
          id: "not-a-uuid",
          options: validTemplate.axes[0].options,
        },
      ],
    };
    expect(variantTemplateSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects blank template names", () => {
    const bad = {
      ...validTemplate,
      name: "   ",
    };
    expect(variantTemplateSchema.safeParse(bad).success).toBe(false);
  });
});

describe("productSchema variant_template_id", () => {
  const minimalVariant = productVariantSchema.parse({
    sku: "SKU-1",
    price_cents: 100,
    currency: "USD",
    inventory_quantity: 1,
    status: "active",
  });

  it("allows omitting variant_template_id", () => {
    const p = productSchema.parse({
      slug: "x",
      title: "t",
      status: "draft",
      variants: [],
    });
    expect(p.variant_template_id).toBeUndefined();
  });

  it("allows null variant_template_id", () => {
    const p = productSchema.parse({
      slug: "x",
      title: "t",
      status: "draft",
      variants: [],
      variant_template_id: null,
    });
    expect(p.variant_template_id).toBeNull();
  });

  it("accepts a uuid variant_template_id", () => {
    const p = productSchema.parse({
      slug: "x",
      title: "t",
      status: "draft",
      variants: [],
      variant_template_id: validUuid,
    });
    expect(p.variant_template_id).toBe(validUuid);
  });

  it("rejects malformed uuid", () => {
    const r = productSchema.safeParse({
      slug: "x",
      title: "t",
      status: "draft",
      variants: [],
      variant_template_id: "nope",
    });
    expect(r.success).toBe(false);
  });

  it("still requires variants for non-draft when template id set", () => {
    const r = productSchema.safeParse({
      slug: "x",
      title: "t",
      status: "active",
      variants: [],
      variant_template_id: validUuid,
    });
    expect(r.success).toBe(false);
  });

  it("accepts active product with variant and template id", () => {
    const p = productSchema.parse({
      slug: "x",
      title: "t",
      status: "active",
      variants: [minimalVariant],
      variant_template_id: validUuid,
    });
    expect(p.variant_template_id).toBe(validUuid);
  });
});
