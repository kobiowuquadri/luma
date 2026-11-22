import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Constants from 'expo-constants';
import { ocrEngine } from '../../modules/luma-ocr';
import { API_URL, onlineConfigured } from '@/ask/api';
import { listReadings, deleteReading } from '@/db/readings';
import { announce } from '@/lib/a11y';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Card, SectionTitle } from '@/ui/parts';
import { Screen } from '@/ui/Screen';
import { Sheet } from '@/ui/Sheet';

export default function PrivacyScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);

  return (
    <Screen title="Privacy and about">
      <SectionTitle>Stays on this phone</SectionTitle>
      <Card>
        <AppText>Your photos, the text LUMA reads from them, your saved readings, your vision profile and your SunSafe reminders. Reading happens on the phone and works in airplane mode.</AppText>
        <AppText>LUMA keeps a copy of each photo in its own private folder and removes location details from it. Deleting a reading deletes its photo, answers and audio.</AppText>
        <AppText>You can start without an account. LUMA has no sign-in.</AppText>
      </Card>

      <SectionTitle>Sent only when you ask</SectionTitle>
      <Card>
        <AppText>Ask about this page and Explain in my language send your question, numbered lines of text from the page and your last few questions and answers to the LUMA server. The server asks OpenAI to write the answer. Your photo is never sent.</AppText>
        <AppText>Record question sends your recording through the LUMA server to YarnGPT to turn it into text. LUMA then deletes the recording from your phone. YarnGPT says it keeps uploaded audio for up to 12 months.</AppText>
        <AppText>Hear answer sends the answer text to YarnGPT to make audio. The audio is saved on your phone so it can play again offline.</AppText>
        <AppText>The SunSafe forecast sends only the coordinates of the city you choose to Open-Meteo.</AppText>
        <AppText>The LUMA server keeps a finished answer in memory for up to 30 minutes, so a retry does not pay twice, and then forgets it. It does not write your questions, page text or recordings to disk, and its logs leave them out. The app sends a random ID for this phone so the server can limit how many questions one phone sends per day.</AppText>
      </Card>

      <SectionTitle>About this app</SectionTitle>
      <Card>
        <AppText>LUMA {Constants.expoConfig?.version ?? ''} — Light-adaptive Understanding and Multilingual Assistant.</AppText>
        <AppText>Text recognition: {ocrEngine === 'unavailable' ? 'not available in this build' : ocrEngine}.</AppText>
        <AppText>Online features: {onlineConfigured ? `on (${API_URL})` : 'not set up in this build'}.</AppText>
        <AppText>Built for the Data Science Nigeria AI for Visually Impaired Hackathon.</AppText>
      </Card>

      <Button icon="trash" variant="danger" label="Delete all my readings" onPress={() => setConfirm(true)} />

      <Sheet visible={confirm} title="Delete all readings?" onClose={() => setConfirm(false)}>
        <AppText>This removes every saved reading, photo, answer and audio file from this phone. Your vision profile and reminders stay.</AppText>
        <Button
          icon="trash"
          variant="danger"
          label="Delete everything"
          onPress={async () => {
            const all = await listReadings(db, 100000);
            for (const r of all) await deleteReading(db, r.id);
            setConfirm(false);
            announce('All readings deleted.');
            router.replace('/');
          }}
        />
        <Button variant="secondary" label="Keep them" onPress={() => setConfirm(false)} />
      </Sheet>
    </Screen>
  );
}
