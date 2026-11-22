import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/ui/AppText';
import { Icon, type IconName } from '@/ui/Icon';

/**
 * Reader toolbar button: icon above a wrapping label. At large text sizes
 * the toolbar wraps onto more rows instead of hiding controls.
 */
export function ToolbarButton({
  icon,
  label,
  onPress,
  active,
  hint,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
  hint?: string;
}) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: t.size.body * 4.6,
        minHeight: 68,
        borderRadius: t.radius,
        borderWidth: focused ? 3 : active ? 2 : 0,
        borderColor: focused ? t.palette.focus : t.palette.accent,
        backgroundColor: active ? t.palette.accent : pressed ? t.palette.surfaceSunken : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: t.space(1.5),
        paddingHorizontal: t.space(1),
        gap: 2,
      })}
    >
      <Icon name={icon} size={Math.round(t.size.body * 1.3)} color={active ? t.palette.onAccent : t.palette.accent} />
      <View>
        <AppText variant="small" weight="bold" tone={active ? 'onAccent' : 'text'} style={{ textAlign: 'center' }}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}
