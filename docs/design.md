# Design

## One idea, everywhere

**A line from a photographed page becomes a clean, adjustable line of text.**

- **Mark**: two faint, tilted lines (a line on a photo) resolving into one bold, straight teal line. It is used for the app icon, the wordmark, empty states and the website header ([`design/icons/make_icons.py`](../design/icons/make_icons.py)).
- **Reading rule**: a thick teal rule at the start of a line or paragraph marks "the line you are on". In the app it marks the selected or spoken paragraph; on the website it marks the clean line in the hero and list items.
- **Website hero**: the photographed due-date line from the sample handout, then the same line as clean text in three student settings.
- **Reader preview**: focusing a line of clean text outlines the same line on the photo. In the app, every answer cites its lines and opens them highlighted in the text and outlined on the photo.

The same original sample handout ([`design/sample/handout.html`](../design/sample/handout.html), "SS2 Biology, Handout 3, Photosynthesis") appears in the app's "Try the sample handout", the website preview and the walkthrough. It is written for LUMA and labelled as a sample wherever it appears. `photograph.py` turns it into a believable phone photo, and `lines.py` maps each printed line onto the photo for the website overlay.

## Typography

- **Atkinson Hyperlegible Next** for the app and all reading text (variable weight, Latin and Latin Extended, self-hosted on the website).
- **Newsreader** (variable serif, weight 500) for website headings only, an editorial look with large headlines, ink buttons and hairline dividers. Its Vietnamese range covers the dotted vowels Yorùbá and Igbo use.
- The website page uses a lighter ivory (`#FAF8F3`) with sand cards and an ink primary button. The reader preview uses the app's exact palettes (`data-palette`), so it shows what the app shows.
- No text below 16 px in the app (16 sp before Android scaling) or 1 rem on the website. Muted text still meets 7:1.

**Coverage gap, measured from the font files:** Atkinson Hyperlegible Next (both the Expo package and the upstream Google Fonts file) has no glyphs for Yorùbá ẹ ọ ṣ, Igbo ị ụ ṅ, Hausa ɓ ɗ ƙ ƴ, the combining dot below (U+0323) or →. The app switches any paragraph containing them to the system font as a whole paragraph, so letters are never mixed inside a word. The website uses a `.multilingual` font stack for such text. Revisit the choice with students during co-design: the system font may suit Yorùbá answers better.

## Colour

Five palettes shared by app and website: **Warm paper** (default), **Plain white**, **Dark**, **Yellow on black**, and **My colours** (eight text and eight background swatches with live contrast feedback). Interactive elements in custom colours use the text colour, so buttons are always as visible as the text.

`node design/check-contrast.mjs` checks every pair the interface draws, in the app palettes and the website CSS. Current result: **180 of 180 pairs pass** (app palettes, website themes and the reader-preview palettes).

| Pair | Minimum | Warm paper | Dark | Yellow on black |
|---|---|---|---|---|
| Text on background | 7 | 15.00 | 15.13 | 16.13 |
| Muted text on background | 7 | 8.96 | 10.67 | 16.13 |
| Teal (links, accent) on background | 7 | 7.45 | 10.54 | 16.13 |
| Button label on teal | 7 | 8.53 | 9.71 | 16.13 |
| Highlighted line text | 7 | 11.93 | 7.97 | 16.13 |
| Borders and focus rings | 3 | 4.24 | 6.25 | 16.13 |

Rerun the script after changing any colour; it exits non-zero when a pair fails.

## Accessibility rules used in this build

- Primary controls are at least 52 dp tall (64 dp for large ones); icon buttons are at least 52 × 52 dp. Labels wrap instead of truncating. Toolbars wrap onto more rows as text grows.
- Every screen scrolls vertically; the reader never scrolls sideways. Android font scaling stays on.
- TalkBack: headings are marked, the title gets focus when a screen opens, scan and recording status changes are announced, paragraphs offer actions (read from here, explain, show on photo) and list their uncertain words.
- Audio plays only after a tap, with a visible Stop. Spoken guidance can be turned off.
- Website: skip link, one visible focus style, native form controls, keyboard-operable menu, reduced-motion support, no horizontal scrolling down to 320 px and at 200% zoom.
