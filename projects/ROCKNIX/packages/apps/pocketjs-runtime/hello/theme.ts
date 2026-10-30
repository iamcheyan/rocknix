// PocketShell Launcher V2 design tokens (issue #92 palette, #93 icon language).
//
// Every length is a logical pixel on the 360x240 grid the host presents at an
// exact 2x to the 720x480 panel. Nothing here may be fractional: the pixel
// frame, the 12 px status bar and the 24 px icon grid all land on integer
// multiples of 2 physical pixels.

export const SCREEN = { w: 360, h: 240 } as const;

/** Status bar: issue #92 fixes it at 12 logical px. */
export const STATUS_BAR_H = 12;
/** Persistent bottom navigation. */
export const NAV_H = 28;
export const CONTENT_TOP = STATUS_BAR_H;
export const CONTENT_H = SCREEN.h - STATUS_BAR_H - NAV_H;

/**
 * Content cards: four across 360 px. 4 px outer margins, 6 px gaps, 84 px
 * cards; 84*4 + 6*3 + 4*2 = 360 exactly, so the row never lands on a
 * fractional pixel.
 */
export const FLOW = {
  cardW: 84,
  cardH: 92,
  gap: 6,
  margin: 4,
  iconBox: 52,
  visible: 4,
} as const;

/** Left inset that centres `count` cards in the 360 px screen band. */
export function flowInset(count: number): number {
  const shown = Math.min(count, FLOW.visible);
  return Math.max(FLOW.margin, Math.round((360 - (shown * FLOW.cardW + (shown - 1) * FLOW.gap)) / 2));
}

/** Icon grid (issue #93: 24x24 logical, 48x48 physical at 2x). */
export const ICON_SIZE = 24;
export const ICON_SIZE_SMALL = 12;

export const COLORS = {
  bg: "#141414",
  surface: "#1A1A1A",
  surfaceRaised: "#202020",
  bar: "#0E0E0E",
  nav: "#101010",
  border: "#2A2A2A",
  borderFocus: "#3FFF96",
  text: "#EAEAEA",
  textMuted: "#8A8A8A",
  textDim: "#5C5C5C",
  primary: "#8BFF5A",
  highlight: "#3FFF96",
  warning: "#FFA63C",
  error: "#FF5A5A",
  disabled: "#4A4A4A",
} as const;

/** Issue #93 battery colour rule: normal, low, critical. */
export const BATTERY_COLORS = {
  normal: "#EAEAEA",
  low: "#FFA63C",
  critical: "#FF5A5A",
} as const;

/** Issue #92 animation budget, in milliseconds. */
export const MOTION = {
  focus: 80,
  slide: 120,
  category: 180,
  search: 150,
} as const;

/** Battery thresholds, as a percentage of full charge. */
export const BATTERY_LOW = 20;
export const BATTERY_CRITICAL = 5;
