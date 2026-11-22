# Spoken guidance recordings

LUMA plays short, fixed guidance ("Take a photo of the page", "Scan complete") from recordings bundled in the app, so it works offline. A prompt plays only in the student's chosen language and only when an **approved** recording exists. LUMA never plays a different language instead; TalkBack announcements and on-screen text still give the same guidance.

The app currently ships **no recordings**. Every language shows "No approved recordings yet" until the team adds them.

## What to record

The prompt IDs and the English meaning of each are in [`src/voice/prompts.ts`](../../src/voice/prompts.ts):

| ID | Meaning |
|---|---|
| `take_photo` | Take a photo of the page. |
| `board_tip` | Stand where the board fills the screen, then take the photo. |
| `reading_page` | Reading the page. Please wait. |
| `scan_complete` | Scan complete. |
| `no_text` | No words were found. Try again. |
| `try_again` | Try again. |
| `too_blurry` | The photo is blurry. Hold the phone steady and try again. |
| `glare` | Light is shining on the page. Tilt the page and try again. |
| `too_dark` | The photo is too dark. Find more light and try again. |
| `recording_started` | Recording. Tap stop when you finish. |
| `answer_ready` | Your answer is ready. |

## Steps

1. **Consent.** Get written consent from each speaker for their voice to be used in the app and, if you want, on the website.
2. **Record.** Mono, quiet room, 1–4 seconds per prompt. Export `.m4a` (AAC) or `.mp3`, peak around -3 dBFS, no music.
3. **Name the files** `assets/prompts/<language>/<prompt-id>.m4a`. Languages: `en`, `yo`, `ha`, `ig`, `pcm`.
4. **Review.** A native speaker who did not record it listens and checks the wording, tone marks and pronunciation. Write down exactly what is said: this is the transcript.
5. **Approve.** Add one entry per recording to `approved.json`:

   ```json
   {
     "language": "yo",
     "prompt": "scan_complete",
     "file": "yo/scan_complete.m4a",
     "transcript": "<exactly what is said, with tone marks>",
     "reviewedBy": "<reviewer name and role>",
     "reviewedOn": "2026-11-25",
     "website": true
   }
   ```

   `"website": true` also publishes the recording and its transcript as a sample on the LUMA website.
6. **Sync.** Run `npm run prompts:sync` in `mobile/`. The script refuses entries without a file, transcript, reviewer or date.
7. **Rebuild** the app (`eas build --profile preview` or a local build). Bundled audio needs a new APK.

`npm run prompts:sync -- --check` fails when the generated files are out of date, which is useful in CI.

## Drafting with YarnGPT (optional)

The team may draft candidate audio with YarnGPT's text-to-speech. Drafts are **not** approved recordings. They still go through steps 4 and 5, and the reviewer must check the pronunciation as carefully as for a human recording.
