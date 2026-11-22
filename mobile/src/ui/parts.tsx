import { useState, type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export function Card({ children, style, tone = 'surface' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'surface' | 'soft' }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: tone === 'soft' ? t.palette.accentSoft : t.palette.surface,
          borderRadius: t.radius + 4,
          borderWidth: 1,
          borderColor: t.palette.border,
          padding: t.space(4),
          gap: t.space(3),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <View accessible accessibilityRole="header">
      <AppText variant="title" style={{ marginTop: 4 }}>
        {children}
      </AppText>
    </View>
  );
}

type BannerTone = 'info' | 'warning' | 'error' | 'success' | 'offline';

const BANNER_ICON: Record<BannerTone, IconName> = { info: 'info', warning: 'warning', error: 'warning', success: 'check', offline: 'offline' };

/**
 * Status message. Announced politely by TalkBack when it appears; errors use
 * the alert role. The icon and title carry meaning without colour alone.
 */
export function Banner({
  tone = 'info',
  title,
  message,
  action,
  secondaryAction,
}: {
  tone?: BannerTone;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void; icon?: IconName };
  secondaryAction?: { label: string; onPress: () => void; icon?: IconName };
}) {
  const t = useTheme();
  const strong = tone === 'error' || tone === 'warning';
  return (
    <View
      accessibilityLiveRegion={strong ? 'assertive' : 'polite'}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      style={{
        borderRadius: t.radius,
        borderWidth: 2,
        borderColor: tone === 'error' ? t.palette.danger : tone === 'success' ? t.palette.accent : t.palette.border,
        backgroundColor: tone === 'success' ? t.palette.accentSoft : t.palette.surface,
        padding: t.space(3),
        gap: t.space(2),
      }}
    >
      <View accessible style={{ flexDirection: 'row', gap: t.space(2), alignItems: 'flex-start' }}>
        <View style={{ paddingTop: 2 }}>
          <Icon name={BANNER_ICON[tone]} size={Math.round(t.size.body * 1.2)} color={tone === 'error' ? t.palette.danger : t.palette.accent} />
        </View>
        <View style={{ flex: 1, gap: t.space(1) }}>
          <AppText weight="bold" tone={tone === 'error' ? 'danger' : 'text'}>
            {title}
          </AppText>
          {message ? <AppText>{message}</AppText> : null}
        </View>
      </View>
      {action || secondaryAction ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space(2) }}>
          {action ? <Button label={action.label} icon={action.icon} onPress={action.onPress} style={{ flexGrow: 1 }} /> : null}
          {secondaryAction ? (
            <Button label={secondaryAction.label} icon={secondaryAction.icon} variant="secondary" onPress={secondaryAction.onPress} style={{ flexGrow: 1 }} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** A labelled on/off row. The whole row is the switch for TalkBack. */
export function ToggleRow({ label, description, value, onChange }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const knob = 28;
  return (
    <Pressable
      onPress={() => onChange(!value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space(3),
        minHeight: 56,
        paddingVertical: t.space(2),
        paddingHorizontal: t.space(2),
        borderRadius: t.radius,
        borderWidth: focused ? 3 : 0,
        borderColor: t.palette.focus,
        backgroundColor: pressed ? t.palette.surfaceSunken : 'transparent',
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText weight="semibold">{label}</AppText>
        {description ? <AppText variant="small" tone="muted">{description}</AppText> : null}
      </View>
      <View
        style={{
          width: knob * 2 + 8,
          height: knob + 8,
          borderRadius: knob,
          padding: 4,
          borderWidth: 2,
          borderColor: value ? t.palette.accent : t.palette.border,
          backgroundColor: value ? t.palette.accent : t.palette.surfaceSunken,
          alignItems: value ? 'flex-end' : 'flex-start',
        }}
      >
        <View style={{ width: knob - 4, height: knob - 4, borderRadius: knob, backgroundColor: value ? t.palette.onAccent : t.palette.border }} />
      </View>
      <AppText variant="small" weight="bold" style={{ minWidth: 36 }}>
        {value ? 'On' : 'Off'}
      </AppText>
    </Pressable>
  );
}

/** Radio group. Options wrap onto new lines as text grows. */
export function ChoiceGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; description?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space(2) }}>
      <AppText weight="semibold">{label}</AppText>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space(2) }}>
        {options.map((o) => (
          <ChoiceChip key={String(o.value)} label={o.label} description={o.description} selected={o.value === value} onPress={() => onChange(o.value)} />
        ))}
      </View>
    </View>
  );
}

