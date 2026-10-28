import { LAUNCHER_APPS } from "./launcher-catalog";
import { createSignal, Index, onMount } from "solid-js";
import { mount } from "@pocketjs/framework/solid";
import { Text, View } from "@pocketjs/framework/solid/components";
import { BTN, onTextEvent, type TextEvent } from "@pocketjs/framework/input";
import { onFrame } from "@pocketjs/framework/lifecycle";

type HostUI = { __launcher?: (command: string) => string; __pocketshell?: (command: string) => string };
type Run = { text: string; fg: number; bg: number; flags: number };

const NAMES = ["APPS", "FILES", "VIM", "TOP", "LOG"];
const LOG_WORKSPACE = 4;
// 360×240 logical pixels scale 2× to the LCD; 12px text appears at 24px.
const ROWS = 12;

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
  const [launcherOpen, setLauncherOpen] = createSignal(true);
  const [launcherPage, setLauncherPage] = createSignal("apps");
  const [launcherSelection, setLauncherSelection] = createSignal(0);
  const [launcherNotice, setLauncherNotice] = createSignal("");
  const [volume, setVolume] = createSignal(50);
  const [brightness, setBrightness] = createSignal(80);
  const serviceKeys = ["adbusb", "ssh", "avahi", "ftp", "http", "rsyncd", "samba", "syncthing", "telnet", "pocketshell-dev"];
  const settings = ["Volume -", "Volume +", "Brightness -", "Brightness +", "Wi-Fi on", "Wi-Fi off", "Bluetooth on", "Bluetooth off", ...serviceKeys.map((s) => `Toggle ${s}`), "Network / USB settings", "Screen timeout: Never", "Screen timeout: 10s", "Screen timeout: 30s", "Screen timeout: 1m", "Screen timeout: 5m", "Screen timeout: 15m", "Screen timeout: 30m", "Screen timeout: 1h"];
  const launcherRows = () => launcherPage() === "settings" ? settings : [...LAUNCHER_APPS.map((a) => a.name), "Settings"];
  const moveLauncher = (step: number) => setLauncherSelection((launcherSelection() + step + launcherRows().length) % launcherRows().length);
  const launcherCommand = (value: string) => setLauncherNotice(host?.__launcher?.(value) ?? "Launcher bridge unavailable");
  const openLauncherEntry = () => {
    const selected = launcherSelection();
    if (launcherPage() === "settings") {
      if (selected < 4) {
        const control = selected < 2 ? "volume" : "brightness";
        const value = Math.max(control === "brightness" ? 5 : 0, Math.min(100, Number(host?.__launcher?.(`LEVEL\t${control}`) ?? "NaN") + (selected % 2 ? 5 : -5)));
        if (!Number.isFinite(value)) { setLauncherNotice("Current level unavailable"); return; }
        if (control === "volume") setVolume(value); else setBrightness(value);
        launcherCommand(`CONTROL\t${control}\t${value}`);
      } else if (selected < 8) launcherCommand(`CONTROL\t${selected < 6 ? "wifi" : "bluetooth"}\t${selected % 2 ? "off" : "on"}`);
      else if (selected < 8 + serviceKeys.length) launcherCommand(`SERVICE\t${serviceKeys[selected - 8]}.enabled`);
      else if (selected === 8 + serviceKeys.length) { setLauncherOpen(false); send("RESET\t0"); send("0\tTEXT /usr/libexec/pocketjs-legacy-settings"); send("0\tKEY ENTER"); }
      else {
        const timeoutIndex = selected - (8 + serviceKeys.length + 1);
        const timeouts = ["never", "10s", "30s", "1m", "5m", "15m", "30m", "1h"];
        const timeout = timeouts[timeoutIndex];
        if (timeout) launcherCommand(`SLEEP\t${timeout}`);
      }
      return;
    }
    if (selected === LAUNCHER_APPS.length) { setLauncherPage("settings"); setLauncherSelection(0); return; }
    const app = LAUNCHER_APPS[selected];
    if (app.kind === "native") { launcherCommand(`LAUNCH\t${app.id}`); return; }
    setLauncherOpen(false);
    send("RESET\t0");
    if (app.id !== "terminal") { send(`0\tTEXT ${app.id === "gamepad" ? "/usr/bin/evtest /dev/input/event3" : `/usr/bin/heya-tool ${app.id} --inside`}`); send("0\tKEY ENTER"); }
  };
  const launcherKey = (key: string) => {
    if (key === "ArrowUp") moveLauncher(-1);
    else if (key === "ArrowDown") moveLauncher(1);
    else if (key === "Enter") openLauncherEntry();
    else if (key === "Escape") { setLauncherPage("apps"); setLauncherSelection(0); }
  };
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
  const inputEntries = () => inputFunction() === 1 ? inputHistory().map((value) => [value, value]) : INPUT_ENTRIES[inputFunction()];
  const moveInputSelection = (direction: number) => {
    const count = inputFunction() === 0 ? INPUT_LAYOUTS[inputLayout()].flatMap((row) => row.split(" ")).length + 3 : inputEntries().length;
    setInputSelection((index) => count ? (index + direction + count) % count : 0);
  };
  const inputListStart = () => Math.max(0, inputSelection() - 7);
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
    if (value) { send(`${active()}\tTEXT ${value}`); send(`${active()}\tKEY ENTER`); }
    setInput(""); setInputOpen(false);
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
    send("RESIZE\t12x46");
    for (let id = 0; id < NAMES.length; id++) send(`${id}\tSTART`);
    log("Workspace Created WS1..WS5");
    onTextEvent((event: TextEvent) => {
      if (active() === 0 && launcherOpen()) { if (event.kind === "key" && event.pressed) launcherKey(event.key); return true; }
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
    if (active() === 0 && launcherOpen()) {
      if (pressed & BTN.UP) moveLauncher(-1);
      if (pressed & BTN.DOWN) moveLauncher(1);
      if (pressed & BTN.CIRCLE) openLauncherEntry();
      if (pressed & BTN.CROSS) { setLauncherPage("apps"); setLauncherSelection(0); }
      if (pressed & BTN.LEFT) switchTo(active() - 1);
      if (pressed & BTN.RIGHT || pressed & BTN.START) switchTo(active() + 1);
      return;
    }
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
    if (pressed & BTN.CROSS) { sendKey("ESC"); switchTo(0); setLauncherOpen(true); }
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
    <View class="w-[360px] h-[240px] bg-slate-950">
      <View class="absolute left-[10px] top-[1px] w-[340px] h-[24px] items-center">
        <Text class="text-2xl font-bold text-emerald-300">◀ WS{active() + 1}:{active() === 0 && !launcherOpen() ? "TERMINAL" : NAMES[active()]} ▶</Text>
        <View class="absolute left-[326px] top-[4px] w-[24px] h-[16px] items-center"><Text class="text-base text-emerald-300">{"\uf240"}</Text></View>
      </View>

      {active() === 0 && launcherOpen() ? (
        <View class="absolute left-[10px] top-[28px] w-[340px] h-[192px] flex-col">
          <Text class="text-xs text-emerald-300">{launcherPage() === "settings" ? "Settings" : "Applications"} · {launcherSelection() + 1}/{launcherRows().length}</Text>
          <Index each={launcherRows().slice(Math.floor(launcherSelection() / 8) * 8, Math.floor(launcherSelection() / 8) * 8 + 8)}>{(name, i) => (
            <View class={Math.floor(launcherSelection() / 8) * 8 + i === launcherSelection() ? "w-[340px] h-[19px] bg-slate-700" : "w-[340px] h-[19px]"}><Text class="text-xs font-mono text-white">{Math.floor(launcherSelection() / 8) * 8 + i === launcherSelection() ? "> " : "  "}{name()}</Text></View>
          )}</Index>
          <Text class="text-2xs text-emerald-300">{launcherNotice()}</Text>
        </View>
      ) : (
      <View class="absolute left-[10px] top-[28px] w-[340px] h-[192px] flex-col">
        <Index each={lines()}>
          {(runs, rowIndex) => (
            <View class="w-[340px] h-[16px] flex-row">
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
          <View class="absolute left-0 top-[176px] w-[340px] h-[16px] bg-slate-800">
            <Text class="text-xs font-mono text-white">: {input()}█</Text>
          </View>
        ) : <View class="w-[0px] h-[0px]" />}
      </View>
      )}
      {inputOpen() ? (
        <View class="absolute left-0 top-0 w-[360px] h-[240px] bg-slate-950 flex-col">
          <View class="absolute left-[10px] top-[1px] w-[340px] h-[24px] items-center"><Text class="text-2xl font-bold text-emerald-300">INPUT</Text></View>
          <View class="absolute left-[10px] top-[28px] w-[340px] h-[16px] bg-slate-800"><Text class="text-xs font-mono text-white">{">"} {input()}█</Text></View>
          <View class="absolute left-[10px] top-[48px] w-[340px] h-[152px] flex-col">
            {inputFunction() === 0 ? (
              <>
                <View class="w-[340px] h-[16px] flex-row"><Index each={["ABC", "123", "SYM", "PATH"]}>{(label, i) => <Text class={inputLayout() === i ? "text-xs font-mono text-slate-950 bg-emerald-300" : "text-xs font-mono text-slate-300 bg-slate-800"}>{label()}</Text>}</Index></View>
                <Index each={INPUT_LAYOUTS[inputLayout()]}>{(line, row) => <View class="w-[340px] h-[22px] flex-row"><Index each={line().split(" ")}>{(key, col) => <Text class={inputSelection() === INPUT_LAYOUTS[inputLayout()].slice(0, row).reduce((count, line) => count + line.split(" ").length, 0) + col ? "text-xs font-mono text-slate-950 bg-emerald-300" : "text-xs font-mono text-slate-100 bg-slate-800"}>{key()}</Text>}</Index></View>}</Index>
                <View class="w-[340px] h-[20px] flex-row"><Index each={["SPACE", "BACKSPACE", "ENTER"]}>{(label, i) => <Text class={inputSelection() === INPUT_LAYOUTS[inputLayout()].flatMap((line) => line.split(" ")).length + i ? "text-xs font-mono text-slate-950 bg-emerald-300" : "text-xs font-mono text-slate-100 bg-slate-800"}>{label()}　</Text>}</Index></View>
              </>
            ) : (
              <Index each={inputEntries().slice(inputListStart(), inputListStart() + 8)}>
                {(entry, i) => <View class={inputSelection() === i + inputListStart() ? "w-[340px] h-[18px] bg-emerald-300" : "w-[340px] h-[18px] bg-slate-800"}><Text class="text-xs font-mono text-white">{entry()[0]}</Text></View>}
              </Index>
            )}
          </View>
          <View class="absolute left-[5px] top-[202px] w-[350px] h-[16px] flex-row"><Index each={INPUT_TABS}>{(tab, i) => <Text class={inputFunction() === i ? "text-xs font-mono text-slate-950 bg-emerald-300" : "text-xs font-mono text-slate-300 bg-slate-800"}>{tab()}</Text>}</Index></View>
          <View class="absolute left-[10px] top-[220px] w-[340px] h-[16px]"><Text class="text-xs text-slate-500">L/R布局 · L1/R1功能 · A选择 · B退出</Text></View>
        </View>
      ) : <View class="w-[0px] h-[0px]" />}

      {!inputOpen() ? <View class="absolute left-[10px] top-[222px] w-[340px] h-[16px] items-center">
        <Text class="text-xs text-slate-500">START 切换 · SELECT 输入 · A 确认 · B 返回</Text>
      </View> : null}

    </View>
  );
});
