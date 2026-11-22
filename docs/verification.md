# Verification record

What has actually been tested, how, and what still needs testing. Update this file whenever a check is run; do not record a check as passed unless it was run.

**Environment for the checks below (20 November 2026):** Windows 11, Node 24.12, Go 1.27.4, JDK 17, Android SDK 36, headless Chromium (Playwright), and the Android emulator (Pixel 9 Pro profile, Android 16, x86_64, Google APIs image). **No physical phone** and **no OpenAI or YarnGPT keys** were available.

## Automated checks

| Check | Command | Result |
|---|---|---|
| Go static analysis | `cd api && go vet ./...` | Clean |
| Go tests | `cd api && go test ./...` | 63 tests pass in 7 packages: validation, grounded prompt, source-ID validation, idempotent replay and conflict, per-device and daily limits, OpenAI and YarnGPT clients against `httptest` fakes (job polling, 402 credits, 429, timeouts, refusal, no key sent to storage host), handlers, content-free logs, preview mode |
| App type check (strict) | `cd mobile && npm run typecheck` | 0 errors |
| App unit tests | `cd mobile && npm test` | 27 pass: reading order (two columns under a title, same-row blocks, tilted page), paragraphs, hyphen joins, list items, headings, uncertain words, retake advice, line selection, contrast, profile repair, font coverage |
| Colour contrast | `node design/check-contrast.mjs` | 180 / 180 pairs pass (app palettes, website themes, reader-preview palettes) |
| Prompt assets | `cd mobile && npm run prompts:sync -- --check` | Up to date (0 approved recordings) |
| Website production build | `cd web && npm run build` | Static export: `/`, `/privacy`, `/support`, 404 |

## Website (headless Chromium)

| Check | Result |
|---|---|
| Widths 320, 360, 768 and 1280 px, plus 640 px (1280 px at 200% zoom) | No horizontal overflow on `/`, `/privacy` and `/support`; 0 console errors |
| Keyboard | First Tab reaches "Skip to main content" and Enter moves focus to `main`; the mobile menu toggles with `aria-expanded`; the theme choice survives a reload |
| Reduced motion | With `prefers-reduced-motion: reduce`, the hero animation is switched off |
| First screen at 360 px | Headline, supporting copy and "Try the reader preview" visible; compact Menu button |
| Reader preview controls | Text size (18–48 px), line spacing and colours apply; at 36 px in Yellow on black the text reflows with no sideways scroll |
| Line ↔ photo link | Arrow keys move the highlight; the outline on the photo matches the line (checked on lines 13 and 23) |
| Download and demo | Hidden, because `release.json` and `demo.json` are not filled in |
| **Bugs found and fixed** | Primary button labels were invisible (unlayered `a` colour overrode `.btn-primary`; moved element styles into `@layer base`). Automatic hyphenation split words in the preview (turned off) |

## API, run locally

| Check | Result |
|---|---|
| No keys configured | `/health` 200; `/v1/capabilities` reports `not_configured` for answers, transcription and speech in all 5 languages; `POST /v1/ask` returns `503 not_configured` with an actionable message |
| Access log content | Only route, status, sizes, timing, hashed device ID and error code. No question or page text |
| Preview fixtures (`LUMA_PREVIEW_FIXTURES=true`) | `mode: preview-fixtures`; ask returns a labelled fixture citing the matching line; a retry with the same `Idempotency-Key` returns `Idempotent-Replayed: true`; multipart transcription returns the fixed transcript; non-audio upload gives `415 unsupported_media`; speech returns a valid 1.2 s WAV |

## Android app

