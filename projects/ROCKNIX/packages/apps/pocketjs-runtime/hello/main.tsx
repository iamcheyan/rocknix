import { isLauncherLocale, LAUNCHER_LOCALES, launcherLocaleIndex, type LauncherLocale } from "./launcher-localization";
import { LauncherHome } from "./launcher-home";
import { SettingsWorkspace } from "./settings-workspace";
import { WorkspaceBar } from "./workspace-bar";
import { createSignal, Index, onMount } from "solid-js";
import { LAUNCHER_APPS } from "./launcher-catalog";
import { mount } from "@pocketjs/framework/solid";
import { Text, View } from "@pocketjs/framework/solid/components";
import { BTN, onTextEvent, type TextEvent } from "@pocketjs/framework/input";
import { onFrame } from "@pocketjs/framework/lifecycle";

const WORKSPACES = [
  { id: "apps", glyph: ["00111100", "01111110", "01011010", "11111111", "11111111", "11100111", "01111110", "00111100"] },
  { id: "files", glyph: ["00000000", "00110000", "01111000", "11111110", "11111111", "11111111", "11111111", "00000000"] },
  { id: "vim", glyph: ["00000010", "00000110", "00001110", "00011110", "00111010", "01110010", "11100010", "11111110"] },
  { id: "top", glyph: ["00000000", "01100110", "01100110", "01100110", "01100110", "01100110", "01111110", "00000000"] },
  { id: "log", glyph: ["11111110", "10000010", "10111010", "10101010", "10111010", "10000010", "11111110", "00000000"] },
] as const;
const NAMES = ["APPS", "FILES", "VIM", "TOP", "LOG"];
const LOG_WORKSPACE = 4;

