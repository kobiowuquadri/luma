/**
 * Unicode code points covered by every bundled weight of Atkinson Hyperlegible
 * Next (400, 600, 700), generated from the font files' cmap tables.
 *
 * The typeface does not include Yorùbá ẹ ọ ṣ, Igbo ị ụ ṅ, Hausa ɓ ɗ ƙ or the
 * combining dot below. Text that needs them is rendered in the phone's system
 * font (Roboto/Noto on Android), one whole paragraph at a time, so letters
 * are never mixed between fonts inside a word. Pure module.
 */
const RANGES: readonly (readonly [number, number])[] = [[32,126],[160,172],[174,180],[182,263],[266,275],[278,283],[286,291],[294,295],[298,299],[302,307],[310,311],[313,318],[321,328],[336,341],[344,347],[350,357],[362,363],[366,382],[402,402],[536,539],[567,567],[710,711],[713,713],[728,733],[768,772],[774,776],[778,780],[786,786],[806,808],[916,916],[937,937],[956,956],[960,960],[7808,7813],[7838,7838],[7922,7923],[8201,8201],[8211,8212],[8216,8218],[8220,8222],[8224,8226],[8230,8230],[8240,8240],[8249,8250],[8260,8260],[8364,8364],[8377,8377],[8467,8467],[8482,8482],[8494,8494],[8706,8706],[8719,8719],[8721,8722],[8725,8725],[8729,8730],[8734,8734],[8747,8747],[8776,8776],[8800,8800],[8804,8805],[9674,9674],[9834,9834]];

function covered(cp: number): boolean {
  let lo = 0;
  let hi = RANGES.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [a, b] = RANGES[mid];
    if (cp < a) hi = mid - 1;
    else if (cp > b) lo = mid + 1;
    else return true;
  }
  return false;
}

/** True when every visible character of text exists in the brand font. */
export function brandFontCovers(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp <= 0x20 || cp === 0x200b || cp === 0x200d || cp === 0xfeff) continue;
    if (!covered(cp)) return false;
  }
  return true;
}
