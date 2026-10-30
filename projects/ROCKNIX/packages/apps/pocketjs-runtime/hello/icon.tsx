// The launcher's only icon renderer (issue #93 "one icon language").
//
// An icon is a bitmap from icons/registry.generated.ts, drawn as exact
// integer rectangles: every horizontal run of lit pixels becomes one View, and
// vertically identical runs merge into taller Views. No SVG, no texture, no
// font glyph, no fractional geometry — so an icon is crisp at 12 or 24 logical
// px (24 or 48 physical) and takes its colour from the caller.

import { For, createMemo } from "solid-js";
import { View } from "@pocketjs/framework/solid/components";
import { ICON_ROWS, ICON_ROWS_HALF, ICON_SIZE, ICON_HALF, type IconName } from "./icons/registry.generated";

export type { IconName };

type Span = { x: number; y: number; w: number; h: number };

/** Merge a row bitmap into the fewest axis-aligned rectangles. */
function spans(rows: readonly number[], size: number): Span[] {
  const rowRuns: { x: number; w: number }[][] = [];
  for (let y = 0; y < size; y++) {
    const runs: { x: number; w: number }[] = [];
    let x = 0;
    while (x < size) {
      if ((rows[y] & (1 << x)) === 0) {
        x++;
        continue;
      }
      const start = x;
      while (x < size && (rows[y] & (1 << x)) !== 0) x++;
      runs.push({ x: start, w: x - start });
    }
    rowRuns.push(runs);
  }
  const consumed = new Set<string>();
  const out: Span[] = [];
  for (let y = 0; y < size; y++) {
    for (const run of rowRuns[y]) {
      if (consumed.has(`${run.x}:${y}`)) continue;
      let h = 1;
      while (y + h < size && !consumed.has(`${run.x}:${y + h}`)
        && rowRuns[y + h].some((other) => other.x === run.x && other.w === run.w)) h++;
      for (let dy = 0; dy < h; dy++) consumed.add(`${run.x}:${y + dy}`);
      out.push({ x: run.x, y, w: run.w, h });
    }
  }
  return out;
}

export type IconProps = {
  name: IconName;
  /** 24 by default; 12 selects the baked status-bar grid. */
  size?: number;
  color: string;
  /** Class for the icon's root View (positioning, opacity). */
  class?: string;
};

/**
 * Icon draws one registry bitmap at one of its two baked resolutions. Any
 * size other than 12 or 24 would resample the art, so it is rejected.
 */
export function Icon(props: IconProps) {
  const size = () => props.size ?? ICON_SIZE;
  if (size() !== ICON_SIZE && size() !== ICON_HALF) {
    throw new Error(`Icon ${props.name}: size must be ${ICON_HALF} or ${ICON_SIZE}`);
  }
  const rectangles = createMemo(() => {
    const rows = size() === ICON_HALF ? ICON_ROWS_HALF[props.name] : ICON_ROWS[props.name];
    return spans(rows, rows.length);
  });
  return (
    <View class={props.class ?? ""} style={{ width: size(), height: size() }}>
      <For each={rectangles()}>{(rect) => (
        <View
          class="absolute"
          style={{
            insetL: rect.x,
            insetT: rect.y,
            width: rect.w,
            height: rect.h,
            bgColor: props.color,
          }}
        />
      )}</For>
    </View>
  );
}
