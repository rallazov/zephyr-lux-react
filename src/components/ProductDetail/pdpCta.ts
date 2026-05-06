import type { ProductVariant } from "../../domain/commerce";
import type { CatalogVariantAxis } from "../../catalog/types";
import { type OptionLayout, resolveSelection, resolveTemplateSelection, type TemplateAxisSelection } from "./variantSelection";

export function pdpCtaTemplateState(
  allVariants: ProductVariant[],
  purchasable: ProductVariant[],
  axes: CatalogVariantAxis[],
  selected: TemplateAxisSelection
):
  | { disabled: true; text: string; hint: string }
  | { disabled: false; text: string; hint: string } {
  if (purchasable.length === 0) {
    return {
      disabled: true,
      text: "Out of stock",
      hint: "This product is not available in stock at the moment.",
    };
  }
  if (purchasable.length === 1) {
    return { disabled: false, text: "Add to cart", hint: "" };
  }
  const sorted = [...axes].sort((a, b) => a.sort_order - b.sort_order);
  const r = resolveTemplateSelection(allVariants, purchasable, sorted, selected);
  if (r.kind === "incomplete") {
    const firstMissing = sorted.find((ax) => {
      const v = selected[ax.id];
      return v == null || v === "";
    });
    const label = firstMissing?.label?.trim() || firstMissing?.axis_key || "option";
    return {
      disabled: true,
      text: "Select options",
      hint: `Choose ${label} and any other options to add this item to your bag.`,
    };
  }
  if (r.kind === "unavailable") {
    return {
      disabled: true,
      text: "Unavailable",
      hint: "This combination is not available. Choose different options.",
    };
  }
  if (r.kind === "not_purchasable") {
    if (r.variant.inventory_quantity === 0) {
      return {
        disabled: true,
        text: "Out of stock",
        hint: "This combination is out of stock.",
      };
    }
    return {
      disabled: true,
      text: "Unavailable",
      hint: "This item cannot be added to the cart in its current state.",
    };
  }
  return { disabled: false, text: "Add to cart", hint: "" };
}

export function pdpCtaState(
  purchasable: ProductVariant[],
  layout: OptionLayout,
  allVariants: ProductVariant[],
  size: string | null,
  color: string | null
):
  | { disabled: true; text: string; hint: string }
  | { disabled: false; text: string; hint: string } {
  if (purchasable.length === 0) {
    return {
      disabled: true,
      text: "Out of stock",
      hint: "This product is not available in any size or color at the moment.",
    };
  }
  const r = resolveSelection(allVariants, purchasable, layout, { size, color });
  if (r.kind === "incomplete") {
    if (layout.showSize && layout.showColor) {
      const needSize = size == null || size === "";
      const needColor = color == null || color === "";
      if (needSize && needColor) {
        return {
          disabled: true,
          text: "Select a size and color",
          hint: "Select a size and a color to add this item to your bag.",
        };
      }
      if (needSize) {
        return {
          disabled: true,
          text: "Select a size",
          hint: "Select a size to continue, then a color.",
        };
      }
      if (needColor) {
        return {
          disabled: true,
          text: "Select a color",
          hint: "Select a color to add this item to your bag.",
        };
      }
      return {
        disabled: true,
        text: "Select options",
        hint: "Complete your selection to add this item to your bag.",
      };
    }
    if (layout.showSize) {
      return {
        disabled: true,
        text: "Select a size",
        hint: "Select a size to continue.",
      };
    }
    if (layout.showColor) {
      return {
        disabled: true,
        text: "Select a color",
        hint: "Select a color to continue.",
      };
    }
  }
  if (r.kind === "unavailable") {
    return {
      disabled: true,
      text: "Unavailable",
      hint: "This combination is not available. Choose different options.",
    };
  }
  if (r.kind === "not_purchasable") {
    if (r.variant.inventory_quantity === 0) {
      return {
        disabled: true,
        text: "Out of stock",
        hint: "This size and color is out of stock.",
      };
    }
    return {
      disabled: true,
      text: "Unavailable",
      hint: "This item cannot be added to the cart in its current state.",
    };
  }
  return {
    disabled: false,
    text: "Add to cart",
    hint: "",
  };
}
