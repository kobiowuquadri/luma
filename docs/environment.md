# Environment variables

## API (`api/`)

The server reads the process environment only. [`api/.env.example`](../api/.env.example) lists everything with placeholders. Missing provider keys are allowed: the matching features report `not_configured`, and reading, saving and the website keep working.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | Listen port. Render sets it. |
| `BIND_HOST` | (empty) | Interface to listen on. Empty means all interfaces (needed on Render). Use `127.0.0.1` locally; the Android emulator reaches it as `10.0.2.2`. |
| `OPENAI_API_KEY` | (empty) | Enables Ask LUMA and Explain. Secret. |
| `OPENAI_MODEL` | `gpt-6-luna` | Answer model (Responses API with strict JSON schema). |
| `OPENAI_REASONING_EFFORT` | `low` | `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, or `omit` to leave it out. Check the model page for supported values. |
| `OPENAI_TIMEOUT_SECONDS` | `45` | Per request. |
| `OPENAI_MAX_OUTPUT_TOKENS` | `1600` | Includes reasoning tokens. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Override for testing. |
| `YARNGPT_API_KEY` | (empty) | Enables spoken questions and spoken answers. Secret. |
| `YARNGPT_BASE_URL` | `https://api.yarngpt.ai` | API host from the YarnGPT reference. Its quickstart shows `https://yarngpt.ai`; confirm with a real key. |
| `YARNGPT_TIMEOUT_SECONDS` | `75` | Total time to submit, poll and download one job. |
| `YARNGPT_VOICE_EN` … `YARNGPT_VOICE_PCM` | (empty) | Voice per language (the `name` from `GET /api/v1/voices`). Unset means a voice whose language list includes the language is chosen automatically, or "no voice" is reported. |
| `YARNGPT_ASR_LANGUAGES` | (empty) | Comma list overriding the live `GET /api/v1/asr/languages` result. |
| `LUMA_CLIENT_TOKEN` | (empty) | If set, POST `/v1/*` requires header `X-Luma-Client`. It is visible in the APK: a speed bump, not a secret. |
| `TRUST_PROXY` | `false` | `true` on Render so limits use the client IP from `X-Forwarded-For`. |
| `PER_DEVICE_PER_MINUTE` / `PER_DEVICE_PER_DAY` | `8` / `80` | Paid requests per install ID (or IP). |
| `DAILY_ASK_LIMIT` / `DAILY_TRANSCRIBE_LIMIT` / `DAILY_SPEECH_LIMIT` | `400` / `100` / `100` | Paid calls across all devices per UTC day. `0` disables the feature. YarnGPT's quickstart mentions about 120 requests a day per key, so keep its two limits below that. |
| `MAX_QUESTION_CHARS`, `MAX_LINE_CHARS`, `MAX_LINES`, `MAX_DOCUMENT_CHARS`, `MAX_HISTORY_TURNS`, `MAX_HISTORY_CHARS` | `600`, `600`, `400`, `16000`, `6`, `700` | Ask request limits (also sent to the app via `/v1/capabilities`). |
| `MAX_ANSWER_WORDS` / `MAX_EXPLAIN_WORDS` | `110` / `170` | Answer length targets. |
| `MAX_SPEECH_CHARS` | `1500` | Longest text sent to TTS. |
| `MAX_AUDIO_BYTES` / `MAX_RECORDING_SECONDS` | `8388608` / `60` | Upload limits for spoken questions. |
| `LUMA_PREVIEW_FIXTURES` | `false` | Labelled fixtures instead of providers, for UI testing. Refused when real keys are set. |
| `LUMA_API_VERSION` | `0.1.0` | Reported by `/health`. |

## Android app (`mobile/`), build time

Set these in `eas.json` profiles, with `eas env:create --environment preview`, or in the shell for local builds. `EXPO_PUBLIC_*` values are compiled into the JavaScript bundle and are **not secret**.

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_LUMA_API_URL` | Base URL of the LUMA API, e.g. `https://luma-api.onrender.com`. Empty turns online features off, and the app says so. |
| `EXPO_PUBLIC_LUMA_CLIENT_TOKEN` | Must match `LUMA_CLIENT_TOKEN` when the API requires it. |
| `LUMA_BUILD_ARCHS` | ABIs to build. Default `armeabi-v7a,arm64-v8a` (pilot phones); add `x86_64` for emulators. |
| `LUMA_ANDROID_PACKAGE` | Application ID. Default `app.luma.reader`. |
| `LUMA_ALLOW_CLEARTEXT` | `1` only for local test builds that call an `http://` API, such as `http://10.0.2.2:8080` from the emulator. Never for pilot APKs. |

## Website (`web/`)

The website needs no environment variables. Release, demo and project details live in `web/src/content/` (`release.json`, `demo.json`, `project.ts`). Cloudinary is not used because it was not configured for this project.
