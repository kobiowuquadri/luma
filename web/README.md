# LUMA website

Next.js 16 (App Router, static export), TypeScript and Tailwind CSS 4.

```sh
npm install
npm run dev        # http://localhost:3000
npm run build      # static site in out/
```

- **Content** lives in `src/content/`. `release.json` controls the APK download: the button appears only with a URL, version, size and SHA-256. `demo.json` controls the demo video (captions and transcript required). `voice-samples.json` is generated from approved recordings by `npm run prompts:sync` in `mobile/`. `handout.json` holds the sample handout's lines and their positions on the photo (from `design/sample/lines.py`). `walkthrough.ts` sets the steps and real screenshots.
- **Theme tokens** in `src/app/globals.css` mirror the app palettes. Check them with `node ../design/check-contrast.mjs`.
- **No tracking**: no analytics, no cookies, fonts self-hosted through `next/font`. The theme choice is kept in `localStorage` only.

Keep the site's claims in step with the build. If a feature, APK, video or recording does not exist, leave it out instead of describing it.
