import { Children, forwardRef, type ReactNode } from 'react';
import { Text, type TextInstance, type TextProps, type TextStyle } from 'react-native';
import { brandFontCovers } from '@/theme/fontCoverage';
import { FONT, useTheme, type FontWeightName } from '@/theme/ThemeProvider';
import type { Palette } from '@/theme/palettes';

export type TextVariant = 'small' | 'body' | 'title' | 'display';
export type TextTone = 'text' | 'muted' | 'accent' | 'danger' | 'onAccent' | 'onDanger';

const TONE: Record<TextTone, keyof Palette> = {
  text: 'text',
  muted: 'textMuted',
  accent: 'accent',
  danger: 'danger',
  onAccent: 'onAccent',
  onDanger: 'onDanger',
};

const NUMERIC: Record<FontWeightName, TextStyle['fontWeight']> = { regular: '400', semibold: '600', bold: '700' };

function plainText(children: ReactNode): string | null {
  let out = '';
  let ok = true;
  Children.forEach(children, (c) => {
    if (typeof c === 'string' || typeof c === 'number') out += String(c);
    else if (c != null && c !== false) ok = false;
  });
  return ok ? out : null;
}

/**
 * Font style for a run of text: the brand font when it has every glyph,
 * otherwise the phone's system font for the whole run.
 */
export function fontStyle(text: string | null, weight: FontWeightName): TextStyle {
  if (text == null || brandFontCovers(text)) return { fontFamily: FONT[weight] };
  return { fontWeight: NUMERIC[weight] };
}

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  weight?: FontWeightName;
  tone?: TextTone;
  children?: ReactNode;
}

export const AppText = forwardRef<TextInstance, AppTextProps>(function AppText(
  { variant = 'body', weight, tone = 'text', style, children, ...rest },
  ref,
) {
  const t = useTheme();
  const size = t.size[variant];
  const w: FontWeightName = weight ?? (variant === 'title' || variant === 'display' ? 'bold' : t.profile.boldText ? 'semibold' : 'regular');
  return (
    <Text
      ref={ref}
      style={[
        { color: t.palette[TONE[tone]], fontSize: size, lineHeight: Math.round(size * 1.38) },
        fontStyle(plainText(children), w),
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
});
