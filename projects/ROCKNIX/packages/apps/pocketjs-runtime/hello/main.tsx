import { createSignal, Index, onMount, Show } from "solid-js";
import { mount } from "@pocketjs/framework/solid";
import { Text, View, type NodeMirror } from "@pocketjs/framework/solid/components";
import { BTN, onTextEvent, type TextEvent } from "@pocketjs/framework/input";
import { onFrame } from "@pocketjs/framework/lifecycle";
import { animate } from "@pocketjs/framework/animation";

import {
  LAUNCHER_APPS,
  getAppsForScreen,
  type LauncherApp,
} from "./launcher-catalog";
import { StatusBar } from "./status-bar";
import { CardCarousel } from "./card-carousel";
import {
  SettingsPage,
  SERVICE_KEYS,
  TIMEOUT_OPTIONS,
  type SettingsState,
} from "./pages/settings-page";
import { SystemPage } from "./pages/system-page";

type HostUI = {
  __launcher?: (command: string) => string;
  __pocketshell?: (command: string) => string;
};
type Run = { text: string; fg: number; bg: number; flags: number };

const NAMES = ["APPS", "FILES", "VIM", "TOP", "LOG"];
const LOG_WORKSPACE = 4;
const ROWS = 12;

const abgr = (rgb: number) => {
  const r = rgb & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 16) & 0xff;
  return (((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0);
};

const emptyRow = (): Run[] => [];

mount(() => {
  const global = globalThis as typeof globalThis & {
    ui?: HostUI;
    __pocketshellOutput?: string;
  };
  const host = global.ui;

  // -------------------------------------------------------------------------
  // Launcher State (Switch 5-Screen)
  // -------------------------------------------------------------------------
  const [currentScreen, setCurrentScreen] = createSignal(0); // 0: Home, 1: Media, 2: Games, 3: Settings, 4: System
  const [launcherOpen, setLauncherOpen] = createSignal(true);
  const [active, setActive] = createSignal(0); // PTY workspace 0..4

  // Card indexes per screen
  const [homeCardIndex, setHomeCardIndex] = createSignal(0);
  const [mediaCardIndex, setMediaCardIndex] = createSignal(0);
  const [gamesCardIndex, setGamesCardIndex] = createSignal(0);
  const [systemToolIndex, setSystemToolIndex] = createSignal(0);

  // Settings State
  const [settingsIndex, setSettingsIndex] = createSignal(0);
  const [brightness, setBrightness] = createSignal(80);
  const [volume, setVolume] = createSignal(65);
  const [wifiEnabled, setWifiEnabled] = createSignal(true);
  const [bluetoothEnabled, setBluetoothEnabled] = createSignal(false);
  const [timeoutIndex, setTimeoutIndex] = createSignal(3); // default 5m
  const [services, setServices] = createSignal<Record<string, boolean>>({
    ssh: true,
    samba: false,
    syncthing: false,
    adbusb: true,
    avahi: true,
    http: false,
    ftp: false,
    rsyncd: false,
    telnet: false,
    "pocketshell-dev": true,
  });

  // Hardware Status State
  const [ipAddress, setIpAddress] = createSignal("--");
  const [batteryLevel, setBatteryLevel] = createSignal(-1);
  const [toastMessage, setToastMessage] = createSignal("");

  // Animation Node Mirrors
  let pageNode: NodeMirror | undefined;
  let carouselNode: NodeMirror | undefined;
  let toastNode: NodeMirror | undefined;
  const cardNodes: Map<number, NodeMirror> = new Map();

  // -------------------------------------------------------------------------
  // Native Terminal & Input Workspace State (Preserved)
  // -------------------------------------------------------------------------
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
  const INPUT_ENTRIES: string[][][] = [
    [],
    [],
    [
      ["Open Shell", ""],
      ["Connect NAS", "ssh nas"],
      ["Restart WiFi", "sudo systemctl restart NetworkManager"],
      ["Mount USB", "udisksctl mount -b"],
      ["Check Logs", "journalctl -f"],
      ["Update ROMs", "/usr/bin/rocknix-roms-update"],
      ["Shutdown", "sudo poweroff"],
      ["Reboot", "sudo reboot"],
      ["System Info", "uname -a"],
    ],
    [
      ["SSH", "ssh user@host"],
      ["Git Clone", "git clone"],
      ["Git Pull", "git pull"],
      ["Rsync", "rsync -av"],
      ["Journal", "journalctl -f"],
      ["tmux", "tmux attach"],
    ],
    [
      ["PVE", "ssh pve"],
      ["DEVBOX", "ssh devbox"],
      ["NAS", "ssh nas"],
      ["CLAUDE", "tmux attach -t claude"],
      ["AIDER", "tmux attach -t aider"],
      ["CODEX", "tmux attach -t codex"],
      ["Remote Agent", "ssh agent"],
    ],
    ["查看日志", "查看异常", "分析系统状态", "检查存储空间", "检查网络连接", "更新 ROM 库", "生成 SSH 配置", "管理 Workspace", "生成脚本", "生成命令"].map(
      (label) => [label, `请${label}，检查当前系统并给出结论。`]
    ),
  ];

  const inputEntries = () =>
    inputFunction() === 1
      ? inputHistory().map((value) => [value, value])
      : INPUT_ENTRIES[inputFunction()];

  const moveInputSelection = (direction: number) => {
    const count =
      inputFunction() === 0
        ? INPUT_LAYOUTS[inputLayout()].flatMap((row) => row.split(" ")).length + 3
        : inputEntries().length;
    setInputSelection((index) => (count ? (index + direction + count) % count : 0));
  };
  const inputListStart = () => Math.max(0, inputSelection() - 7);

  let armed = false;
  let previousButtons = 0;
  let frameCounter = 0;

  const send = (command: string) => host?.__pocketshell?.(command) ?? "";
  const log = (entry: string) =>
    send(`LOG\t${entry.replace(/[\t\r\n]/g, " ").slice(0, 120)}`);

  // -------------------------------------------------------------------------
  // Toast & Animation Helpers
  // -------------------------------------------------------------------------
  let toastTimer: any = null;
  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastNode) {
      animate(toastNode, "opacity", 1, { dur: 120, easing: "out" });
      animate(toastNode, "translateY", 0, { dur: 150, easing: "out-back" });
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        if (toastNode) {
          animate(toastNode, "opacity", 0, { dur: 300, easing: "out" });
          animate(toastNode, "translateY", 6, { dur: 300, easing: "out" });
        }
      }, 1400);
    }
  };

  const currentApps = () => getAppsForScreen(currentScreen());
  const currentCardIndex = () => {
    const s = currentScreen();
    if (s === 0) return homeCardIndex();
    if (s === 1) return mediaCardIndex();
    if (s === 2) return gamesCardIndex();
    return 0;
  };

  const updateCardPosition = (idx: number, smooth = true) => {
    const targetX = -idx * 92;
    if (carouselNode) {
      if (smooth) {
        animate(carouselNode, "translateX", targetX, { dur: 220, easing: "out-back" });
      } else {
        animate(carouselNode, "translateX", targetX, { dur: 0 });
      }
    }
  };

  const switchScreen = (target: number, direction: number) => {
    const next = (target + 5) % 5;
    if (next === currentScreen()) return;
    cardNodes.clear();

    if (pageNode) {
      animate(pageNode, "opacity", 0, { dur: 80, easing: "out" });
    }

    setCurrentScreen(next);

    setTimeout(() => {
      if (pageNode) {
        animate(pageNode, "translateX", direction * 28, { dur: 0 });
        animate(pageNode, "translateX", 0, { dur: 220, easing: "out-back" });
        animate(pageNode, "opacity", 1, { dur: 200, easing: "out" });
      }

      // Restore carousel position
      if (next <= 2) {
        updateCardPosition(currentCardIndex(), false);
      }

      // Stagger entrance animation
      cardNodes.forEach((node, i) => {
        animate(node, "translateY", 12, { dur: 0 });
        animate(node, "opacity", 0, { dur: 0 });
        animate(node, "translateY", 0, { dur: 220, delay: i * 35, easing: "out-back" });
        animate(node, "opacity", 1, { dur: 200, delay: i * 35, easing: "out" });
      });
    }, 90);
  };

  const moveCard = (delta: number) => {
    const apps = currentApps();
    if (apps.length === 0) return;
    const s = currentScreen();
    let cur = currentCardIndex();
    const next = (cur + delta + apps.length) % apps.length;

    // Pop animation
    const oldNode = cardNodes.get(cur);
    const newNode = cardNodes.get(next);
    if (oldNode) animate(oldNode, "scale", 1.0, { dur: 160, easing: "out" });
    if (newNode) animate(newNode, "scale", 1.06, { dur: 200, easing: "spring-bouncy" });

    if (s === 0) setHomeCardIndex(next);
    else if (s === 1) setMediaCardIndex(next);
    else if (s === 2) setGamesCardIndex(next);

    updateCardPosition(next, true);
  };

  // -------------------------------------------------------------------------
  // Host Bridge Actions
  // -------------------------------------------------------------------------
  const syncHardwareLevels = () => {
    if (!host?.__launcher) return;
    const b = Number(host.__launcher("LEVEL\tbrightness"));
    if (Number.isFinite(b) && b >= 0 && b <= 100) setBrightness(b);
    const v = Number(host.__launcher("LEVEL\tvolume"));
    if (Number.isFinite(v) && v >= 0 && v <= 100) setVolume(v);
  };

  // Real hardware status for the top bar: battery %, Wi-Fi association and the
  // live IPv4 address. Falls back to "--" / -1 when the bridge cannot answer,
  // never to a made-up number.
  const syncHardwareStatus = () => {
    if (!host?.__launcher) return;
    const battery = Number(host.__launcher("LEVEL\tbattery"));
    setBatteryLevel(Number.isFinite(battery) && battery >= 0 && battery <= 100 ? battery : -1);
    const wifi = (host.__launcher("LEVEL\twifi") ?? "").trim();
    setWifiEnabled(wifi === "on");
    const ip = (host.__launcher("LEVEL\tip") ?? "").trim();
    const addr = ip.includes("|") ? ip.split("|")[1] : "";
    setIpAddress(addr || "--");
  };

  const changeBrightness = (delta: number) => {
    const next = Math.max(5, Math.min(100, brightness() + delta));
    setBrightness(next);
    const res = host?.__launcher?.(`CONTROL\tbrightness\t${next}`) ?? "OK";
    showToast(`Brightness 亮度: ${next}%`);
  };

  const changeVolume = (delta: number) => {
    const next = Math.max(0, Math.min(100, volume() + delta));
    setVolume(next);
    const res = host?.__launcher?.(`CONTROL\tvolume\t${next}`) ?? "OK";
    showToast(`Volume 音量: ${next}%`);
  };

  const toggleWifi = () => {
    const next = !wifiEnabled();
    setWifiEnabled(next);
    host?.__launcher?.(`CONTROL\twifi\t${next ? "on" : "off"}`);
    showToast(`Wi-Fi: ${next ? "ON 开启" : "OFF 关闭"}`);
  };

  const toggleBluetooth = () => {
    const next = !bluetoothEnabled();
    setBluetoothEnabled(next);
    host?.__launcher?.(`CONTROL\tbluetooth\t${next ? "on" : "off"}`);
    showToast(`Bluetooth 蓝牙: ${next ? "ON 开启" : "OFF 关闭"}`);
  };

  const cycleTimeout = (delta: number) => {
    const nextIdx = (timeoutIndex() + delta + TIMEOUT_OPTIONS.length) % TIMEOUT_OPTIONS.length;
    setTimeoutIndex(nextIdx);
    const opt = TIMEOUT_OPTIONS[nextIdx];
    const res = host?.__launcher?.(`SLEEP\t${opt.value}`) ?? `Screen timeout set to ${opt.value}`;
    showToast(`Timeout 屏幕超时: ${opt.label}`);
  };

  const toggleService = (key: string) => {
    const current = !!services()[key];
    const next = !current;
    setServices((prev) => ({ ...prev, [key]: next }));
    const res = host?.__launcher?.(`SERVICE\t${key}.enabled`) ?? "Toggled";
    showToast(`${key}: ${next ? "ENABLED 已启用" : "DISABLED 已停用"}`);
  };

  const launchApp = (app: LauncherApp) => {
    showToast(`启动应用: ${app.name}...`);
    // Pulse animation
    const node = cardNodes.get(currentCardIndex());
    if (node) {
      animate(node, "scale", 1.15, { dur: 90, easing: "out" });
      setTimeout(() => {
        if (node) animate(node, "scale", 1.06, { dur: 140, easing: "spring-bouncy" });
      }, 100);
    }

    if (app.kind === "native") {
      const res = host?.__launcher?.(`LAUNCH\t${app.id}`) ?? "Opening application";
      return;
    }

    // Terminal app: switch to VT100 workspace
    setLauncherOpen(false);
    send("RESET\t0");
    if (app.id !== "terminal") {
      send(`0\tTEXT ${app.id === "gamepad" ? "/usr/bin/evtest /dev/input/event3" : `/usr/bin/heya-tool ${app.id} --inside`}`);
      send("0\tKEY ENTER");
    }
  };

  const launchDiagnosticTool = (tool: LauncherApp) => {
    showToast(`启动诊断工具: ${tool.name}...`);
    setLauncherOpen(false);
    send("RESET\t0");
    send(`0\tTEXT /usr/bin/heya-tool ${tool.id} --inside`);
    send("0\tKEY ENTER");
  };

  const activateCurrent = () => {
    const s = currentScreen();
    if (s <= 2) {
      const apps = currentApps();
      const app = apps[currentCardIndex()];
      if (app) launchApp(app);
      return;
    }
    if (s === 3) {
      // Settings Page
      const sel = settingsIndex();
      if (sel === 0) changeBrightness(5);
      else if (sel === 1) changeVolume(5);
      else if (sel === 2) toggleWifi();
      else if (sel === 3) toggleBluetooth();
      else if (sel === 4) cycleTimeout(1);
      else if (sel >= 5 && sel < 5 + SERVICE_KEYS.length) {
        toggleService(SERVICE_KEYS[sel - 5].key);
      } else if (sel === 5 + SERVICE_KEYS.length) {
        // Legacy settings
        showToast("打开高级设置...");
        setLauncherOpen(false);
        send("RESET\t0");
        send("0\tTEXT /usr/libexec/pocketjs-legacy-settings");
        send("0\tKEY ENTER");
      }
      return;
    }
    if (s === 4) {
      // System Page
      const tools = getAppsForScreen(4);
      const tool = tools[systemToolIndex()];
      if (tool) launchDiagnosticTool(tool);
    }
  };

  // -------------------------------------------------------------------------
  // Terminal Logic (Preserved)
  // -------------------------------------------------------------------------
  const applyRows = (payload: string) => {
    if (!payload) return;
    const changed = new Map<number, Run[]>();
    let nextCursor: { row: number; col: number; visible: boolean } | null = null;
    for (const record of payload.split("\n")) {
      if (!record) continue;
      const fields = record.split("\t");
      if (fields[0] === "C") {
        nextCursor = {
          row: Number(fields[1]) || 0,
          col: Number(fields[2]) || 0,
          visible: fields[3] === "1",
        };
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
        const text = parts
          .slice(3)
          .join(":")
          .replace(/\\t/g, "    ")
          .replace(/\\n/g, "")
          .replace(/\\\\/g, "\\");
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
    if (value)
      setInputHistory((items) => [value, ...items.filter((item) => item !== value)]);
    if (value) {
      send(`${active()}\tTEXT ${value}`);
      send(`${active()}\tKEY ENTER`);
    }
    setInput("");
    setInputOpen(false);
  };

  const selectInputEntry = (index: number) => {
    if (inputFunction() === 0) {
      const chars = [
        ...INPUT_LAYOUTS[inputLayout()].flatMap((line) => line.split(" ")),
        "SPACE",
        "BACKSPACE",
        "ENTER",
      ];
      const value = chars[index];
      if (value === "SPACE") setInput((text) => text + " ");
      else if (value === "BACKSPACE") setInput((text) => text.slice(0, -1));
      else if (value === "ENTER") submitInput();
      else if (value) setInput((text) => text + value);
      return;
    }
    const entries =
      inputFunction() === 1
        ? inputHistory().map((value) => [value, value])
        : INPUT_ENTRIES[inputFunction()];
    if (inputFunction() === 2 && index >= 6) return;
    if (entries[index]) setInput(entries[index][1]);
  };

  onMount(() => {
    send("RESIZE\t12x46");
    for (let id = 0; id < NAMES.length; id++) send(`${id}\tSTART`);
    log("Workspace Created WS1..WS5");
    syncHardwareLevels();
    syncHardwareStatus();

    onTextEvent((event: TextEvent) => {
      if (active() === 0 && launcherOpen()) {
        if (event.kind === "key" && event.pressed) {
          if (event.key === "ArrowLeft") {
            if (currentScreen() <= 2) moveCard(-1);
            else if (currentScreen() === 3) {
              const sel = settingsIndex();
              if (sel === 0) changeBrightness(-5);
              else if (sel === 1) changeVolume(-5);
              else if (sel === 2) toggleWifi();
              else if (sel === 3) toggleBluetooth();
              else if (sel === 4) cycleTimeout(-1);
            } else if (currentScreen() === 4) {
              setSystemToolIndex((p) => Math.max(0, p - 1));
            }
          } else if (event.key === "ArrowRight") {
            if (currentScreen() <= 2) moveCard(1);
            else if (currentScreen() === 3) {
              const sel = settingsIndex();
              if (sel === 0) changeBrightness(5);
              else if (sel === 1) changeVolume(5);
              else if (sel === 2) toggleWifi();
              else if (sel === 3) toggleBluetooth();
              else if (sel === 4) cycleTimeout(1);
            } else if (currentScreen() === 4) {
              setSystemToolIndex((p) => Math.min(getAppsForScreen(4).length - 1, p + 1));
            }
          } else if (event.key === "ArrowUp") {
            if (currentScreen() === 3) setSettingsIndex((p) => Math.max(0, p - 1));
          } else if (event.key === "ArrowDown") {
            if (currentScreen() === 3) setSettingsIndex((p) => Math.min(15, p + 1));
          } else if (event.key === "Enter") {
            activateCurrent();
          } else if (event.key === "Escape") {
            if (currentScreen() > 0) switchScreen(0, -1);
          } else if (event.key === "PageUp") {
            switchScreen(currentScreen() - 1, -1);
          } else if (event.key === "PageDown") {
            switchScreen(currentScreen() + 1, 1);
          }
        }
        return true;
      }

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
        if (event.key === "Escape") {
          setCommandOpen(false);
          setInput("");
        } else if (event.key === "Backspace") setInput((value) => value.slice(0, -1));
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
      if (
        [
          "ENTER",
          "BACKSPACE",
          "ARROWUP",
          "ARROWDOWN",
          "ARROWLEFT",
          "ARROWRIGHT",
          "TAB",
          "ESC",
          "CTRL_C",
          "CTRL_D",
          "CTRL_L",
          "HOME",
          "END",
        ].includes(key)
      )
        sendKey(key.replace("ARROW", ""));
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
    if (active() === LOG_WORKSPACE && armed && !inputOpen())
      applyRows(send(`SNAP\t${LOG_WORKSPACE}`));

    // Periodic hardware poll: levels every ~1s, battery/Wi-Fi/IP every ~5s
    // (the latter shells out to `ip`, so poll it less often).
    frameCounter++;
    if (frameCounter % 60 === 0) {
      syncHardwareLevels();
    }
    if (frameCounter % 300 === 0) {
      syncHardwareStatus();
    }

    if (!armed) {
      previousButtons = buttons;
      return;
    }
    const pressed = buttons & ~previousButtons;
    previousButtons = buttons;

    // -----------------------------------------------------------------------
    // Native Switch Launcher Input Mode
    // -------------------------------------------------------------------------
    if (active() === 0 && launcherOpen()) {
      // Shoulder triggers: smooth screen transition
      if (pressed & BTN.LTRIGGER) switchScreen(currentScreen() - 1, -1);
      if (pressed & BTN.RTRIGGER) switchScreen(currentScreen() + 1, 1);
      if (pressed & BTN.START) switchScreen(currentScreen() + 1, 1);

      // Select: open virtual keyboard
      if (pressed & BTN.SELECT) {
        setInput("");
        setInputOpen(true);
        setInputFunction(0);
        return;
      }

      // Directional D-pad
      if (pressed & BTN.LEFT) {
        if (currentScreen() <= 2) moveCard(-1);
        else if (currentScreen() === 3) {
          const sel = settingsIndex();
          if (sel === 0) changeBrightness(-5);
          else if (sel === 1) changeVolume(-5);
          else if (sel === 2) toggleWifi();
          else if (sel === 3) toggleBluetooth();
          else if (sel === 4) cycleTimeout(-1);
        } else if (currentScreen() === 4) {
          setSystemToolIndex((p) => Math.max(0, p - 1));
        }
      }
      if (pressed & BTN.RIGHT) {
        if (currentScreen() <= 2) moveCard(1);
        else if (currentScreen() === 3) {
          const sel = settingsIndex();
          if (sel === 0) changeBrightness(5);
          else if (sel === 1) changeVolume(5);
          else if (sel === 2) toggleWifi();
          else if (sel === 3) toggleBluetooth();
          else if (sel === 4) cycleTimeout(1);
        } else if (currentScreen() === 4) {
          setSystemToolIndex((p) => Math.min(getAppsForScreen(4).length - 1, p + 1));
        }
      }
      if (pressed & BTN.UP) {
        if (currentScreen() === 3) setSettingsIndex((p) => Math.max(0, p - 1));
      }
      if (pressed & BTN.DOWN) {
        if (currentScreen() === 3) setSettingsIndex((p) => Math.min(15, p + 1));
      }

      // Action buttons: CIRCLE (A) = confirm, CROSS (B) = back
      if (pressed & BTN.CIRCLE) activateCurrent();
      if (pressed & BTN.CROSS) {
        if (currentScreen() > 0) switchScreen(0, -1);
      }
      return;
    }

    // -----------------------------------------------------------------------
    // Virtual Keyboard / Input Workspace Input Mode
    // -----------------------------------------------------------------------
    if (inputOpen()) {
      const entries =
        inputFunction() === 1
          ? inputHistory().map((value) => [value, value])
          : INPUT_ENTRIES[inputFunction()];
      const selectionCount =
        inputFunction() === 0
          ? INPUT_LAYOUTS[inputLayout()].flatMap((line) => line.split(" ")).length + 3
          : entries.length;
      if (pressed & BTN.LEFT) setInputLayout((inputLayout() + 3) % 4);
      if (pressed & BTN.RIGHT) setInputLayout((inputLayout() + 1) % 4);
      if (pressed & BTN.LTRIGGER) setInputFunction((inputFunction() + 5) % 6);
      if (pressed & BTN.RTRIGGER) setInputFunction((inputFunction() + 1) % 6);
      if (pressed & BTN.UP)
        setInputSelection((inputSelection() + Math.max(1, selectionCount) - 1) % Math.max(1, selectionCount));
      if (pressed & BTN.DOWN)
        setInputSelection((inputSelection() + 1) % Math.max(1, selectionCount));
      if (pressed & BTN.CIRCLE) selectInputEntry(inputSelection());
      if (pressed & BTN.CROSS) setInputOpen(false);
      if (pressed & BTN.START) setInputFunction((inputFunction() + 1) % 6);
      if (pressed & BTN.SELECT) submitInput();
      return;
    }

    // -----------------------------------------------------------------------
    // Terminal Mode Controller Input
    // -----------------------------------------------------------------------
    if (pressed & BTN.LEFT) switchTo(active() - 1);
    if (pressed & BTN.RIGHT) switchTo(active() + 1);
    if (pressed & BTN.LTRIGGER) sendKey("PGUP");
    if (pressed & BTN.RTRIGGER) sendKey("PGDN");
    if (pressed & BTN.UP) sendKey("UP");
    if (pressed & BTN.DOWN) sendKey("DOWN");
    if (pressed & BTN.CIRCLE) {
      sendKey("ENTER");
      log(`Process Input WS${active() + 1}`);
    }
    if (pressed & BTN.CROSS) {
      sendKey("ESC");
      switchTo(0);
      setLauncherOpen(true);
    }
    if (pressed & BTN.START) switchTo(active() + 1);
    if (pressed & BTN.SELECT) {
      setInput("");
      setInputOpen(true);
      setInputFunction(0);
    }
  });

  const runColor = (run: Run) =>
    (run.flags & 2) !== 0
      ? { textColor: abgr(run.bg), bgColor: abgr(run.fg) }
      : { textColor: abgr(run.fg), bgColor: abgr(run.bg) };

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
      if (c.col < start || c.col >= end) {
        out.push(run);
        continue;
      }
      const offset = c.col - start;
      if (offset > 0) out.push({ ...run, text: chars.slice(0, offset).join("") });
      out.push({ ...run, text: chars[offset], flags: run.flags ^ 2 });
      if (offset + 1 < chars.length) out.push({ ...run, text: chars.slice(offset + 1).join("") });
    }
    if (c.col >= col) out.push({ text: " ", fg: 0xe5e5e5, bg: 0xe5e5e5, flags: 0 });
    return out;
  };

  const selectedApp = () => {
    const apps = currentApps();
    return apps[currentCardIndex()] || apps[0];
  };

  const settingsState = (): SettingsState => ({
    selectedIndex: settingsIndex(),
    brightness: brightness(),
    volume: volume(),
    wifi: wifiEnabled(),
    bluetooth: bluetoothEnabled(),
    timeoutIndex: timeoutIndex(),
    services: services(),
  });

  return (
    <View class="w-[360px] h-[240px] bg-[#0c131a] relative flex-col justify-between overflow-hidden">
      {/* ------------------------------------------------------------------- */}
      {/* View Branch A: Switch Native 5-Screen UI (active === 0 && launcherOpen) */}
      {/* ------------------------------------------------------------------- */}
      {active() === 0 && launcherOpen() ? (
        <View class="w-[360px] h-[240px] flex-col justify-between">
          {/* Persistent Top Status Bar */}
          <StatusBar
            currentScreen={currentScreen()}
            wifiConnected={wifiEnabled()}
            ipAddress={ipAddress()}
            bluetoothOn={bluetoothEnabled()}
            batteryLevel={batteryLevel()}
          />

          {/* Animated Page Container */}
          <View
            ref={(node: NodeMirror) => {
              pageNode = node;
            }}
            class="w-[360px] h-[198px] flex-col justify-between overflow-hidden relative"
          >
            {/* Screen 0, 1, 2: Switch Horizontal Card Carousel */}
            {currentScreen() <= 2 ? (
              <View class="w-[360px] h-[198px] flex-col justify-between px-2 py-1">
                {/* Active Card Title & Description Row */}
                <View class="w-[344px] h-[34px] flex-col justify-between">
                  <View class="flex-row items-center justify-between">
                    <Text class="text-sm font-bold text-white">
                      {selectedApp()?.name}
                    </Text>
                    <View
                      class={
                        selectedApp()?.kind === "native"
                          ? "px-1 rounded-sm bg-emerald-950"
                          : "px-1 rounded-sm bg-sky-950"
                      }
                    >
                      <Text
                        class={
                          selectedApp()?.kind === "native"
                            ? "text-xs font-bold text-emerald-400"
                            : "text-xs font-bold text-sky-400"
                        }
                      >
                        {selectedApp()?.kind === "native" ? "[ 原生 NATIVE ]" : "[ 终端 VT100 ]"}
                      </Text>
                    </View>
                  </View>
                  <Text class="text-xs text-slate-400">
                    {selectedApp()?.description}
                  </Text>
                </View>

                {/* Horizontal Card Carousel */}
                <CardCarousel
                  apps={currentApps()}
                  selectedIndex={currentCardIndex()}
                  onMountCarousel={(node) => {
                    carouselNode = node;
                  }}
                  onMountCard={(idx, node) => {
                    cardNodes.set(idx, node);
                  }}
                />

                {/* Action Feedback Bar */}
                <View class="w-[344px] h-[20px] flex-row items-center justify-between">
                  <Text class="text-xs text-slate-500">
                    {currentCardIndex() + 1} / {currentApps().length} · A 确认 · ◀▶ 移动
                  </Text>
                  <View
                    ref={(node: NodeMirror) => {
                      toastNode = node;
                    }}
                    class="px-2 h-[18px] rounded-md bg-[#164e63] border border-[#38bdf8] items-center justify-center opacity-0"
                  >
                    <Text class="text-xs font-mono text-cyan-200">
                      {toastMessage()}
                    </Text>
                  </View>
                </View>
              </View>
            ) : currentScreen() === 3 ? (
              /* Screen 3: Settings Page */
              <SettingsPage state={settingsState()} />
            ) : (
              /* Screen 4: System Information Page */
              <SystemPage
                selectedToolIndex={systemToolIndex()}
                systemTools={getAppsForScreen(4)}
                ipAddress={ipAddress()}
              />
            )}
          </View>

          {/* Bottom Navigation Hint Bar */}
          <View class="w-[360px] h-[20px] bg-[#0c131a] flex-col justify-between">
            <View class="w-[360px] h-[1px] bg-[#1f2d3d]" />
            <View class="w-[360px] h-[19px] flex-row items-center justify-between px-2">
              <Text class="text-xs text-slate-400">
                L/R 切屏 · ◀▶ 选择 · A 确认 · B 返回
              </Text>
              <Text class="text-xs text-[#38bdf8]">
                SELECT 输入键盘
              </Text>
            </View>
          </View>
        </View>
      ) : (
        /* ----------------------------------------------------------------- */
        /* View Branch B: Terminal Workspace (active > 0 or !launcherOpen)   */
        /* ----------------------------------------------------------------- */
        <View class="w-[360px] h-[240px] bg-slate-950 flex-col">
          <View class="absolute left-[10px] top-[1px] w-[340px] h-[24px] items-center">
            <Text class="text-2xl font-bold text-emerald-300">
              ◀ WS{active() + 1}:{active() === 0 && !launcherOpen() ? "TERMINAL" : NAMES[active()]} ▶
            </Text>
            <View class="absolute left-[326px] top-[4px] w-[24px] h-[16px] items-center">
              <Text class="text-base text-emerald-300">{"\uf240"}</Text>
            </View>
          </View>

          <View class="absolute left-[10px] top-[28px] w-[340px] h-[192px] flex-col">
            <Index each={lines()}>
              {(runs, rowIndex) => (
                <View class="w-[340px] h-[16px] flex-row">
                  <Index each={withCursor(runs(), rowIndex)}>
                    {(run) => {
                      const c = runColor(run());
                      return (
                        <Text
                          class="text-xs font-mono"
                          style={{ textColor: c.textColor, bgColor: c.bgColor }}
                        >
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
            ) : (
              <View class="w-[0px] h-[0px]" />
            )}
          </View>

          <View class="absolute left-[10px] top-[222px] w-[340px] h-[16px] items-center">
            <Text class="text-xs text-slate-500">
              START 切换 · SELECT 输入 · A 确认 · B 返回启动器
            </Text>
          </View>
        </View>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Modal Overlay: Virtual Keyboard / Input Workspace (Preserved)      */}
      {/* ------------------------------------------------------------------- */}
      {inputOpen() ? (
        <View class="absolute left-0 top-0 w-[360px] h-[240px] bg-slate-950 flex-col">
          <View class="absolute left-[10px] top-[1px] w-[340px] h-[24px] items-center">
            <Text class="text-2xl font-bold text-emerald-300">INPUT</Text>
          </View>
          <View class="absolute left-[10px] top-[28px] w-[340px] h-[16px] bg-slate-800">
            <Text class="text-xs font-mono text-white">{">"} {input()}█</Text>
          </View>
          <View class="absolute left-[10px] top-[48px] w-[340px] h-[152px] flex-col">
            {inputFunction() === 0 ? (
              <>
                <View class="w-[340px] h-[16px] flex-row">
                  <Index each={["ABC", "123", "SYM", "PATH"]}>
                    {(label, i) => (
                      <Text
                        class={
                          inputLayout() === i
                            ? "text-xs font-mono text-slate-950 bg-emerald-300"
                            : "text-xs font-mono text-slate-300 bg-slate-800"
                        }
                      >
                        {label()}
                      </Text>
                    )}
                  </Index>
                </View>
                <Index each={INPUT_LAYOUTS[inputLayout()]}>
                  {(line, row) => (
                    <View class="w-[340px] h-[22px] flex-row">
                      <Index each={line().split(" ")}>
                        {(key, col) => (
                          <Text
                            class={
                              inputSelection() ===
                              INPUT_LAYOUTS[inputLayout()]
                                .slice(0, row)
                                .reduce((count, line) => count + line.split(" ").length, 0) +
                                col
                                ? "text-xs font-mono text-slate-950 bg-emerald-300"
                                : "text-xs font-mono text-slate-100 bg-slate-800"
                            }
                          >
                            {key()}
                          </Text>
                        )}
                      </Index>
                    </View>
                  )}
                </Index>
                <View class="w-[340px] h-[20px] flex-row">
                  <Index each={["SPACE", "BACKSPACE", "ENTER"]}>
                    {(label, i) => (
                      <Text
                        class={
                          inputSelection() ===
                          INPUT_LAYOUTS[inputLayout()].flatMap((line) => line.split(" ")).length + i
                            ? "text-xs font-mono text-slate-950 bg-emerald-300"
                            : "text-xs font-mono text-slate-100 bg-slate-800"
                        }
                      >
                        {label()}　
                      </Text>
                    )}
                  </Index>
                </View>
              </>
            ) : (
              <Index
                each={inputEntries().slice(inputListStart(), inputListStart() + 8)}
              >
                {(entry, i) => (
                  <View
                    class={
                      inputSelection() === i + inputListStart()
                        ? "w-[340px] h-[18px] bg-emerald-300"
                        : "w-[340px] h-[18px] bg-slate-800"
                    }
                  >
                    <Text class="text-xs font-mono text-white">{entry()[0]}</Text>
                  </View>
                )}
              </Index>
            )}
          </View>
          <View class="absolute left-[5px] top-[202px] w-[350px] h-[16px] flex-row">
            <Index each={INPUT_TABS}>
              {(tab, i) => (
                <Text
                  class={
                    inputFunction() === i
                      ? "text-xs font-mono text-slate-950 bg-emerald-300"
                      : "text-xs font-mono text-slate-300 bg-slate-800"
                  }
                >
                  {tab()}
                </Text>
              )}
            </Index>
          </View>
          <View class="absolute left-[10px] top-[220px] w-[340px] h-[16px]">
            <Text class="text-xs text-slate-500">
              L/R布局 · L1/R1功能 · A选择 · B退出
            </Text>
          </View>
        </View>
      ) : (
        <View class="w-[0px] h-[0px]" />
      )}
    </View>
  );
});
