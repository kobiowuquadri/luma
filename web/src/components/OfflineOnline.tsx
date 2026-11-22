import Link from "next/link";

const OFFLINE = [
  "Scan a page or a board: text recognition runs on the phone",
  "Read with your own text size, spacing and colours",
  "Zoom into the original photo",
  "Save, rename and delete readings",
  "Read the original aloud with a voice installed on the phone",
  "Replay answers you have already heard",
  "SunSafe reminders",
];

const ONLINE = ["Ask about this page", "Explain in my language", "Turn a spoken question into text", "Hear a new answer read aloud", "Update the UV forecast"];

function Tick({ cloud = false }: { cloud?: boolean }) {
  return cloud ? (
    <svg viewBox="0 0 24 24" className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden="true">
      <path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Dark band: what works in airplane mode and what needs a connection. */
export function OfflineOnline() {
  return (
    <section aria-labelledby="offline-title" className="band-dark bg-bg text-fg">
      <div className="container-luma py-24">
        <div className="max-w-3xl">
          <p className="eyebrow">Works in airplane mode</p>
          <h2 id="offline-title" className="mt-3 text-[clamp(2.1rem,4.6vw,3.4rem)] leading-[1.08]">
            Reading never waits for a network.
          </h2>
          <p className="mt-5 max-w-[46ch] text-xl text-muted">
            Fresh answers and new spoken answers need a connection. When it drops, the page stays open and the question is kept for a retry.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-[1.5rem] border border-line p-6 sm:p-8">
            <h3 className="text-[1.75rem]">On the phone, offline</h3>
            <ul className="mt-5 space-y-3 text-lg">
              {OFFLINE.map((i) => (
                <li key={i} className="flex gap-3">
                  <Tick />
                  {i}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[1.5rem] border border-hairline p-6 sm:p-8">
            <h3 className="text-[1.75rem]">Needs a connection</h3>
            <ul className="mt-5 space-y-3 text-lg">
              {ONLINE.map((i) => (
                <li key={i} className="flex gap-3">
                  <Tick cloud />
                  {i}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Two quieter companions: privacy and SunSafe. */
export function Companions() {
  return (
    <section aria-label="Privacy and SunSafe" className="border-b border-hairline">
      <div className="container-luma grid gap-5 py-24 md:grid-cols-2">
        <article className="card p-6 sm:p-8">
          <p className="eyebrow">Private by design</p>
          <h2 className="mt-2 text-[2rem] leading-tight">Classroom photos stay on the phone</h2>
          <p className="mt-4 text-lg text-muted">
            Photos, readings and settings never leave the device. Only the question and the lines of text it needs go online, and only when the student asks.
          </p>
          <Link href="/privacy/" className="mt-5 inline-flex min-h-11 items-center font-bold">
            What LUMA sends, and when
          </Link>
        </article>
        <article className="card p-6 sm:p-8">
          <p className="eyebrow">SunSafe</p>
          <h2 className="mt-2 text-[2rem] leading-tight">A small companion for sunny days</h2>
          <p className="mt-4 text-lg text-muted">
            A daily reminder to cover up, testable straight away and working offline, plus a UV forecast for a city the student picks with its source and update time. Reminders only: no medical advice, no skin photos.
          </p>
        </article>
      </div>
    </section>
  );
}
