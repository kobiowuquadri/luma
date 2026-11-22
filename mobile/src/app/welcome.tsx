import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { DEFAULT_PROFILE, type LanguageCode } from '@/profile/profile';
import { ProfileEditor, SamplePreview } from '@/profile/ProfileEditor';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { ChoiceGroup } from '@/ui/parts';
import { Screen } from '@/ui/Screen';
import { LANGUAGES } from '@/voice/languages';

/** First use: the student sets up how they like to read, or skips. */
export default function Welcome() {
  const t = useTheme();
  const router = useRouter();
  const finish = (patch: Parameters<typeof t.updateProfile>[0] = {}) => {
    t.updateProfile({ ...patch, onboarded: true });
    router.replace('/');
  };
  return (
    <Screen title="Set up how you read" kicker="Welcome to LUMA" back={false}>
      <AppText>Change the sample until it is comfortable to read. Every change shows straight away. You can change this later in My vision profile.</AppText>
      <SamplePreview />
      <ProfileEditor />
      <ChoiceGroup<LanguageCode>
        label="Language for answers and spoken guidance"
        value={t.profile.language}
        onChange={(language) => t.updateProfile({ language })}
        options={LANGUAGES.map((l) => ({ value: l.code, label: l.nativeName, description: l.name === l.nativeName ? undefined : l.name }))}
      />
      <View style={{ gap: t.space(3) }}>
        <Button size="large" icon="check" label="Start reading" onPress={() => finish()} />
        <Button
          variant="secondary"
          icon="refresh"
          label="Use the readable default"
          hint="Large text on warm paper with comfortable spacing"
          onPress={() => finish({ ...DEFAULT_PROFILE, language: t.profile.language })}
        />
        <Button variant="quiet" label="Skip for now" hint="Uses the readable default. You can change it later." onPress={() => finish({ ...DEFAULT_PROFILE })} />
      </View>
    </Screen>
  );
}
