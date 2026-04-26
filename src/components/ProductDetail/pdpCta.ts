import type { ProductVariant } from "../../domain/commerce";
import { type OptionLayout, resolveSelection } from "./variantSelection";

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
