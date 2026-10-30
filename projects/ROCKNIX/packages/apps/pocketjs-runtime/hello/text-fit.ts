// Text fitting for a fixed pixel grid.
//
// PocketJS lays text out per glyph with the baked advance widths, so a long ROM
// title would silently overflow its card. Every visible label passes through
// `fit`, which measures with the same rule the atlas bakes: in the pixel face an
// ASCII glyph advances half a full-width cell, and kana/kanji advance a full
// cell. Measured values for the vendored Tamzen stack: 6 px / 12 px at 12 px,
// 5 px / 10 px at 10 px (see docs/launcher-v2/ACCEPTANCE.md).

/** Glyph advances in logical px for the pixel face, per text size. */
const ADVANCE: Readonly<Record<number, { ascii: number; full: number }>> = {
  10: { ascii: 5, full: 10 },
  12: { ascii: 6, full: 12 },
  14: { ascii: 7, full: 14 },
};

const isFullWidth = (codePoint: number): boolean => codePoint >= 0x2000;

/** `text` fitted into `width` logical px, ending in an ellipsis when cut. */
export function fit(text: string, width: number, size = 10): string {
  const advance = ADVANCE[size] ?? ADVANCE[10];
  const widthOf = (char: string) => (isFullWidth(char.codePointAt(0)!) ? advance.full : advance.ascii);
  let total = 0;
  for (const char of text) total += widthOf(char);
  if (total <= width) return text;
  const budget = width - advance.full;
  let used = 0;
  let out = "";
  for (const char of text) {
    const next = widthOf(char);
    if (used + next > budget) break;
    used += next;
    out += char;
  }
  return `${out}…`;
}
