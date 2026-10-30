// Settings category (issue #92's fifth rail entry).
//
// Two stacked horizontal flows: the setting groups (画面/音声/ネットワーク/
// サービス/システム), then the rows of the focused group. A row is a tile with
// an icon, a name and its value; a percentage appears only where the percentage
// IS the value (brightness, volume). There is no nested menu and no list view —
// the same horizontal grammar the content pages use.

import { Index, Show } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { Icon } from "./icon";
import { COLORS, CONTENT_H, CONTENT_TOP, FLOW, flowInset } from "./theme";
import { JA, SERVICE_KEYS } from "./strings";
import { fit } from "./text-fit";
import type { IconName } from "./icons/registry.generated";

export type SettingRow =
  | { kind: "level"; id: "brightness" | "volume"; icon: IconName; label: string; value: number | undefined }
  | { kind: "radio"; id: "wifi" | "bluetooth"; icon: IconName; label: string; value: "on" | "off" | "unknown" }
  | { kind: "service"; id: string; icon: IconName; label: string; value: "on" | "off" | "unknown" }
  | { kind: "timeout"; icon: IconName; label: string; value: string }
  | { kind: "open"; id: string; icon: IconName; label: string };

export type SettingGroup = {
  id: string;
  icon: IconName;
  label: string;
  rows: SettingRow[];
};

export type SettingsValues = {
  brightness?: number;
  volume?: number;
  wifi: "on" | "off" | "unknown";
  bluetooth: "on" | "off" | "unknown";
  services: Record<string, "on" | "off" | "unknown">;
  timeout: string;
};

/** Service labels and icons, keyed by the bridge's service key. */
const SERVICE_META: Readonly<Record<string, { icon: IconName; label: string }>> = {
  adbusb: { icon: "usb", label: JA.settings.adbusb },
  ssh: { icon: "terminal", label: JA.settings.ssh },
  avahi: { icon: "network", label: JA.settings.avahi },
  ftp: { icon: "network", label: JA.settings.ftp },
  http: { icon: "network", label: JA.settings.http },
  rsyncd: { icon: "refresh", label: JA.settings.rsyncd },
  samba: { icon: "folder", label: JA.settings.samba },
  syncthing: { icon: "refresh", label: JA.settings.syncthing },
  telnet: { icon: "terminal", label: JA.settings.telnet },
  "pocketshell-dev": { icon: "monitor", label: JA.settings.devd },
};

export function buildSettingGroups(values: SettingsValues): SettingGroup[] {
  return [
    {
      id: "display",
      icon: "sun",
      label: JA.settings.display,
      rows: [{ kind: "level", id: "brightness", icon: "sun", label: JA.settings.brightness, value: values.brightness }],
    },
    {
      id: "audio",
      icon: "volume",
      label: JA.settings.audio,
      rows: [{ kind: "level", id: "volume", icon: "volume", label: JA.settings.volume, value: values.volume }],
    },
    {
      id: "network",
      icon: "network",
      label: JA.settings.network,
      rows: [
        { kind: "radio", id: "wifi", icon: "wifi", label: JA.settings.wifi, value: values.wifi },
        { kind: "radio", id: "bluetooth", icon: "bluetooth", label: JA.settings.bluetooth, value: values.bluetooth },
      ],
    },
    {
      id: "services",
      icon: "storage",
      label: JA.settings.services,
      rows: SERVICE_KEYS.map((key) => {
        const meta = SERVICE_META[key];
        return {
          kind: "service" as const,
          id: key,
          icon: meta?.icon ?? "storage",
          label: meta?.label ?? key,
          value: values.services[key] ?? "unknown",
        };
      }),
    },
    {
      id: "system",
      icon: "settings",
      label: JA.settings.system,
      rows: [
        { kind: "timeout", icon: "monitor", label: JA.settings.timeout, value: values.timeout },
        { kind: "open", id: "tools", icon: "plug", label: JA.settings.tools },
      ],
    },
  ];
}

const stateColor = (state: "on" | "off" | "unknown"): string =>
  state === "on" ? COLORS.primary : state === "off" ? COLORS.disabled : COLORS.error;

