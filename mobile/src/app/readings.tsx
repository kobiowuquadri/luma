import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { deleteReading, listReadings, renameReading, type ReadingSummary } from '@/db/readings';
import { announce } from '@/lib/a11y';
import { formatWhen } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, fontStyle } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';

export default function ReadingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useTheme();
  const [items, setItems] = useState<ReadingSummary[]>([]);
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<ReadingSummary | null>(null);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<ReadingSummary | null>(null);

  const load = useCallback(() => listReadings(db).then(setItems), [db]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((r) => r.title.toLowerCase().includes(q) || r.preview.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const input = {
    minHeight: 56,
    borderWidth: 2,
    borderColor: t.palette.border,
    borderRadius: t.radius,
    paddingHorizontal: t.space(3),
    color: t.palette.text,
    backgroundColor: t.palette.surface,
    fontSize: t.size.body,
  };

  return (
    <Screen title="Saved readings" scroll={false}>
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: t.space(4), gap: t.space(3), paddingBottom: t.space(12) }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: t.space(2), marginBottom: t.space(2) }}>
            <AppText weight="semibold" nativeID="searchLabel">
              Find a reading
            </AppText>
            <TextInput
              value={query}
              onChangeText={setQuery}
              accessibilityLabel="Find a reading"
              accessibilityLabelledBy="searchLabel"
              placeholder="Type a word from the title or text"
              placeholderTextColor={t.palette.textMuted}
              style={[input, fontStyle(query, 'regular')]}
            />
            <AppText variant="small" tone="muted" accessibilityLiveRegion="polite">
              {filtered.length} of {items.length} readings
            </AppText>
          </View>
        }
        ListEmptyComponent={<AppText>{items.length ? 'No readings match.' : 'No saved readings yet. Scan a page to start.'}</AppText>}
        renderItem={({ item }) => (
          <View style={{ borderWidth: 1, borderColor: t.palette.border, borderRadius: t.radius + 4, backgroundColor: t.palette.surface, overflow: 'hidden' }}>
            <Pressable
              onPress={() => router.push({ pathname: '/reading/[id]', params: { id: item.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.kind === 'board' ? 'Board' : 'Page'}, opened ${formatWhen(item.openedAt)}.`}
              accessibilityHint="Opens the reading"
              style={({ pressed }) => ({ padding: t.space(4), gap: t.space(1), backgroundColor: pressed ? t.palette.surfaceSunken : 'transparent' })}
            >
              <AppText weight="bold">{item.title}</AppText>
              <AppText variant="small" tone="muted" numberOfLines={2}>
                {item.preview}
              </AppText>
              <AppText variant="small" tone="muted">
                {item.kind === 'board' ? 'Board' : 'Page'} · {item.lineCount} lines · {formatWhen(item.openedAt)}
              </AppText>
            </Pressable>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space(2), padding: t.space(2), paddingTop: 0 }}>
              <Button
                icon="pencil"
                variant="quiet"
                label="Rename"
                accessibilityLabel={`Rename ${item.title}`}
                onPress={() => {
                  setName(item.title);
                  setRenaming(item);
                }}
                style={{ flexGrow: 1 }}
              />
              <Button icon="trash" variant="quiet" label="Delete" accessibilityLabel={`Delete ${item.title}`} onPress={() => setDeleting(item)} style={{ flexGrow: 1 }} />
            </View>
          </View>
        )}
      />

      <Sheet visible={renaming != null} title="Rename reading" onClose={() => setRenaming(null)}>
        <TextInput value={name} onChangeText={setName} accessibilityLabel="Reading name" autoFocus maxLength={120} style={[input, fontStyle(name, 'regular')]} />
        <Button
          icon="check"
          label="Save name"
          onPress={async () => {
            if (renaming) await renameReading(db, renaming.id, name);
            setRenaming(null);
            announce('Name saved.');
            load();
          }}
        />
      </Sheet>

      <Sheet visible={deleting != null} title="Delete this reading?" onClose={() => setDeleting(null)}>
        <AppText>“{deleting?.title}” will be removed from this phone with its photo, saved answers and saved audio.</AppText>
        <Button
          icon="trash"
          variant="danger"
          label="Delete reading"
          onPress={async () => {
            if (deleting) await deleteReading(db, deleting.id);
            setDeleting(null);
            announce('Reading deleted.');
            load();
          }}
        />
        <Button variant="secondary" label="Keep it" onPress={() => setDeleting(null)} />
      </Sheet>
    </Screen>
  );
}
