import { View, Text } from "@pocketjs/framework/solid/components";
import { Index } from "solid-js";

export interface SettingsState {
  selectedIndex: number;
  brightness: number;
  volume: number;
  wifi: boolean;
  bluetooth: boolean;
  timeoutIndex: number;
  services: Record<string, boolean>;
}

export const TIMEOUT_OPTIONS = [
  { label: "10s", value: "10s" },
  { label: "30s", value: "30s" },
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "30m", value: "30m" },
  { label: "1h", value: "1h" },
  { label: "Never", value: "never" },
];

export const SERVICE_KEYS = [
  { key: "ssh", name: "SSH Remote Shell" },
  { key: "samba", name: "Samba Windows Share" },
  { key: "syncthing", name: "Syncthing File Sync" },
  { key: "adbusb", name: "ADB over USB" },
  { key: "avahi", name: "Avahi mDNS Discovery" },
  { key: "http", name: "HTTP Web Server" },
  { key: "ftp", name: "FTP File Transfer" },
  { key: "rsyncd", name: "Rsync Daemon" },
  { key: "telnet", name: "Telnet Console" },
  { key: "pocketshell-dev", name: "PocketShell DevBridge" },
];

export function SettingsPage(props: { state: SettingsState }) {
  const allRows = [
    { type: "brightness", label: "Brightness" },
    { type: "volume", label: "Volume" },
    { type: "wifi", label: "Wi-Fi" },
    { type: "bluetooth", label: "Bluetooth" },
    { type: "timeout", label: "Screen Timeout" },
    ...SERVICE_KEYS.map((s) => ({ type: "service", key: s.key, label: s.name })),
    { type: "legacy", label: "Advanced Settings" },
  ];

  const visibleWindow = () => {
    const sel = props.state.selectedIndex;
    const maxStart = Math.max(0, allRows.length - 6);
    const start = Math.max(0, Math.min(maxStart, sel - 2));
    return allRows.slice(start, start + 6).map((item, i) => ({ ...item, realIndex: start + i }));
  };

  const renderProgressBar = (value: number) => {
    const filled = Math.round(value / 10);
    const empty = 10 - filled;
    return `[${"=".repeat(filled)}${" ".repeat(empty)}]`;
  };

  return (
    <View class="w-[360px] h-[184px] px-2 py-1 flex-col justify-between">
      {/* Category Header */}
      <View class="flex-col gap-1 w-full">
        <View class="flex-row items-center justify-between w-full">
          <Text class="text-xs font-bold text-[#38bdf8]">
            {"\uf013"} SYSTEM SETTINGS 系统设置
          </Text>
          <Text class="text-xs text-slate-400 font-mono">
            {props.state.selectedIndex + 1} / {allRows.length}
          </Text>
        </View>
        <View class="w-[344px] h-[1px] bg-[#1e2d3d]" />
      </View>

      {/* Settings Rows */}
      <View class="flex-col gap-1 w-full">
        <Index each={visibleWindow()}>
          {(row) => {
            const isSelected = () => props.state.selectedIndex === row().realIndex;
            return (
              <View
                class={
                  isSelected()
                    ? "w-[344px] h-[23px] px-2 rounded-md flex-row items-center justify-between bg-[#1e3042] border border-[#38bdf8]"
                    : "w-[344px] h-[23px] px-2 rounded-md flex-row items-center justify-between bg-[#14202c] border border-[#273a4b]"
                }
              >
                {/* Left: Label */}
                <Text
                  class={
                    isSelected()
                      ? "text-xs font-bold text-white"
                      : "text-xs font-bold text-slate-300"
                  }
                >
                  {row().label}
                </Text>

                {/* Right: Value Widget */}
                {row().type === "brightness" ? (
                  <View class="flex-row items-center gap-1">
                    <Text class="text-xs font-mono text-cyan-300">
                      {`${renderProgressBar(props.state.brightness)} ${props.state.brightness}%`}
                    </Text>
                  </View>
                ) : row().type === "volume" ? (
                  <View class="flex-row items-center gap-1">
                    <Text class="text-xs font-mono text-cyan-300">
                      {`${renderProgressBar(props.state.volume)} ${props.state.volume}%`}
                    </Text>
                  </View>
                ) : row().type === "wifi" ? (
                  <View
                    class={
                      props.state.wifi
                        ? "px-2 h-[15px] rounded-sm items-center justify-center bg-emerald-900 border border-emerald-400"
                        : "px-2 h-[15px] rounded-sm items-center justify-center bg-slate-800"
                    }
                  >
                    <Text
                      class={
                        props.state.wifi
                          ? "text-xs font-bold text-emerald-300"
                          : "text-xs font-bold text-slate-500"
                      }
                    >
                      {props.state.wifi ? "ON 开启" : "OFF 关闭"}
                    </Text>
                  </View>
                ) : row().type === "bluetooth" ? (
                  <View
                    class={
                      props.state.bluetooth
                        ? "px-2 h-[15px] rounded-sm items-center justify-center bg-sky-900 border border-sky-400"
                        : "px-2 h-[15px] rounded-sm items-center justify-center bg-slate-800"
                    }
                  >
                    <Text
                      class={
                        props.state.bluetooth
                          ? "text-xs font-bold text-sky-300"
                          : "text-xs font-bold text-slate-500"
                      }
                    >
                      {props.state.bluetooth ? "ON 开启" : "OFF 关闭"}
                    </Text>
                  </View>
                ) : row().type === "timeout" ? (
                  <View class="flex-row items-center gap-1">
                    <Text class="text-xs font-mono text-cyan-300">
                      {`[ ${TIMEOUT_OPTIONS[props.state.timeoutIndex].label} ]`}
                    </Text>
                  </View>
                ) : row().type === "service" ? (
                  <View
                    class={
                      props.state.services[(row() as any).key]
                        ? "px-2 h-[15px] rounded-sm items-center justify-center bg-emerald-900 border border-emerald-400"
                        : "px-2 h-[15px] rounded-sm items-center justify-center bg-slate-800"
                    }
                  >
                    <Text
                      class={
                        props.state.services[(row() as any).key]
                          ? "text-xs font-bold text-emerald-300"
                          : "text-xs font-bold text-slate-500"
                      }
                    >
                      {props.state.services[(row() as any).key] ? "ENABLED 开启" : "DISABLED 关闭"}
                    </Text>
                  </View>
                ) : (
                  <Text class="text-xs font-bold text-amber-300">
                    PRESS A 打开
                  </Text>
                )}
              </View>
            );
          }}
        </Index>
      </View>

      {/* Control hints */}
      <View class="flex-col gap-1 w-full">
        <View class="w-[344px] h-[1px] bg-[#1e2d3d]" />
        <View class="flex-row items-center justify-between w-full">
          <Text class="text-xs text-slate-500">
            方向键选择 · A 切换 · B 返回
          </Text>
          <Text class="text-xs text-[#38bdf8] font-mono">
            SLEEP runtime.conf
          </Text>
        </View>
      </View>
    </View>
  );
}
