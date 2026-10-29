import { Index } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";

export type SettingItem = { id: string; label: string; kind: string };

export type SettingsWorkspaceProps = {
  category: number;
  categories: string[];
  rows: SettingItem[];
  selected: number;
  value: (item: SettingItem) => string;
  detail: (item: SettingItem) => string;
  notice: string;
};

export function SettingsWorkspace(props: SettingsWorkspaceProps) {
  return (
    <View class="absolute left-[10px] top-[27px] w-[340px] h-[190px] flex-col">
      <View class="h-[20px] flex-row items-center justify-between">
        <Text class="text-sm font-bold text-[#3ECFFF]">SYSTEM SETTINGS</Text>
        <Text class="text-xs text-[#D8E8FF] transition-colors duration-200">L1 ◀ {props.categories[props.category]} ▶ R1</Text>
      </View>
      <Text class="text-xs text-[#00FF99]">{props.selected + 1}/{props.rows.length} ITEMS</Text>
      <Index each={props.rows.slice(Math.max(0, Math.min(props.selected - 1, props.rows.length - 4)), Math.max(0, Math.min(props.selected - 1, props.rows.length - 4)) + 4)}>{(item, visibleIndex) => {
        const index = visibleIndex + Math.max(0, Math.min(props.selected - 1, props.rows.length - 4));
        const focused = () => index === props.selected;
        return (
          <View class={focused() ? "h-[20px] flex-row items-center bg-[#102B3A] transition-colors duration-150" : "h-[20px] flex-row items-center transition-colors duration-150"}>
            <Text class="text-sm font-bold w-[18px] text-[#3ECFFF]">{focused() ? "▶" : " "}</Text>
            <Text class={focused() ? "text-sm font-bold w-[175px] text-[#D8E8FF]" : "text-sm w-[175px] text-[#D8E8FF]"}>{item().label}</Text>
            <Text class="text-xs font-mono text-[#00FF99]">{props.value(item())}</Text>
          </View>
        );
      }}</Index>
      <Text class="text-xs text-[#D8E8FF]">{props.detail(props.rows[props.selected])}</Text>
      <Text class="text-xs text-[#D8E8FF]">↑↓ ITEM · ←→ VALUE · A APPLY · B BACK · START WORKSPACE · SELECT INPUT</Text>
      <Text class="text-xs text-[#FFB400]">{props.notice}</Text>
    </View>
  );
}
