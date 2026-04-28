import type { ProductVariant } from "../../domain/commerce";
import {
  colorsForSize,
  formatOptionLabel,
  type OptionLayout,
} from "./variantSelection";

type Props = {
  purchasable: ProductVariant[];
  layout: OptionLayout;
  selectedSize: string | null;
  selectedColor: string | null;
  onSizeChange: (v: string | null) => void;
  onColorChange: (v: string | null) => void;
};

const VariantSelector: React.FC<Props> = (props) => {
  const {
    purchasable,
    layout,
    selectedSize,
    selectedColor,
    onSizeChange,
    onColorChange,
  } = props;

  const sizeId = "pdp-variant-size";
  const colorId = "pdp-variant-color";
  const colorHintId = "pdp-variant-color-hint";
  const sizeOptions = layout.showSize ? layout.uniqueSizes : [];
  const colorOptions = layout.showColor
    ? layout.showSize
      ? colorsForSize(purchasable, selectedSize)
      : layout.uniqueColors
    : [];

  const colorBlocked = Boolean(
    layout.showSize && layout.showColor && !selectedSize
  );

  if (!layout.showSize && !layout.showColor) {
    return null;
  }

  return (
    <fieldset
      className="flex flex-col gap-3 border-0 p-0 m-0"
      data-testid="pdp-variant-selector"
    >
      <legend className="sr-only">Size and color</legend>
      {layout.showSize && (
        <div>
          <label htmlFor={sizeId} className="block text-sm font-medium mb-1">
            Size
          </label>
          <select
            id={sizeId}
            name="size"
            data-testid="pdp-select-size"
            className="border border-stone-300 rounded-md px-2 py-2 min-w-[140px] bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2"
            value={selectedSize ?? ""}
            onChange={(e) =>
              onSizeChange(e.target.value === "" ? null : e.target.value)
            }
          >
            <option value="">Select size</option>
            {sizeOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {layout.showColor && (
        <div>
          <label htmlFor={colorId} className="block text-sm font-medium mb-1">
            Color
          </label>
          {colorBlocked ? (
            <p id={colorHintId} className="text-xs text-stone-500 mb-1">
              Select a size to see available colors.
            </p>
          ) : null}
          <select
            id={colorId}
            name="color"
            data-testid="pdp-select-color"
            className="border border-stone-300 rounded-md px-2 py-2 min-w-[140px] bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            value={selectedColor ?? ""}
            disabled={colorBlocked}
            onChange={(e) =>
              onColorChange(e.target.value === "" ? null : e.target.value)
            }
            aria-label={
              colorBlocked ? "Color — select a size first" : "Color"
            }
            aria-describedby={colorBlocked ? colorHintId : undefined}
          >
            <option value="">
              {colorBlocked ? "Select a size first" : "Select color"}
            </option>
            {colorOptions.map((c) => (
              <option key={c} value={c}>
                {formatOptionLabel(c)}
              </option>
            ))}
          </select>
        </div>
      )}
    </fieldset>
  );
};

export default VariantSelector;
