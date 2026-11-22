import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, TextInput, View, type ScrollViewInstance, type ViewInstance } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useSQLiteContext } from 'expo-sqlite';
import { ApiError, ask, onlineConfigured, reasonText, synthesizeTo, transcribe } from '@/ask/api';
import { useOnline } from '@/ask/OnlineProvider';
import { PreviewBanner } from '@/ask/PreviewBanner';
import { selectLines } from '@/ask/selectLines';
import { useQuestionRecorder } from '@/ask/useQuestionRecorder';
import { clearDraft, getDraft, insertMessage, listMessages, saveDraft, setMessageAudio, type Message } from '@/db/messages';
import { getReading, type Reading } from '@/db/readings';
import { announce, focusElement } from '@/lib/a11y';
import { deleteCacheFile, fileExists, readingFile } from '@/lib/files';
import { formatDuration } from '@/lib/format';
import { newId, newRequestId } from '@/lib/ids';
import { lineMap } from '@/ocr/layout';
import type { LanguageCode } from '@/profile/profile';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, fontStyle } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Banner, Card, ChoiceGroup } from '@/ui/parts';
import { Screen } from '@/ui/Screen';
import { playGuidance } from '@/voice/guidance';
import { LANGUAGES, languageInfo } from '@/voice/languages';

const DEFAULT_LIMITS = { maxDocumentChars: 16000, maxLineChars: 600, maxLines: 400, maxHistoryTurns: 6, maxRecordingSeconds: 60, maxQuestionChars: 600 };

type Phase = 'idle' | 'recording' | 'recorded' | 'transcribing' | 'asking';

