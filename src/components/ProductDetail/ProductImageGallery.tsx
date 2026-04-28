import { useEffect, useState } from "react";

type Props = {
  urls: string[];
  resolvedHeroUrl: string;
  alt: string;
  /** Resets manual thumbnail selection when variant selection changes (e.g. selected SKU). */
  selectionKey: string;
};

/**
 * PDP image region: single hero + optional thumbnail strip (scroll-snap on narrow viewports).
 * Manual pick updates the visible hero; variant changes reset to `resolvedHeroUrl`.
 */
const ProductImageGallery: React.FC<Props> = (props) => {
  const { urls, resolvedHeroUrl, alt, selectionKey } = props;
  const slides =
    urls.length > 0 ? urls : [resolvedHeroUrl].filter((u) => u.trim().length > 0);
  const [userSlide, setUserSlide] = useState<number | null>(null);

  useEffect(() => {
    setUserSlide(null);
  }, [selectionKey]);

  const defaultIdx = Math.max(
    0,
    slides.findIndex((u) => u === resolvedHeroUrl)
  );
  const idx =
    userSlide !== null && userSlide >= 0 && userSlide < slides.length
      ? userSlide
      : defaultIdx;
  const mainSrc = slides[idx] ?? resolvedHeroUrl;
  const showThumbs = slides.length > 1;

  return (
    <div data-testid="pdp-image-gallery" className="w-full space-y-3">
      <div className="overflow-hidden rounded-md bg-stone-100">
        <img
          data-testid="pdp-gallery-main"
          src={mainSrc}
          alt={alt}
          className="aspect-[4/5] w-full object-cover"
          width={800}
          height={1000}
          loading="eager"
          decoding="async"
        />
      </div>
      {showThumbs ? (
        <div
          className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Product image thumbnails"
        >
          {slides.map((url, i) => {
            const selected = i === idx;
            return (
              <button
                key={`${url}-${i}`}
                type="button"
                aria-label={`View image ${i + 1}`}
                aria-pressed={selected}
                className={`h-16 w-16 shrink-0 snap-start overflow-hidden rounded border-2 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2 ${
                  selected
                    ? "border-stone-900 opacity-100"
                    : "border-transparent opacity-75 hover:opacity-100"
                }`}
                onClick={() => setUserSlide(i)}
              >
                <img
                  src={url}
                  alt=""
                  className="h-full w-full object-cover"
                  width={64}
                  height={64}
                  loading="lazy"
                  decoding="async"
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default ProductImageGallery;
