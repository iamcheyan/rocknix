import { View, Text } from "@pocketjs/framework/solid/components";
import { Index } from "solid-js";
import type { LauncherApp } from "../launcher-catalog";

export interface SystemPageProps {
  selectedToolIndex: number;
  systemTools: LauncherApp[];
  ipAddress: string;
}

export function SystemPage(props: SystemPageProps) {
  return (
    <View class="w-[360px] h-[184px] px-2 py-1 flex-col justify-between">
      {/* Header */}
      <View class="flex-col gap-1 w-full">
        <View class="flex-row items-center justify-between w-full">
          <Text class="text-xs font-bold text-[#38bdf8]">
            {"\uf2db"} SYSTEM INFORMATION 系统信息
          </Text>
          <Text class="text-xs text-slate-400 font-mono">
            Anbernic RG34XX · H700 DDR4
          </Text>
        </View>
        <View class="w-[344px] h-[1px] bg-[#1e2d3d]" />
      </View>

      {/* Hardware / System Grid */}
      <View class="flex-col gap-1 w-full">
        <View class="flex-row gap-1 w-full">
          {/* CPU Card */}
          <View class="flex-1 bg-[#14202c] border border-[#273a4b] rounded-md p-1 flex-col justify-between h-[42px]">
            <View class="flex-row items-center justify-between">
              <Text class="text-xs font-bold text-sky-400">{"\uf2db"} CPU</Text>
              <Text class="text-xs font-mono text-slate-400">4-Core A53</Text>
            </View>
            <Text class="text-xs font-mono text-white">Allwinner H700 @ 1.5GHz</Text>
          </View>

          {/* Memory Card */}
          <View class="flex-1 bg-[#14202c] border border-[#273a4b] rounded-md p-1 flex-col justify-between h-[42px]">
            <View class="flex-row items-center justify-between">
              <Text class="text-xs font-bold text-emerald-400">{"\uf085"} RAM</Text>
              <Text class="text-xs font-mono text-slate-400">1024 MB</Text>
            </View>
            <Text class="text-xs font-mono text-white">LPDDR4 · 32% Used</Text>
          </View>
        </View>

        <View class="flex-row gap-1 w-full">
          {/* Storage Card */}
          <View class="flex-1 bg-[#14202c] border border-[#273a4b] rounded-md p-1 flex-col justify-between h-[42px]">
            <View class="flex-row items-center justify-between">
              <Text class="text-xs font-bold text-amber-400">{"\uf0a0"} STORAGE</Text>
              <Text class="text-xs font-mono text-slate-400">EXT4</Text>
            </View>
            <Text class="text-xs font-mono text-white">/storage 14.8G / 29.8G</Text>
          </View>

          {/* Network Card */}
          <View class="flex-1 bg-[#14202c] border border-[#273a4b] rounded-md p-1 flex-col justify-between h-[42px]">
            <View class="flex-row items-center justify-between">
              <Text class="text-xs font-bold text-cyan-400">{"\uf012"} NETWORK</Text>
              <Text class="text-xs font-mono text-slate-400">wlan0</Text>
            </View>
            <Text class="text-xs font-mono text-white">{props.ipAddress || "--"}</Text>
          </View>
        </View>

        {/* Kernel & OS line */}
        <View class="w-[344px] h-[20px] px-2 rounded-md bg-[#101720] border border-[#1f2d3d] flex-row items-center justify-between">
          <Text class="text-xs font-mono text-slate-400">
            OS: ROCKNIX (Linux 6.6.x aarch64)
          </Text>
          <Text class="text-xs font-mono text-emerald-400">
            Display: 720×480 (2×)
          </Text>
        </View>
      </View>

      {/* Diagnostics tools shortcuts */}
      <View class="flex-col gap-1 w-full">
        <View class="w-[344px] h-[1px] bg-[#1e2d3d]" />
        <Text class="text-xs font-bold text-slate-400">
          DIAGNOSTIC TOOLS 系统诊断工具 (◀▶ 选择 · A 启动):
        </Text>
        <View class="flex-row items-center gap-1 overflow-hidden w-[344px] h-[22px]">
          <Index each={props.systemTools}>
            {(tool, index) => {
              const isSelected = () => props.selectedToolIndex === index;
              return (
                <View
                  class={
                    isSelected()
                      ? "px-2 h-[20px] rounded-md items-center justify-center flex-row gap-1 bg-[#1e3042] border border-[#38bdf8]"
                      : "px-2 h-[20px] rounded-md items-center justify-center flex-row gap-1 bg-[#14202c] border border-[#273a4b]"
                  }
                >
                  <Text class={isSelected() ? "text-xs text-cyan-300" : "text-xs text-slate-400"}>
                    {tool().icon}
                  </Text>
                  <Text
                    class={
                      isSelected()
                        ? "text-xs font-bold text-white"
                        : "text-xs font-bold text-slate-400"
                    }
                  >
                    {tool().name}
                  </Text>
                </View>
              );
            }}
          </Index>
        </View>
      </View>
    </View>
  );
}
