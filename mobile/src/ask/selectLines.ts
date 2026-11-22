/**
 * Chooses which numbered lines to send with a question. Short pages are
 * sent whole. Long pages send the lines that share words with the question
 * (plus their neighbours), then fill the rest in reading order, always
 * within the server's character limit. Pure module.
 */
export interface NumberedLine {
  id: string;
  text: string;
}

const STOP = new Set([
  'the', 'and', 'for', 'are', 'was', 'what', 'when', 'where', 'which', 'who', 'why', 'how', 'this', 'that',
  'with', 'from', 'does', 'did', 'about', 'page', 'there', 'their', 'they', 'have', 'has', 'can', 'will',
]);

function tokens(s: string): string[] {
  return (s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (t) => (t.length >= 3 || /\d/.test(t)) && !STOP.has(t),
  );
}

export function selectLines(
  lines: NumberedLine[],
  question: string,
  opts: { maxChars: number; maxLineChars: number; maxLines: number; focusIds?: string[] },
): NumberedLine[] {
  const clean = lines
    .map((l) => ({ id: l.id, text: l.text.replace(/\s+/g, ' ').trim().slice(0, opts.maxLineChars) }))
    .filter((l) => l.text.length > 0);
  const total = clean.reduce((n, l) => n + l.text.length, 0);
  if (total <= opts.maxChars && clean.length <= opts.maxLines) return clean;

  const q = new Set(tokens(question));
  const focus = new Set(opts.focusIds ?? []);
  const scored = clean.map((l, i) => {
    let score = focus.has(l.id) ? 100 : 0;
    for (const t of tokens(l.text)) if (q.has(t)) score += 1;
    return { i, score };
  });

  const chosen = new Set<number>();
  let used = 0;
  const take = (i: number) => {
    if (i < 0 || i >= clean.length || chosen.has(i)) return true;
    if (chosen.size >= opts.maxLines || used + clean[i].text.length > opts.maxChars) return false;
    chosen.add(i);
    used += clean[i].text.length;
    return true;
  };

  for (const s of scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score || a.i - b.i)) {
    if (!take(s.i)) break;
    take(s.i - 1);
    take(s.i + 1);
  }
  for (let i = 0; i < clean.length; i++) {
    if (!take(i)) break;
  }
  return [...chosen].sort((a, b) => a - b).map((i) => clean[i]);
}
