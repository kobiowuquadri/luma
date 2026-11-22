import { memo } from 'react';
import { Pressable, Text, View, type TextStyle } from 'react-native';
import type { DocLine, DocParagraph } from '@/ocr/layout';
import { useTheme } from '@/theme/ThemeProvider';
import { fontStyle } from '@/ui/AppText';

interface Props {
  paragraph: DocParagraph;
  lines: Map<string, DocLine>;
  text: string;
  highlightLineId: string | null;
  selected: boolean;
  speaking: boolean;
  onPress: () => void;
  onAction: (action: 'read' | 'explain' | 'photo') => void;
}

/**
 * One reflowed paragraph. Lines are nested spans so a single source line can
 * be highlighted; uncertain words are underlined on a tinted background and
 * listed for TalkBack. The selected or spoken paragraph carries LUMA's
 * reading line on its left edge.
 */
export const ParagraphView = memo(function ParagraphView({ paragraph, lines, text, highlightLineId, selected, speaking, onPress, onAction }: Props) {
  const t = useTheme();
  const c = t.palette;
  const heading = paragraph.kind === 'heading';
  const size = heading ? Math.round(t.reader.fontSize * 1.12) : t.reader.fontSize;
  const base: TextStyle = {
    color: c.text,
    fontSize: size,
    lineHeight: Math.round(size * t.profile.lineSpacing),
    letterSpacing: t.reader.letterSpacing,
    ...fontStyle(text, heading ? 'bold' : t.reader.weight),
  };
  const uncertainStyle: TextStyle = { backgroundColor: c.uncertainBg, textDecorationLine: 'underline', textDecorationColor: c.uncertain };
  const uncertainWords: string[] = [];

  const spans = paragraph.lineIds.map((id, i) => {
    const line = lines.get(id);
    if (!line) return null;
    const prev = i > 0 ? lines.get(paragraph.lineIds[i - 1]) : undefined;
    const sep = i === 0 || prev?.text.endsWith('-') ? '' : ' ';
    const highlighted = id === highlightLineId;
    const markWords = t.profile.markUncertainWords && line.words.some((w) => w.uncertain);
    let content: React.ReactNode = line.text;
    if (markWords) {
      content = line.words.map((w, wi) => {
        if (w.uncertain) uncertainWords.push(w.text);
        return (
          <Text key={wi} style={w.uncertain && !highlighted ? uncertainStyle : undefined}>
            {wi > 0 ? ' ' : ''}
            {w.text}
          </Text>
        );
      });
    }
    return (
      <Text key={id} style={highlighted ? { backgroundColor: c.highlight, color: c.onHighlight } : undefined}>
        {sep}
        {content}
      </Text>
    );
  });

  const a11yLabel =
    uncertainWords.length > 0
      ? `${text}. ${uncertainWords.length} uncertain word${uncertainWords.length === 1 ? '' : 's'}: ${uncertainWords.join(', ')}.`
      : text;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={heading ? 'header' : undefined}
      accessibilityLabel={a11yLabel}
      accessibilityHint="Double tap for paragraph actions"
      accessibilityState={{ selected }}
      accessibilityActions={[
        { name: 'read', label: 'Read aloud from here' },
        { name: 'explain', label: 'Explain in my language' },
        { name: 'photo', label: 'Show on photo' },
      ]}
      onAccessibilityAction={(e) => onAction(e.nativeEvent.actionName as 'read' | 'explain' | 'photo')}
      style={{ flexDirection: 'row', gap: t.space(3) }}
    >
      <View
        style={{
          width: 6,
          borderRadius: 3,
          backgroundColor: speaking || selected ? c.accent : 'transparent',
        }}
      />
      <View style={{ flex: 1, paddingVertical: t.space(1) }}>
        <Text style={base}>{spans}</Text>
      </View>
    </Pressable>
  );
});