function ChoiceChip({ label, description, selected, onPress }: { label: string; description?: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="radio"
      accessibilityLabel={description ? `${label}. ${description}` : label}
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => ({
        minHeight: 52,
        minWidth: 64,
        paddingHorizontal: t.space(3.5),
        paddingVertical: t.space(2),
        borderRadius: t.radius,
        borderWidth: focused ? 3 : 2,
        borderColor: focused ? t.palette.focus : selected ? t.palette.accent : t.palette.border,
        backgroundColor: selected ? t.palette.accent : pressed ? t.palette.surfaceSunken : t.palette.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space(1.5),
        flexGrow: 1,
      })}
    >
      {selected ? <Icon name="check" size={Math.round(t.size.body)} color={t.palette.onAccent} /> : null}
      <View style={{ flexShrink: 1 }}>
        <AppText weight="bold" tone={selected ? 'onAccent' : 'text'}>
          {label}
        </AppText>
        {description ? (
          <AppText variant="small" tone={selected ? 'onAccent' : 'muted'}>
            {description}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Number control with large minus/plus buttons. TalkBack users can also
 * swipe up/down on it (adjustable role).
 */
export function Stepper({
  label,
  value,
  display,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  display: string;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  const t = useTheme();
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
  const btn = (icon: IconName, delta: number, name: string) => (
    <Pressable
      onPress={() => set(value + delta)}
      disabled={delta < 0 ? value <= min : value >= max}
      accessibilityRole="button"
      accessibilityLabel={`${name} ${label.toLowerCase()}`}
      accessibilityState={{ disabled: delta < 0 ? value <= min : value >= max }}
      style={({ pressed }) => ({
        width: 60,
        height: 60,
        borderRadius: t.radius,
        borderWidth: 2,
        borderColor: t.palette.border,
        backgroundColor: pressed ? t.palette.surfaceSunken : t.palette.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: (delta < 0 ? value <= min : value >= max) ? 0.45 : 1,
      })}
    >
      <Icon name={icon} size={28} color={t.palette.text} strokeWidth={2.5} />
    </Pressable>
  );
  return (
    <View style={{ gap: t.space(2) }}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: display }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === 'increment' ? step : -step))}
      >
        <AppText weight="semibold">
          {label}: {display}
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space(3) }}>
        {btn('minus', -step, 'Decrease')}
        <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: t.palette.surfaceSunken, overflow: 'hidden' }}>
          <View style={{ width: `${((value - min) / (max - min)) * 100}%`, height: 8, backgroundColor: t.palette.accent }} />
        </View>
        {btn('plus', step, 'Increase')}
      </View>
    </View>
  );
}

/** Row that navigates somewhere, with an icon, label and description. */
export function LinkRow({ icon, label, description, onPress }: { icon: IconName; label: string; description?: string; onPress: () => void }) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={description ? `${label}. ${description}` : label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space(3),
        minHeight: 64,
        padding: t.space(3),
        borderRadius: t.radius,
        borderWidth: focused ? 3 : 1,
        borderColor: focused ? t.palette.focus : t.palette.border,
        backgroundColor: pressed ? t.palette.surfaceSunken : t.palette.surface,
      })}
    >
      <Icon name={icon} size={Math.round(t.size.body * 1.4)} color={t.palette.accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText weight="bold">{label}</AppText>
        {description ? <AppText variant="small" tone="muted">{description}</AppText> : null}
      </View>
      <Icon name="chevron" size={Math.round(t.size.body)} color={t.palette.textMuted} />
    </Pressable>
  );
}

/** Status pill with icon + words (never colour alone). */
export function StatusPill({ ok, label }: { ok: boolean | null; label: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: t.space(1.5),
        paddingHorizontal: t.space(2.5),
        paddingVertical: t.space(1),
        borderRadius: 999,
        borderWidth: 2,
        borderColor: ok ? t.palette.accent : t.palette.border,
        backgroundColor: ok ? t.palette.accentSoft : t.palette.surface,
      }}
    >
      <Icon name={ok ? 'check' : ok === false ? 'close' : 'info'} size={Math.round(t.size.small)} color={ok ? t.palette.accent : t.palette.textMuted} />
      <AppText variant="small" weight="semibold">
        {label}
      </AppText>
    </View>
  );
}
