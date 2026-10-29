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

// PocketJS evaluates a row's `class`/`style` once, when the node is created, so a
// conditional background or text colour keeps its first value and a highlight bar
// cannot follow the selection. Selection is therefore carried by the row's text,
// which is a live binding: a ">" marker in the gutter plus the detail line.
const BG = 0xff170602;
const BG_FOCUSED = 0xff3a2b10;
const FG_IDLE = 0xff8b7464;
const FG_FOCUSED = 0xffffcf3e;
const FG_ACCENT = 0xff99ff00;
const FG_TEXT = 0xffffe8d8;
const FG_HEADER = 0xffffcf3e;
const FG_HEADER_IDLE = 0xffb8a394;
const FG_EMPTY = 0xffffb400;

// The list never contains the Scan row (it is rendered separately), so the row
// type can exclude it and keep TypeScript narrowing on `kind`.
type ShownRow = { row: LibraryRow; focused: boolean };

export function LibraryWorkspace(props: LibraryWorkspaceProps) {
  // selected 0 is the Scan row; selected n>=1 addresses rows[n-1]. The list, the
  // detail line and the launcher all use this one mapping.
  const start = () => Math.max(0, Math.min(props.selected - 1, Math.max(0, props.rows.length - VISIBLE)));
  const scanFocused = () => props.selected === 0;
  const shown = (): ShownRow[] => props.rows
    .slice(start(), start() + VISIBLE)
    .map((row, offset) => ({ row, focused: start() + offset + 1 === props.selected }));
  const focusedRow = () => (props.selected <= 0 ? undefined : props.rows[props.selected - 1]);
  const detail = () => {
    if (props.selected === 0) return props.labels.scan;
    const row = focusedRow();
    if (!row) return props.notice;
    if (row.kind === "scan") return props.labels.scan;
    if (row.kind === "header") return `${sectionLabel(row.section)} · ${row.count}`;
    return `${row.section} / ${row.group} / ${row.title}`;
  };
  return (
    <View class="absolute left-[10px] top-[27px] w-[340px] h-[192px] flex-col">
      <View class="h-[20px] flex-row items-center justify-between">
        <Text class="text-sm font-bold" style={{ textColor: FG_HEADER }}>{props.labels.title}</Text>
        <Text class="text-xs" style={{ textColor: FG_TEXT }}>{props.scanning ? "SCANNING" : `${props.total}`}</Text>
      </View>
      <View class="w-[340px] h-[18px] flex-row items-center">
        <Text class="text-xs font-mono" style={{ textColor: FG_ACCENT }}>{scanFocused() ? "> " : "  "}{props.labels.scan}</Text>
      </View>
      {props.rows.length === 0 ? (
        <Text class="text-xs" style={{ textColor: FG_EMPTY }}>{props.labels.empty}</Text>
      ) : (
        <Index each={shown()}>{(entry) => {
          const row = entry().row;
          const focused = () => entry().focused;
          if (row.kind === "header") {
            return (
              <View class="w-[340px] h-[18px] flex-row items-center">
                <Text class="text-xs font-bold" style={{ textColor: FG_HEADER }}>{focused() ? "> " : "  "}{sectionLabel(row.section)} {row.count}</Text>
              </View>
            );
          }
          if (row.kind !== "item") return <View class="w-[340px] h-[18px]" />;
          return (
            <View class="w-[340px] h-[18px] flex-row items-center">
              <Text class="text-xs font-mono" style={{ textColor: FG_FOCUSED }}>{focused() ? "  > " : "    "}{row.group.slice(0, 5)}</Text>
              <Text class="text-xs font-mono" style={{ textColor: FG_TEXT }}>{row.title}</Text>
            </View>
          );
        }}</Index>
      )}
      <Text class="text-xs" style={{ textColor: FG_TEXT }}>{detail()}</Text>
      <Text class="text-xs" style={{ textColor: FG_ACCENT }}>{props.notice}</Text>
      <Text class="text-xs" style={{ textColor: FG_IDLE }}>{props.labels.hint}</Text>
    </View>
  );
}
