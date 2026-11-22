import { DEFAULT_PROFILE } from '@/profile/profile';
import { ProfileEditor, SamplePreview } from '@/profile/ProfileEditor';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

export default function ProfileScreen() {
  const t = useTheme();
  return (
    <Screen title="My vision profile">
      <AppText>These settings change the reader and the rest of LUMA. They are saved on this phone only.</AppText>
      <SamplePreview />
      <ProfileEditor />
      <Button
        variant="secondary"
        icon="refresh"
        label="Reset to the readable default"
        onPress={() => t.updateProfile({ ...DEFAULT_PROFILE, language: t.profile.language, onboarded: true })}
      />
    </Screen>
  );
}
