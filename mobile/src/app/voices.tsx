import { useCallback, useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { reasonText } from '@/ask/api';
import { useOnline } from '@/ask/OnlineProvider';
import { PreviewBanner } from '@/ask/PreviewBanner';
import { formatWhen } from '@/lib/format';
import type { LanguageCode } from '@/profile/profile';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card, ChoiceGroup, SectionTitle, StatusPill, ToggleRow } from '@/ui/parts';
import { Screen } from '@/ui/Screen';
import { chooseVoice, type VoiceChoice } from '@/voice/deviceVoices';
import { playGuidance, promptAvailable, promptCoverage } from '@/voice/guidance';
import { LANGUAGES, languageInfo } from '@/voice/languages';
import { PROMPT_IDS } from '@/voice/prompts';

function Capability({ title, where, ok, detail }: { title: string; where: 'Offline' | 'Online'; ok: boolean | null; detail: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space(1.5), paddingVertical: t.space(2), borderTopWidth: 1, borderTopColor: t.palette.border }}>
      <AppText weight="bold">
        {title} · {where}
      </AppText>
      <StatusPill ok={ok} label={ok ? 'Available' : ok === false ? 'Not available' : 'Not checked'} />
      <AppText variant="small" tone="muted">
        {detail}
      </AppText>
    </View>
  );
}

/** Local Voices: what works in each language, offline and online. */
export default function VoicesScreen() {
  const t = useTheme();
  const online = useOnline();
  const lang = t.profile.language;
  const L = languageInfo(lang);
  const [voice, setVoice] = useState<VoiceChoice | null>(null);

  const checkVoices = useCallback((force: boolean) => {
    chooseVoice(lang, force).then(setVoice);
  }, [lang]);

  useEffect(() => checkVoices(false), [checkVoices]);

  const caps = online.caps?.languages.find((l) => l.code === lang);
  const prompts = promptCoverage(lang);
  const firstPrompt = PROMPT_IDS.find((id) => promptAvailable(lang, id));
  const serverKnown = online.status === 'ready' || (online.caps != null && online.status !== 'not_configured');
  const serverDetail = (feature: string, cap: { available: boolean; reason?: string } | undefined) => {
    if (online.status === 'not_configured') return 'Online features are not set up in this version of the app.';
    if (!cap) return online.connected ? 'Could not check the LUMA server yet.' : 'Connect to the internet to check.';
    return cap.available ? `${feature} works when you are online.` : reasonText(cap.reason, feature);
  };

  return (
    <Screen title="Languages and voices">
      <ChoiceGroup<LanguageCode>
        label="Language for answers, explanations and spoken guidance"
        value={lang}
        onChange={(language) => t.updateProfile({ language })}
        options={LANGUAGES.map((l) => ({ value: l.code, label: l.nativeName, description: l.name === l.nativeName ? undefined : l.name }))}
      />
      <PreviewBanner />
      <AppText>LUMA never switches to another language without telling you. If something is not available in {L.nativeName}, it says so.</AppText>

      <SectionTitle>{`What works in ${L.nativeName}`}</SectionTitle>
      <Card>
        <Capability
          title="Spoken guidance"
          where="Offline"
          ok={prompts.available > 0}
          detail={
            prompts.available > 0
              ? `${prompts.available} of ${prompts.total} approved recordings are installed.`
              : `No approved recordings in ${L.nativeName} yet. Screen-reader announcements and on-screen text still guide you.`
          }
        />
        <Capability
          title="Read the original aloud on this phone"
          where="Offline"
          ok={voice ? voice.offline != null : null}
          detail={
            !voice
              ? 'Checking the voices on this phone…'
              : voice.offline
                ? `Uses the phone voice ${voice.offline.locale}.`
                : voice.network
                  ? 'This phone has an online voice for this language only. It needs the internet.'
                  : 'No voice for this language is installed on this phone. LUMA can use an online voice instead when you are connected.'
          }
        />
        <Capability title="Written answers and explanations" where="Online" ok={serverKnown && caps ? caps.answers.available : null} detail={serverDetail('Ask LUMA', caps?.answers)} />
        <Capability
          title="Spoken questions"
          where="Online"
          ok={serverKnown && caps ? caps.transcription.available : null}
          detail={serverDetail('Spoken questions', caps?.transcription)}
        />
        <Capability title="Spoken answers" where="Online" ok={serverKnown && caps ? caps.speech.available : null} detail={serverDetail('Spoken answers', caps?.speech)} />
        <AppText variant="small" tone="muted">
          {online.checkedAt ? `Online features checked ${formatWhen(online.checkedAt)}.` : 'Online features not checked yet.'}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space(2) }}>
          <Button icon="refresh" variant="secondary" label="Check again" onPress={() => { online.refresh(); checkVoices(true); }} style={{ flexGrow: 1 }} />
          {prompts.available > 0 && firstPrompt ? (
            <Button icon="speaker" variant="secondary" label="Play guidance sample" onPress={() => playGuidance(lang, firstPrompt, true)} style={{ flexGrow: 1 }} />
          ) : null}
          <Button
            icon="info"
            variant="quiet"
            label="Phone voice settings"
            hint="Opens Android text-to-speech settings where you can install voices"
            onPress={() => Linking.sendIntent('com.android.settings.TTS_SETTINGS').catch(() => Linking.openSettings())}
            style={{ flexGrow: 1 }}
          />
        </View>
      </Card>

      <ToggleRow
        label="Spoken guidance"
        description="Play approved recordings such as “Scan complete” when they exist for your language."
        value={t.profile.spokenGuidance}
        onChange={(spokenGuidance) => t.updateProfile({ spokenGuidance })}
      />
    </Screen>
  );
}
