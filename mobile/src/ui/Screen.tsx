import { useEffect, useRef, type ReactNode } from 'react';
import { ScrollView, View, type ScrollViewProps, type ViewInstance } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { focusElement } from '@/lib/a11y';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { IconButton } from './Button';

interface ScreenProps {
  title: string;
  /** Show a Back button (default true). */
  back?: boolean;
  /** Small text above the title, e.g. "Reading". */
  kicker?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Wrap children in a vertical ScrollView (default true). */
  scroll?: boolean;
  footer?: ReactNode;
  scrollProps?: ScrollViewProps;
  /** Move TalkBack focus to the title when the screen opens (default true). */
  focusTitle?: boolean;
}

/**
 * Screen scaffold: themed safe area, a header whose title wraps rather than
 * truncates, vertical scrolling content and an optional fixed footer.
 */
export function Screen({ title, back = true, kicker, actions, children, scroll = true, footer, scrollProps, focusTitle = true }: ScreenProps) {
  const t = useTheme();
  const router = useRouter();
  const titleRef = useRef<ViewInstance>(null);

  useEffect(() => {
    if (focusTitle) focusElement(titleRef);
  }, [focusTitle]);

  const pad = t.space(4);
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: t.palette.background }}>
      <StatusBar style={t.palette.scheme === 'dark' ? 'light' : 'dark'} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: t.space(1),
          paddingHorizontal: t.space(2),
          paddingTop: t.space(2),
          paddingBottom: t.space(2),
          borderBottomWidth: 1,
          borderBottomColor: t.palette.border,
        }}
      >
        {back ? (
          <IconButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        ) : null}
        <View ref={titleRef} accessible accessibilityRole="header" style={{ flex: 1, minWidth: 160, paddingHorizontal: t.space(1) }}>
          {kicker ? (
            <AppText variant="small" tone="muted" weight="semibold">
              {kicker}
            </AppText>
          ) : null}
          <AppText variant="title">{title}</AppText>
        </View>
        {actions ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space(1) }}>{actions}</View> : null}
      </View>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: pad, gap: t.space(4), paddingBottom: t.space(10) }}
          keyboardShouldPersistTaps="handled"
          {...scrollProps}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
      {footer ? (
        <View style={{ borderTopWidth: 1, borderTopColor: t.palette.border, backgroundColor: t.palette.surface, padding: t.space(2) }}>
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
