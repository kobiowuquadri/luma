import { downloadReady } from "@/content/project";

/** Scribbled "printed" lines on a tilted page, following the page's slope. */
const LINE_LENGTHS = [210, 186, 204, 150, 196, 176, 118];

function scribble(x: number, y: number, length: number) {
  const steps = Math.floor(length / 48);
  let d = `M${x} ${y} q 24 -7.5 48 -5.4`;
  for (let i = 1; i < steps; i++) d += " t 48 -5.4";
  return d;
}

/**
 * LUMA's idea as a hand-drawn illustration: one line on a photographed page
 * is lifted out and becomes clean, large text with the teal reading rule.
 */
export function HeroIllustration() {
  const ink = "var(--fg)";
  return (
    <svg viewBox="0 0 480 430" className="h-auto w-full max-w-[34rem]" role="img" aria-labelledby="hero-art-title">
      <title id="hero-art-title">
        Drawing: a tilted handout page with one line highlighted in teal, lifted out by an arrow into a card of large, clean letters.
      </title>
      <path
        d="M66 116 C150 104 238 94 318 84 C330 184 342 282 354 378 C272 388 190 396 102 404 C90 306 78 208 66 116 Z"
        fill="var(--bg)"
        stroke={ink}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      {LINE_LENGTHS.map((len, i) => {
        const y = 152 + i * 33 - i * 0.5;
        const x = 98 + i * 3.4;
        const lifted = i === 4;
        return (
          <g key={i}>
            {lifted ? (
              <path
                d={`M${x - 10} ${y + 14} L${x + len + 6} ${y - 9} L${x + len + 9} ${y - 36} L${x - 7} ${y - 13} Z`}
                fill="var(--accent)"
                stroke={ink}
                strokeWidth="4"
                strokeLinejoin="round"
              />
            ) : null}
            <path
              d={scribble(x, y, len)}
              fill="none"
              stroke={lifted ? "var(--on-accent)" : ink}
              strokeWidth="4.5"
              strokeLinecap="round"
              opacity={lifted ? 1 : 0.7}
            />
          </g>
        );
      })}
      <path
        className="draw"
        style={{ ["--len" as string]: "210" }}
        d="M318 276 C 378 262 404 222 396 172"
        fill="none"
        stroke={ink}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path className="draw" style={{ ["--len" as string]: "60" }} d="M380 190 L397 168 L412 192" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="rotate(3 384 92)">
        <rect x="300" y="34" width="168" height="112" rx="20" fill="var(--bg)" stroke={ink} strokeWidth="5" />
        <rect x="322" y="60" width="10" height="60" rx="5" fill="var(--accent)" />
        <text x="346" y="117" fontFamily="var(--font-display)" fontSize="62" fontWeight="500" fill={ink}>
          Aa
        </text>
      </g>
    </svg>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="container-luma grid items-center gap-x-16 gap-y-12 pb-20 pt-14 md:pt-24 lg:grid-cols-[1.15fr_1fr]">
      <div>
        <p className="eyebrow">For students with albinism and other students with low vision</p>
        <h1 id="hero-title" className="mt-4 text-[clamp(2.9rem,7vw,5rem)] leading-[1.02] tracking-[-0.025em]">
          Read the page your way.
        </h1>
        <p className="mt-7 max-w-[34ch] text-xl text-muted md:text-[1.4rem] md:leading-[1.55]">
          Turn a classroom board or handout into text you can resize, listen to, and ask questions about in your language.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          {downloadReady ? (
            <a href="#download" className="btn btn-primary">
              Download Android app
            </a>
          ) : null}
          <a href="#preview" className={`btn ${downloadReady ? "btn-secondary" : "btn-primary"}`}>
            Try the reader preview
          </a>
          <a href="#how" className="btn btn-secondary">
            See how it works
          </a>
        </div>
        <p className="mt-8 flex items-center gap-2.5 text-muted">
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-accent" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Reading works offline, on the phone. No account needed.
        </p>
      </div>
      <div className="flex justify-center lg:justify-end">
        <HeroIllustration />
      </div>
    </section>
  );
}
