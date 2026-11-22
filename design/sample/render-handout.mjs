// Renders handout.html to handout-flat.png (1240 x 1754, A4 at 150 dpi).
// Run with the browser-automation runner:
//   node <browser.mjs> file:///<repo>/design/sample/handout.html --script design/sample/render-handout.mjs
import { fileURLToPath } from 'node:url';

export default async function run(page) {
  await page.setViewportSize({ width: 1240, height: 1754 });
  await page.waitForTimeout(300);
  const out = fileURLToPath(new URL('./handout-flat.png', import.meta.url));
  await page.locator('.sheet').screenshot({ path: out });
  return { saved: out };
}
