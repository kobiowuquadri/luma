import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What LUMA keeps on your phone, and what it sends when you ask a question online.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-[2rem] leading-tight">{title}</h2>
      <div className="mt-4 max-w-prose space-y-4 text-lg">{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <article className="container-luma py-16 md:py-20">
      <h1 className="text-[clamp(2.4rem,6vw,3.75rem)] leading-tight">Privacy</h1>
      <p className="mt-4 max-w-prose text-xl">
        LUMA is built so reading happens on the phone. This page explains what stays on the device, what leaves it, and when.
      </p>

      <Section title="Stays on your phone">
        <p>Photos you take or open, the text LUMA reads from them, your saved readings, your vision profile and your SunSafe reminders. Text recognition runs on the phone and works in airplane mode.</p>
        <p>LUMA keeps its own copy of each photo in the app&apos;s private storage, re-saved without location details. Deleting a reading deletes its photo, saved answers and saved audio. The app turns off Android cloud backup for its data.</p>
        <p>There is no account and no sign-in.</p>
      </Section>

      <Section title="Sent only when you ask">
        <ul className="list-disc space-y-3 ps-6">
          <li>
            <strong>Ask about this page</strong> and <strong>Explain in my language</strong> send your question, numbered lines of text from the page and your last few questions and answers to the LUMA server. The server asks OpenAI to write a short answer. Your photo is never sent.
          </li>
          <li>
            <strong>Record question</strong> sends your recording through the LUMA server to YarnGPT, which turns it into text. LUMA deletes the recording from the phone afterwards. YarnGPT&apos;s documentation says it keeps uploaded audio for up to 12 months.
          </li>
          <li>
            <strong>Hear answer</strong> sends the answer text to YarnGPT to make audio. The audio is saved on the phone so it can play again offline.
          </li>
          <li>
            <strong>SunSafe forecast</strong> sends the coordinates of the city you choose to Open-Meteo. LUMA never uses your location.
          </li>
        </ul>
      </Section>

      <Section title="The LUMA server">
        <p>The server passes requests to OpenAI and YarnGPT and returns the result. It keeps a finished result in memory for up to 30 minutes, so a retry after a dropped connection does not pay twice, and then forgets it. It does not write your questions, page text, answers or recordings to disk, and its logs leave them out. Provider keys stay on the server and are never in the app.</p>
        <p>The app sends a random ID created when it was installed. The server uses it only to limit how many questions one phone can send per day.</p>
      </Section>

      <Section title="This website">
        <p>The website has no sign-in, no analytics and no cookies. Its fonts are served from this site. The reader preview runs entirely in your browser and uploads nothing. If you choose a theme, the choice is saved in your browser only.</p>
      </Section>
    </article>
  );
}
