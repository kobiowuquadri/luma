import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { Button } from './Button';

/**
 * Bottom panel over the current screen. The content behind stays where it
 * was, so changing reading settings never loses the student's place.
 */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType={t.reduceMotion ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }}
        />
        <SafeAreaView
          edges={['bottom', 'left', 'right']}
          style={{
            maxHeight: '88%',
            backgroundColor: t.palette.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderColor: t.palette.border,
          }}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space(2), padding: t.space(4), paddingBottom: t.space(2) }}>
            <View accessible accessibilityRole="header" style={{ flex: 1, minWidth: 160 }}>
              <AppText variant="title">{title}</AppText>
            </View>
            <Button label="Done" icon="check" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={{ padding: t.space(4), paddingTop: t.space(2), gap: t.space(4) }}>{children}</ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