| Check | Result |
|---|---|
| `expo prebuild -p android` | Generates the native project. Two configuration bugs were found in the merged manifest and fixed: the image-picker option `microphonePermission: false` removed `RECORD_AUDIO` app-wide, which would have broken spoken questions; and `allowBackup` was on, letting Android back classroom photos up to the cloud. Final manifest: `CAMERA`, `RECORD_AUDIO`, `POST_NOTIFICATIONS`; location permissions removed; `allowBackup="false"`. |
| Release JavaScript bundle (Metro, production) | **Built** (`Done writing bundle output`): every route, import and the bundled sample photo resolve. |
| EAS preview build (`eas build -p android --profile preview`) | **Succeeded** on 20 November 2026. Build `b08d78e4-3202-4ec0-b2bf-f21a6d8723f3` produced an installable APK (`armeabi-v7a`, `arm64-v8a`) with an EAS-managed keystore. Online features are off in this APK because `EXPO_PUBLIC_LUMA_API_URL` is not set for the preview environment. |
| Native release build on this Windows machine | **Blocked**. C++ codegen object paths exceed 260 characters even from `C:\lb\mobile` (gesture-handler 322, safe-area-context 307, reanimated 291, screens 279, svg 263), and the SDK's CMake 3.22.1 ships ninja 1.10.2, which cannot handle them. Worklets and reanimated native code did compile from the short path. Remedy in [release.md](release.md). EAS (Linux) is unaffected. |
| Kotlin OCR module (`:luma-ocr:compileReleaseKotlin`) | **Compiles** against `com.google.mlkit:text-recognition:16.0.1` and Expo Modules Core (SDK 58), with no errors. |
| On-device checks (first scan in airplane mode, reader, display changes, photo zoom, Ask flow, permission denied, empty scan, font scale 200%, TalkBack labels, SunSafe notifications) | **Not run yet.** The EAS preview APK now exists. Run these checks on it first, on a phone or on an x86_64 emulator image with Google APIs (those images can run ARM-only apps through translation, though slowly). |

### Fixed during code review (not yet confirmed on a device)

- Board Reader: "Open the camera" on the tips screen could launch the camera twice.
- Ask LUMA: changing the answer language and retrying reused the old idempotency key, giving a dead-end conflict. A new language now starts a new request, and a conflict resets the key.
- Reader toolbar: at the default size the four buttons wrapped onto two rows on a 411 dp-wide phone; they now fit on one row and still wrap as text grows.
- Root layout: a font-loading error would have left a blank screen; the app now falls back to system fonts.

## Not yet verified (needs keys, a phone, or people)

| What | Why it is open | Exact steps |
|---|---|---|
| Live OpenAI answers | No `OPENAI_API_KEY` | Deploy the API with the key. On the phone, scan the sample handout and ask "When should we submit the assignment?" in Yorùbá. Expected: a Yorùbá answer quoting "Friday, 27 November 2026" with line 23 cited. Repeat with a question the page does not answer: expect `answerFound: false` and no cited lines. |
| Live YarnGPT transcription | No `YARNGPT_API_KEY` | Check `/v1/capabilities`: `transcription.listed` per language. Record the same question spoken in Yorùbá; check the transcript and correct it in the box. Then repeat **independently** for Hausa, Igbo and Nigerian Pidgin, recording each result here. |
| Live YarnGPT speech | No key; voice-to-language mapping unknown | `GET /api/v1/voices` with the key; set `YARNGPT_VOICE_*` if the automatic match is wrong. Tap Hear answer for each language; confirm the voice speaks that language. Turn on airplane mode and replay: it must play from the saved file. |
| Exhausted credits | Needs an account at zero balance (or a test project) | Expect `credits_exhausted`: the app shows "The LUMA service has run out of AI credits. Reading still works." and offers no retry. |
| YarnGPT base host | The reference says `api.yarngpt.ai`; the quickstart shows `yarngpt.ai` | Confirm with a real key; set `YARNGPT_BASE_URL` if needed. |
| Physical phone | None attached | Install the EAS preview APK on a low-end Android phone (2–3 GB RAM). Airplane mode **before first launch**, then scan: time to result, memory, TalkBack, font size at maximum, display size at maximum. |
| Approved recordings | None supplied | Follow `mobile/assets/prompts/README.md`. |
| Demo video, APK on website | Not produced | Fill `web/src/content/demo.json` and `release.json` after recording and testing. |
| Co-design sessions | Not run | `docs/co-design-test-guide.md`. |