export default function AskScreen() {
  const params = useLocalSearchParams<{ id: string; mode?: string; focus?: string }>();
  const id = params.id;
  const mode: 'question' | 'explain' = params.mode === 'explain' ? 'explain' : 'question';
  const focusIds = useMemo(() => (params.focus ? params.focus.split(',').filter((x) => /^L\d+$/.test(x)) : []), [params.focus]);
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useTheme();
  const online = useOnline();
  const lang = t.profile.language;
  const recorder = useQuestionRecorder();

  const [reading, setReading] = useState<Reading | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [recording, setRecording] = useState<{ uri: string; durationMs: number; requestId: string } | null>(null);
  const [error, setError] = useState<{ message: string; retry?: 'ask' | 'transcribe'; settings?: boolean } | null>(null);
  const [checkTranscript, setCheckTranscript] = useState(false);
  const [pickLanguage, setPickLanguage] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [audio, setAudio] = useState<{ id: string; state: 'loading' | 'playing' } | null>(null);
  const [audioError, setAudioError] = useState<{ id: string; message: string } | null>(null);
  const player = useRef<AudioPlayer | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const answerRef = useRef<ViewInstance>(null);

  const limits = { ...DEFAULT_LIMITS, ...(online.caps?.limits ?? {}) };
  const langCaps = online.caps?.languages.find((l) => l.code === lang);
  const answersOk = online.status === 'ready' && langCaps?.answers.available === true;
  const transcriptionOk = online.status === 'ready' && langCaps?.transcription.available === true;
  const speechOk = (code: LanguageCode) => online.status === 'ready' && online.caps?.languages.find((l) => l.code === code)?.speech.available === true;
  const L = languageInfo(lang);

  const reload = useCallback(() => listMessages(db, id).then(setMessages), [db, id]);

  useEffect(() => {
    getReading(db, id).then(setReading);
    reload();
    getDraft(db, id).then((d) => {
      if (d && d.mode === mode) {
        setDraft(d.text);
        setRequestId(d.requestId);
      }
    });
  }, [db, id, mode, reload]);

  const stopAudio = useCallback(() => {
    if (player.current) {
      try {
        player.current.pause();
        player.current.remove();
      } catch {
        // Already released.
      }
      player.current = null;
    }
    setAudio((a) => (a?.state === 'playing' ? null : a));
  }, []);

  useFocusEffect(useCallback(() => () => stopAudio(), [stopAudio]));

  // Stop recording automatically at the server's limit.
  const autoStopped = useRef(false);
  const overLimit = phase === 'recording' && recorder.durationMs >= limits.maxRecordingSeconds * 1000;
  useEffect(() => {
    if (!overLimit) {
      autoStopped.current = false;
      return;
    }
    if (autoStopped.current) return;
    autoStopped.current = true;
    announce('Time limit reached. Recording stopped.');
    void finishRecording();
  }, [overLimit]);

  const doc = reading?.doc;
  const lines = useMemo(() => (doc ? lineMap(doc) : new Map()), [doc]);

  const updateDraft = (text: string) => {
    setDraft(text);
    setRequestId(null); // a changed question is a new request
    saveDraft(db, id, { text, mode, requestId: null }).catch(() => {});
  };

  const send = async () => {
    if (!doc) return;
    const question = draft.trim();
    if (mode === 'question' && !question) return;
    stopAudio();
    const rid = requestId ?? newRequestId();
    setRequestId(rid);
    await saveDraft(db, id, { text: draft, mode, requestId: rid });
    setPhase('asking');
    setError(null);
    announce(mode === 'explain' ? 'Asking LUMA to explain.' : 'Sending your question.');
    const picked = selectLines(
      doc.lines.map((l) => ({ id: l.id, text: l.text })),
      question,
      { maxChars: limits.maxDocumentChars - 400, maxLineChars: limits.maxLineChars, maxLines: limits.maxLines, focusIds },
    );
    const history = messages.slice(-limits.maxHistoryTurns).map((m) => ({ role: m.role, text: m.text }));
    try {
      const res = await ask(
        { mode, language: lang, question, lines: picked, focusLineIds: mode === 'explain' ? focusIds : undefined, history },
        rid,
      );
      const userText = mode === 'explain' ? `Explain ${focusIds.length ? `lines ${focusIds[0].slice(1)} to ${focusIds[focusIds.length - 1].slice(1)}` : 'this page'} in ${L.nativeName}.${question ? ' ' + question : ''}` : question;
      await insertMessage(db, { id: newId(), readingId: id, role: 'user', mode, language: lang, text: userText, focusLineIds: focusIds, requestId: rid });
      await insertMessage(db, {
        id: newId(),
        readingId: id,
        role: 'assistant',
        mode,
        language: res.language,
        text: res.answer,
        answerFound: res.answerFound,
        sourceLineIds: res.sourceLineIds,
        requestId: rid,
      });
      await clearDraft(db, id);
      setDraft('');
      setRequestId(null);
      setCheckTranscript(false);
      await reload();
      setPhase('idle');
      announce('Answer ready.');
      playGuidance(lang, 'answer_ready', t.profile.spokenGuidance);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: !t.reduceMotion }), 100);
      focusElement(answerRef, 600);
    } catch (e) {
      setPhase('idle');
      if (e instanceof ApiError && e.code === 'idempotency_conflict') {
        // The question changed since the first attempt: send it as a new request.
        setRequestId(null);
        setError({ message: 'Your question changed since the last try. Send it again.', retry: 'ask' });
        return;
      }
      const message = e instanceof ApiError ? e.message : 'Something went wrong. Try again.';
      setError({ message, retry: e instanceof ApiError && e.retryable ? 'ask' : undefined });
      announce(message);
    }
  };

  const startRecording = async () => {
    stopAudio();
    setError(null);
    const r = await recorder.start();
    if (r === 'denied') {
      setError({ message: 'Microphone permission is off. You can type your question instead, or allow the microphone in phone settings.', settings: true });
      return;
    }
    if (r === 'error') {
      setError({ message: 'The microphone could not start. You can type your question instead.' });
      return;
    }
    setPhase('recording');
    announce('Recording. Tap Stop recording when you finish.');
  };

  async function finishRecording() {
    const r = await recorder.stop();
    if (!r.uri) {
      setPhase('idle');
      setError({ message: 'Nothing was recorded. Try again, or type your question.' });
      return;
    }
    setRecording({ uri: r.uri, durationMs: r.durationMs, requestId: newRequestId() });
    setPhase('recorded');
    announce('Recording stopped. Send it to turn your words into text, or record again.');
  }

  const discardRecording = () => {
    deleteCacheFile(recording?.uri);
    setRecording(null);
    setPhase('idle');
    announce('Recording deleted.');
  };

  const sendRecording = async () => {
    if (!recording) return;
    setPhase('transcribing');
    setError(null);
    announce('Turning your recording into text.');
    try {
      const r = await transcribe(recording.uri, lang, recording.requestId);
      if (r.empty || !r.transcript) {
        setPhase('recorded');
        setError({ message: "LUMA didn't hear any words. Record again a little closer to the phone, or type your question." });
        return;
      }
      deleteCacheFile(recording.uri); // the recording is not kept after transcription
      setRecording(null);
      updateDraft(r.transcript);
      setCheckTranscript(true);
      setPhase('idle');
      announce(`Your words are in the question box: ${r.transcript}. Check them, then send.`);
    } catch (e) {
      setPhase('recorded');
      const message = e instanceof ApiError ? e.message : 'Transcription failed. Try again.';
      setError({ message, retry: e instanceof ApiError && e.retryable ? 'transcribe' : undefined });
      announce(message);
    }
  };

  const playAnswer = async (m: Message) => {
    if (audio?.id === m.id && audio.state === 'playing') {
      stopAudio();
      setAudio(null);
      return;
    }
    stopAudio();
    setAudioError(null);
    let uri = m.audioUri && fileExists(m.audioUri) ? m.audioUri : null;
    if (!uri) {
      if (!online.connected) {
        setAudioError({ id: m.id, message: 'You are offline. A spoken answer needs the internet the first time. After that it plays offline.' });
        return;
      }
      if (!speechOk(m.language)) {
        const reason = online.caps?.languages.find((l) => l.code === m.language)?.speech.reason;
        setAudioError({ id: m.id, message: `${reasonText(reason, 'Spoken answers')} The written answer is still here. No other language was used.` });
        return;
      }
      setAudio({ id: m.id, state: 'loading' });
      announce('Preparing the spoken answer.');
      try {
        const rel = `audio/${m.id}.mp3`;
        const file = await synthesizeTo(m.text, m.language, `speech-${m.id}`, readingFile(id, rel));
        await setMessageAudio(db, m.id, rel);
        uri = file.uri;
        reload();
      } catch (e) {
        setAudio(null);
        setAudioError({ id: m.id, message: `${e instanceof ApiError ? e.message : 'The spoken answer could not be made.'} The written answer is still here.` });
        return;
      }
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    const pl = createAudioPlayer(uri);
    player.current = pl;
    pl.playbackRate = t.profile.speechRate;
    pl.addListener('playbackStatusUpdate', (s) => {
      if (s.didJustFinish && player.current === pl) {
        stopAudio();
        setAudio(null);
      }
    });
    pl.play();
    setAudio({ id: m.id, state: 'playing' });
  };

  const openLine = (lineId: string) => {
    stopAudio();
    router.dismissTo({ pathname: '/reading/[id]', params: { id, line: lineId } });
  };

  if (reading === undefined) return <Screen title="Ask about this page">{null}</Screen>;
  if (!reading || !doc) {
    return (
      <Screen title="Ask about this page">
        <Banner tone="info" title="This reading is no longer on this phone" action={{ label: 'Back to home', onPress: () => router.replace('/') }} />
      </Screen>
    );
  }

  const busy = phase === 'asking' || phase === 'transcribing';
  const canSend = answersOk && online.connected && !busy && phase !== 'recording' && (mode === 'explain' || draft.trim().length > 0);
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')?.id;
  const inputStyle = [
    {
      minHeight: 120,
      borderWidth: 2,
      borderColor: t.palette.border,
      borderRadius: t.radius,
      padding: t.space(3),
      color: t.palette.text,
      backgroundColor: t.palette.background,
      fontSize: t.size.body,
      lineHeight: Math.round(t.size.body * 1.4),
      textAlignVertical: 'top' as const,
    },
    fontStyle(draft, 'regular'),
  ];

  return (
    <Screen
      title={mode === 'explain' ? 'Explain in my language' : 'Ask about this page'}
      kicker={reading.title}
      scroll={false}
    >
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: t.space(4), gap: t.space(4), paddingBottom: t.space(12) }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space(2) }}>
          <Icon name="globe" size={Math.round(t.size.body * 1.2)} color={t.palette.accent} />
          <AppText weight="semibold" style={{ flexShrink: 1 }}>
            Answer language: {L.nativeName}
          </AppText>
          <Button variant="quiet" label={pickLanguage ? 'Close' : 'Change'} onPress={() => setPickLanguage((v) => !v)} />
        </View>
        {pickLanguage ? (
          <ChoiceGroup<LanguageCode>
            label="Answer language"
            value={lang}
            onChange={(language) => {
              t.updateProfile({ language });
              setRequestId(null); // a different language is a new request
              setPickLanguage(false);
            }}
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.nativeName, description: l.name === l.nativeName ? undefined : l.name }))}
          />
        ) : null}

        <PreviewBanner />
        {!onlineConfigured ? (
          <Banner tone="info" title="Ask LUMA is not set up in this version" message="Reading, saving and reading aloud still work. Ask your LUMA team for a build with online features." />
        ) : !online.connected ? (
          <Banner tone="offline" title="You are offline" message="Reading works offline. Asking needs the internet. Your question stays here until you connect." />
        ) : online.status === 'unreachable' ? (
          <Banner tone="warning" title="Can't reach LUMA" message={online.error ?? 'Check your connection.'} action={{ label: 'Check again', icon: 'refresh', onPress: online.refresh }} />
        ) : online.status === 'checking' ? (
          <AppText tone="muted">Checking online features…</AppText>
        ) : langCaps && !langCaps.answers.available ? (
          <Banner tone="warning" title="Answers are not available right now" message={reasonText(langCaps.answers.reason, 'Ask LUMA')} />
        ) : null}

        {mode === 'explain' ? (
          <Card>
            <AppText weight="bold">{focusIds.length ? 'The passage you chose' : 'The whole page'}</AppText>
            <AppText variant="small" tone="muted">
              LUMA explains it in {L.nativeName}. The original stays here so you can compare.
            </AppText>
            {(focusIds.length ? focusIds : doc.lines.slice(0, 12).map((l) => l.id)).map((lid) => {
              const text = lines.get(lid)?.text ?? '';
              return (
                <AppText key={lid} style={[{ fontSize: t.reader.fontSize * 0.85, lineHeight: Math.round(t.reader.fontSize * 0.85 * t.profile.lineSpacing) }, fontStyle(text, t.reader.weight)]}>
                  {text}
                </AppText>
              );
            })}
            {!focusIds.length && doc.lines.length > 12 ? <AppText variant="small" tone="muted">…and {doc.lines.length - 12} more lines.</AppText> : null}
          </Card>
        ) : null}

        {messages.map((m) =>
          m.role === 'user' ? (
            <View key={m.id} accessible style={{ alignSelf: 'flex-end', maxWidth: '92%', gap: 2 }}>
              <AppText variant="small" tone="muted" weight="semibold">
                You asked
              </AppText>
              <AppText>{m.text}</AppText>
            </View>
          ) : (
            <View
              key={m.id}
              ref={m.id === lastAssistant ? answerRef : undefined}
              style={{ gap: t.space(3), padding: t.space(4), borderRadius: t.radius + 4, borderWidth: 2, borderColor: t.palette.accent, backgroundColor: t.palette.surface }}
            >
              <View accessible style={{ gap: t.space(2) }}>
                <AppText variant="small" weight="bold" tone="accent">
                  LUMA · {languageInfo(m.language).nativeName}
                  {m.answerFound === false ? ' · Not on this page' : ''}
                </AppText>
                <AppText style={[{ fontSize: t.reader.fontSize, lineHeight: t.reader.lineHeight }, fontStyle(m.text, t.reader.weight)]}>{m.text}</AppText>
              </View>
              {m.sourceLineIds.length > 0 ? (
                <View style={{ gap: t.space(2) }}>
                  <AppText variant="small" weight="semibold">
                    From the page. Tap a line to check it:
                  </AppText>
                  {m.sourceLineIds.map((lid) => (
                    <Pressable
                      key={lid}
                      onPress={() => openLine(lid)}
                      accessibilityRole="link"
                      accessibilityLabel={`Line ${lid.slice(1)}: ${lines.get(lid)?.text ?? ''}`}
                      accessibilityHint="Opens the reading at this line"
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        gap: t.space(2),
                        minHeight: 52,
                        padding: t.space(2),
                        borderRadius: t.radius,
                        borderWidth: 1,
                        borderColor: t.palette.border,
                        backgroundColor: pressed ? t.palette.surfaceSunken : t.palette.background,
                      })}
                    >
                      <View style={{ width: 5, borderRadius: 3, backgroundColor: t.palette.accent }} />
                      <View style={{ flex: 1 }}>
                        <AppText variant="small" weight="bold" tone="accent">
                          Line {lid.slice(1)}
                        </AppText>
                        <AppText>{lines.get(lid)?.text ?? ''}</AppText>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : m.answerFound ? (
                <AppText variant="small" tone="muted">
                  LUMA did not point to a line for this answer. Check it against the page.
                </AppText>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space(2), alignItems: 'center' }}>
                <Button
                  icon={audio?.id === m.id && audio.state === 'playing' ? 'stop' : 'speaker'}
                  label={audio?.id === m.id ? (audio.state === 'loading' ? 'Preparing audio…' : 'Stop') : m.audioUri ? 'Play answer' : 'Hear answer'}
                  busy={audio?.id === m.id && audio.state === 'loading'}
                  active={audio?.id === m.id && audio.state === 'playing'}
                  variant="secondary"
                  onPress={() => playAnswer(m)}
                />
                {m.audioUri ? (
                  <AppText variant="small" tone="muted">
                    Saved. Plays offline.
                  </AppText>
                ) : null}
              </View>
              {audioError?.id === m.id ? <Banner tone="warning" title="Audio not available" message={audioError.message} /> : null}
            </View>
          ),
        )}

        {error ? (
          <Banner
            tone="error"
            title={error.retry ? 'Not sent yet' : 'Something needs attention'}
            message={error.message}
            action={
              error.retry === 'ask'
                ? { label: 'Try again', icon: 'refresh', onPress: send }
                : error.retry === 'transcribe'
                  ? { label: 'Try again', icon: 'refresh', onPress: sendRecording }
                  : error.settings
                    ? { label: 'Open phone settings', onPress: () => Linking.openSettings() }
                    : undefined
            }
            secondaryAction={{ label: 'Dismiss', onPress: () => setError(null) }}
          />
        ) : null}

        <View style={{ gap: t.space(3) }}>
          <AppText weight="semibold" nativeID="questionLabel">
            {mode === 'explain' ? 'Anything to add? (optional)' : 'Your question'}
          </AppText>
          {checkTranscript ? (
            <Banner tone="info" title="Check the words" message="Fix any mistakes, especially names and words in another language. Then send." />
          ) : null}
          <TextInput
            value={draft}
            onChangeText={updateDraft}
            multiline
            editable={!busy}
            maxLength={limits.maxQuestionChars}
            accessibilityLabel={mode === 'explain' ? 'Anything to add' : 'Your question'}
            accessibilityLabelledBy="questionLabel"
            placeholder={mode === 'explain' ? 'For example: use simple words' : 'Type your question'}
            placeholderTextColor={t.palette.textMuted}
            style={inputStyle}
          />

          {phase === 'recording' ? (
            <View accessibilityLiveRegion="polite" style={{ gap: t.space(2) }}>
              <AppText weight="bold">
                Recording {formatDuration(recorder.durationMs)} of {formatDuration(limits.maxRecordingSeconds * 1000)}
              </AppText>
              <Button size="large" icon="stop" label="Stop recording" variant="danger" onPress={finishRecording} />
            </View>
          ) : phase === 'recorded' || (phase === 'transcribing' && recording) ? (
            <View style={{ gap: t.space(2) }}>
              <AppText weight="semibold">Recording ready ({formatDuration(recording?.durationMs ?? 0)})</AppText>
              <Button size="large" icon="send" label="Send recording to type it out" busy={phase === 'transcribing'} disabled={!transcriptionOk || !online.connected} onPress={sendRecording} />
              <AppText variant="small">Sending uploads this recording through the LUMA server to YarnGPT to turn it into text. It is deleted from your phone afterwards. Your photo stays on your phone.</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space(2) }}>
                <Button icon="mic" variant="secondary" label="Record again" onPress={() => { deleteCacheFile(recording?.uri); setRecording(null); void startRecording(); }} style={{ flexGrow: 1 }} />
                <Button icon="trash" variant="secondary" label="Delete recording" onPress={discardRecording} style={{ flexGrow: 1 }} />
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space(2) }}>
              <Button
                size="large"
                icon={mode === 'explain' ? 'explain' : 'send'}
                label={phase === 'asking' ? 'Waiting for LUMA…' : mode === 'explain' ? 'Explain' : 'Ask LUMA'}
                busy={phase === 'asking'}
                disabled={!canSend}
                onPress={send}
                style={{ flexGrow: 1 }}
              />
              {mode === 'question' ? (
                <Button
                  size="large"
                  icon="mic"
                  variant="secondary"
                  label="Record question"
                  hint={transcriptionOk ? 'Speak your question, then stop and send it' : undefined}
                  disabled={!transcriptionOk || !online.connected || busy}
                  onPress={startRecording}
                  style={{ flexGrow: 1 }}
                />
              ) : null}
            </View>
          )}
          {mode === 'question' && online.status === 'ready' && !transcriptionOk ? (
            <AppText variant="small" tone="muted">
              Spoken questions in {L.nativeName}: {reasonText(langCaps?.transcription.reason, 'Spoken questions')} You can type instead.
            </AppText>
          ) : null}
          {phase === 'asking' || phase === 'transcribing' ? (
            <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: t.space(2), alignItems: 'center' }}>
              <ActivityIndicator color={t.palette.accent} />
              <AppText tone="muted">{phase === 'asking' ? 'LUMA is reading the page and writing an answer…' : 'Turning your recording into text…'}</AppText>
            </View>
          ) : null}

          <Pressable
            onPress={() => setShowPrivacy((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showPrivacy }}
            style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: t.space(2) }}
          >
            <Icon name="lock" size={Math.round(t.size.body)} color={t.palette.accent} />
            <AppText weight="semibold" tone="accent">
              What leaves your phone
            </AppText>
          </Pressable>
          {showPrivacy ? (
            <Card>
              <AppText>When you send a question, LUMA sends your question, numbered lines of text from this page and your last few questions and answers to the LUMA server. The server asks OpenAI to write the answer. Your photo is never sent.</AppText>
              <AppText>When you send a recording, it goes through the LUMA server to YarnGPT, which turns it into text. LUMA deletes the recording from your phone afterwards. YarnGPT says it keeps uploaded audio for up to 12 months.</AppText>
              <AppText>When you tap Hear answer, the answer text goes to YarnGPT to make the audio, which is then saved on your phone.</AppText>
            </Card>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
