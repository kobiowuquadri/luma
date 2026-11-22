import type { Metadata } from "next";
import Link from "next/link";
import { downloadReady, project } from "@/content/project";

export const metadata: Metadata = {
  title: "Support",
  description: "Installing LUMA on Android, permissions, and what to do when something does not work.",
};

const PROBLEMS = [
  {
    q: "The scan finds no words, or many words are underlined",
    a: "Retake the photo so the page fills the screen, the words are the right way up and there is no shiny patch of light. LUMA says whether the photo looked blurry, dark or glary. For a long board, scan it in parts.",
  },
  {
    q: "Read aloud says there is no offline voice",
    a: "Android reads English with its built-in voice. For other languages, open Android Settings, then Text-to-speech, and install a voice if one exists for that language. Without one, LUMA can read with its online voice when you are connected.",
  },
  {
    q: "Ask about this page is not available",
    a: "Asking needs an internet connection. Your question stays in the box when the connection drops, so you can tap Try again later. If LUMA says a feature is not set up or has reached today's limit, reading and saving still work.",
  },
  {
    q: "Spoken questions are not available in my language",
    a: "LUMA checks which languages its speech service supports and says so instead of guessing. You can type your question in any of the five languages.",
  },
  {
    q: "Text is too big for the buttons",
    a: "LUMA's layout grows with Android's font size and display size settings. Buttons wrap onto more lines rather than hide. Change the reading size inside LUMA under Display or My vision profile.",
  },
  {
    q: "The SunSafe reminder does not appear",
    a: "Allow notifications for LUMA when asked, or in Android Settings. Use Test reminder to check. Some phones delay reminders by a few minutes to save battery.",
  },
];

export default function Support() {
  return (
    <article className="container-luma py-16 md:py-20">
      <h1 className="text-[clamp(2.4rem,6vw,3.75rem)] leading-tight">Support</h1>

      <section className="mt-10">
        <h2 className="text-[2rem] leading-tight">Install the pilot app</h2>
        <ol className="mt-4 max-w-prose list-decimal space-y-3 ps-6 text-lg">
          <li>{downloadReady ? <>Download the APK from the <Link href="/#download">download section</Link> on the Android phone.</> : "Get the LUMA APK file from your LUMA pilot coordinator."}</li>
          <li>Open the file. If Android asks, allow installing apps from that source for this one time.</li>
          <li>Tap Install, then Open. Choose how you like to read, or skip and use the readable default.</li>
        </ol>
        <p className="mt-4 max-w-prose text-lg">LUMA works with TalkBack and with Android&apos;s font size and display size settings.</p>
      </section>

      <section className="mt-12">
        <h2 className="text-[2rem] leading-tight">Permissions</h2>
        <dl className="mt-4 max-w-prose space-y-4 text-lg">
          <div>
            <dt className="font-bold">Camera</dt>
            <dd>Asked when you first tap Scan a page or Scan a board. You can open existing images without it.</dd>
          </div>
          <div>
            <dt className="font-bold">Microphone</dt>
            <dd>Asked when you first tap Record question. You can always type instead.</dd>
          </div>
          <div>
            <dt className="font-bold">Notifications</dt>
            <dd>Asked when you turn on a SunSafe reminder.</dd>
          </div>
        </dl>
        <p className="mt-4 max-w-prose text-lg">LUMA does not ask for your location.</p>
      </section>

      <section className="mt-12">
        <h2 className="text-[2rem] leading-tight">When something does not work</h2>
        <div className="mt-4 max-w-prose space-y-3">
          {PROBLEMS.map((p) => (
            <details key={p.q} className="rounded-xl border border-line bg-surface p-4">
              <summary className="cursor-pointer text-lg font-bold">{p.q}</summary>
              <p className="mt-3 text-lg">{p.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-[2rem] leading-tight">Contact</h2>
        <p className="mt-4 max-w-prose text-lg">
          {project.supportEmail ? (
            <>
              Email <a href={`mailto:${project.supportEmail}`}>{project.supportEmail}</a>.
            </>
          ) : (
            "During the pilot, contact the LUMA pilot coordinator who gave you the app."
          )}
        </p>
      </section>
    </article>
  );
}
