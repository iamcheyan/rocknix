// Terminal workspace — the PTY side of the handheld, unchanged from the
// pre-V2 launcher.
//
// The launcher view is a native Solid tree; the terminal is a 12x46 character
// grid driven by `ui.__pocketshell` (RESIZE / SNAP / ACTIVATE / KEY / TEXT),
// with an on-screen input workspace. Both behaviours were verified on the
// RG34XX, so they move into their own module rather than being rewritten: V2
// changes the home screen, not the shell.

import { Index, createSignal, onMount, type Accessor, type JSX as SolidJSX } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { BTN, onTextEvent, type TextEvent } from "@pocketjs/framework/input";
import { onFrame } from "@pocketjs/framework/lifecycle";
import { COLORS } from "./theme";
import { JA } from "./strings";

const WORKSPACES = [
  { id: "apps", glyph: ["00111100", "01111110", "01011010", "11111111", "11111111", "11100111", "01111110", "00111100"] },
  { id: "files", glyph: ["00000000", "00110000", "01111000", "11111110", "11111111", "11111111", "11111111", "00000000"] },
  { id: "vim", glyph: ["00000010", "00000110", "00001110", "00011110", "00111010", "01110010", "11100010", "11111110"] },
  { id: "top", glyph: ["00000000", "01100110", "01100110", "01100110", "01100110", "01100110", "01111110", "00000000"] },
  { id: "log", glyph: ["11111110", "10000010", "10111010", "10101010", "10111010", "10000010", "11111110", "00000000"] },
] as const;
const NAMES = ["APPS", "FILES", "VIM", "TOP", "LOG"];
const LOG_WORKSPACE = 4;
const ROWS = 12;
const COLS = 46;

type Run = { text: string; fg: number; bg: number; flags: number };
type HostUi = { __pocketshell?: (command: string) => string };

