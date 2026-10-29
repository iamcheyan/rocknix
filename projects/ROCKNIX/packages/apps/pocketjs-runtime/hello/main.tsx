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
  const [inputOpen, setInputOpen] = createSignal(false);
  const [inputLayout, setInputLayout] = createSignal(0);
  const [inputFunction, setInputFunction] = createSignal(0);
  const [inputHistory, setInputHistory] = createSignal<string[]>([]);
  const [inputSelection, setInputSelection] = createSignal(0);
  const INPUT_TABS = ["Keyboard", "History", "Commands", "Phrases", "Sessions", "Agent"];
  const INPUT_LAYOUTS = [
    ["A B C D E F G", "H I J K L M N", "O P Q R S T U", "V W X Y Z"],
    ["1 2 3 4 5", "6 7 8 9 0", ". , : ;", "/ - _ @"],
    ["! ? # $ %", "& * + =", "( ) [ ]", "{ } < >", "| \\ ~ ^"],
    ["/ ~ . .. - _ : @", "root home storage roms", "mnt tmp config logs", "usr bin"],
  ];
  const INPUT_ENTRIES: string[][][] = [[], [],
    [["Open Shell", ""], ["Connect NAS", "ssh nas"], ["Restart WiFi", "sudo systemctl restart NetworkManager"], ["Mount USB", "udisksctl mount -b"], ["Check Logs", "journalctl -f"], ["Update ROMs", "/usr/bin/rocknix-roms-update"], ["Shutdown", "sudo poweroff"], ["Reboot", "sudo reboot"], ["System Info", "uname -a"]],
    [["SSH", "ssh user@host"], ["Git Clone", "git clone"], ["Git Pull", "git pull"], ["Rsync", "rsync -av"], ["Journal", "journalctl -f"], ["tmux", "tmux attach"]],
    [["PVE", "ssh pve"], ["DEVBOX", "ssh devbox"], ["NAS", "ssh nas"], ["CLAUDE", "tmux attach -t claude"], ["AIDER", "tmux attach -t aider"], ["CODEX", "tmux attach -t codex"], ["Remote Agent", "ssh agent"]],
    ["查看日志", "查看异常", "分析系统状态", "检查存储空间", "检查网络连接", "更新 ROM 库", "生成 SSH 配置", "管理 Workspace", "生成脚本", "生成命令"].map((label) => [label, `请${label}，检查当前系统并给出结论。`]),
  ];
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
  const submitInput = () => {
    const value = input().trim();
    if (value) setInputHistory((items) => [value, ...items.filter((item) => item !== value)]);
    setInput("");
  };
  const selectInputEntry = (index: number) => {
    if (inputFunction() === 0) {
      const chars = [...INPUT_LAYOUTS[inputLayout()].flatMap((line) => line.split(" ")), "SPACE", "BACKSPACE", "ENTER"];
      const value = chars[index];
      if (value === "SPACE") setInput((text) => text + " ");
      else if (value === "BACKSPACE") setInput((text) => text.slice(0, -1));
      else if (value === "ENTER") submitInput();
      else if (value) setInput((text) => text + value);
      return;
    }
    const entries = inputFunction() === 1 ? inputHistory().map((value) => [value, value]) : INPUT_ENTRIES[inputFunction()];
    if (inputFunction() === 2 && index >= 6) return;
    if (entries[index]) setInput(entries[index][1]);
  };
  const deleteInput = (index: number) => {
    if (inputFunction() === 1) setInputHistory((items) => items.filter((_, i) => i !== index));
  };

  onMount(() => {
    for (let id = 0; id < NAMES.length; id++) send(`${id}\tSTART`);
    log("Workspace Created WS1..WS5");
    onTextEvent((event: TextEvent) => {
      if (event.kind === "commit") {
        if (inputOpen()) setInput((value) => value + event.text);
        else if (commandOpen()) setInput((value) => value + event.text);
        else if (active() < LOG_WORKSPACE) send(`${active()}\tTEXT ${event.text}`);
        return true;
      }
      if (event.kind !== "key" || !event.pressed) return false;
      if (inputOpen()) {
        if (event.key === "Escape") setInputOpen(false);
        else if (event.key === "Backspace") setInput((value) => value.slice(0, -1));
        else if (event.key === "Enter") submitInput();
        return true;
      }
      if (commandOpen()) {
        if (event.key === "Escape") { setCommandOpen(false); setInput(""); }
        else if (event.key === "Backspace") setInput((value) => value.slice(0, -1));
        else if (event.key === "Enter") {
          const value = input(); setInput(""); setCommandOpen(false); switchTo(0);
          if (value) send(`0\tTEXT ${value}`); send("0\tKEY ENTER"); log("Process Input WS1");
        }
        return true;
      }
      const key = event.key.replace(/^Control\+/, "CTRL_").toUpperCase();
      if (["ENTER", "BACKSPACE", "ARROWUP", "ARROWDOWN", "ARROWLEFT", "ARROWRIGHT", "TAB", "ESC", "CTRL_C", "CTRL_D", "CTRL_L", "HOME", "END"].includes(key)) sendKey(key.replace("ARROW", ""));
      return true;
    });
  });

  onFrame((buttons: number) => {
    if (buttons === 0) armed = true;
    const payload = global.__pocketshellOutput ?? "";
    if (payload) { delete global.__pocketshellOutput; applyRows(payload); }
    if (active() === LOG_WORKSPACE && armed && !inputOpen()) applyRows(send(`SNAP\t${LOG_WORKSPACE}`));
    if (!armed) { previousButtons = buttons; return; }
    const pressed = buttons & ~previousButtons;
    previousButtons = buttons;
    if (inputOpen()) {
      const entries = inputFunction() === 1 ? inputHistory().map((value) => [value, value]) : INPUT_ENTRIES[inputFunction()];
      const selectionCount = inputFunction() === 0
        ? INPUT_LAYOUTS[inputLayout()].flatMap((line) => line.split(" ")).length + 3
        : entries.length;
      if (pressed & BTN.LEFT) setInputLayout((inputLayout() + 3) % 4);
      if (pressed & BTN.RIGHT) setInputLayout((inputLayout() + 1) % 4);
      if (pressed & BTN.LTRIGGER) setInputFunction((inputFunction() + 5) % 6);
      if (pressed & BTN.RTRIGGER) setInputFunction((inputFunction() + 1) % 6);
      if (pressed & BTN.UP) setInputSelection((inputSelection() + Math.max(1, selectionCount) - 1) % Math.max(1, selectionCount));
      if (pressed & BTN.DOWN) setInputSelection((inputSelection() + 1) % Math.max(1, selectionCount));
      if (pressed & BTN.CIRCLE) selectInputEntry(inputSelection());
      if (pressed & BTN.CROSS) setInputOpen(false);
      if (pressed & BTN.START) setInputFunction((inputFunction() + 1) % 6);
      if (pressed & BTN.SELECT) submitInput();
      return;
    }
    if (pressed & BTN.LEFT) switchTo(active() - 1);
    if (pressed & BTN.RIGHT) switchTo(active() + 1);
    if (pressed & BTN.LTRIGGER) sendKey("PGUP");
    if (pressed & BTN.RTRIGGER) sendKey("PGDN");
    if (pressed & BTN.UP) sendKey("UP");
    if (pressed & BTN.DOWN) sendKey("DOWN");
    if (pressed & BTN.CIRCLE) { sendKey("ENTER"); log(`Process Input WS${active() + 1}`); }
    if (pressed & BTN.CROSS) { sendKey("ESC"); switchTo(0); }
    if (pressed & BTN.START) switchTo(active() + 1);
    if (pressed & BTN.SELECT) { setInput(""); setInputOpen(true); setInputFunction(0); }
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
      {inputOpen() ? (
        <View class="absolute left-0 top-0 w-[720px] h-[480px] bg-slate-950 flex-col">
          <View class="absolute left-[20px] top-[8px] w-[680px] h-[34px] items-center"><Text class="text-base font-mono font-bold text-emerald-300">INPUT</Text></View>
          <View class="absolute left-[20px] top-[45px] w-[680px] h-[42px] bg-slate-800"><Text class="text-sm font-mono text-white">{"> "}{input()}█</Text></View>
          <View class="absolute left-[20px] top-[94px] w-[680px] h-[324px] flex-col">
            {inputFunction() === 0 ? (
              <>
                <View class="w-[680px] h-[24px] flex-row"><Index each={["ABC", "123", "SYM", "PATH"]}>{(label, i) => inputLayout() === i ? <Text class="text-2xs font-mono text-slate-950 bg-emerald-300">{label()}</Text> : <Text class="text-2xs font-mono text-slate-300 bg-slate-800">{label()}</Text>}</Index></View>
                <Index each={INPUT_LAYOUTS[inputLayout()]}>{(line, row) => <View class="w-[680px] h-[45px] flex-row"><Index each={line().split(" ")}>{(key, col) => inputSelection() === row * 7 + col ? <Text class="text-sm font-mono text-slate-950 bg-emerald-300">{key()}</Text> : <Text class="text-sm font-mono text-slate-100 bg-slate-800">{key()}</Text>}</Index></View>}</Index>
                <View class="w-[680px] h-[40px] flex-row"><Text class="text-xs font-mono text-slate-100 bg-slate-800">SPACE　 BACKSPACE　 ENTER</Text></View>
              </>
            ) : (
              <Index each={inputFunction() === 1 ? inputHistory().map((value) => [value, value]) : INPUT_ENTRIES[inputFunction()]}>
                {(entry, i) => inputSelection() === i ? <View class="w-[680px] h-[36px] bg-emerald-300"><Text class="text-xs font-mono text-white">{entry()[0]}</Text></View> : <View class="w-[680px] h-[36px] bg-slate-800"><Text class="text-xs font-mono text-white">{entry()[0]}</Text></View>}
              </Index>
            )}
          </View>
          <View class="absolute left-[10px] top-[425px] w-[700px] h-[42px] flex-row"><Index each={INPUT_TABS}>{(tab, i) => inputFunction() === i ? <Text class="text-2xs font-mono text-slate-950 bg-emerald-300">{tab()}</Text> : <Text class="text-2xs font-mono text-slate-300 bg-slate-800">{tab()}</Text>}</Index></View>
          <View class="absolute left-[20px] top-[466px] w-[680px] h-[14px]"><Text class="text-2xs text-slate-500">L/R Layout　L1/R1 Function　↑↓ Select　A Choose　B Exit　SELECT Submit</Text></View>
        </View>
      ) : <View class="w-[1px] h-[1px]" />}

      <View class="absolute left-[20px] top-[440px] w-[680px] h-[24px] items-center">
        <Text class="text-2xs text-slate-500">L/R WS　L1/R1 PgUp/PgDn　↑↓ 键　A Enter　B Esc/WS1　START 切换　SELECT 命令</Text>
      </View>

      <ActionHandler button={BTN.LEFT} onPress={() => inputOpen() ? setInputLayout((inputLayout() + 3) % 4) : switchTo(active() - 1)} />
      <ActionHandler button={BTN.RIGHT} onPress={() => inputOpen() ? setInputLayout((inputLayout() + 1) % 4) : switchTo(active() + 1)} />
      <ActionHandler button={BTN.LTRIGGER} onPress={() => inputOpen() ? setInputFunction((inputFunction() + 5) % 6) : sendKey("PGUP")} />
      <ActionHandler button={BTN.RTRIGGER} onPress={() => inputOpen() ? setInputFunction((inputFunction() + 1) % 6) : sendKey("PGDN")} />
      <ActionHandler button={BTN.UP} onPress={() => inputOpen() ? setInputSelection((inputSelection() + 1) % 8) : sendKey("UP")} />
      <ActionHandler button={BTN.DOWN} onPress={() => inputOpen() ? setInputSelection((inputSelection() + 1) % 8) : sendKey("DOWN")} />
      <ActionHandler button={BTN.CIRCLE} onPress={() => inputOpen() ? selectInputEntry(inputSelection()) : sendKey("ENTER")} />
      <ActionHandler button={BTN.CROSS} onPress={() => inputOpen() ? setInputOpen(false) : sendKey("ESC")} />
      <ActionHandler button={BTN.START} onPress={() => inputOpen() ? setInputFunction((inputFunction() + 1) % 6) : switchTo(active() + 1)} />
      <ActionHandler button={BTN.SELECT} onPress={() => inputOpen() ? submitInput() : (setInput(""), setInputOpen(true), setInputFunction(0))} />
    </View>
  );
});
