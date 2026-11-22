import { Pressable, View } from 'react-native';
import { contrastRatio, describeContrast } from '@/theme/contrast';
import { backgroundSwatches, palettes, textSwatches, type PaletteId } from '@/theme/palettes';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, fontStyle } from '@/ui/AppText';
import { ChoiceGroup, Stepper, ToggleRow } from '@/ui/parts';
import { LETTER_SPACING_OPTIONS, LINE_SPACING_OPTIONS, TEXT_SIZE, type VisionProfile } from './profile';

/** The sample paragraph shown on first use. It is part of LUMA's sample handout. */
export const SAMPLE_PARAGRAPH =
  'Photosynthesis is the process by which green plants make their own food. They use light energy from the sun, water from the soil and carbon dioxide from the air. Submit on Friday, 27 November 2026.';

const SPACING_LABELS: Record<number, string> = { 1.3: 'Compact', 1.6: 'Comfortable', 2: 'Roomy', 2.4: 'Extra roomy' };
const LETTER_LABELS: Record<number, string> = { 0: 'Normal', 0.04: 'Wide', 0.08: 'Wider', 0.12: 'Widest' };

/** Live preview in the student's current reading style. */
export function SamplePreview({ text = SAMPLE_PARAGRAPH, label = 'Sample paragraph' }: { text?: string; label?: string }) {
  const t = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}. ${text}`}
      style={{
        backgroundColor: t.palette.background,
        borderRadius: t.radius + 4,
        borderWidth: 2,
        borderColor: t.palette.border,
        padding: t.space(4),
        gap: t.space(2),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space(2) }}>
        <View style={{ width: 28, height: 5, borderRadius: 3, backgroundColor: t.palette.accent }} />
        <AppText variant="small" tone="muted" weight="semibold">
          {label}
        </AppText>
      </View>
      <AppText
        style={[
          {
            fontSize: t.reader.fontSize,
            lineHeight: t.reader.lineHeight,
            letterSpacing: t.reader.letterSpacing,
            color: t.palette.text,
          },
          fontStyle(text, t.reader.weight),
        ]}
      >
        {text}
      </AppText>
    </View>
  );
}

function Swatch({ hex, name, selected, onPress, against }: { hex: string; name: string; selected: boolean; onPress: () => void; against: string }) {
  const t = useTheme();
  const ratio = contrastRatio(hex, against);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={`${name}. ${describeContrast(ratio)}`}
      accessibilityState={{ checked: selected }}
      style={{ alignItems: 'center', gap: 4, width: 76, minHeight: 88 }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: hex,
          borderWidth: selected ? 4 : 2,
          borderColor: selected ? t.palette.accent : t.palette.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText weight="bold" style={{ color: against, fontSize: 18, lineHeight: 22 }}>
          Aa
        </AppText>
      </View>
      <AppText variant="small" style={{ textAlign: 'center' }} weight={selected ? 'bold' : 'regular'}>
        {name}
      </AppText>
    </Pressable>
  );
}

export function ProfileEditor({ compact = false }: { compact?: boolean }) {
  const t = useTheme();
  const p = t.profile;
  const set = (patch: Partial<VisionProfile>) => t.updateProfile(patch);
  const paletteOptions: { value: PaletteId | 'custom'; label: string }[] = [
    ...Object.values(palettes).map((pl) => ({ value: pl.id as PaletteId, label: pl.name })),
    { value: 'custom', label: 'My colours' },
  ];
  const ratio = contrastRatio(t.palette.text, t.palette.background);

  return (
    <View style={{ gap: t.space(5) }}>
      <Stepper
        label="Text size"
        value={p.textSize}
        display={`${p.textSize}`}
        min={TEXT_SIZE.min}
        max={TEXT_SIZE.max}
        step={TEXT_SIZE.step}
        onChange={(v) => set({ textSize: v })}
      />
      <ChoiceGroup
        label="Line spacing"
        value={p.lineSpacing}
        onChange={(v) => set({ lineSpacing: v })}
        options={LINE_SPACING_OPTIONS.map((v) => ({ value: v, label: SPACING_LABELS[v] }))}
      />
      <ChoiceGroup
        label="Letter spacing"
        value={p.letterSpacing}
        onChange={(v) => set({ letterSpacing: v })}
        options={LETTER_SPACING_OPTIONS.map((v) => ({ value: v, label: LETTER_LABELS[v] }))}
      />
      <ChoiceGroup label="Colours" value={p.paletteId} onChange={(v) => set({ paletteId: v })} options={paletteOptions} />
      {p.paletteId === 'custom' ? (
        <View style={{ gap: t.space(3) }}>
          <AppText weight="semibold">Text colour</AppText>
          <View accessibilityRole="radiogroup" accessibilityLabel="Text colour" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space(2) }}>
            {textSwatches.map((s) => (
              <Swatch key={s.hex} hex={s.hex} name={s.name} selected={p.customText === s.hex} onPress={() => set({ customText: s.hex })} against={p.customBackground} />
            ))}
          </View>
          <AppText weight="semibold">Background colour</AppText>
          <View accessibilityRole="radiogroup" accessibilityLabel="Background colour" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space(2) }}>
            {backgroundSwatches.map((s) => (
              <Swatch key={s.hex} hex={s.hex} name={s.name} selected={p.customBackground === s.hex} onPress={() => set({ customBackground: s.hex })} against={p.customText} />
            ))}
          </View>
        </View>
      ) : null}
      <AppText accessibilityLiveRegion="polite" weight="semibold" tone={ratio < 4.5 ? 'danger' : 'text'}>
        {describeContrast(ratio)}
      </AppText>
      <ToggleRow label="Bold text" description="Thicker letters in the reader and the app." value={p.boldText} onChange={(v) => set({ boldText: v })} />
      <ToggleRow
        label="Mark uncertain words"
        description="Underline words LUMA may have read wrongly, so you can check them."
        value={p.markUncertainWords}
        onChange={(v) => set({ markUncertainWords: v })}
      />
      {!compact ? (
        <Stepper
          label="Reading speed"
          value={p.speechRate}
          display={p.speechRate === 1 ? 'normal' : p.speechRate < 1 ? `slower (${p.speechRate.toFixed(1)})` : `faster (${p.speechRate.toFixed(1)})`}
          min={0.6}
          max={1.4}
          step={0.1}
          onChange={(v) => set({ speechRate: v })}
        />
      ) : null}
    </View>
  );
}
