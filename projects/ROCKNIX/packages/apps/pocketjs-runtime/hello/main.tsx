import { createSignal, Index, onMount } from "solid-js";
import { mount } from "@pocketjs/framework/solid";
import { ActionHandler, Text, View } from "@pocketjs/framework/solid/components";
import { BTN, onTextEvent, type TextEvent } from "@pocketjs/framework/input";
import { onFrame } from "@pocketjs/framework/lifecycle";

type HostUI = { __pocketshell?: (command: string) => string };
type Run = { text: string; fg: number; bg: number; flags: number };

const NAMES = ["SHELL", "FILES", "VIM", "TOP", "LOG"];
const LOG_WORKSPACE = 4;
// DisplayProfile: 54x24 cells at 12px mono (12x16) = 648x384 inside the 720x480 panel.
const ROWS = 24;

const abgr = (rgb: number) => {
  const r = rgb & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 16) & 0xff;
  return (((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0);
};

const emptyRow = (): Run[] => [];

mount(() => {
  const global = globalThis as typeof globalThis & { ui?: HostUI; __pocketshellOutput?: string };
  const host = global.ui;
  const [active, setActive] = createSignal(0);
  const [lines, setLines] = createSignal<Run[][]>(Array.from({ length: ROWS }, emptyRow));
  const [cursor, setCursor] = createSignal({ row: 0, col: 0, visible: false });
  const [input, setInput] = createSignal("");
  const [commandOpen, setCommandOpen] = createSignal(false);
  let armed = false;
  let previousButtons = 0;

  const send = (command: string) => host?.__pocketshell?.(command) ?? "";
  const log = (entry: string) => send(`LOG\t${entry.replace(/[\t\r\n]/g, " ").slice(0, 120)}`);

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
        const fg = parseInt(parts[0], 16);
        const bg = parseInt(parts[1], 16);
        const flags = Number(parts[2]) || 0;
        const text = parts.slice(3).join(":").replace(/\\t/g, "    ").replace(/\\n/g, "").replace(/\\\\/g, "\\");
        if (!text) continue;
        runs.push({ text, fg, bg, flags });
      }
      changed.set(row, runs);
    }
    if (changed.size > 0) {
      setLines((old) => old.map((runs, index) => changed.get(index) ?? runs));
    }
    if (nextCursor) setCursor(nextCursor);
  };

  const switchTo = (id: number) => {
    const next = (id + NAMES.length) % NAMES.length;
    if (next === active()) return;
    setActive(next);
    setLines(Array.from({ length: ROWS }, emptyRow));
    setCursor({ row: 0, col: 0, visible: false });
    send(`ACTIVATE\t${next}`);
    applyRows(send(`SNAP\t${next}`));
    log(`Workspace Activated WS${next + 1}`);
  };

  const sendKey = (key: string) => send(`${active()}\tKEY ${key}`);

  onMount(() => {
    for (let id = 0; id < NAMES.length; id++) send(`${id}\tSTART`);
    log("Workspace Created WS1..WS5");
    onTextEvent((event: TextEvent) => {
      if (event.kind === "commit") {
        if (commandOpen()) setInput((value) => value + event.text);
        else if (active() < LOG_WORKSPACE) send(`${active()}\tTEXT ${event.text}`);
        return true;
      }
      if (event.kind !== "key" || !event.pressed) return false;
      if (commandOpen()) {
        if (event.key === "Escape") { setCommandOpen(false); setInput(""); }
        else if (event.key === "Backspace") setInput((value) => value.slice(0, -1));
        else if (event.key === "Enter") {
          const value = input();
          setInput("");
          setCommandOpen(false);
          switchTo(0);
          if (value) send(`0\tTEXT ${value}`);
          send("0\tKEY ENTER");
          log("Process Input WS1");
        }
        return true;
      }
      const key = event.key.replace(/^Control\+/, "CTRL_").toUpperCase();
      if (["ENTER", "BACKSPACE", "ARROWUP", "ARROWDOWN", "ARROWLEFT", "ARROWRIGHT", "TAB", "ESC", "CTRL_C", "CTRL_D", "CTRL_L", "HOME", "END"].includes(key)) {
        sendKey(key.replace("ARROW", ""));
      }
      return true;
    });
  });

  onFrame((buttons: number) => {
    if (buttons === 0) armed = true;
    const payload = global.__pocketshellOutput ?? "";
    if (payload) {
      delete global.__pocketshellOutput;
      applyRows(payload);
    }
    if (active() === LOG_WORKSPACE && armed) applyRows(send(`SNAP\t${LOG_WORKSPACE}`));
    if (!armed) { previousButtons = buttons; return; }
    const pressed = buttons & ~previousButtons;
    previousButtons = buttons;
    if (pressed & BTN.LEFT) switchTo(active() - 1);
    if (pressed & BTN.RIGHT) switchTo(active() + 1);
    if (pressed & BTN.LTRIGGER) sendKey("PGUP");
    if (pressed & BTN.RTRIGGER) sendKey("PGDN");
    if (pressed & BTN.UP) sendKey("UP");
    if (pressed & BTN.DOWN) sendKey("DOWN");
    if (pressed & BTN.CIRCLE) { sendKey("ENTER"); log(`Process Input WS${active() + 1}`); }
    if (pressed & BTN.CROSS) { sendKey("ESC"); switchTo(0); }
    if (pressed & BTN.START) switchTo(active() + 1);
    if (pressed & BTN.SELECT) { switchTo(0); setInput(""); setCommandOpen(true); }
  });

  const runColor = (run: Run) =>
    (run.flags & 2) !== 0
      ? { textColor: abgr(run.bg), bgColor: abgr(run.fg) }
      : { textColor: abgr(run.fg), bgColor: abgr(run.bg) };

  // The panel has no block cursor primitive, so the cursor is drawn as an
  // inverted cell inside the row's runs.
  const withCursor = (runs: Run[], row: number): Run[] => {
    const c = cursor();
    if (!c.visible || c.row !== row) return runs;
    const out: Run[] = [];
    let col = 0;
    for (const run of runs) {
      const chars = [...run.text];
      const start = col;
      const end = col + chars.length;
      col = end;
      if (c.col < start || c.col >= end) { out.push(run); continue; }
      const offset = c.col - start;
      if (offset > 0) out.push({ ...run, text: chars.slice(0, offset).join("") });
      out.push({ ...run, text: chars[offset], flags: run.flags ^ 2 });
      if (offset + 1 < chars.length) out.push({ ...run, text: chars.slice(offset + 1).join("") });
    }
    if (c.col >= col) out.push({ text: " ", fg: 0xe5e5e5, bg: 0xe5e5e5, flags: 0 });
    return out;
  };

  return (
    <View class="w-[720px] h-[480px] bg-slate-950">
      <View class="absolute left-[20px] top-[8px] w-[680px] h-[31px] items-center">
        <Text class="text-base font-mono font-bold text-emerald-300">◀ WS{active() + 1}:{NAMES[active()]} ▶</Text>
      </View>

      <View class="absolute left-[20px] top-[45px] w-[648px] h-[384px] flex-col">
        <Index each={lines()}>
          {(runs, rowIndex) => (
            <View class="w-[648px] h-[16px] flex-row">
              <Index each={withCursor(runs(), rowIndex)}>
                {(run) => {
                  const c = runColor(run());
                  return (
                    <Text class="text-xs font-mono" style={{ textColor: c.textColor, bgColor: c.bgColor }}>
                      {run().text}
                    </Text>
                  );
                }}
              </Index>
            </View>
          )}
        </Index>
        {commandOpen() ? (
          <View class="absolute left-0 top-[368px] w-[648px] h-[16px] bg-slate-800">
            <Text class="text-xs font-mono text-white">: {input()}█</Text>
          </View>
        ) : <View class="w-[1px] h-[1px]" />}
      </View>

      <View class="absolute left-[20px] top-[440px] w-[680px] h-[24px] items-center">
        <Text class="text-2xs text-slate-500">L/R WS　L1/R1 PgUp/PgDn　↑↓ 键　A Enter　B Esc/WS1　START 切换　SELECT 命令</Text>
      </View>

      <ActionHandler button={BTN.LEFT} onPress={() => switchTo(active() - 1)} />
      <ActionHandler button={BTN.RIGHT} onPress={() => switchTo(active() + 1)} />
      <ActionHandler button={BTN.LTRIGGER} onPress={() => sendKey("PGUP")} />
      <ActionHandler button={BTN.RTRIGGER} onPress={() => sendKey("PGDN")} />
      <ActionHandler button={BTN.UP} onPress={() => sendKey("UP")} />
      <ActionHandler button={BTN.DOWN} onPress={() => sendKey("DOWN")} />
      <ActionHandler button={BTN.CIRCLE} onPress={() => sendKey("ENTER")} />
      <ActionHandler button={BTN.CROSS} onPress={() => sendKey("ESC")} />
      <ActionHandler button={BTN.START} onPress={() => switchTo(active() + 1)} />
      <ActionHandler button={BTN.SELECT} onPress={() => { switchTo(0); setInput(""); setCommandOpen(true); }} />
    </View>
  );
});
