// Horizontal content flow (issue #92: `[A][B][C][D]…`, no lists, no trees).
//
// Four cards across 360 px, vertically centred in the content band, with the
// focused item's name repeated once underneath at title size. A card is an icon
// and a name — no description, no subtitle, no metadata. The selected card is
// marked by a border, a brighter surface and a stronger pixel shadow; never by
// a scale transform (issue #92 forbids scale(1.15) on selection).

import { Index, Show } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { Icon } from "./icon";
import { COLORS, CONTENT_H, CONTENT_TOP, FLOW, flowInset } from "./theme";
import { fit } from "./text-fit";
import type { ContentItem } from "./model";

/** First visible index for a selection, so the window follows the focus. */
export function windowStart(selected: number, count: number): number {
  const last = Math.max(0, count - FLOW.visible);
  return Math.max(0, Math.min(selected - Math.floor(FLOW.visible / 2), last));
}

export type ContentFlowProps = {
  items: readonly ContentItem[];
  selected: number;
  favorites: readonly string[];
  /** Shown when the category has no content. */
  emptyLabel: string;
};

const ROW_TOP = CONTENT_TOP + Math.round((CONTENT_H - FLOW.cardH - 30) / 2);
const TITLE_TOP = ROW_TOP + FLOW.cardH + 8;

export function ContentFlow(props: ContentFlowProps) {
  const start = () => windowStart(props.selected, props.items.length);
  const visible = () => props.items.slice(start(), start() + FLOW.visible);
  const focused = (): ContentItem | undefined => props.items[props.selected];
  return (
    <View class="absolute" style={{ insetL: 0, insetT: 0, width: 360, height: CONTENT_H }}>
      <Show when={props.items.length > 0} fallback={
        <View class="absolute flex-row items-center justify-center" style={{ insetL: 0, insetT: CONTENT_TOP, width: 360, height: CONTENT_H }}>
          <Icon name="info" size={24} color={COLORS.textDim} />
          <Text class="text-xs" style={{ textColor: COLORS.textDim, paddingL: 6 }}>{props.emptyLabel}</Text>
        </View>
      }>
        <View class="absolute flex-row items-center" style={{ insetL: flowInset(props.items.length), insetT: ROW_TOP, width: 360 - flowInset(props.items.length) * 2, height: FLOW.cardH }}>
          <Index each={visible()}>{(item, slot) => {
            const active = () => start() + slot === props.selected;
            return (
              <View
                class="flex-col items-center"
                style={{
                  marginL: slot === 0 ? 0 : FLOW.gap,
                  width: FLOW.cardW,
                  height: FLOW.cardH,
                  bgColor: active() ? COLORS.surfaceRaised : COLORS.surface,
                  borderColor: active() ? COLORS.borderFocus : COLORS.border,
                  borderWidth: active() ? 2 : 1,
                  shadow: active() ? 2 : 0,
                }}
              >
                <View class="items-center justify-center" style={{ width: FLOW.cardW, height: FLOW.iconBox, paddingT: 8 }}>
                  <Icon name={item().icon} size={24} color={active() ? COLORS.highlight : COLORS.text} />
                </View>
                <Text
                  class={active() ? "text-2xs font-bold" : "text-2xs"}
                  style={{
                    textColor: active() ? COLORS.text : COLORS.textMuted,
                    textAlign: 1,
                    width: FLOW.cardW,
                  }}
                >
                  {fit(item().label, FLOW.cardW - 6)}
                </Text>
                <Show when={props.favorites.includes(item().key)}>
                  <View class="absolute" style={{ insetR: 2, insetT: 2 }}>
                    <Icon name="favorites" size={12} color={COLORS.warning} />
                  </View>
                </Show>
              </View>
            );
          }}</Index>
        </View>

        {/* the focused item, once, at title size: icon + name only */}
        <Show when={focused()}>
          <View class="absolute" style={{ insetL: flowInset(props.items.length), insetT: TITLE_TOP, width: 360 - flowInset(props.items.length) * 2, height: 28 }}>
            <Icon name={focused()!.icon} size={24} color={COLORS.highlight} />
            <Text class="text-sm font-bold" style={{ textColor: COLORS.text, paddingL: 8 }}>
              {fit(focused()!.label, 300, 14)}
            </Text>
          </View>
        </Show>
      </Show>
    </View>
  );
}
