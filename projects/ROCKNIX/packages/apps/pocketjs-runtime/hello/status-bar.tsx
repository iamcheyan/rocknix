// Top status bar (issue #92): 12 logical px, three zones.
//
//   [ネットワーク/IP]        <分類>        [システム状態]
//
// The battery shows an icon and a colour, never a percentage. Every glyph is a
// Pixelarticons bitmap from the launcher registry (#93) and the text face is
// the pixel stack, so no Nerd Font artwork appears in the UI.
//
// Zones are absolutely placed instead of flex-distributed: a 360 px bar has no
// room for layout drift, and every glyph keeps an exact integer box.

import { Show } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { Icon } from "./icon";
import type { IconName } from "./icons/registry.generated";
import { COLORS, STATUS_BAR_H, BATTERY_COLORS, BATTERY_LOW, BATTERY_CRITICAL } from "./theme";
import type { Status } from "./bridge";

/** Battery glyph steps (issue #93 levels): full / medium / low / critical. */
export function batteryIcon(level: number | undefined): IconName {
  if (level === undefined) return "battery-critical";
  if (level > 60) return "battery-full";
  if (level > BATTERY_LOW) return "battery-medium";
  return "battery-low";
}

export function batteryColor(level: number | undefined): string {
  if (level === undefined) return COLORS.textDim;
  if (level <= BATTERY_CRITICAL) return BATTERY_COLORS.critical;
  if (level <= BATTERY_LOW) return BATTERY_COLORS.low;
  return BATTERY_COLORS.normal;
}

/** A state glyph: theme colour when on, grey when off, red when unknown. */
function stateColor(state: "on" | "off" | "unknown"): string {
  if (state === "on") return COLORS.primary;
  if (state === "off") return COLORS.disabled;
  return COLORS.error;
}

export type StatusBarProps = {
  status: Status;
  wifi: "on" | "off" | "unknown";
  bluetooth: "on" | "off" | "unknown";
  adb: boolean;
  /** Category name centred between the L1/R1 chevrons. */
  category: string;
};

/** Width of a 12 px label: ASCII advances 6 px, kana/kanji 12 px. */
function labelWidth(label: string): number {
  let total = 0;
  for (const char of label) total += char.codePointAt(0)! < 0x2000 ? 6 : 12;
  return total;
}

/** Right-hand state glyphs, right to left, with their logical x offsets. */
const STATE_SLOTS = { battery: 360 - 4 - 12, volume: 360 - 4 - 12 - 2 - 12, bluetooth: 360 - 4 - 12 - 2 - 12 - 2 - 12, adb: 360 - 4 - 12 - 2 - 12 - 2 - 12 - 2 - 12 };

export function StatusBar(props: StatusBarProps) {
  return (
    <View class="absolute left-0 top-0" style={{ width: 360, height: STATUS_BAR_H, bgColor: COLORS.bar }}>
      {/* network / IP */}
      <View class="absolute flex-row items-center" style={{ insetL: 4, insetT: 0, height: STATUS_BAR_H }}>
        <Icon name="wifi" size={12} color={stateColor(props.wifi)} />
        <Text class="text-2xs" style={{ textColor: props.status.ip === "--" ? COLORS.textDim : COLORS.text, paddingL: 2 }}>
          {props.status.ip}
        </Text>
      </View>

      {/* current category, flanked by the L1/R1 chevrons */}
      <View
        class="absolute flex-row items-center justify-center"
        style={{
          insetL: Math.round(180 - (labelWidth(props.category) + 24) / 2),
          insetT: 0,
          width: labelWidth(props.category) + 24,
          height: STATUS_BAR_H,
        }}
      >
        <Icon name="chevron-left" size={12} color={COLORS.textDim} />
        <Text class="text-2xs font-bold" style={{ textColor: COLORS.highlight, paddingL: 2, paddingR: 2 }}>{props.category}</Text>
        <Icon name="chevron-right" size={12} color={COLORS.textDim} />
      </View>

      {/* system state */}
      <Show when={props.adb}>
        <View class="absolute" style={{ insetL: STATE_SLOTS.adb, insetT: 0 }}>
          <Icon name="adb" size={12} color={COLORS.primary} />
        </View>
      </Show>
      <View class="absolute" style={{ insetL: STATE_SLOTS.bluetooth, insetT: 0 }}>
        <Icon name="bluetooth" size={12} color={stateColor(props.bluetooth)} />
      </View>
      <View class="absolute" style={{ insetL: STATE_SLOTS.volume, insetT: 0 }}>
        <Icon name="volume" size={12} color={COLORS.textMuted} />
      </View>
      <View class="absolute" style={{ insetL: STATE_SLOTS.battery, insetT: 0 }}>
        <Icon name={batteryIcon(props.status.battery)} size={12} color={batteryColor(props.status.battery)} />
      </View>
      {/* a charging bolt replaces nothing: it sits left of the cell, so the
          battery step stays readable while the cable is attached */}
      <Show when={props.status.charging}>
        <View class="absolute" style={{ insetL: STATE_SLOTS.battery - 12, insetT: 0 }}>
          <Icon name="charging" size={12} color={COLORS.primary} />
        </View>
      </Show>
    </View>
  );
}
