import { Check } from "lucide-react";

import { SAMPLE_CATALOG, type SampleImage } from "@/features/samples/catalog";
import { cn } from "@/lib/utils";

interface SampleGalleryProps {
  selectedId: string | null;
  onSelect: (sample: SampleImage) => void;
  className?: string;
}

export function SampleGallery({ selectedId, onSelect, className }: SampleGalleryProps) {
  return (
    <section className={cn("flex flex-col gap-3", className)} aria-label="Sample inspection images">
      <header className="flex items-baseline justify-between">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.5px] text-fg-secondary">
          Or try a sample frame
        </h3>
        <span className="text-[11px] text-fg-tertiary">
          {SAMPLE_CATALOG.length} real CCTV samples — one per defect class
        </span>
      </header>

      <ul
        role="radiogroup"
        aria-label="Sample inspection images"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7"
      >
        {SAMPLE_CATALOG.map((sample) => {
          const isActive = selectedId === sample.id;
          return (
            <li key={sample.id}>
              <button
                type="button"
                role="radio"
                aria-checked={isActive}
                aria-label={`Sample: ${sample.expectedClass}`}
                onClick={() => onSelect(sample)}
                className={cn(
                  "group relative block aspect-square w-full overflow-hidden rounded-lg border-2 bg-bg-base text-left transition-all duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
                  isActive
                    ? "border-accent shadow-[0_0_0_3px_var(--accent-muted)]"
                    : "border-border-default hover:border-accent/60",
                )}
              >
                <img
                  src={sample.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={cn(
                    "absolute inset-0 size-full object-cover transition-transform duration-200",
                    isActive ? "scale-[1.02]" : "group-hover:scale-[1.04]",
                  )}
                />
                {/* Bottom gradient + label */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 py-1.5">
                  <span className="block text-[11px] font-medium text-white drop-shadow-sm">
                    {sample.label}
                  </span>
                </div>
                {/* Active checkmark */}
                {isActive && (
                  <span
                    className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-fg-inverse shadow"
                    aria-hidden="true"
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
