# LUMA Android app

Expo SDK 58 · React Native 0.88 · strict TypeScript · expo-router · expo-sqlite · a local Kotlin module for on-device text recognition.

## Setup

```sh
npm install
npm run check          # tsc --noEmit (strict) + unit tests (node --test)
npx expo run:android   # development build on a phone or emulator
```

The app needs its native module, so use a development build or an APK, not Expo Go. In Expo Go, scanning shows an honest "needs the LUMA app" message.

To use online features in development, set `EXPO_PUBLIC_LUMA_API_URL`. From the emulator to a local API, that is `http://10.0.2.2:8080`, built with `LUMA_ALLOW_CLEARTEXT=1`. All variables are listed in [docs/environment.md](../docs/environment.md); APK builds in [docs/release.md](../docs/release.md).

## Map

```
modules/luma-ocr/          Kotlin: ML Kit Text Recognition v2 (bundled Latin 16.0.1), EXIF/upright,
                           metadata-free copy, blur/glare/light metrics, TTS voice inventory
src/app/                   screens (expo-router)
  index.tsx                Home: Scan a page · Open an image · Scan a board · saved readings
  welcome.tsx, profile.tsx My Vision Profile (first use + settings)
  scan.tsx                 capture states: board tips, processing, empty, cancelled, denied, error
  reading/[id]/index.tsx   Reader: reflowed paragraphs, uncertain words, Display sheet, read aloud
  reading/[id]/photo.tsx   zoomable original with line and uncertain-word outlines
  reading/[id]/ask.tsx     Ask LUMA / Explain: record > transcript > answer > sources > audio
  readings.tsx             saved readings: find, rename, delete
  voices.tsx               Local Voices: language + per-capability status
  sunsafe.tsx              reminders + UV forecast
  privacy.tsx              what stays on the phone, delete all
src/ocr/                   layout (reading order, line IDs), advice (retake), scan pipeline
src/ask/                   API client, connectivity/capabilities, line selection, recorder
src/voice/                 languages, prompt IDs, approved recordings, device voices
src/theme/, src/profile/   palettes (verified), contrast, font coverage, Vision Profile
src/db/                    SQLite migrations, readings, messages, drafts, settings
assets/prompts/            approved spoken-guidance recordings (README explains the process)
assets/sample/             the original sample handout photo
```

## Tests

`npm test` runs the pure-module tests with Node's built-in runner: reading order (columns, same-row blocks, tilt), paragraphs, uncertain words, retake advice, line selection for questions, palette contrast, profile repair and font coverage. Modules tested this way import siblings with explicit `.ts` extensions so Node can run them directly.
