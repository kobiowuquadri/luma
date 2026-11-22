# LUMA API

A small Go service (standard library only) that keeps provider keys off the phone and turns three provider operations into safe, bounded endpoints.

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness, version, mode. Never calls providers. |
| `GET /v1/capabilities` | Per-language availability of answers, transcription and speech, with reasons, plus request limits. |
| `POST /v1/ask` | Grounded answer or explanation from numbered lines. Returns validated `sourceLineIds`. |
| `POST /v1/transcribe` | Multipart `audio` (m4a, mp3, wav, ogg, flac or webm, checked by content) and `language`. YarnGPT ASR job, polled. |
| `POST /v1/speech` | JSON `{text, language}`. YarnGPT TTS job, polled, then audio bytes returned. |

POST endpoints accept `Idempotency-Key` (8–64 of `A-Z a-z 0-9 _ -`). A retry with the same key and body replays the stored result instead of paying again. Errors always have the shape `{"error": {"code", "message", "retryable", "provider"}}`. Codes include `not_configured`, `language_unavailable`, `credits_exhausted`, `provider_timeout`, `rate_limited` and `daily_limit_reached`.

## Run

```sh
go test ./...
go run ./cmd/server                                  # no keys: honest "not_configured"
OPENAI_API_KEY=... YARNGPT_API_KEY=... go run ./cmd/server
LUMA_PREVIEW_FIXTURES=true go run ./cmd/server       # labelled fixtures for UI testing
```

Configuration: [`.env.example`](.env.example) and [docs/environment.md](../docs/environment.md). Deployment: [`render.yaml`](../render.yaml) and [docs/release.md](../docs/release.md).

## Layout

```
cmd/server          main: config, providers, HTTP server, graceful shutdown
internal/config     environment loading and validation
internal/lang       the five languages and their writing guidance
internal/ask        request validation, grounded prompt, JSON schema, source-ID validation
internal/guard      idempotency store, per-device limiter, daily budgets
internal/apierr     error kinds and HTTP mapping
internal/providers  openai (Responses API), yarngpt (ASR/TTS jobs, voices), fixture (preview mode)
internal/server     routes, middleware (request IDs, content-free logging), handlers
```

Provider behaviour follows the official docs as of November 2026. OpenAI: `POST /v1/responses`, `text.format` `json_schema` strict, `store: false`. YarnGPT: `POST /api/v1/asr` and `/api/v1/tts` with `Idempotency-Key`, polling `GET /api/v1/asr/{id}` and `/api/v1/status/{id}`, voices from `GET /api/v1/voices`. The tests run against `httptest` fakes of those shapes. Live verification with real keys is still needed; see [docs/verification.md](../docs/verification.md).
