// Overlays: live search (X) and recent-use history (Y), issue #92 item 10.
//
// Both are horizontal content flows over the same model, drawn above the page
// and closed with B. Neither is a list menu: results scroll as one row of
// cards, matching the home screen.

import { Index, Show } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { Icon } from "./icon";
import { COLORS, FLOW, STATUS_BAR_H, flowInset } from "./theme";
import { fit } from "./text-fit";
import { JA } from "./strings";
import type { ContentItem } from "./model";
import { windowStart } from "./content-flow";

export type OverlayProps = {
  /** `search` shows a live query line; `recent` shows the history header. */
  mode: "search" | "recent";
  query: string;
  items: readonly ContentItem[];
  selected: number;
  favorites: readonly string[];
};

const PANEL_TOP = STATUS_BAR_H + 2;
const PANEL_H = 150;
const ROW_TOP = 20;

export function Overlay(props: OverlayProps) {
  const start = () => windowStart(props.selected, props.items.length);
  const visible = () => props.items.slice(start(), start() + FLOW.visible);
  const focused = (): ContentItem | undefined => props.items[props.selected];
  return (
    <View
      class="absolute"
      style={{
        insetL: 0,
        insetT: PANEL_TOP,
        width: 360,
        height: PANEL_H,
        bgColor: COLORS.bg,
        borderColor: COLORS.borderFocus,
        borderWidth: 1,
        shadow: 2,
      }}
    >
      <View class="absolute flex-row items-center" style={{ insetL: 4, insetT: 2, height: 14 }}>
        <Icon name={props.mode === "search" ? "search" : "recent"} size={12} color={COLORS.highlight} />
        <Text class="text-2xs font-bold" style={{ textColor: COLORS.text, paddingL: 3 }}>
          {props.mode === "search" ? JA.search : JA.recent}
        </Text>
        <Show when={props.mode === "search"}>
          <Text class="text-2xs" style={{ textColor: COLORS.primary, paddingL: 6 }}>
            {props.query.length > 0 ? props.query : "_"}
          </Text>
        </Show>
      </View>

      <Show when={props.items.length > 0} fallback={
        <View class="absolute flex-row items-center" style={{ insetL: 8, insetT: ROW_TOP + 20, height: 24 }}>
          <Icon name="info" size={24} color={COLORS.textDim} />
          <Text class="text-xs" style={{ textColor: COLORS.textDim, paddingL: 6 }}>{JA.noResults}</Text>
        </View>
      }>
        <View class="absolute flex-row items-center" style={{ insetL: flowInset(props.items.length), insetT: ROW_TOP, width: 360 - flowInset(props.items.length) * 2, height: 72 }}>
          <Index each={visible()}>{(item, slot) => {
            const active = () => start() + slot === props.selected;
            return (
              <View
                class="flex-col items-center"
                style={{
                  marginL: slot === 0 ? 0 : FLOW.gap,
                  width: FLOW.cardW,
                  height: 72,
                  bgColor: active() ? COLORS.surfaceRaised : COLORS.surface,
                  borderColor: active() ? COLORS.borderFocus : COLORS.border,
                  borderWidth: active() ? 2 : 1,
                }}
              >
                <View class="items-center justify-center" style={{ width: FLOW.cardW, height: 46, paddingT: 8 }}>
                  <Icon name={item().icon} size={24} color={active() ? COLORS.highlight : COLORS.text} />
                </View>
                <Text
                  class={active() ? "text-2xs font-bold" : "text-2xs"}
                  style={{ textColor: active() ? COLORS.text : COLORS.textMuted, textAlign: 1, width: FLOW.cardW }}
                >
                  {fit(item().label, FLOW.cardW - 6)}
                </Text>
              </View>
            );
          }}</Index>
        </View>

        <Show when={focused()}>
          <View class="absolute flex-row items-center" style={{ insetL: 10, insetT: ROW_TOP + 80, width: 340, height: 20 }}>
            <Icon name={focused()!.icon} size={12} color={COLORS.primary} />
            <Text class="text-2xs" style={{ textColor: COLORS.text, paddingL: 6 }}>
              {fit(focused()!.label, 320)}
            </Text>
          </View>
        </Show>
      </Show>
    </View>
  );
}