const stateLabel = (state: "on" | "off" | "unknown"): string =>
  state === "on" ? JA.settings.on : state === "off" ? JA.settings.off : JA.settings.unknown;

/** The tile's value line, narrowed per row kind. */
function RowValue(row: SettingRow) {
  switch (row.kind) {
    case "level":
      return (
        <Text class="text-2xs font-bold" style={{ textColor: COLORS.primary }}>
          {row.value === undefined ? JA.settings.unknown : `${row.value}%`}
        </Text>
      );
    case "radio":
    case "service":
      return <Text class="text-2xs font-bold" style={{ textColor: stateColor(row.value) }}>{stateLabel(row.value)}</Text>;
    case "timeout":
      return (
        <Text class="text-2xs font-bold" style={{ textColor: COLORS.primary }}>
          {(JA.timeouts as Record<string, string>)[row.value] ?? row.value}
        </Text>
      );
    case "open":
      return <Text class="text-2xs font-bold" style={{ textColor: COLORS.textMuted }}>{JA.settings.apply}</Text>;
  }
}

/** First visible row index, so a group with ten services still fits. */
function rowwStart(selected: number, count: number): number {
  const last = Math.max(0, count - FLOW.visible);
  return Math.max(0, Math.min(selected - Math.floor(FLOW.visible / 2), last));
}

export type SettingsPageProps = {
  groups: readonly SettingGroup[];
  group: number;
  row: number;
};

const GROUPS_TOP = CONTENT_TOP;
const ROWS_TOP = CONTENT_TOP + 34;

export function SettingsPage(props: SettingsPageProps) {
  const current = (): SettingGroup | undefined => props.groups[props.group];
  const navLabel = () => props.groups.map((group) => group.label)[props.group] ?? "";
  const start = () => rowwStart(props.row, current()?.rows.length ?? 0);
  const visibleRows = () => (current()?.rows ?? []).slice(start(), start() + FLOW.visible);
  return (
    <View class="absolute" style={{ insetL: 0, insetT: 0, width: 360, height: CONTENT_H }}>
      {/* group name, centred: the same "< 分類 >" affordance as the status bar */}
      <View class="absolute flex-row items-center justify-center" style={{ insetL: 4, insetT: GROUPS_TOP, width: 352, height: 16 }}>
        <Icon name="chevron-left" size={12} color={COLORS.textDim} />
        <View style={{ paddingL: 4, paddingR: 4 }}>
          <Icon name={current()?.icon ?? "settings"} size={12} color={COLORS.highlight} />
        </View>
        <Text class="text-xs font-bold" style={{ textColor: COLORS.text, paddingR: 4 }}>{navLabel()}</Text>
        <Icon name="chevron-right" size={12} color={COLORS.textDim} />
      </View>

      {/* rows of the focused group as a horizontal flow */}
      <View class="absolute flex-row items-start" style={{ insetL: flowInset(visibleRows().length), insetT: ROWS_TOP, width: 360 - flowInset(visibleRows().length) * 2, height: FLOW.cardH }}>
        <Index each={visibleRows()}>{(row, slot) => {
          const active = () => start() + slot === props.row;
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
                <Icon name={row().icon} size={24} color={active() ? COLORS.highlight : COLORS.text} />
              </View>
              <Text class="text-2xs" style={{ textColor: active() ? COLORS.text : COLORS.textMuted, textAlign: 1, width: FLOW.cardW }}>
                {fit(row().label, FLOW.cardW - 6)}
              </Text>
              <Show when={true}>
                <View class="items-center justify-center" style={{ width: FLOW.cardW, height: 16 }}>
                  {RowValue(row())}
                </View>
              </Show>
            </View>
          );
        }}</Index>
      </View>

      <View class="absolute flex-row items-center" style={{ insetL: 10, insetT: ROWS_TOP + FLOW.cardH + 10, width: 340, height: 16 }}>
        <Icon name="sliders" size={12} color={COLORS.textDim} />
        <Text class="text-2xs" style={{ textColor: COLORS.textDim, paddingL: 6 }}>
          {"← → " + JA.settings.adjust + "  ↑ ↓ " + JA.category}
        </Text>
      </View>
    </View>
  );
}
