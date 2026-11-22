import { LANGUAGES } from "@/content/project";
import { SectionHeading } from "./SectionHeading";

function Card({ title, where, children, visual, className = "" }: { title: string; where: string; children: React.ReactNode; visual: React.ReactNode; className?: string }) {
  return (
    <article className={`card flex flex-col gap-6 p-6 sm:p-8 ${className}`}>
      <div className="flex-1">{visual}</div>
      <div>
        <p className="font-bold text-accent">{where}</p>
        <h3 className="mt-1 text-[1.9rem] leading-tight">{title}</h3>
        <p className="mt-3 text-lg text-muted">{children}</p>
      </div>
    </article>
  );
}

function ProfileVisual() {
  const samples = [
    { palette: "paper", size: "1.25rem", label: "Warm paper" },
    { palette: "dark", size: "1.75rem", label: "Dark" },
    { palette: "contrast", size: "2.4rem", label: "Yellow on black" },
  ];
  return (
    <div className="flex flex-wrap items-end gap-3" aria-hidden="true">
      {samples.map((s) => (
        <div key={s.palette} data-palette={s.palette} className="flex min-h-28 min-w-28 flex-1 flex-col justify-between rounded-2xl border border-line bg-bg p-4 text-fg">
          <span className="font-display leading-none" style={{ fontSize: s.size }}>
            Aa
          </span>
          <span className="mt-3 text-base">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function OfflineVisual() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-bg p-4" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-9 w-9 shrink-0 text-accent">
        <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" fill="currentColor" />
      </svg>
      <span className="text-lg font-bold">Works in airplane mode</span>
    </div>
  );
}

function AskVisual() {
  return (
    <div className="space-y-3 text-lg" aria-hidden="true">
      <p className="text-base text-muted">Example</p>
      <p className="ms-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-bg px-4 py-3">When should we submit the assignment?</p>
      <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-bg px-4 py-3">
        <p>On Friday, 27 November 2026.</p>
        <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-accent-soft px-2.5 py-1 text-base font-bold text-fg">
          <span className="inline-block h-4 w-1 rounded bg-accent" />
          From the page: line 23
        </p>
      </div>
    </div>
  );
}

function VoicesVisual() {
  return (
    <ul className="flex flex-wrap gap-2" aria-hidden="true">
      {LANGUAGES.map((l) => (
        <li key={l.code} lang={l.code} className="rounded-full border border-line bg-bg px-4 py-2 font-display text-xl">
          {l.nativeName}
        </li>
      ))}
    </ul>
  );
}

function BoardVisual() {
  return (
    <svg viewBox="0 0 260 120" className="h-auto w-full max-w-xs" aria-hidden="true">
      <rect x="10" y="8" width="240" height="96" rx="8" fill="var(--bg)" stroke="var(--fg)" strokeWidth="3" />
      <path d="M30 34h120M30 56h170M30 78h90" stroke="var(--fg)" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
      <rect x="24" y="47" width="186" height="18" rx="4" fill="none" stroke="var(--accent)" strokeWidth="3" />
      <path d="M90 104l-14 14M170 104l14 14" stroke="var(--fg)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function SunVisual() {
  return (
    <div className="flex flex-wrap gap-3" aria-hidden="true">
      <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-bg px-4 py-2.5 text-lg font-bold">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-accent">
          <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        07:00 · school days
      </span>
      <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-bg px-4 py-2.5 text-lg font-bold">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-accent">
          <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.2 5.2 7 7M17 17l1.8 1.8M5.2 18.8 7 17M17 7l1.8-1.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        UV forecast for your city
      </span>
    </div>
  );
}

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-4 border-t border-hairline">
      <div className="container-luma py-24">
        <SectionHeading
          id="features-title"
          eyebrow="What's inside"
          title="Six tools, built around one page"
          lede="Everything a student needs to read a handout or a board, check it and keep it, with the parts that need the internet kept clearly separate."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-6">
          <Card className="md:col-span-4" title="My Vision Profile" where="Offline" visual={<ProfileVisual />}>
            Text size, line and letter spacing, colours and bold text. Students see each change on a real paragraph, and it applies across the whole app, not just the page.
          </Card>
          <Card className="md:col-span-2" title="Snap & Read" where="Offline" visual={<OfflineVisual />}>
            Photograph a handout or open a photo a lecturer sent. Text recognition runs on the phone.
          </Card>
          <Card className="md:col-span-3" title="Ask LUMA" where="Online" visual={<AskVisual />}>
            Type or say a question. LUMA answers from the page and shows the lines it used, so the answer can be checked. If the page does not say, it says so.
          </Card>
          <Card className="md:col-span-3" title="Local Voices" where="Online, with offline guidance" visual={<VoicesVisual />}>
            Answers, explanations and spoken replies in five languages. LUMA never switches to another language without telling you.
          </Card>
          <Card className="md:col-span-3" title="Board Reader" where="Offline" visual={<BoardVisual />}>
            The same reading engine for classroom boards, with tips for distance, glare and long boards. Diagrams stay on the zoomable photo.
          </Card>
          <Card className="md:col-span-3" title="SunSafe" where="Reminders offline" visual={<SunVisual />}>
            A daily reminder to cover up, and a UV forecast for a city the student picks. No location, no medical claims.
          </Card>
        </div>
      </div>
    </section>
  );
}