const abgr = (rgb: number) => {
  const r = rgb & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 16) & 0xff;
  return (((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0);
};

const emptyRows = (): Run[][] => Array.from({ length: ROWS }, () => []);

/** The terminal view's props; the shell renders it while `active()` holds. */
export interface TerminalViewProps {
  workspace: number;
  lines: readonly (readonly Run[])[];
  cursor: { row: number; col: number; visible: boolean };
  input: string;
  inputOpen: boolean;
  commandOpen: boolean;
}

export type TerminalWorkspace = {
  /** True while the terminal owns input (the launcher view is hidden). */
  active: Accessor<boolean>;
  /** Show the terminal; `workspace` selects which PTY (0 = shell). */
  show: (workspace?: number) => void;
  /** Return to the launcher home. */
  hide: () => void;
  /** The terminal view, rendered by the shell when `active()` is true. */
  view: () => SolidJSX.Element;
};

/** Create the terminal workspace. Frame and text hooks are installed once. */
export function createTerminalWorkspace(): TerminalWorkspace {
  const host = (globalThis as typeof globalThis & { ui?: HostUi }).ui;
  const send = (command: string) => host?.__pocketshell?.(command) ?? "";

  const [open, setOpen] = createSignal(false);
  const [workspace, setWorkspace] = createSignal(0);
  const [lines, setLines] = createSignal<Run[][]>(emptyRows());
  const [cursor, setCursor] = createSignal({ row: 0, col: 0, visible: false });
  const [input, setInput] = createSignal("");
  const [commandOpen, setCommandOpen] = createSignal(false);
  const [inputOpen, setInputOpen] = createSignal(false);

  const applyRows = (payload: string) => {
    if (!payload) return;
    const changed = new Map<number, Run[]>();
    let nextCursor: { row: number; col: number; visible: boolean } | null = null;
    for (const record of payload.split("\n")) {
      if (!record) continue;
      const fields = record.split("\t");
      if (fields[0] === "C") {
        nextCursor = { row: Number(fields[1]) || 0, col: Number(fields[2]) || 0, visible: fields[3] === "1" };
        continue;
      }
      if (fields[0] !== "L") continue;
      const row = Number(fields[1]);
      if (!Number.isInteger(row) || row < 0 || row >= ROWS) continue;
      const runs: Run[] = [];
      for (const field of fields.slice(2)) {
        const parts = field.split(":");
        if (parts.length < 4) continue;
        const text = parts.slice(3).join(":").replace(/\\t/g, "    ").replace(/\\n/g, "").replace(/\\\\/g, "\\");
        if (!text) continue;
        runs.push({ text, fg: parseInt(parts[0], 16), bg: parseInt(parts[1], 16), flags: Number(parts[2]) || 0 });
      }
      changed.set(row, runs);
    }
    if (changed.size > 0) setLines((old) => old.map((runs, index) => changed.get(index) ?? runs));
    if (nextCursor) setCursor(nextCursor);
  };

  const switchTo = (id: number) => {
    const next = (id + NAMES.length) % NAMES.length;
    if (next === workspace()) return;
    setWorkspace(next);
    setLines(emptyRows());
    setCursor({ row: 0, col: 0, visible: false });
    send(`ACTIVATE\t${next}`);
    applyRows(send(`SNAP\t${next}`));
  };

  const sendKey = (key: string) => send(`${workspace()}\tKEY ${key}`);

  const submitInput = () => {
    const value = input().trim();
    if (value) {
      send(`${workspace()}\tTEXT ${value}`);
      send(`${workspace()}\tKEY ENTER`);
    }
    setInput("");
    setCommandOpen(false);
  };

  const show = (target = 0) => {
    const next = (target + NAMES.length) % NAMES.length;
    setWorkspace(next);
    send(`ACTIVATE\t${next}`);
    applyRows(send(`SNAP\t${next}`));
    setOpen(true);
  };

  const hide = () => {
    setOpen(false);
    setInputOpen(false);
    setCommandOpen(false);
  };

  const runColor = (run: Run) =>
    (run.flags & 2) !== 0
      ? { textColor: abgr(run.bg), bgColor: abgr(run.fg) }
      : { textColor: abgr(run.fg), bgColor: abgr(run.bg) };

  // The panel has no block-cursor primitive, so the cursor is drawn as an
  // inverted cell inside the row's runs.
  const withCursor = (runs: Run[], row: number): Run[] => {
    const c = cursor();
    if (!c.visible || c.row !== row) return runs;
    const out: Run[] = [];
    let col = 0;
    for (const run of runs) {
      const chars = [...run.text];
      const start = col;
      col += chars.length;
      if (c.col < start || c.col >= col) { out.push(run); continue; }
      const offset = c.col - start;
      if (offset > 0) out.push({ ...run, text: chars.slice(0, offset).join("") });
      out.push({ ...run, text: chars[offset], flags: run.flags ^ 2 });
      if (offset + 1 < chars.length) out.push({ ...run, text: chars.slice(offset + 1).join("") });
    }
    if (c.col >= col) out.push({ text: " ", fg: 0xe5e5e5, bg: 0xe5e5e5, flags: 0 });
    return out;
  };

  const TerminalView = (): SolidJSX.Element => (
    <View class="absolute left-0 top-0" style={{ width: 360, height: 240, bgColor: COLORS.bg }}>
      <View class="absolute flex-row items-center" style={{ insetL: 6, insetT: 2, width: 348, height: 12 }}>
        <Index each={NAMES}>{(name, index) => (
          <View class="flex-col items-center" style={{ marginR: 6, width: 12, height: 10, bgColor: index === workspace() ? COLORS.highlight : COLORS.surface }}>
            <Text class="text-2xs" style={{ textColor: index === workspace() ? COLORS.bg : COLORS.textDim }}>{name().slice(0, 1)}</Text>
          </View>
        )}</Index>
      </View>
      <View class="absolute flex-col" style={{ insetL: 6, insetT: 18, width: 348, height: 192 }}>
        <Index each={lines()}>{(runs, rowIndex) => (
          <View class="flex-row" style={{ width: 348, height: 16 }}>
            <Index each={withCursor(runs(), rowIndex)}>
              {(run) => {
                const paint = runColor(run());
                return <Text class="text-xs font-mono" style={{ textColor: paint.textColor, bgColor: paint.bgColor }}>{run().text}</Text>;
              }}
            </Index>
          </View>
        )}</Index>
        {commandOpen() ? (
          <View class="absolute" style={{ insetL: 0, insetT: 176, width: 348, height: 16, bgColor: COLORS.surfaceRaised }}>
            <Text class="text-xs font-mono" style={{ textColor: COLORS.text }}>{": " + input() + "█"}</Text>
          </View>
        ) : null}
      </View>
      <View class="absolute" style={{ insetL: 6, insetT: 220, width: 348, height: 12 }}>
        <Text class="text-2xs" style={{ textColor: COLORS.textDim }}>
          {inputOpen() ? JA.hints.cancel : `${JA.hints.start} / ${JA.hints.cancel}`}
        </Text>
      </View>
      {inputOpen() ? (
        <View class="absolute left-0 top-0 flex-col" style={{ width: 360, height: 240, bgColor: COLORS.bg }}>
          <View class="absolute" style={{ insetL: 6, insetT: 4, width: 348, height: 20 }}>
            <Text class="text-sm font-bold" style={{ textColor: COLORS.highlight }}>{"INPUT"}</Text>
          </View>
          <View class="absolute" style={{ insetL: 6, insetT: 28, width: 348, height: 16, bgColor: COLORS.surfaceRaised }}>
            <Text class="text-xs font-mono" style={{ textColor: COLORS.text }}>{"> " + input() + "█"}</Text>
          </View>
          <View class="absolute" style={{ insetL: 6, insetT: 220, width: 348, height: 12 }}>
            <Text class="text-2xs" style={{ textColor: COLORS.textDim }}>{"A ENTER  B CLOSE"}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  onMount(() => {
    send(`RESIZE\t${ROWS}x${COLS}`);
    for (let id = 0; id < NAMES.length; id++) send(`${id}\tSTART`);
  });

  let armed = false;
  let previous = 0;
  onFrame((buttons: number) => {
    if (buttons === 0) armed = true;
    const global = globalThis as typeof globalThis & { __pocketshellOutput?: string };
    const payload = global.__pocketshellOutput ?? "";
    if (payload) { delete global.__pocketshellOutput; applyRows(payload); }
    if (!open() || !armed) { if (!armed) previous = buttons; return; }
    if (workspace() === LOG_WORKSPACE && !inputOpen()) applyRows(send(`SNAP\t${LOG_WORKSPACE}`));
    const pressed = buttons & ~previous;
    previous = buttons;

    if (inputOpen()) {
      if (pressed & BTN.CIRCLE) submitInput();
      if (pressed & BTN.CROSS) setInputOpen(false);
      return;
    }
    if (pressed & BTN.LEFT) switchTo(workspace() - 1);
    if (pressed & BTN.RIGHT) switchTo(workspace() + 1);
    if (pressed & BTN.LTRIGGER) sendKey("PGUP");
    if (pressed & BTN.RTRIGGER) sendKey("PGDN");
    if (pressed & BTN.UP) sendKey("UP");
    if (pressed & BTN.DOWN) sendKey("DOWN");
    if (pressed & BTN.CIRCLE) sendKey("ENTER");
    if (pressed & BTN.CROSS) hide();
    if (pressed & BTN.START) switchTo(workspace() + 1);
    if (pressed & BTN.SELECT) { setInput(""); setInputOpen(true); }
  });

  onTextEvent((event: TextEvent) => {
    if (!open()) return false;
    if (event.kind === "commit") {
      if (inputOpen() || commandOpen()) setInput((value) => value + event.text);
      else if (workspace() < LOG_WORKSPACE) send(`${workspace()}\tTEXT ${event.text}`);
      return true;
    }
    if (event.kind !== "key" || !event.pressed) return false;
    if (event.key === "Escape") {
      if (inputOpen()) setInputOpen(false);
      else if (commandOpen()) { setCommandOpen(false); setInput(""); }
      else hide();
      return true;
    }
    if (inputOpen() || commandOpen()) {
      if (event.key === "Backspace") setInput((value) => value.slice(0, -1));
      else if (event.key === "Enter") submitInput();
      return true;
    }
    const key = event.key.replace(/^Control\+/, "CTRL_").toUpperCase();
    if (["ENTER", "BACKSPACE", "ARROWUP", "ARROWDOWN", "ARROWLEFT", "ARROWRIGHT", "TAB", "ESC", "CTRL_C", "CTRL_D", "CTRL_L", "HOME", "END"].includes(key)) {
      sendKey(key.replace("ARROW", ""));
    }
    return true;
  });

  return { active: open, show, hide, view: TerminalView };
}

export { WORKSPACES };
