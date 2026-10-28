import { createSignal, For } from "solid-js";
import { mount } from "@pocketjs/framework/solid";
import { ActionHandler, Text, View } from "@pocketjs/framework/solid/components";
import { BTN } from "@pocketjs/framework/input";
import { onFrame } from "@pocketjs/framework/lifecycle";

const applications = [
  ["File Manager", "disk"], ["Terminal", "terminal"], ["XMPlayer", "xmplayer"],
  ["System Information", "system-info"], ["Storage Information", "storage-info"],
  ["Network Information", "network-info"], ["USB Devices", "usb-info"],
  ["Input Devices", "input-info"], ["System Logs", "system-log"], ["Kernel Logs", "kernel-log"],
  ["System Monitor", "monitor"], ["Process Manager", "processes"], ["Audio Mixer", "audio-mixer"],
  ["Midnight Commander", "file-manager-text"], ["Text Editor", "notes"],
  ["Clean macOS Metadata", "clean-mac-files"], ["Cloud Backup", "cloud-backup"],
  ["Cloud Restore", "cloud-restore"], ["Gamepad Test", "gamepad"],
] as const;
const services = ["adbd", "avahi", "ftp", "http", "rsyncd", "samba", "syncthing", "telnet", "ssh"] as const;
const pages = ["Applications", "Services", "Settings"] as const;
type KoroUI = { __koroAction?: (action: string) => boolean; __koroTheme?: () => string };

mount(() => {
  const [page, setPage] = createSignal(0);
  const [selected, setSelected] = createSignal(0);
  const ui = (globalThis as typeof globalThis & { ui?: KoroUI }).ui;
  const [theme, setTheme] = createSignal(ui?.__koroTheme?.() === "light" ? "Light" : "Dark");
  const [message, setMessage] = createSignal("A: Open   B: Back   L/R: Section");
  let inputArmed = false;
  onFrame((buttons: number) => { if (buttons === 0) inputArmed = true; });
  const whenReady = (action: () => void) => () => { if (inputArmed) action(); };
  const entries = () => page() === 0 ? applications.map(([name, id]) => [name, id] as const)
    : page() === 1 ? services.map((id) => [id.toUpperCase(), id] as const)
    : [[`Theme: ${theme()}`, "theme"], ["System Information", "system-info"]] as const;
  const visible = () => entries().slice(Math.max(0, Math.min(selected() - 4, entries().length - 7)), Math.max(0, Math.min(selected() - 4, entries().length - 7)) + 7);
  const move = (delta: number) => setSelected((value) => Math.max(0, Math.min(entries().length - 1, value + delta)));
  const switchPage = (delta: number) => {
    setPage((value) => (value + delta + pages.length) % pages.length);
    setSelected(0);
    setMessage("A: Open   B: Back   L/R: Section");
  };
  const activate = () => {
    const [label, id] = entries()[selected()] ?? ["", ""];
    if (id === "theme") {
      const next = theme() === "Dark" ? "Light" : "Dark";
      if (ui?.__koroAction?.(`theme:${next.toLowerCase()}`)) {
        setTheme(next);
        setMessage(`Saved ${next} theme`);
      }
      return;
    }
    const request = page() === 1 ? `service:${id}:toggle` : `launch:${id}`;
    setMessage(ui?.__koroAction?.(request) ? `Opening ${label}…` : "Launcher host unavailable");
  };
  const back = () => {
    setPage(0);
    setSelected(0);
    setMessage("Applications");
  };
  return (
    <View class={theme() === "Dark" ? "w-full h-full bg-slate-950 p-6 flex-col gap-2" : "w-full h-full bg-slate-200 p-6 flex-col gap-2"}>
      <Text class="text-2xl font-bold text-emerald-300">KoroOS</Text>
      <Text class="text-lg text-white">{pages[page()]}</Text>
      <For each={visible()}>{(entry) => (
        <Text class={entries()[selected()]?.[1] === entry[1] ? "text-base text-emerald-300" : "text-base text-slate-300"}>
          {entries()[selected()]?.[1] === entry[1] ? "▶ " : "  "}{entry[0]}
        </Text>
      )}</For>
      <Text class="text-base text-slate-400">{message()}</Text>
      <Text class="text-sm text-slate-500">{`UP/DOWN Select   A Open   B Back   L/R Sections`}</Text>
      <ActionHandler button={BTN.UP} onPress={whenReady(() => move(-1))} />
      <ActionHandler button={BTN.DOWN} onPress={whenReady(() => move(1))} />
      <ActionHandler button={BTN.LEFT} onPress={whenReady(() => switchPage(-1))} />
      <ActionHandler button={BTN.RIGHT} onPress={whenReady(() => switchPage(1))} />
      <ActionHandler button={BTN.LTRIGGER} onPress={whenReady(() => switchPage(-1))} />
      <ActionHandler button={BTN.RTRIGGER} onPress={whenReady(() => switchPage(1))} />
      <ActionHandler button={BTN.CIRCLE} onPress={whenReady(activate)} />
      <ActionHandler button={BTN.CROSS} onPress={whenReady(back)} />
      <ActionHandler button={BTN.START} onPress={whenReady(() => { setPage(0); setSelected(2); setMessage("XMPlayer selected"); })} />
    </View>
  );
});