type HostUI = { __launcher?: (command: string) => string; __pocketshell?: (command: string) => string };
type Run = { text: string; fg: number; bg: number; flags: number };

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
  const [selectedWorkspace, setSelectedWorkspace] = createSignal(0);
  const [launcherOpen, setLauncherOpen] = createSignal(true);
  const [launcherPage, setLauncherPage] = createSignal("apps");
  const [launcherSelection, setLauncherSelection] = createSignal(0);
  const [launcherNotice, setLauncherNotice] = createSignal("");
  const [locale, setLocale] = createSignal<LauncherLocale>("ja");
  const [overview, setOverview] = createSignal(true);
  const [launcherCategory, setLauncherCategory] = createSignal(0);
  const [pendingDirection, setPendingDirection] = createSignal(1);
  const [levelPending, setLevelPending] = createSignal(false);
  const [timeoutSelection, setTimeoutSelection] = createSignal(5);
  const [timeoutPending, setTimeoutPending] = createSignal(false);
  const [settingsValues, setSettingsValues] = createSignal<Record<string, string>>({});
  const [volume, setVolume] = createSignal(50);
  const LOCALES = LAUNCHER_LOCALES;
  const localeIndex = () => launcherLocaleIndex(locale());
  const labels = () => LOCALES[localeIndex()].labels;
  const serviceKeys = ["adbusb", "ssh", "avahi", "ftp", "http", "rsyncd", "samba", "syncthing", "telnet", "pocket" + "shell-dev"];
  const timeouts = ["never", "10s", "30s", "1m", "5m", "15m", "30m", "1h"];
  type SettingItem = { id: string; label: string; kind: string };
  const settingGroups: SettingItem[][] = [
    [{ id: "brightness", label: "Brightness", kind: "level" }],
    [{ id: "volume", label: "Volume", kind: "level" }],
    [{ id: "wifi", label: "Wi-Fi", kind: "radio" }, { id: "bluetooth", label: "Bluetooth", kind: "radio" }],
    serviceKeys.map((id) => ({ id, label: id, kind: "service" })),
    [
      { id: "apps", label: "Tools / Applications", kind: "tools" },
      { id: "network-usb", label: "Network / USB settings", kind: "open" },
      { id: "timeout", label: "Screen timeout", kind: "timeout" },
      { id: "language", label: "Display language", kind: "language" },
    ],
  ];
  const categoryNames = () => locale() === "ja"
    ? ["表示", "音声", "ネットワーク", "サービス", "システム"]
    : locale() === "zh" ? ["显示", "音频", "网络", "服务", "系统"] : ["DISPLAY", "AUDIO", "NETWORK", "SERVICES", "SYSTEM"];
  const translatedApps = () => locale() === "ja" ? ["XMPlayer", "オーディオ", "Mac メタデータ削除", "クラウドバックアップ", "クラウド復元", "ファイルマネージャー", "Midnight Commander", "ゲームパッドテスト", "入力デバイス", "カーネルログ", "システムモニター", "ネットワーク情報", "テキストエディター", "プロセス管理", "ストレージ情報", "システム情報", "システムログ", "ターミナル", "USB デバイス"] : locale() === "zh" ? ["XMPlayer", "音频混音器", "清理 macOS 文件", "云备份", "云恢复", "文件管理器", "Midnight Commander", "手柄测试", "输入设备", "内核日志", "系统监视器", "网络信息", "文本编辑器", "进程管理", "存储信息", "系统信息", "系统日志", "终端", "USB 设备"] : LAUNCHER_APPS.map((app) => app.name);
  const settingLabel = (id: string): string => {
    const map: Record<string, readonly [string, string, string]> = {
      brightness: ["明るさ", "亮度", "Brightness"],
      volume: ["音量", "音量", "Volume"],
      wifi: ["Wi-Fi", "Wi-Fi", "Wi-Fi"],
      bluetooth: ["Bluetooth", "Bluetooth", "Bluetooth"],
      apps: ["ツール / アプリ", "工具与应用", "Tools / Applications"],
      "network-usb": ["ネットワーク / USB 設定", "网络 / USB 设置", "Network / USB settings"],
      timeout: ["画面オフ", "屏幕超时", "Screen timeout"],
      language: ["表示言語", "界面语言", "Display language"],
    };
    const entry = map[id];
    return entry ? entry[localeIndex()] : id;
  };
  const settingRows = (): SettingItem[] => settingGroups[launcherCategory()].map((item) => ({ ...item, label: settingLabel(item.id) }));
  const appRows = () => [...translatedApps(), labels().settings];
  const toolRows = () => systemTools.map((tool) => tool.label);
  const launcherRows = () => launcherPage() === "tools" ? toolRows() : launcherPage() === "settings" ? settingRows().map((item) => item.label) : appRows();
  const moveLauncher = (step: number) => setLauncherSelection((launcherSelection() + step + launcherRows().length) % launcherRows().length);
  const launcherCommand = (value: string) => setLauncherNotice(host?.__launcher?.(value) ?? "Launcher bridge unavailable");
  const setLanguage = (id: LauncherLocale) => {
    const result = host?.__launcher?.(`LANGUAGE\t${id}`) ?? "ja";
    if (["ja", "zh", "en"].includes(result)) setLocale(result as LauncherLocale);
  };
  const refreshSettingValues = () => {
    const next: Record<string, string> = {};
    for (const key of ["brightness", "volume", "wifi", "bluetooth", "timeout", ...serviceKeys]) {
      const value = host?.__launcher?.(`STATE\t${key}`) ?? "unknown";
      next[key] = value === "unknown" || !value ? "?" : value;
    }
    setSettingsValues(next);
    const timeout = next.timeout;
    const timeoutIndex = timeouts.indexOf(timeout);
    if (timeoutIndex >= 0) setTimeoutSelection(timeoutIndex);
  };
  const changeCategory = (step: number) => {
    setLauncherCategory((launcherCategory() + step + settingGroups.length) % settingGroups.length);
    setLauncherSelection(0);
    setLevelPending(false);
    setTimeoutPending(false);
    setLauncherNotice("");
    refreshSettingValues();
  };
  const valueLabel = (item: { id: string; kind: string }) => {
    const value = settingsValues()[item.id] ?? "?";
    if (item.kind === "level") {
      const current = Number(value);
      if (!Number.isFinite(current)) return "??????????  ?%";
      const staged = levelPending() ? Math.max(item.id === "brightness" ? 5 : 0, Math.min(100, current + pendingDirection() * 5)) : current;
      return `${"●".repeat(Math.round(staged / 10))}${"·".repeat(10 - Math.round(staged / 10))} ${staged}%${levelPending() ? " *" : ""}`;
    }
    if (item.kind === "timeout") return timeoutPending() ? `${value} → ${timeouts[timeoutSelection()]}` : value;
    if (item.kind === "language") return locale() === "ja" ? "日本語" : locale() === "zh" ? "中文" : "English";
    if (item.kind === "tools") return "A OPEN";
    if (item.kind === "radio" || item.kind === "service") return value === "1" || value === "on" ? "● ON" : value === "0" || value === "off" ? "○ OFF" : "? UNKNOWN";
    return "A OPEN";
  };
  const activeItem = (): SettingItem => settingRows()[launcherSelection()] ?? { id: "", label: "", kind: "" };
  const systemTools = [
    { label: "Terminal", run: () => { setLauncherOpen(false); switchTo(1); } },
    ...LAUNCHER_APPS.map((app, index) => ({ label: translatedApps()[index] ?? app.name, run: () => {
      if (app.kind === "native") launcherCommand(`LAUNCH\t${app.id}`);
      else { setLauncherOpen(false); send("RESET\t0"); send(`0\tTEXT ${app.id === "gamepad" ? "/usr/bin/evtest /dev/input/event3" : `/usr/bin/heya-tool ${app.id} --inside`}`); send("0\tKEY ENTER"); }
    } })),
  ];
  const openLauncherEntry = () => {
    const selected = launcherSelection();
    if (launcherPage() === "tools") { systemTools[launcherSelection()]?.run(); return; }
    if (launcherPage() === "settings") {
      const item = activeItem();
      if (item.kind === "language") { setLanguage(LAUNCHER_LOCALES[(localeIndex() + 1) % LAUNCHER_LOCALES.length].id); refreshSettingValues(); return; }
      if (item.kind === "level") {
        if (!levelPending()) { setLauncherNotice("Choose a 5% step with left or right"); return; }
        const current = Number(host?.__launcher?.(`STATE\t${item.id}`) ?? "NaN");
        if (!Number.isFinite(current)) { setLauncherNotice("Current level unavailable"); return; }
        const value = Math.max(item.id === "brightness" ? 5 : 0, Math.min(100, current + pendingDirection() * 5));
        launcherCommand(`CONTROL\t${item.id}\t${value}`); setLevelPending(false);
      } else if (item.kind === "radio") {
        const current = settingsValues()[item.id];
        if (!["0", "1", "on", "off"].includes(current)) { setLauncherNotice("Current state unavailable"); return; }
        const result = host?.__launcher?.(`CONTROL\t${item.id}\t${current === "1" || current === "on" ? "off" : "on"}`) ?? "Setting failed";
        setLauncherNotice(result); refreshSettingValues();
      } else if (item.kind === "service") {
        setLauncherNotice(launcherCommand(`SERVICE\t${item.id}.enabled`));
        refreshSettingValues();
      } else if (item.kind === "timeout") {
        setLauncherNotice(launcherCommand(`SLEEP\t${timeouts[timeoutSelection()]}`)); setTimeoutPending(false); refreshSettingValues();
      } else if (item.kind === "tools") {
        setLauncherPage("tools"); setLauncherSelection(0); setLauncherNotice("");
      } else if (item.kind === "open") { setLauncherOpen(false); send("RESET\t0"); send("0\tTEXT /usr/libexec/pocketjs-legacy-settings"); send("0\tKEY ENTER"); }
      refreshSettingValues();
      return;
    }
    if (selected >= LAUNCHER_APPS.length) {
      setLauncherPage("settings");
      setLauncherCategory(0);
      setLauncherSelection(0);
      refreshSettingValues();
      return;
    }
    const app = LAUNCHER_APPS[selected];
    if (!app) return;
    if (app.kind === "native") { launcherCommand(`LAUNCH\t${app.id}`); return; }
    setLauncherOpen(false); send("RESET\t0");
    if (app.id !== "terminal") { send(`0\tTEXT ${app.id === "gamepad" ? "/usr/bin/evtest /dev/input/event3" : `/usr/bin/heya-tool ${app.id} --inside`}`); send("0\tKEY ENTER"); }
  };
  const moveSettingValue = (direction: number) => {
    const item = activeItem();
    if (item.kind === "timeout") { setTimeoutSelection((timeoutSelection() + direction + timeouts.length) % timeouts.length); setTimeoutPending(true); }
    else if (item.kind === "level") { setPendingDirection(direction); setLevelPending(true); }
  };
  const launcherKey = (key: string) => {
    if (overview()) {
      if (key === "ArrowLeft") changeWorkspace(selectedWorkspace() - 1);
      else if (key === "ArrowRight") changeWorkspace(selectedWorkspace() + 1);
      else if (key === "ArrowUp" || key === "ArrowDown") { setOverview(false); setLauncherSelection(0); }
      else if (key === "Enter") { if (selectedWorkspace() === 0) { setOverview(false); setLauncherSelection(0); } else { switchTo(selectedWorkspace()); setLauncherOpen(false); } }
      return;
    }
    if (key === "ArrowUp") moveLauncher(-1);
    else if (key === "ArrowDown") moveLauncher(1);
    else if ((key === "ArrowLeft" || key === "ArrowRight") && launcherPage() === "settings") moveSettingValue(key === "ArrowLeft" ? -1 : 1);
    else if (key === "Enter") openLauncherEntry();
    else if (key === "Escape") { setOverview(true); setLauncherPage("apps"); setLauncherSelection(0); }
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

  const changeWorkspace = (id: number) => {
    const next = (id + WORKSPACES.length) % WORKSPACES.length;
    setSelectedWorkspace(next); setOverview(true); setLauncherPage("apps"); setLauncherSelection(0);
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
    const savedLocale = host?.__launcher?.("LANGUAGE") ?? "ja";
    if (isLauncherLocale(savedLocale)) setLocale(savedLocale);
    send("RESIZE\t12x46");
    for (let id = 0; id < NAMES.length; id++) send(`${id}\tSTART`);
    log("Workspace Created WS1..WS5");
    onTextEvent((event: TextEvent) => {
      if (launcherOpen() && !inputOpen() && !commandOpen()) { if (event.kind === "key" && event.pressed) launcherKey(event.key); return true; }
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
    if (launcherOpen() && !inputOpen() && !commandOpen()) {
      if (pressed & BTN.SELECT) { setInput(""); setInputOpen(true); setInputFunction(0); return; }
      if (pressed & BTN.START) { setInput(""); setCommandOpen(true); return; }
      if (overview()) {
        if (pressed & BTN.LEFT) changeWorkspace(selectedWorkspace() - 1);
        if (pressed & BTN.RIGHT) changeWorkspace(selectedWorkspace() + 1);
        if (pressed & BTN.UP || pressed & BTN.DOWN) { setOverview(false); setLauncherSelection(0); }
        if (pressed & BTN.CIRCLE) { if (selectedWorkspace() === 0) { setOverview(false); setLauncherSelection(0); } else { switchTo(selectedWorkspace()); setLauncherOpen(false); } }
        if (pressed & BTN.CROSS) setSelectedWorkspace(active());
      } else {
        if (pressed & BTN.LEFT && launcherPage() === "settings") moveSettingValue(-1);
        else if (pressed & BTN.LEFT) changeWorkspace(selectedWorkspace() - 1);
        if (pressed & BTN.RIGHT && launcherPage() === "settings") moveSettingValue(1);
        else if (pressed & BTN.RIGHT) changeWorkspace(selectedWorkspace() + 1);
        if (launcherPage() === "settings") {
          if (pressed & BTN.LTRIGGER) changeCategory(-1);
          if (pressed & BTN.RTRIGGER) changeCategory(1);
        }
        if (pressed & BTN.UP) moveLauncher(-1);
        if (pressed & BTN.DOWN) moveLauncher(1);
        if (pressed & BTN.CIRCLE) openLauncherEntry();
        if (pressed & BTN.CROSS) { setOverview(true); setLauncherPage("apps"); setLauncherSelection(0); }
      }
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
        <Text class="text-xs font-mono text-emerald-300">{LOCALES[localeIndex()].id.toUpperCase()}</Text>
      </View>
      {launcherOpen() ? (
        <>
          <View class="absolute left-[10px] top-[1px] w-[340px] h-[12px] flex-row items-center">
            <WorkspaceBar workspaces={WORKSPACES} activeId={WORKSPACES[selectedWorkspace()].id} />
          </View>
          {overview() ? (
            <LauncherHome locale={locale()} workspace={selectedWorkspace()} overview={true} page="apps" selection={launcherSelection()} rows={launcherRows()} notice={launcherNotice()} onNavigate={(direction) => changeWorkspace(selectedWorkspace() + direction)} onEnterList={() => setOverview(false)} onOpen={openLauncherEntry} onBack={() => setOverview(true)} onLanguage={() => setLanguage(LAUNCHER_LOCALES[(localeIndex() + 1) % LAUNCHER_LOCALES.length].id)} />
          ) : launcherPage() === "settings" ? (
            <SettingsWorkspace category={launcherCategory()} categories={categoryNames()} rows={settingRows()} selected={launcherSelection()} value={valueLabel} detail={(item) => item.kind === "level" ? "Adjust output level in 5% steps." : item.kind === "service" ? "Toggle the existing system service." : item.kind === "timeout" ? "Select and save display timeout." : item.kind === "radio" ? "Toggle the saved wireless state." : "Open the existing system utility."} notice={launcherNotice()} />
          ) : (
            <LauncherHome locale={locale()} workspace={selectedWorkspace()} overview={false} page={launcherPage() === "tools" ? "apps" : "apps"} selection={launcherSelection()} rows={launcherPage() === "tools" ? systemTools.map((item) => item.label) : launcherRows()} notice={launcherNotice()} onNavigate={(direction) => changeWorkspace(selectedWorkspace() + direction)} onEnterList={() => setOverview(false)} onOpen={openLauncherEntry} onBack={() => { setOverview(true); setLauncherPage("apps"); setLauncherSelection(0); }} onLanguage={() => setLanguage(LAUNCHER_LOCALES[(localeIndex() + 1) % LAUNCHER_LOCALES.length].id)} />
          )}
        </>
      ) : (
        <View class="absolute left-[10px] top-[28px] w-[340px] h-[192px] flex-col">
          <Index each={lines()}>
            {(runs, rowIndex) => (
              <View class="w-[340px] h-[16px] flex-row">
                <Index each={withCursor(runs(), rowIndex)}>
                  {(run) => { const c = runColor(run()); return <Text class="text-xs font-mono" style={{ textColor: c.textColor, bgColor: c.bgColor }}>{run().text}</Text>; }}
                </Index>
              </View>
            )}
          </Index>
          {commandOpen() ? <View class="absolute left-0 top-[176px] w-[340px] h-[16px] bg-slate-800"><Text class="text-xs font-mono text-white">: {input()}█</Text></View> : null}
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

      {!inputOpen() && !launcherOpen() ? <View class="absolute left-[10px] top-[222px] w-[340px] h-[16px] items-center">
        <Text class="text-xs text-slate-500">START WS  SELECT INPUT</Text>
      </View> : null}

    </View>
  );
});
