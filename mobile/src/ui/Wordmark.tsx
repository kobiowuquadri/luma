import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

/**
 * LUMA's signature: two tilted, faint "photographed" lines resolving into one
 * straight, bold line of text. Used beside the wordmark and in empty states.
 */
export function LineMark({ size = 40 }: { size?: number }) {
  const t = useTheme();
  return (
    <Svg width={size * 1.4} height={size} viewBox="0 0 56 40" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M3 9 L30 4" stroke={t.palette.textMuted} strokeWidth={2.5} strokeLinecap="round" opacity={0.5} />
      <Path d="M4 17 L31 12" stroke={t.palette.textMuted} strokeWidth={2.5} strokeLinecap="round" opacity={0.5} />
      <Path d="M8 31 H52" stroke={t.palette.accent} strokeWidth={6} strokeLinecap="round" />
    </Svg>
  );
}

export function Wordmark() {
  const t = useTheme();
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="LUMA" style={{ flexDirection: 'row', alignItems: 'center', gap: t.space(2) }}>
      <LineMark size={Math.round(t.size.display * 0.9)} />
      <AppText variant="display" weight="bold" style={{ letterSpacing: 2 }}>
        LUMA
      </AppText>
    </View>
  );
}
