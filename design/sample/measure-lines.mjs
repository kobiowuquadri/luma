// Measures every visual line of the sample handout (text + rectangle in the
// 1240x1754 flat render), grouped by block, for the website preview overlay.
export default async function run(page) {
  await page.setViewportSize({ width: 1240, height: 1754 });
  await page.waitForTimeout(300);
  const blocks = await page.evaluate(() => {
    const sheet = document.querySelector('.sheet');
    const origin = sheet.getBoundingClientRect();
    const blockEls = [...sheet.querySelectorAll('.school span, h1, .topic, .meta span, h2, p:not(.topic), .eq, li, .task')];
    return blockEls.map((el) => {
      const words = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const re = /\S+/g;
        let m;
        while ((m = re.exec(node.data))) {
          const r = document.createRange();
          r.setStart(node, m.index);
          r.setEnd(node, m.index + m[0].length);
          const rect = r.getClientRects()[0];
          if (rect) words.push({ text: m[0], x0: rect.left - origin.left, y0: rect.top - origin.top, x1: rect.right - origin.left, y1: rect.bottom - origin.top });
        }
      }
      const lines = [];
      for (const w of words) {
        const last = lines[lines.length - 1];
        if (last && Math.abs(last.y0 - w.y0) < 6) {
          last.words.push(w.text); last.x1 = Math.max(last.x1, w.x1); last.y1 = Math.max(last.y1, w.y1); last.y0 = Math.min(last.y0, w.y0);
        } else lines.push({ words: [w.text], x0: w.x0, y0: w.y0, x1: w.x1, y1: w.y1 });
      }
      const tag = el.tagName.toLowerCase();
      const kind = tag === 'h1' || tag === 'h2' || el.classList.contains('topic') ? 'heading' : tag === 'li' ? 'list' : 'text';
      return { kind, prefix: tag === 'li' ? '• ' : '', lines: lines.map((l) => ({ text: l.words.join(' '), box: [l.x0, l.y0, l.x1, l.y1] })) };
    });
  });
  const fs = await import('node:fs');
  fs.writeFileSync(new URL('./handout-lines-flat.json', import.meta.url), JSON.stringify(blocks, null, 1));
  return { blocks: blocks.length, lines: blocks.reduce((n, b) => n + b.lines.length, 0) };
}
