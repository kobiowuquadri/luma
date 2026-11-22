import { STEPS } from "@/content/walkthrough";
import { SectionHeading } from "./SectionHeading";

export function Walkthrough() {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-4 border-t border-hairline">
      <div className="container-luma py-24">
        <SectionHeading
          id="how-title"
          eyebrow="How it works"
          title="One student, one handout, four steps"
          lede="The handout is the same sample used in the reader preview."
        />
        <ol className="mt-14 grid gap-x-8 gap-y-12 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t-2 border-fg pt-6">
              <p className="font-display text-[3.25rem] leading-none text-accent" aria-hidden="true">
                {i + 1}
              </p>
              <h3 className="mt-4 text-[1.75rem] leading-tight">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </h3>
              <p className="mt-3 text-lg">{s.body}</p>
              <ul className="mt-4 space-y-2 text-muted">
                {s.points.map((p) => (
                  <li key={p} className="reading-rule">
                    {p}
                  </li>
                ))}
              </ul>
              {s.image ? (
                <figure className="mt-6">
                  {/* Static export: screenshots are pre-sized WebP files, so no next/image loader is needed. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.image.src} width={s.image.width} height={s.image.height} alt={s.image.alt} loading="lazy" className="h-auto w-full rounded-[1.5rem] border border-hairline" />
                  <figcaption className="mt-2 text-muted">Screenshot from the LUMA app</figcaption>
                </figure>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
