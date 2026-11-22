import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useSQLiteContext } from 'expo-sqlite';
import { ApiError, synthesizeTo } from '@/ask/api';
import { getReadAloudAudio, saveReadAloudAudio } from '@/db/messages';
import { announce } from '@/lib/a11y';
import { readingFile } from '@/lib/files';
import { newRequestId } from '@/lib/ids';
import { paragraphText, lineMap, type ReadingDocument } from '@/ocr/layout';
import type { LanguageCode } from '@/profile/profile';
import { chooseVoice, type VoiceChoice } from '@/voice/deviceVoices';
import { languageLabel } from '@/voice/languages';

export type ReadAloudMode = 'device' | 'online';

export interface ReadAloudState {
  status: 'idle' | 'preparing' | 'speaking';
  index: number | null;
  mode: ReadAloudMode | null;
  /** Set when no offline voice exists for the page's language. */
  needsChoice: { language: LanguageCode; voice: VoiceChoice } | null;
  error: string | null;
}

const IDLE: ReadAloudState = { status: 'idle', index: null, mode: null, needsChoice: null, error: null };

function chunks(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let cur = '';
  for (const s of text.split(/(?<=[.!?;:])\s+/)) {
    if ((cur + ' ' + s).trim().length > max && cur) {
      out.push(cur.trim());
      cur = s;
    } else cur = (cur + ' ' + s).trim();
  }
  if (cur) out.push(cur.trim());
  return out.flatMap((c) => (c.length <= max ? [c] : c.match(new RegExp(`.{1,${max}}`, 'g')) ?? []));
}

/**
 * "Read original aloud": voices the recognised text itself, paragraph by
 * paragraph. Uses an installed offline voice for the page's language when
 * the phone has one; otherwise the student chooses LUMA's online voice
 * explicitly. Always user-started, always stoppable.
 */
export function useReadAloud(readingId: string, doc: ReadingDocument | null, language: LanguageCode, rate: number, maxSpeechChars = 1400) {
  const db = useSQLiteContext();
  const [state, setState] = useState<ReadAloudState>(IDLE);
  const token = useRef(0);
  const player = useRef<AudioPlayer | null>(null);

  const releasePlayer = () => {
    if (player.current) {
      try {
        player.current.pause();
        player.current.remove();
      } catch {
        // Already released.
      }
      player.current = null;
    }
  };

  const stop = useCallback(() => {
    token.current += 1;
    Speech.stop().catch(() => {});
    releasePlayer();
    setState((s) => (s.status === 'idle' ? s : IDLE));
  }, []);

  useEffect(() => () => stop(), [stop]);

  const speakDevice = useCallback(
    (from: number, voice: string, my: number) => {
      if (!doc) return;
      const lines = lineMap(doc);
      const next = (i: number) => {
        if (my !== token.current) return;
        if (i >= doc.paragraphs.length) {
          setState(IDLE);
          announce('Finished reading the page.');
          return;
        }
        setState({ status: 'speaking', index: i, mode: 'device', needsChoice: null, error: null });
        Speech.speak(paragraphText(doc, doc.paragraphs[i], lines), {
          voice,
          rate,
          onDone: () => next(i + 1),
          onError: () => {
            if (my === token.current) setState({ ...IDLE, error: 'The phone voice stopped unexpectedly. Try again.' });
          },
        });
      };
      next(from);
    },
    [doc, rate],
  );

  const speakOnline = useCallback(
    async (from: number, my: number) => {
      if (!doc) return;
      const lines = lineMap(doc);
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
      for (let i = from; i < doc.paragraphs.length; i++) {
        const p = doc.paragraphs[i];
        const parts = chunks(paragraphText(doc, p, lines), maxSpeechChars);
        for (let c = 0; c < parts.length; c++) {
          if (my !== token.current) return;
          const key = `${p.id}-${c}`;
          setState({ status: 'preparing', index: i, mode: 'online', needsChoice: null, error: null });
          let uri = await getReadAloudAudio(db, readingId, key, language);
          if (!uri) {
            const rel = `read-aloud/${key}-${language}.mp3`;
            try {
              const file = await synthesizeTo(parts[c], language, newRequestId(), readingFile(readingId, rel));
              await saveReadAloudAudio(db, readingId, key, language, rel);
              uri = file.uri;
            } catch (e) {
              if (my === token.current) setState({ ...IDLE, error: e instanceof ApiError ? e.message : 'Online reading failed. Try again.' });
              return;
            }
          }
          if (my !== token.current) return;
          setState({ status: 'speaking', index: i, mode: 'online', needsChoice: null, error: null });
          await new Promise<void>((resolve) => {
            releasePlayer();
            const pl = createAudioPlayer(uri);
            player.current = pl;
            pl.playbackRate = rate;
            const sub = pl.addListener('playbackStatusUpdate', (s) => {
              if (s.didJustFinish || my !== token.current) {
                sub.remove();
                resolve();
              }
            });
            pl.play();
          });
        }
      }
      if (my === token.current) {
        releasePlayer();
        setState(IDLE);
        announce('Finished reading the page.');
      }
    },
    [db, doc, language, maxSpeechChars, rate, readingId],
  );

  /** Start reading from a paragraph. */
  const start = useCallback(
    async (from: number) => {
      stop();
      const my = token.current;
      setState({ ...IDLE, status: 'preparing', index: from });
      const voice = await chooseVoice(language);
      if (my !== token.current) return;
      if (voice.offline) {
        announce('Reading aloud. Tap Stop reading to stop.');
        speakDevice(from, voice.offline.name, my);
        return;
      }
      setState({ ...IDLE, needsChoice: { language, voice } });
      announce(`No offline voice for ${languageLabel(language)} on this phone.`);
    },
    [language, speakDevice, stop],
  );

  /** Continue with a phone voice that needs the internet, or LUMA's online voice. */
  const startWith = useCallback(
    (from: number, mode: 'network-device' | 'online') => {
      const choice = state.needsChoice;
      stop();
      const my = token.current;
      if (mode === 'network-device' && choice?.voice.network) {
        speakDevice(from, choice.voice.network.name, my);
      } else {
        speakOnline(from, my).catch(() => {});
      }
    },
    [speakDevice, speakOnline, state.needsChoice, stop],
  );

  const dismissChoice = useCallback(() => setState(IDLE), []);

  return { state, start, startWith, stop, dismissChoice };
}
