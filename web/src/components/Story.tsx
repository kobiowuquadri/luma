import { SectionHeading } from "./SectionHeading";

const LINE = "Submit on Friday, 27 November 2026.";

/** The problem, and LUMA's answer, shown with one real line from the sample photo. */
export function Story() {
  return (
    <section aria-labelledby="story-title" className="border-t border-hairline">
      <div className="container-luma grid items-center gap-x-16 gap-y-12 py-24 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <SectionHeading
            id="story-title"
            eyebrow="Why LUMA"
            title="No more dragging sideways to finish a line."
            lede="A lecturer sends the class a photo of a handout. Zoomed in, every line runs off the edge of the screen. LUMA reads the photo on the phone and reflows the text to fit, in the size, spacing and colours each student chooses."
          />
          <ul className="mt-8 space-y-3 text-lg">
            {[
              "Names, dates and numbers stay exactly as printed.",
              "Words LUMA is unsure of are marked, never guessed.",
              "Every answer points back to the line it came from.",
            ].map((t) => (
              <li key={t} className="reading-rule">
                {t}
              </li>
            ))}
          </ul>
        </div>

        <figure aria-labelledby="story-figure-caption" className="card p-5 sm:p-8">
          <p className="font-bold text-muted">On the photographed handout</p>
          <picture>
            <source srcSet="/sample/line.webp" type="image/webp" />
            <img
              src="/sample/line.jpg"
              width={615}
              height={87}
              alt={`A tilted, slightly blurred photo of one printed line: “${LINE}”`}
              className="mt-3 h-auto w-full rounded-xl border border-hairline"
            />
          </picture>
          <svg viewBox="0 0 40 44" className="mx-auto my-3 h-11 w-10 text-accent" aria-hidden="true">
            <path d="M20 4v30M10 25l10 11 10-11" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="lift rounded-2xl border border-hairline bg-bg p-5">
            <p className="font-bold text-accent">In LUMA</p>
            <p className="reading-rule mt-2 text-[1.7rem] leading-snug sm:text-[1.95rem]">{LINE}</p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2" aria-hidden="true">
            <div data-palette="dark" className="lift lift-delay-1 rounded-2xl bg-bg p-5 text-fg">
              <p className="font-bold text-muted">Dark, larger</p>
              <p className="reading-rule mt-1 text-[1.95rem] leading-tight">{LINE}</p>
            </div>
            <div data-palette="contrast" className="lift lift-delay-2 rounded-2xl bg-bg p-5 text-fg">
              <p className="font-bold">Yellow on black, roomy</p>
              <p className="reading-rule mt-1 text-[1.8rem] leading-[1.7]">{LINE}</p>
            </div>
          </div>
          <figcaption id="story-figure-caption" className="mt-4 text-muted">
            The same line from the sample handout: as photographed, then as clean text in three of the settings a student can choose.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
