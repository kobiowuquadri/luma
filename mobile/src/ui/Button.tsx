import { useState } from 'react';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: ButtonVariant;
  size?: 'large' | 'regular';
  hint?: string;
  disabled?: boolean;
  busy?: boolean;
  /** Shown as pressed/selected, e.g. "Stop reading" while speaking. */
  active?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Labelled button. Minimum height 52 dp (64 dp for large) so primary
 * controls exceed the 48 x 48 dp target; the label wraps instead of
 * truncating when text is large.
 */
export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  size = 'regular',
  hint,
  disabled,
  busy,
  active,
  accessibilityLabel,
  style,
  testID,
}: ButtonProps) {
  const t = useTheme();
  const c = t.palette;
  const [focused, setFocused] = useState(false);
  const colors = {
    primary: { bg: c.accent, pressed: c.accentPressed, fg: 'onAccent' as const, border: c.accent },
    secondary: { bg: c.surface, pressed: c.surfaceSunken, fg: 'text' as const, border: c.border },
    quiet: { bg: 'transparent', pressed: c.surfaceSunken, fg: 'accent' as const, border: 'transparent' },
    danger: { bg: c.danger, pressed: c.danger, fg: 'onDanger' as const, border: c.danger },
  }[variant];
  const fgColor = { onAccent: c.onAccent, text: c.text, accent: c.accent, onDanger: c.onDanger }[colors.fg];
  const minHeight = size === 'large' ? 64 : 52;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy, selected: active }}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight,
          minWidth: 48,
          borderRadius: t.radius,
          paddingHorizontal: t.space(4),
          paddingVertical: t.space(2.5),
          backgroundColor: pressed || active ? colors.pressed : colors.bg,
          borderWidth: focused ? 3 : variant === 'secondary' ? 2 : 0,
          borderColor: focused ? c.focus : colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: t.space(2),
          opacity: disabled ? 0.55 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fgColor} />
      ) : icon ? (
        <Icon name={icon} size={Math.round(t.size.body * 1.15)} color={fgColor} />
      ) : null}
      <View style={{ flexShrink: 1 }}>
        <AppText weight="bold" tone={colors.fg} style={{ textAlign: 'center' }}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

/** Icon-only button for secondary chrome; always needs an accessibility label. */
export function IconButton({
  icon,
  label,
  onPress,
  hint,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  hint?: string;
  disabled?: boolean;
}) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={4}
      style={({ pressed }) => ({
        minWidth: 52,
        minHeight: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? t.palette.surfaceSunken : 'transparent',
        borderWidth: focused ? 3 : 0,
        borderColor: t.palette.focus,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Icon name={icon} size={Math.round(t.size.body * 1.3)} color={t.palette.text} />
    </Pressable>
  );
}
