import type { ProductVariant } from "../../domain/commerce";
import { colorsForSize, formatOptionLabel, type OptionLayout } from "./variantSelection";

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
  const sizeOptions = layout.showSize ? layout.uniqueSizes : [];
  const colorOptions = layout.showColor
    ? layout.showSize
      ? colorsForSize(purchasable, selectedSize)
      : layout.uniqueColors
    : [];

  return (
    <div className="flex flex-col gap-3" data-testid="pdp-variant-selector">
      {layout.showSize && (
        <div>
          <label htmlFor={sizeId} className="block text-sm font-medium mb-1">
            Size
          </label>
          <select
            id={sizeId}
            name="size"
            data-testid="pdp-select-size"
            className="border rounded px-2 py-1 min-w-[120px] focus:outline focus:ring-2"
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
          <select
            id={colorId}
            name="color"
            data-testid="pdp-select-color"
            className="border rounded px-2 py-1 min-w-[120px] focus:outline focus:ring-2"
            value={selectedColor ?? ""}
            disabled={layout.showSize && layout.showColor && !selectedSize}
            onChange={(e) =>
              onColorChange(e.target.value === "" ? null : e.target.value)
            }
            aria-label={
              layout.showSize && layout.showColor && !selectedSize
                ? "Color — first select a size"
                : "Color"
            }
          >
            <option value="">
              {layout.showSize && layout.showColor && !selectedSize
                ? "Select a size first"
                : "Select color"}
            </option>
            {colorOptions.map((c) => (
              <option key={c} value={c}>
                {formatOptionLabel(c)}
              </option>
            ))}
          </select>
        </div>
      )}

    </div>
  );
};

export default VariantSelector;
