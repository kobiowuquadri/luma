import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getReading, type Reading } from '@/db/readings';
import { announce } from '@/lib/a11y';
import { fileExists } from '@/lib/files';
import { lineMap } from '@/ocr/layout';
import { ZoomableImage, type Overlay, type ZoomHandle } from '@/reader/ZoomableImage';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Banner, ToggleRow } from '@/ui/parts';
import { Screen } from '@/ui/Screen';

export default function PhotoScreen() {
  const { id, line } = useLocalSearchParams<{ id: string; line?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useTheme();
  const [reading, setReading] = useState<Reading | null | undefined>(undefined);
  const [showUncertain, setShowUncertain] = useState(true);
  const zoom = useRef<ZoomHandle>(null);

  useEffect(() => {
    getReading(db, id).then(setReading);
  }, [db, id]);

  const lineBox = useMemo(() => (reading && line ? (lineMap(reading.doc).get(line)?.box ?? null) : null), [reading, line]);
  const overlays = useMemo<Overlay[]>(() => {
    if (!reading) return [];
    const out: Overlay[] = [];
    if (lineBox) out.push({ box: lineBox, kind: 'line' });
    if (showUncertain) {
      for (const l of reading.doc.lines) for (const w of l.words) if (w.uncertain && w.box) out.push({ box: w.box, kind: 'uncertain' });
    }
    return out;
  }, [reading, lineBox, showUncertain]);

  useEffect(() => {
    if (!lineBox) return;
    const timer = setTimeout(() => zoom.current?.focusBox(lineBox), 400);
    return () => clearTimeout(timer);
  }, [lineBox]);

  if (reading === undefined) return <Screen title="Original photo">{null}</Screen>;
  if (!reading || !reading.imageUri || !fileExists(reading.imageUri) || !reading.imageWidth || !reading.imageHeight) {
    return (
      <Screen title="Original photo">
        <Banner tone="info" title="The photo is not available" message="The text of this reading is still saved." action={{ label: 'Back to the text', onPress: () => router.back() }} />
      </Screen>
    );
  }

  const zoomBy = (f: number) => {
    const s = zoom.current?.zoomBy(f) ?? 1;
    announce(`Zoom ${Math.round(s * 100)} percent`);
  };

  return (
    <Screen
      title="Original photo"
      kicker={reading.title}
      scroll={false}
      footer={
        <View style={{ gap: t.space(2) }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space(2) }}>
            <Button icon="zoomIn" label="Zoom in" variant="secondary" onPress={() => zoomBy(1.5)} style={{ flexGrow: 1 }} />
            <Button icon="zoomOut" label="Zoom out" variant="secondary" onPress={() => zoomBy(1 / 1.5)} style={{ flexGrow: 1 }} />
            <Button icon="photo" label="Fit to screen" variant="secondary" onPress={() => { zoom.current?.fit(); announce('Whole photo'); }} style={{ flexGrow: 1 }} />
            {lineBox ? (
              <Button icon="line" label={`Go to line ${line?.slice(1)}`} onPress={() => zoom.current?.focusBox(lineBox)} style={{ flexGrow: 1 }} />
            ) : null}
          </View>
          {reading.doc.stats.uncertainCount > 0 ? (
            <ToggleRow
              label="Outline uncertain words"
              description="Words LUMA may have read wrongly get an orange outline."
              value={showUncertain}
              onChange={setShowUncertain}
            />
          ) : null}
        </View>
      }
    >
      {lineBox ? (
        <View style={{ paddingHorizontal: t.space(4), paddingVertical: t.space(2) }}>
          <AppText variant="small" weight="semibold">
            Line {line?.slice(1)} has a teal outline.
          </AppText>
        </View>
      ) : null}
      <ZoomableImage ref={zoom} uri={reading.imageUri} width={reading.imageWidth} height={reading.imageHeight} overlays={overlays} />
    </Screen>
  );
}
