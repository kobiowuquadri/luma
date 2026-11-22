"use client";

import { useRef, useState } from "react";
import type { VoiceSample as Sample } from "@/content/project";

/** Play/stop for one approved recording, with its transcript always shown. */
export function VoiceSample({ sample }: { sample: Sample }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (playing) {
      a.pause();
      a.currentTime = 0;
      setPlaying(false);
    } else {
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="font-bold">
        {sample.nativeName}
        {sample.nativeName !== sample.languageName ? ` (${sample.languageName})` : ""}: “{sample.english}”
      </p>
      <p className="multilingual mt-2 text-lg" lang={sample.language}>
        {sample.transcript}
      </p>
      <audio ref={audio} src={sample.src} preload="none" onEnded={() => setPlaying(false)} />
      <button type="button" className="btn btn-secondary mt-3" aria-pressed={playing} onClick={toggle}>
        {playing ? "Stop" : "Play sample"}
      </button>
      <p className="mt-2 text-muted">Approved by a native speaker on {sample.reviewedOn}.</p>
    </div>
  );
}
