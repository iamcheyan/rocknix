import { For, createMemo } from "solid-js";
import { View } from "@pocketjs/framework/solid/components";

type WorkspaceId = "apps" | "files" | "vim" | "top" | "log";
type Workspace = { id: WorkspaceId; glyph: readonly string[] };

export function WorkspaceBar(props: { workspaces: readonly Workspace[]; activeId: WorkspaceId }) {
  const workspaces = createMemo(() => props.workspaces.map((workspace) => ({ workspace, pixels: workspace.glyph.map((row) => [...row].map((pixel) => pixel === "1")) })));
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
