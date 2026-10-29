import { For } from "solid-js";
import { View } from "@pocketjs/framework/solid/components";

const WORKSPACES = [
  ["00011000", "00111100", "01111110", "11011011", "11111111", "00011000", "00100100", "01000010"],
  ["00111100", "01100110", "11000011", "10000001", "10000001", "11000011", "01100110", "00111100"],
  ["00000010", "00000110", "00001110", "00011110", "00111010", "01110010", "11100010", "11111110"],
  ["00111100", "01111110", "11000011", "10011001", "10000001", "11000011", "01111110", "00111100"],
  ["11111110", "10000010", "10111010", "10101010", "10111010", "10000010", "11111110", "00000000"],
] as const;
const WORKSPACE_IDS = ["apps", "files", "vim", "top", "log"] as const;

const WORKSPACE_PIXELS = WORKSPACES.map((rows) => rows.map((row) => [...row].map((pixel) => pixel === "1")));

export function WorkspaceBar(props: { activeIndex: number }) {
  return (
    <View class="w-[360px] h-[12px] flex-row items-center justify-between">
      <View class="h-[12px] flex-row items-center">
        <For each={WORKSPACE_IDS}>{(workspaceId, index) => (
          <View class="w-[12px] h-[12px] items-center justify-center">
            <View class="w-[8px] h-[8px] flex-col">
              <For each={WORKSPACE_PIXELS[index()]}>{(row) => (
                <View class="w-[8px] h-[1px] flex-row">
                  <For each={row}>{(activePixel) => (
                    <View class={activePixel ? (props.activeIndex === index() ? "w-[1px] h-[1px] bg-[#3ECFFF] transition-colors duration-150" : "w-[1px] h-[1px] bg-[#64748B] transition-colors duration-150") : "w-[1px] h-[1px]"} />
                  )}</For>
                </View>
              )}</For>
            </View>
          </View>
        )}</For>
      </View>
      <View class="h-[12px] flex-row items-center" />
    </View>
  );
}
