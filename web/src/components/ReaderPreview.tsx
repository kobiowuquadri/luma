"use client";

import { useState, type KeyboardEvent } from "react";
import { handout } from "@/content/project";
import { SectionHeading } from "./SectionHeading";

const SIZES = [18, 20, 22, 24, 28, 32, 36, 42, 48];
const SPACING = [
  { value: 1.3, label: "Compact" },
  { value: 1.6, label: "Comfortable" },
  { value: 2, label: "Roomy" },
  { value: 2.4, label: "Extra roomy" },
];
const PALETTES = [
  { value: "paper", label: "Warm paper" },
  { value: "white", label: "Plain white" },
  { value: "dark", label: "Dark" },
  { value: "contrast", label: "Yellow on black" },
];

const lines = handout.paragraphs.flatMap((p) => p.lines);

/**
 * Working reader preview with the app's own controls and palettes. The
 * highlighted line of clean text is outlined on the photo it came from.
 */
export function ReaderPreview() {
  const [sizeIndex, setSizeIndex] = useState(3);
  const [spacing, setSpacing] = useState(1.6);
  const [palette, setPalette] = useState("paper");
  const [active, setActive] = useState<string>("L23");
  const size = SIZES[sizeIndex];
  const index = lines.findIndex((l) => l.id === active);
  const activeLine = lines[index];

  const step = (delta: number) => setActive(lines[Math.min(lines.length - 1, Math.max(0, index + delta))].id);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => step(1),
      ArrowUp: () => step(-1),
      Home: () => setActive(lines[0].id),
      End: () => setActive(lines[lines.length - 1].id),
    };
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  return (
    <section id="preview" aria-labelledby="preview-title" className="scroll-mt-4 border-t border-hairline bg-surface">
      <div className="container-luma py-24">
        <SectionHeading
          id="preview-title"
          eyebrow="Try it here"
          title="The reader, with a real sample page"
          lede="This sample handout was written for this preview. Change it the way a student would. Nothing is uploaded and nothing is saved."
        />

        <div className="mt-12 overflow-hidden rounded-[1.75rem] border border-hairline bg-bg shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(40,30,10,0.18)]">
          <div role="group" aria-label="Reading settings" className="flex flex-wrap items-start gap-x-10 gap-y-5 border-b border-hairline px-5 py-5 sm:px-8">
            <div>
              <p id="size-label" className="font-bold">
                Text size
              </p>
              <div className="mt-2 flex items-center gap-2" role="group" aria-labelledby="size-label">
                <button type="button" className="btn btn-secondary btn-small min-w-12 px-3" aria-label="Smaller text" disabled={sizeIndex === 0} onClick={() => setSizeIndex((i) => Math.max(0, i - 1))}>
                  <span aria-hidden="true" className="text-base">A−</span>
                </button>
                <output aria-live="polite" className="min-w-16 text-center text-lg font-bold">
                  {size} px
                </output>
                <button type="button" className="btn btn-secondary btn-small min-w-12 px-3" aria-label="Larger text" disabled={sizeIndex === SIZES.length - 1} onClick={() => setSizeIndex((i) => Math.min(SIZES.length - 1, i + 1))}>
                  <span aria-hidden="true" className="text-2xl">A+</span>
                </button>
              </div>
            </div>
            <fieldset>
              <legend className="font-bold">Line spacing</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {SPACING.map((s) => (
                  <label key={s.value} className="pill">
                    <input type="radio" name="spacing" className="sr-only" checked={spacing === s.value} onChange={() => setSpacing(s.value)} />
                    {s.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="font-bold">Colours</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {PALETTES.map((t) => (
                  <label key={t.value} className="pill">
                    <input type="radio" name="palette" className="sr-only" checked={palette === t.value} onChange={() => setPalette(t.value)} />
                    {t.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="grid lg:grid-cols-2">
            <div className="border-hairline p-5 sm:p-8 lg:border-r">
              <h3 className="text-2xl">Clean text</h3>
              <div
                data-palette={palette}
                className="mt-4 rounded-2xl border border-line bg-bg p-5 text-fg sm:p-7"
                style={{ fontSize: `${size}px`, lineHeight: spacing, overflowWrap: "anywhere", hyphens: "none" }}
              >
                <div
                  tabIndex={0}
                  role="group"
                  aria-label="Sample handout text. Use the up and down arrow keys to move the highlight to another line."
                  onKeyDown={onKey}
                  className="space-y-[0.7em] rounded-md"
                  lang="en"
                >
                  {handout.paragraphs.map((p) => (
                    <p key={p.id} className={p.kind === "heading" ? "font-bold" : undefined}>
                      {p.lines.map((l, i) => (
                        <span key={l.id}>
                          {i > 0 ? " " : null}
                          <span
                            onClick={() => setActive(l.id)}
                            onMouseEnter={() => setActive(l.id)}
                            className={l.id === active ? "rounded bg-highlight text-on-highlight" : "cursor-pointer"}
                          >
                            {l.text}
                          </span>
                        </span>
                      ))}
                    </p>
                  ))}
                </div>
              </div>
              <p className="mt-4 text-muted" aria-live="polite">
                Highlighted: line {index + 1} of {lines.length}, “{activeLine.text}”
              </p>
              <p className="mt-1 text-muted">Point at or tap a line, or focus the text and use the arrow keys, to see it on the photo.</p>
            </div>

            <figure className="border-t border-hairline p-5 sm:p-8 lg:sticky lg:top-4 lg:self-start lg:border-t-0">
              <h3 className="text-2xl">The photo it came from</h3>
              <div className="relative mt-4">
                <picture>
                  <source srcSet={handout.image.src} type="image/webp" />
                  <img
                    src={handout.image.fallback}
                    width={handout.image.width}
                    height={handout.image.height}
                    alt="Photo of the sample handout lying on a desk: SS2 Biology, Handout 3, Topic: Photosynthesis, with four numbered sections and an assignment box."
                    className="h-auto w-full rounded-2xl border border-hairline"
                    loading="lazy"
                  />
                </picture>
                <svg viewBox={`0 0 ${handout.image.width} ${handout.image.height}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
                  {activeLine ? (
                    <polygon
                      points={activeLine.quad.map((p) => p.join(",")).join(" ")}
                      fill="rgba(243, 213, 115, 0.35)"
                      stroke="#0A5651"
                      strokeWidth="5"
                      strokeLinejoin="round"
                    />
                  ) : null}
                </svg>
              </div>
              <figcaption className="mt-4 text-muted">
                Sample photo. The teal outline marks the highlighted line. In the app, every answer points back to lines like this so students can check it.
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
