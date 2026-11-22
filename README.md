# LUMA

**Light-adaptive Understanding & Multilingual Assistant**: an Android app, a small Go API and a public website for the Data Science Nigeria AI for Visually Impaired Hackathon.

LUMA's first users are Nigerian students with albinism and other students with low vision. A student photographs a handout or board, or opens a photo a lecturer sent. LUMA reads it **on the phone, offline**, and shows the text reflowed in the student's own size, spacing and colours: no sideways dragging. When connected, the student can ask a question about the page in English, Yorùbá, Hausa, Igbo or Nigerian Pidgin, see which lines the answer came from, and hear the answer.

| Folder | What it is | Stack |
|---|---|---|
| [`mobile/`](mobile/) | Android app | Expo SDK 58, React Native 0.88, strict TypeScript, expo-router, expo-sqlite, a local Kotlin module wrapping ML Kit Text Recognition v2 (bundled Latin model) |
| [`api/`](api/) | API for Ask LUMA, transcription and speech | Go 1.24+, standard library only (`net/http`) |
| [`web/`](web/) | Public website (static export) | Next.js 16, TypeScript, Tailwind CSS 4 |
| [`design/`](design/) | Contrast checker, sample handout pipeline, icon generator | Node, Python (Pillow, NumPy) |
| [`docs/`](docs/) | Architecture, environment variables, release steps, verification record, co-design guide | Markdown |

## Quick start

**API** (needs Go 1.24+). Runs without keys; features that need a key report themselves unavailable.

```sh
cd api
go test ./...
go run ./cmd/server            # http://localhost:8080/health
```

**Android app** (needs Node 22+, JDK 17, Android SDK). The app uses native code, so it runs as a development build or APK, not in Expo Go.

```sh
cd mobile
npm install
npm run check                  # strict type check + unit tests
npx expo run:android           # development build on a connected phone or emulator
```

**Website**

```sh
cd web
npm install
npm run build                  # static site in web/out/
```

**Installable APK**: `eas build -p android --profile preview` (EAS) or the local Gradle route in [docs/release.md](docs/release.md).

**Every automated check at once**: `bash scripts/check.sh` runs the API vet and tests, the app type check, unit tests and prompt-asset check, the contrast check and the website build.

## Documents

- [Architecture and privacy](docs/architecture.md): what runs offline, what goes online, and what is sent where
- [Environment variables](docs/environment.md): API, app build and website
- [Release and deployment](docs/release.md): APK (EAS preview and local), Render, website publishing
- [Design](docs/design.md): identity, palettes, verified contrast, typeface coverage
- [Verification record](docs/verification.md): what has actually been tested, and what still needs testing
- [Co-design test guide](docs/co-design-test-guide.md): sessions with students with low vision
- [Spoken guidance recordings](mobile/assets/prompts/README.md): how the team adds approved recordings

## Product decisions in this build

- Ask LUMA is an assistant inside the app. There are no WhatsApp bots, Meta APIs or messaging integrations.
- Reading is offline. Fresh answers and newly generated speech need the internet; saved answer audio replays offline.
- Students start as guests. Data lives in SQLite and private files on the phone. There are no accounts, sync, payments or admin dashboards.
- Pilot distribution is an installable APK. Google Play submission is out of scope.
