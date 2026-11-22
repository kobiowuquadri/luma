import { LANGUAGES, voiceSamples } from "@/content/project";
import { SectionHeading } from "./SectionHeading";
import { VoiceSample } from "./VoiceSample";

const CAPABILITIES = [
  {
    title: "Written answers and explanations",
    where: "Online",
    text: "Ask about the page or ask for an explanation in any of the five languages. The original text stays on screen to compare.",
  },
  {
    title: "Spoken questions and answers",
    where: "Online",
    text: "Recording a question and hearing the answer use YarnGPT. The app checks which languages it currently offers and says plainly when one is not available.",
  },
  {
    title: "Spoken guidance",
    where: "Offline",
    text: "Short prompts such as “Scan complete” play from recordings stored in the app, in each language only after a native speaker has approved them.",
  },
];

export function LocalVoices() {
  return (
    <section id="voices" aria-labelledby="voices-title" className="scroll-mt-4 border-t border-hairline bg-surface">
      <div className="container-luma py-24">
        <SectionHeading
          id="voices-title"
          eyebrow="Local voices"
          title="Answers in the language you think in"
          lede="Students choose the language LUMA answers and speaks in. The page itself is always shown exactly as it was written."
        />
        <ul className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-[1.5rem] border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-5">
          {LANGUAGES.map((l) => (
            <li key={l.code} className="bg-bg p-6">
              <p lang={l.code} className="font-display text-[2.4rem] leading-tight">
                {l.nativeName}
              </p>
              <p className="mt-1 text-lg text-muted">{l.name === l.nativeName ? " " : l.name}</p>
            </li>
          ))}
        </ul>

        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <div key={c.title}>
              <p className="font-bold text-accent">{c.where}</p>
              <h3 className="mt-1 text-[1.6rem] leading-tight">{c.title}</h3>
              <p className="mt-3 text-lg text-muted">{c.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 border-t border-hairline pt-10">
          <h3 className="text-[1.6rem]">Recorded samples</h3>
          {voiceSamples.length > 0 ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {voiceSamples.map((s) => (
                <VoiceSample key={`${s.language}-${s.prompt}`} sample={s} />
              ))}
            </div>
          ) : (
            <p className="mt-3 max-w-prose text-lg text-muted">
              No recordings have been approved yet. Each sample will appear here, with play and stop controls and its transcript, once a native speaker has approved it.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
