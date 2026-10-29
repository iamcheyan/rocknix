import { Index } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";

export type LibraryRow =
  | { kind: "scan" }
  | { kind: "header"; section: string; count: number }
  | { kind: "item"; section: string; group: string; title: string; path: string };

export type LibraryWorkspaceProps = {
  rows: readonly LibraryRow[];
  selected: number;
  scanning: boolean;
  notice: string;
  total: number;
  labels: { title: string; scan: string; empty: string; hint: string };
};

const VISIBLE = 7;

const sectionLabel = (section: string) => section.toUpperCase();

export function LibraryWorkspace(props: LibraryWorkspaceProps) {
  const rawStart = () => props.selected - 1;
  const maxStart = () => Math.max(0, props.rows.length - VISIBLE);
  const start = () => Math.max(0, Math.min(rawStart(), maxStart()));
  const shown = () => props.rows.slice(start(), start() + VISIBLE);
  const focusedRow = () => props.rows[props.selected];
  const detail = () => {
    const row = focusedRow();
    if (!row) return props.notice;
    if (row.kind === "scan") return props.labels.scan;
    if (row.kind === "header") return `${sectionLabel(row.section)} · ${row.count}`;
    return `${row.section} / ${row.group} / ${row.title}`;
  };
  return (
    <View class="absolute left-[10px] top-[27px] w-[340px] h-[192px] flex-col">
      <View class="h-[20px] flex-row items-center justify-between">
        <Text class="text-sm font-bold text-[#3ECFFF]">{props.labels.title}</Text>
        <Text class="text-xs text-[#D8E8FF]">{props.scanning ? "SCANNING" : `${props.total}`}</Text>
      </View>
      <View class={props.selected === 0 ? "w-[340px] h-[18px] flex-row items-center bg-[#102B3A]" : "w-[340px] h-[18px] flex-row items-center"}>
        <Text class={props.selected === 0 ? "text-xs font-mono text-[#00FF99]" : "text-xs font-mono text-[#64748B]"}>
          {props.selected === 0 ? "> " : "  "}{props.labels.scan}
        </Text>
      </View>
      {props.rows.length === 0 ? (
        <Text class="text-xs text-[#FFB400]">{props.labels.empty}</Text>
      ) : (
        <Index each={shown()}>{(row, offset) => {
          const focused = () => start() + offset + 1 === props.selected;
          const item = row();
          if (item.kind === "header") {
            return (
              <View class={focused() ? "w-[340px] h-[18px] flex-row items-center bg-[#102B3A]" : "w-[340px] h-[18px] flex-row items-center"}>
                <Text class={focused() ? "text-xs font-bold text-[#3ECFFF]" : "text-xs font-bold text-[#64748B]"}>
                  {focused() ? "> " : "  "}{sectionLabel(item.section)} {item.count}
                </Text>
              </View>
            );
          }
          const entry = item as { group: string; title: string };
          return (
            <View class={focused() ? "w-[340px] h-[18px] flex-row items-center bg-[#102B3A]" : "w-[340px] h-[18px] flex-row items-center"}>
              <Text class={focused() ? "text-xs font-mono text-[#3ECFFF]" : "text-xs font-mono text-[#64748B]"}>
                {focused() ? "  > " : "    "}{entry.group.slice(0, 5)}
              </Text>
              <Text class="text-xs font-mono text-[#D8E8FF]">{entry.title}</Text>
            </View>
          );
        }}</Index>
      )}
      <Text class="text-xs text-[#D8E8FF]">{detail()}</Text>
      <Text class="text-xs text-[#00FF99]">{props.notice}</Text>
      <Text class="text-xs text-[#64748B]">{props.labels.hint}</Text>
    </View>
  );
}
