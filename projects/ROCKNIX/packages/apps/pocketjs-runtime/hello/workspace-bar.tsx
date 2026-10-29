import { For, createMemo } from "solid-js";
import { View } from "@pocketjs/framework/solid/components";

type Workspace = {
  id: string;
  icon: string;
};

type WorkspaceIcon = "\uf11b" | "\uf07b" | "\uf044" | "\uf201" | "\uf15c";

const PIXEL_GLYPHS: Record<WorkspaceIcon, readonly string[]> = {
  "\uf11b": ["00111100", "01111110", "01011010", "11111111", "11111111", "11100111", "01111110", "00111100"],
  "\uf07b": ["00000000", "00110000", "01111000", "11111110", "11111111", "11111111", "11111111", "00000000"],
  "\uf044": ["00000010", "00000110", "00001110", "00011110", "00111010", "01110010", "11100010", "11111110"],
  "\uf201": ["00000000", "01100110", "01100110", "01100110", "01100110", "01100110", "01111110", "00000000"],
  "\uf15c": ["11111110", "10000010", "10111010", "10101010", "10111010", "10000010", "11111110", "00000000"],
};

const workspacePixels = (icon: WorkspaceIcon) => PIXEL_GLYPHS[icon].map((row) => [...row].map((pixel) => pixel === "1"));

export function WorkspaceBar(props: { workspaces: readonly Workspace[]; activeId: string }) {
  const workspaces = createMemo(() => props.workspaces.flatMap((workspace) => {
    if (!(workspace.icon in PIXEL_GLYPHS)) return [];
    return [{ workspace, pixels: workspacePixels(workspace.icon as WorkspaceIcon) }];
  }));

  return (
    <View class="w-[360px] h-[12px] flex-row items-center justify-between">
      <View class="h-[12px] flex-row items-center">
        <For each={workspaces()}>{({ workspace, pixels }) => {
          const active = () => props.activeId === workspace.id;
          return (
            <View class={active() ? "w-[12px] h-[12px] items-center justify-center bg-[#102B3A] transition-colors duration-150" : "w-[12px] h-[12px] items-center justify-center"}>
              <View class="w-[8px] h-[8px] flex-col">
                <For each={pixels}>{(row) => (
                  <View class="w-[8px] h-[1px] flex-row">
                    <For each={row}>{(pixel) => (
                      <View class={pixel ? (active() ? "w-[1px] h-[1px] bg-[#3ECFFF] transition-colors duration-150" : "w-[1px] h-[1px] bg-[#64748B] transition-colors duration-150") : "w-[1px] h-[1px]"} />
                    )}</For>
                  </View>
                )}</For>
              </View>
            </View>
          );
        }}</For>
      </View>
      <View class="h-[12px] flex-row items-center" />
    </View>
  );
}
