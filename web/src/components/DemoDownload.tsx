import { demo, downloadReady, formatBytes, release } from "@/content/project";

/** Closing call to action, with the demo video and APK details when they exist. */
export function DemoDownload() {
  return (
    <section id="download" aria-labelledby="download-title" className="scroll-mt-4">
      <div className="container-luma py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="download-title" className="text-[clamp(2.4rem,5.5vw,4rem)] leading-[1.05]">
            Bring the next handout into focus.
          </h2>
          <p className="mx-auto mt-5 max-w-[44ch] text-xl text-muted">
            {downloadReady
              ? "Install the Android preview build, scan a page in airplane mode, and read it your way."
              : "Try the reader preview now. The Android preview build will be offered here once it has been tested on a phone."}
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            {downloadReady && release.url && release.sizeBytes ? (
              <a href={release.url} className="btn btn-primary" download={release.fileName ?? undefined}>
                Download Android app ({formatBytes(release.sizeBytes)})
              </a>
            ) : null}
            <a href="#preview" className={`btn ${downloadReady ? "btn-secondary" : "btn-primary"}`}>
              Try the reader preview
            </a>
            <a href="/support/" className="btn btn-secondary">
              Installation help
            </a>
          </div>
        </div>

        {downloadReady && release.sizeBytes ? (
          <div className="card mx-auto mt-14 grid max-w-4xl gap-8 p-6 sm:p-8 md:grid-cols-2">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 self-start">
              <dt className="font-bold">Version</dt>
              <dd>{release.version}</dd>
              <dt className="font-bold">File size</dt>
              <dd>{formatBytes(release.sizeBytes)}</dd>
              {release.minAndroid ? (
                <>
                  <dt className="font-bold">Needs</dt>
                  <dd>{release.minAndroid} or newer</dd>
                </>
              ) : null}
              {release.publishedOn ? (
                <>
                  <dt className="font-bold">Published</dt>
                  <dd>{release.publishedOn}</dd>
                </>
              ) : null}
              <dt className="font-bold">SHA-256</dt>
              <dd className="font-mono text-base [overflow-wrap:anywhere]">{release.sha256}</dd>
            </dl>
            <div>
              <h3 className="text-2xl">Install it</h3>
              <ol className="mt-3 list-decimal space-y-2 ps-6 text-lg">
                <li>Open this page on the Android phone and download the app.</li>
                <li>Open the file. If Android asks, allow your browser to install apps this one time.</li>
                <li>Tap Install, then Open. LUMA asks for the camera only when you first scan.</li>
              </ol>
              <p className="mt-3 text-muted">A pilot build, installed directly rather than from Google Play.</p>
            </div>
          </div>
        ) : null}

        {demo.available && demo.video ? (
          <div className="mx-auto mt-14 max-w-4xl">
            <h3 className="text-2xl">Watch the demo</h3>
            <video controls preload="none" poster={demo.poster ?? undefined} className="mt-4 w-full rounded-[1.5rem] border border-hairline">
              <source src={demo.video} type="video/mp4" />
              {demo.captions ? <track kind="captions" src={demo.captions} srcLang="en" label="English" default /> : null}
            </video>
            {demo.transcript.length ? (
              <details className="mt-4">
                <summary className="cursor-pointer text-lg font-bold">Read the transcript</summary>
                <ol className="mt-3 space-y-2">
                  {demo.transcript.map((t) => (
                    <li key={t.time}>
                      <span className="font-bold">{t.time}</span> {t.text}
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
