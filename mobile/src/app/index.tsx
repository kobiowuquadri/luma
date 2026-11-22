import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOnline } from '@/ask/OnlineProvider';
import { listReadings, type ReadingSummary } from '@/db/readings';
import { formatWhen } from '@/lib/format';
import { recoverPendingPhoto } from '@/ocr/scan';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { LinkRow, SectionTitle, StatusPill } from '@/ui/parts';
import { Wordmark } from '@/ui/Wordmark';

function ReadingCard({ r, primary, onPress }: { r: ReadingSummary; primary?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${primary ? 'Continue reading: ' : ''}${r.title}. ${r.kind === 'board' ? 'Board' : 'Page'}, opened ${formatWhen(r.openedAt)}.`}
      accessibilityHint="Opens the reading"
      style={({ pressed }) => ({
        borderRadius: t.radius + 4,
        borderWidth: primary ? 2 : 1,
        borderColor: primary ? t.palette.accent : t.palette.border,
        backgroundColor: pressed ? t.palette.surfaceSunken : t.palette.surface,
        padding: t.space(4),
        gap: t.space(2),
        flexDirection: 'row',
      })}
    >
      <View style={{ width: 6, borderRadius: 3, backgroundColor: primary ? t.palette.accent : t.palette.border }} />
      <View style={{ flex: 1, gap: t.space(1) }}>
        {primary ? (
          <AppText variant="small" weight="bold" tone="accent">
            Continue reading
          </AppText>
        ) : null}
        <AppText weight="bold">{r.title}</AppText>
        <AppText variant="small" tone="muted" numberOfLines={primary ? 3 : 2}>
          {r.preview}
        </AppText>
        <AppText variant="small" tone="muted">
          {r.kind === 'board' ? 'Board' : 'Page'} · {formatWhen(r.openedAt)}
        </AppText>
      </View>
    </Pressable>
  );
}

export default function Home() {
  const t = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const online = useOnline();
  const [readings, setReadings] = useState<ReadingSummary[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listReadings(db, 50).then((r) => alive && setReadings(r));
      return () => {
        alive = false;
      };
    }, [db]),
  );

  useEffect(() => {
    recoverPendingPhoto().then((uri) => {
      if (uri) router.push({ pathname: '/scan', params: { source: 'pending', kind: 'page', uri } });
    });
  }, [router]);

  if (!t.profile.onboarded) return <Redirect href="/welcome" />;

  const [latest, ...rest] = readings ?? [];
  const scan = (source: 'camera' | 'library', kind: 'page' | 'board') => router.push({ pathname: '/scan', params: { source, kind } });

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: t.palette.background }}>
      <StatusBar style={t.palette.scheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={{ padding: t.space(4), gap: t.space(4), paddingBottom: t.space(12) }}>
        <View style={{ gap: t.space(1), paddingTop: t.space(2) }}>
          <Wordmark />
          <AppText tone="muted">Read the page your way.</AppText>
        </View>

        {online.status === 'offline' ? <StatusPill ok={null} label="Offline. Scanning, reading and saving still work." /> : null}

        <View style={{ gap: t.space(3) }}>
          <Button size="large" icon="camera" label="Scan a page" hint="Opens the camera to photograph a handout" onPress={() => scan('camera', 'page')} />
          <Button size="large" variant="secondary" icon="image" label="Open an image" hint="Choose a photo that is already on your phone" onPress={() => scan('library', 'page')} />
          <Button variant="secondary" icon="board" label="Scan a board" hint="Photograph a classroom board" onPress={() => scan('camera', 'board')} />
        </View>

        {readings === null ? null : latest ? (
          <View style={{ gap: t.space(3) }}>
            <ReadingCard r={latest} primary onPress={() => router.push({ pathname: '/reading/[id]', params: { id: latest.id } })} />
            {rest.length > 0 ? (
              <>
                <SectionTitle>Saved readings</SectionTitle>
                {rest.slice(0, 3).map((r) => (
                  <ReadingCard key={r.id} r={r} onPress={() => router.push({ pathname: '/reading/[id]', params: { id: r.id } })} />
                ))}
                <Button variant="secondary" icon="book" label={`All saved readings (${readings.length})`} onPress={() => router.push('/readings')} />
              </>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: t.space(3), padding: t.space(4), borderRadius: t.radius + 4, borderWidth: 1, borderColor: t.palette.border, backgroundColor: t.palette.surface }}>
            <Icon name="line" size={44} color={t.palette.accent} />
            <AppText weight="bold">No saved readings yet</AppText>
            <AppText>Scan a handout or open a photo of one. LUMA reads it on this phone, even without internet, and keeps it here for later.</AppText>
            <Button variant="secondary" icon="book" label="Try the sample handout" hint="Opens a sample page made for trying LUMA" onPress={() => router.push({ pathname: '/scan', params: { source: 'sample', kind: 'page' } })} />
          </View>
        )}

        <SectionTitle>Settings</SectionTitle>
        <View style={{ gap: t.space(2) }}>
          <LinkRow icon="eye" label="My vision profile" description="Text size, spacing and colours" onPress={() => router.push('/profile')} />
          <LinkRow icon="globe" label="Languages and voices" description="Answer language and what works offline" onPress={() => router.push('/voices')} />
          <LinkRow icon="sun" label="SunSafe" description="Sun protection reminders and UV forecast" onPress={() => router.push('/sunsafe')} />
          <LinkRow icon="lock" label="Privacy and about" description="What stays on your phone" onPress={() => router.push('/privacy')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
