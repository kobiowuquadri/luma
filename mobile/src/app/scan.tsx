import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Asset } from 'expo-asset';
import { useSQLiteContext } from 'expo-sqlite';
import { isOcrAvailable } from '../../modules/luma-ocr';
import { announce } from '@/lib/a11y';
import type { CaptureAdvice, CaptureKind } from '@/ocr/advice';
import { pickImage, processImage, type PickSource } from '@/ocr/scan';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Banner, Card } from '@/ui/parts';
import { Screen } from '@/ui/Screen';
import { playGuidance } from '@/voice/guidance';

type Source = PickSource | 'sample' | 'pending';

type Phase =
  | { phase: 'intro' }
  | { phase: 'picking' }
  | { phase: 'processing' }
  | { phase: 'empty'; advice: CaptureAdvice | null }
  | { phase: 'cancelled' }
  | { phase: 'denied'; canAskAgain: boolean }
  | { phase: 'error'; message: string }
  | { phase: 'unavailable' };

const BOARD_TIPS = [
  'Stand where the board fills most of the screen.',
  'Move so window light or lamps do not reflect off the board.',
  'For a long board, scan it in parts. Each part is saved as its own reading.',
  'Diagrams stay on the photo. Open the photo in the reader to zoom in.',
];

export default function ScanScreen() {
  const params = useLocalSearchParams<{ source?: string; kind?: string; uri?: string }>();
  const kind: CaptureKind = params.kind === 'board' ? 'board' : 'page';
  const initialSource: Source = (['camera', 'library', 'sample', 'pending'] as const).find((s) => s === params.source) ?? 'camera';
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useTheme();
  const lang = t.profile.language;
  const spoken = t.profile.spokenGuidance;
  const [state, setState] = useState<Phase>(kind === 'board' && initialSource === 'camera' ? { phase: 'intro' } : { phase: 'picking' });
  const [lastSource, setLastSource] = useState<Source>(initialSource);
  const started = useRef(false);

  const run = useCallback(
    async (src: Source) => {
      setLastSource(src);
      if (!isOcrAvailable) {
        setState({ phase: 'unavailable' });
        return;
      }
      let uri: string | null = null;
      let keep = false;
      if (src === 'sample') {
        const asset = Asset.fromModule(require('../../assets/sample/handout.jpg'));
        await asset.downloadAsync();
        uri = asset.localUri;
        keep = true;
      } else if (src === 'pending') {
        uri = params.uri ?? null;
      } else {
        setState({ phase: 'picking' });
        if (src === 'camera') {
          playGuidance(lang, kind === 'board' ? 'board_tip' : 'take_photo', spoken);
          announce('Opening the camera.');
        }
        const r = await pickImage(src);
        if (r.kind === 'cancelled') {
          setState({ phase: 'cancelled' });
          announce(src === 'camera' ? 'No photo was taken.' : 'No image was chosen.');
          return;
        }
        if (r.kind === 'denied') {
          setState({ phase: 'denied', canAskAgain: r.canAskAgain });
          announce('Camera permission is off.');
          return;
        }
        if (r.kind === 'error') {
          setState({ phase: 'error', message: r.message });
          return;
        }
        uri = r.uri;
      }
      if (!uri) {
        setState({ phase: 'error', message: 'The image could not be found. Try again.' });
        return;
      }
      setState({ phase: 'processing' });
      announce('Reading the page. Please wait.');
      playGuidance(lang, 'reading_page', spoken);
      try {
        const res = await processImage(db, uri, kind, keep);
        if (!res.readingId) {
          setState({ phase: 'empty', advice: res.advice });
          if (res.advice) announce(`${res.advice.title}. ${res.advice.instruction}`);
          playGuidance(lang, res.advice?.promptId ?? 'no_text', spoken);
          return;
        }
        announce(`Scan complete. ${res.stats.lineCount} lines found.`);
        playGuidance(lang, 'scan_complete', spoken);
        router.replace({
          pathname: '/reading/[id]',
          params: { id: res.readingId, fresh: '1', ...(res.advice && !res.advice.blocking ? { advice: res.advice.reason } : {}) },
        });
      } catch (e) {
        const message = e instanceof Error && e.message ? e.message : 'Text recognition failed on this image.';
        setState({ phase: 'error', message });
        announce(`Scan failed. ${message}`);
      }
    },
    [db, kind, lang, params.uri, router, spoken],
  );

  // Any button press counts as the start, so the automatic first run below
  // never launches the camera a second time.
  const begin = (src: Source) => {
    started.current = true;
    void run(src);
  };

  useEffect(() => {
    if (started.current || state.phase === 'intro') return;
    started.current = true;
    void run(initialSource);
  }, [initialSource, run, state.phase]);

  const title = kind === 'board' ? 'Scan a board' : lastSource === 'library' ? 'Open an image' : 'Scan a page';
  const retryButtons = (
    <View style={{ gap: t.space(3) }}>
      <Button size="large" icon="camera" label={kind === 'board' ? 'Photograph the board again' : 'Take a photo'} onPress={() => begin('camera')} />
      <Button variant="secondary" icon="image" label="Choose an image instead" onPress={() => begin('library')} />
      <Button variant="quiet" label="Back to home" onPress={() => router.replace('/')} />
    </View>
  );

  return (
    <Screen title={title}>
      {state.phase === 'intro' ? (
        <>
          <Card>
            <AppText weight="bold">Before you take the photo</AppText>
            {BOARD_TIPS.map((tip) => (
              <View key={tip} style={{ flexDirection: 'row', gap: t.space(2) }}>
                <View style={{ width: 6, borderRadius: 3, backgroundColor: t.palette.accent, marginVertical: 4 }} />
                <AppText style={{ flex: 1 }}>{tip}</AppText>
              </View>
            ))}
          </Card>
          <Button size="large" icon="camera" label="Open the camera" onPress={() => begin('camera')} />
          <Button variant="secondary" icon="image" label="Choose a photo of a board" onPress={() => begin('library')} />
        </>
      ) : null}

      {state.phase === 'picking' || state.phase === 'processing' ? (
        <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: t.space(4), paddingVertical: t.space(10) }}>
          <ActivityIndicator size="large" color={t.palette.accent} />
          <AppText variant="title" style={{ textAlign: 'center' }}>
            {state.phase === 'processing' ? 'Reading the page…' : 'Waiting for the photo…'}
          </AppText>
          {state.phase === 'processing' ? (
            <AppText tone="muted" style={{ textAlign: 'center' }}>
              This happens on your phone and works without internet.
            </AppText>
          ) : null}
        </View>
      ) : null}

      {state.phase === 'empty' ? (
        <>
          <Banner
            tone="warning"
            title={state.advice?.title ?? 'No words were found'}
            message={state.advice?.instruction ?? 'Fill the screen with the page and keep the words the right way up. Then take the photo again.'}
          />
          {retryButtons}
        </>
      ) : null}

      {state.phase === 'cancelled' ? (
        <>
          <Banner tone="info" title={lastSource === 'library' ? 'No image was chosen' : 'No photo was taken'} message="Nothing was saved." />
          {retryButtons}
        </>
      ) : null}

      {state.phase === 'denied' ? (
        <>
          <Banner
            tone="warning"
            title="Camera permission is off"
            message="LUMA needs the camera to photograph pages. The photo stays on your phone. You can also choose an image that is already on your phone."
          />
          {state.canAskAgain ? (
            <Button size="large" icon="camera" label="Allow camera and try again" onPress={() => begin('camera')} />
          ) : (
            <Button size="large" icon="info" label="Open phone settings" hint="Turn on Camera for LUMA, then come back" onPress={() => Linking.openSettings()} />
          )}
          <Button variant="secondary" icon="image" label="Choose an image instead" onPress={() => begin('library')} />
        </>
      ) : null}

      {state.phase === 'error' ? (
        <>
          <Banner tone="error" title="The scan did not work" message={state.message} />
          <Button size="large" icon="refresh" label="Try again" onPress={() => run(lastSource === 'pending' ? 'camera' : lastSource)} />
          <Button variant="quiet" label="Back to home" onPress={() => router.replace('/')} />
        </>
      ) : null}

      {state.phase === 'unavailable' ? (
        <Banner
          tone="warning"
          title="Scanning needs the LUMA app"
          message="Text recognition runs inside the LUMA Android app (APK or development build). It is not included in Expo Go."
          action={{ label: 'Back to home', onPress: () => router.replace('/') }}
        />
      ) : null}
    </Screen>
  );
}
