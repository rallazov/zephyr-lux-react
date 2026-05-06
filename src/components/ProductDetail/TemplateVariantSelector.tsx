import React from "react";
import type { CatalogVariantAxis } from "../../catalog/types";
import type { ProductVariant } from "../../domain/commerce";
import {
  allowedOptionIdsForAxisIndex,
  formatOptionLabel,
  type TemplateAxisSelection,
} from "./variantSelection";

type Props = {
  axes: CatalogVariantAxis[];
  purchasable: ProductVariant[];
  selected: TemplateAxisSelection;
  onChange: (axisId: string, optionId: string | null) => void;
};

const TemplateVariantSelector: React.FC<Props> = (props) => {
  const { axes, purchasable, selected, onChange } = props;
  const sorted = [...axes].sort((a, b) => a.sort_order - b.sort_order);

  if (sorted.length === 0) {
    return null;
  }

  return (
    <fieldset
      className="flex flex-col gap-3 border-0 p-0 m-0"
      data-testid="pdp-template-variant-selector"
    >
      <legend className="sr-only">Variant options</legend>
      {sorted.map((ax, axisIndex) => {
        const labelText = ax.label?.trim() || ax.axis_key;
        const allowed = allowedOptionIdsForAxisIndex(axisIndex, sorted, selected, purchasable);
        const optSorted = [...ax.options].sort((a, b) => a.sort_order - b.sort_order);
        const blocked =
          axisIndex > 0 &&
          sorted.slice(0, axisIndex).some((prior) => {
            const v = selected[prior.id];
            return v == null || v === "";
          });
        const hintId = `pdp-tpl-axis-hint-${ax.id}`;
        const value = selected[ax.id] ?? "";

        return (
          <div key={ax.id}>
            <label htmlFor={`pdp-tpl-${ax.id}`} className="mb-1 block text-sm font-medium text-neutral-300">
              {formatOptionLabel(labelText)}
            </label>
            {blocked ? (
              <p id={hintId} className="mb-1 text-xs text-neutral-500">
                Select earlier options to see choices for {labelText.toLowerCase()}.
              </p>
            ) : null}
            <select
              id={`pdp-tpl-${ax.id}`}
              name={`template_axis_${ax.axis_key}`}
              data-testid={`pdp-select-template-axis-${ax.axis_key}`}
              className={`min-w-[140px] rounded-md border px-3 py-2.5 text-sm [color-scheme:dark] focus:outline-none focus-visible:ring-2 focus-visible:ring-zlx-processing focus-visible:ring-offset-0 focus-visible:ring-offset-black ${
                blocked
                  ? "cursor-not-allowed border-neutral-700 bg-neutral-900 text-neutral-400"
                  : "cursor-pointer border-neutral-600 bg-neutral-950 text-neutral-100"
              }`}
              value={value}
              disabled={blocked}
              aria-describedby={blocked ? hintId : undefined}
              onChange={(e) =>
                onChange(ax.id, e.target.value === "" ? null : e.target.value)
              }
            >
              <option value="">
                {blocked ? "Select earlier options first" : `Select ${labelText.toLowerCase()}`}
              </option>
              {optSorted.map((o) => {
                const disallowed = !allowed.has(o.id);
                const optLabel = o.label?.trim() || o.option_key;
                return (
                  <option key={o.id} value={o.id} disabled={disallowed}>
                    {disallowed ? `${optLabel} (unavailable)` : optLabel}
                  </option>
                );
              })}
            </select>
          </div>
        );
      })}
    </fieldset>
  );
};

export default TemplateVariantSelector;
