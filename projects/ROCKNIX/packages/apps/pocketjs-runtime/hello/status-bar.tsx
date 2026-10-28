import { View, Text } from "@pocketjs/framework/solid/components";
import { Index } from "solid-js";

export interface StatusBarProps {
  currentScreen: number;
  wifiConnected: boolean;
  ipAddress: string;
  bluetoothOn: boolean;
  batteryLevel: number;
}

const TAB_NAMES = ["HOME", "MEDIA", "GAMES", "SETTINGS", "SYSTEM"];

export function StatusBar(props: StatusBarProps) {
  const batteryKnown = () => props.batteryLevel >= 0;
  const batteryIcon = () => {
    const level = props.batteryLevel;
    if (!batteryKnown()) return "\uf244";
    if (level >= 90) return "\uf240";
    if (level >= 65) return "\uf241";
    if (level >= 40) return "\uf242";
    if (level >= 15) return "\uf243";
    return "\uf244";
  };

  return (
    <View class="w-[360px] h-[22px] bg-[#0c131a] flex-col justify-between">
      <View class="w-[360px] h-[21px] flex-row items-center justify-between px-2">
        {/* Left: Wi-Fi, Bluetooth, IP */}
        <View class="flex-row items-center gap-1">
          <Text class={props.wifiConnected ? "text-xs text-emerald-400" : "text-xs text-slate-600"}>
            {"\uf1eb"}
          </Text>
          <Text class={props.bluetoothOn ? "text-xs text-sky-400" : "text-xs text-slate-600"}>
            {"\uf293"}
          </Text>
          <Text class="text-xs font-mono text-slate-300">
            {props.wifiConnected ? props.ipAddress : "--"}
          </Text>
        </View>

        {/* Center: Switch 5-screen tabs */}
        <View class="flex-row items-center gap-1">
          <Index each={TAB_NAMES}>
            {(name, index) => (
              <View
                class={
                  props.currentScreen === index
                    ? "px-1 h-[16px] items-center justify-center rounded-sm bg-[#164e63] border border-[#38bdf8]"
                    : "px-1 h-[16px] items-center justify-center rounded-sm bg-transparent"
                }
              >
                <Text
                  class={
                    props.currentScreen === index
                      ? "text-xs font-bold text-[#38bdf8]"
                      : "text-xs font-bold text-slate-500"
                  }
                >
                  {name()}
                </Text>
              </View>
            )}
          </Index>
        </View>

        {/* Right: Battery */}
        <View class="flex-row items-center gap-1">
          <Text class={!batteryKnown() ? "text-xs text-slate-600" : props.batteryLevel > 20 ? "text-xs text-emerald-400" : "text-xs text-amber-400"}>
            {batteryIcon()}
          </Text>
          <Text class="text-xs font-mono text-slate-300">
            {batteryKnown() ? `${props.batteryLevel}%` : "--"}
          </Text>
        </View>
      </View>
      {/* 1px clean bottom divider line */}
      <View class="w-[360px] h-[1px] bg-[#1f2d3d]" />
    </View>
  );
}
