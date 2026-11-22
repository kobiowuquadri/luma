import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, TextInput, View, type ListViewToken } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useOnline } from '@/ask/OnlineProvider';
import { deleteReading, getReading, markOpened, renameReading, savePosition, type Reading } from '@/db/readings';
import { announce } from '@/lib/a11y';
import { formatWhen } from '@/lib/format';
import { adviseCapture, type AdviceReason } from '@/ocr/advice';
import { lineMap, paragraphIndexOfLine, paragraphText, type DocParagraph } from '@/ocr/layout';
import { ProfileEditor } from '@/profile/ProfileEditor';
import { ParagraphView } from '@/reader/ParagraphView';
import { ToolbarButton } from '@/reader/ToolbarButton';
import { useReadAloud } from '@/reader/useReadAloud';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, fontStyle } from '@/ui/AppText';
import { Button, IconButton } from '@/ui/Button';
import { Banner } from '@/ui/parts';
import { Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';
import { languageLabel, toLanguageCode } from '@/voice/languages';

const VIEWABILITY = { itemVisiblePercentThreshold: 20 };

const ADVICE_REASONS: AdviceReason[] = ['dark', 'glare', 'blurry', 'noText', 'lowConfidence'];

export default function ReaderScreen() {
  const params = useLocalSearchParams<{ id: string; line?: string; fresh?: string; advice?: string }>();
  const id = params.id;
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useTheme();
  const online = useOnline();
  const [reading, setReading] = useState<Reading | null | undefined>(undefined);
  const [selected, setSelected] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<string | null>(params.line ?? null);
  const [sheet, setSheet] = useState<'display' | 'more' | 'rename' | 'delete' | null>(null);
  const [showSaved, setShowSaved] = useState(params.fresh === '1');
  const [showAdvice, setShowAdvice] = useState(!!params.advice);
  const [titleDraft, setTitleDraft] = useState('');
  const listRef = useRef<FlatList<DocParagraph>>(null);
  const topIndex = useRef(0);

  useEffect(() => {
    let alive = true;
    getReading(db, id).then((r) => {
      if (!alive) return;
      setReading(r);
      if (r) {
        markOpened(db, id).catch(() => {});
        topIndex.current = r.positionParagraph;
      }
    });
    return () => {
      alive = false;
    };
  }, [db, id]);

  const doc = reading?.doc ?? null;
  const lines = useMemo(() => (doc ? lineMap(doc) : new Map()), [doc]);
  const texts = useMemo(() => (doc ? doc.paragraphs.map((p) => paragraphText(doc, p, lines)) : []), [doc, lines]);
  const docLanguage = toLanguageCode(doc?.language) ?? 'en';
  const caps = online.caps;
  const ra = useReadAloud(id, doc, docLanguage, t.profile.speechRate, caps?.limits.maxSpeechChars ?? 1400);

  const scrollTo = useCallback((index: number, animated: boolean) => {
    if (index < 0) return;
    try {
      listRef.current?.scrollToIndex({ index, animated, viewPosition: 0.1 });
    } catch {
      // Handled by onScrollToIndexFailed.
    }
  }, []);

  // Return to where the student stopped last time, or to a cited line.
  useEffect(() => {
    if (!doc) return;
    const target = params.line ? paragraphIndexOfLine(doc, params.line) : topIndex.current;
    if (params.line) {
      setHighlight(params.line);
      announce(`Showing line ${params.line.slice(1)} from LUMA's answer.`);
    }
    if (target > 0) {
      const timer = setTimeout(() => scrollTo(target, false), 250);
      return () => clearTimeout(timer);
    }
  }, [doc, params.line, scrollTo]);

  // Changing display settings must not lose the student's place.
  useEffect(() => {
    const timer = setTimeout(() => scrollTo(topIndex.current, false), 80);
    return () => clearTimeout(timer);
  }, [t.reader.fontSize, t.reader.lineHeight, t.reader.letterSpacing, t.reader.weight, scrollTo]);

  // Follow the paragraph being read aloud.
  useEffect(() => {
    if (ra.state.status === 'speaking' && ra.state.index != null) scrollTo(ra.state.index, !t.reduceMotion);
  }, [ra.state.status, ra.state.index, scrollTo, t.reduceMotion]);

  const stopReading = ra.stop;
  useFocusEffect(
    useCallback(
      () => () => {
        stopReading();
        savePosition(db, id, topIndex.current).catch(() => {});
      },
      [db, id, stopReading],
    ),
  );

  const onViewable = useCallback(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const first = viewableItems.find((v) => v.index != null);
    if (first?.index != null) topIndex.current = first.index;
  }, []);

  if (reading === undefined) return <Screen title="Opening…">{null}</Screen>;
  if (reading === null || !doc) {
    return (
      <Screen title="Reading not found">
        <Banner tone="info" title="This reading is no longer on this phone" message="It may have been deleted." action={{ label: 'Back to home', onPress: () => router.replace('/') }} />
      </Screen>
    );
  }

  const ask = (mode: 'question' | 'explain', paragraphIndex?: number | null) => {
    ra.stop();
    const focus = paragraphIndex != null ? doc.paragraphs[paragraphIndex]?.lineIds.join(',') : undefined;
    router.push({ pathname: '/reading/[id]/ask', params: { id, mode, ...(focus ? { focus } : {}) } });
  };
  const openPhoto = (lineId?: string) => {
    ra.stop();
    router.push({ pathname: '/reading/[id]/photo', params: { id, ...(lineId ? { line: lineId } : {}) } });
  };
  const speaking = ra.state.status !== 'idle';
  const advice = showAdvice && params.advice && ADVICE_REASONS.includes(params.advice as AdviceReason) ? adviseCapture(doc.quality, doc.stats, reading.kind) : null;
  const onlineSpeech = caps?.languages.find((l) => l.code === docLanguage)?.speech.available === true && online.connected;
  const needs = ra.state.needsChoice;

  const header = (
    <View style={{ gap: t.space(3), paddingBottom: t.space(2) }}>
      <AppText variant="small" tone="muted">
        {reading.kind === 'board' ? 'Board' : 'Page'} · {doc.stats.lineCount} lines · Scanned {formatWhen(reading.createdAt)}
      </AppText>
      {showSaved ? (
        <Banner
          tone="success"
          title="Saved to your readings"
          message={`Saved on this phone as “${reading.title}”.`}
          action={{ label: 'Rename', icon: 'pencil', onPress: () => { setTitleDraft(reading.title); setSheet('rename'); } }}
          secondaryAction={{ label: 'OK', onPress: () => setShowSaved(false) }}
        />
      ) : null}
      {advice ? (
        <Banner
          tone="warning"
          title={advice.title}
          message={advice.instruction}
          action={{ label: 'Retake photo', icon: 'camera', onPress: () => router.replace({ pathname: '/scan', params: { source: 'camera', kind: reading.kind } }) }}
          secondaryAction={{ label: 'Keep this scan', onPress: () => setShowAdvice(false) }}
        />
      ) : null}
      {!advice && t.profile.markUncertainWords && doc.stats.uncertainCount > 0 ? (
        <Banner
          tone="info"
          title={`${doc.stats.uncertainCount} word${doc.stats.uncertainCount === 1 ? ' is' : 's are'} marked as uncertain`}
          message="They are underlined. Compare them with the photo before you rely on them."
          action={{ label: 'Open the photo', icon: 'photo', onPress: () => openPhoto() }}
        />
      ) : null}
      {highlight ? (
        <Banner
          tone="info"
          title={`Line ${highlight.slice(1)} is highlighted`}
          message={lines.get(highlight)?.text}
          action={{ label: 'Show on photo', icon: 'photo', onPress: () => openPhoto(highlight) }}
          secondaryAction={{ label: 'Clear highlight', onPress: () => setHighlight(null) }}
        />
      ) : null}
      {needs ? (
        <Banner
          tone="warning"
          title={`No offline voice for ${languageLabel(needs.language)} on this phone`}
          message={
            onlineSpeech || needs.voice.network
              ? 'Reading this page aloud needs the internet. Choose a voice below.'
              : online.connected
                ? 'There is no voice for this language on the phone or on the LUMA server yet. You can add a voice in Android Settings, under Text-to-speech.'
                : 'Connect to the internet to use an online voice, or add a voice in Android Settings, under Text-to-speech.'
          }
          action={onlineSpeech ? { label: "Use LUMA's online voice", icon: 'speaker', onPress: () => ra.startWith(ra.state.index ?? topIndex.current, 'online') } : needs.voice.network && online.connected ? { label: "Use the phone's online voice", icon: 'speaker', onPress: () => ra.startWith(ra.state.index ?? topIndex.current, 'network-device') } : undefined}
          secondaryAction={{ label: 'Cancel', onPress: ra.dismissChoice }}
        />
      ) : null}
      {ra.state.error ? <Banner tone="error" title="Reading aloud stopped" message={ra.state.error} secondaryAction={{ label: 'OK', onPress: ra.dismissChoice }} /> : null}
    </View>
  );

  return (
    <Screen
      title={reading.title}
      kicker="Reading"
      scroll={false}
      actions={
        <>
          <IconButton icon="photo" label="Original photo" hint="Opens the photo so you can zoom in" onPress={() => openPhoto()} />
          <IconButton icon="more" label="More options" hint="Rename or delete this reading" onPress={() => setSheet('more')} />
        </>
      }
      footer={
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space(1) }}>
          <ToolbarButton
            icon={speaking ? 'stop' : 'speaker'}
            label={speaking ? 'Stop reading' : 'Read aloud'}
            active={speaking}
            hint={speaking ? undefined : 'Reads the original text from the top of the screen'}
            onPress={() => (speaking ? ra.stop() : ra.start(selected ?? topIndex.current))}
          />
          <ToolbarButton icon="question" label="Ask about this page" onPress={() => ask('question')} />
          <ToolbarButton icon="explain" label="Explain in my language" onPress={() => ask('explain', selected)} />
          <ToolbarButton icon="textSize" label="Display" hint="Text size, spacing and colours" onPress={() => setSheet('display')} />
        </View>
      }
    >
      <FlatList
        ref={listRef}
        data={doc.paragraphs}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: t.space(4), paddingBottom: t.space(12), gap: t.space(4) }}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={VIEWABILITY}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0.1 }), 150);
        }}
        extraData={[highlight, selected, ra.state.index, t.reader, t.palette, t.profile.markUncertainWords]}
        renderItem={({ item, index }) => (
          <View style={{ gap: t.space(2) }}>
            <ParagraphView
              paragraph={item}
              lines={lines}
              text={texts[index]}
              highlightLineId={highlight}
              selected={selected === index}
              speaking={ra.state.index === index && speaking}
              onPress={() => setSelected(selected === index ? null : index)}
              onAction={(a) => (a === 'read' ? ra.start(index) : a === 'explain' ? ask('explain', index) : openPhoto(item.lineIds[0]))}
            />
            {selected === index ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space(2), paddingLeft: t.space(4) }}>
                <Button icon="speaker" label="Read from here" variant="secondary" onPress={() => ra.start(index)} style={{ flexGrow: 1 }} />
                <Button icon="explain" label="Explain this" variant="secondary" onPress={() => ask('explain', index)} style={{ flexGrow: 1 }} />
                <Button icon="photo" label="Show on photo" variant="secondary" onPress={() => openPhoto(item.lineIds[0])} style={{ flexGrow: 1 }} />
                <Button icon="close" label="Close" variant="quiet" onPress={() => setSelected(null)} style={{ flexGrow: 1 }} />
              </View>
            ) : null}
          </View>
        )}
      />

      <Sheet visible={sheet === 'display'} title="Display" onClose={() => setSheet(null)}>
        <AppText tone="muted">Changes apply straight away. You stay on the same paragraph.</AppText>
        <ProfileEditor compact />
      </Sheet>

      <Sheet visible={sheet === 'more'} title="This reading" onClose={() => setSheet(null)}>
        <Button icon="pencil" variant="secondary" label="Rename" onPress={() => { setTitleDraft(reading.title); setSheet('rename'); }} />
        <Button icon="photo" variant="secondary" label="Original photo" onPress={() => { setSheet(null); openPhoto(); }} />
        <Button icon="trash" variant="danger" label="Delete this reading" onPress={() => setSheet('delete')} />
      </Sheet>

      <Sheet visible={sheet === 'rename'} title="Rename reading" onClose={() => setSheet(null)}>
        <AppText weight="semibold" nativeID="renameLabel">
          Name
        </AppText>
        <TextInput
          value={titleDraft}
          onChangeText={setTitleDraft}
          accessibilityLabel="Reading name"
          accessibilityLabelledBy="renameLabel"
          autoFocus
          maxLength={120}
          returnKeyType="done"
          style={[
            {
              minHeight: 56,
              borderWidth: 2,
              borderColor: t.palette.border,
              borderRadius: t.radius,
              paddingHorizontal: t.space(3),
              color: t.palette.text,
              backgroundColor: t.palette.background,
              fontSize: t.size.body,
            },
            fontStyle(titleDraft, 'regular'),
          ]}
        />
        <Button
          icon="check"
          label="Save name"
          onPress={async () => {
            await renameReading(db, id, titleDraft);
            setReading({ ...reading, title: titleDraft.trim() || reading.title });
            setShowSaved(false);
            setSheet(null);
            announce('Name saved.');
          }}
        />
      </Sheet>

      <Sheet visible={sheet === 'delete'} title="Delete this reading?" onClose={() => setSheet(null)}>
        <AppText>This removes the text, the photo, saved answers and saved audio from this phone. It cannot be undone.</AppText>
        <Button
          icon="trash"
          variant="danger"
          label="Delete reading"
          onPress={async () => {
            ra.stop();
            await deleteReading(db, id);
            setSheet(null);
            announce('Reading deleted.');
            router.replace('/');
          }}
        />
        <Button variant="secondary" label="Keep it" onPress={() => setSheet(null)} />
      </Sheet>
    </Screen>
  );
}
