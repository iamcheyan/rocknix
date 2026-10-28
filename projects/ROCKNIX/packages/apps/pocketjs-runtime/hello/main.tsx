import { createSignal, For, onMount } from "solid-js";
import { mount } from "@pocketjs/framework/solid";
import { ActionHandler, Text, View } from "@pocketjs/framework/solid/components";
import { BTN, onTextEvent, type TextEvent } from "@pocketjs/framework/input";
import { onFrame } from "@pocketjs/framework/lifecycle";
type HostUI = { __pocketshell?: (command: string) => string };
const names = ["SHELL", "FILES", "VIM", "TOP", "LOG"];
const colors = ["text-xs font-mono text-emerald-200", "text-xs font-mono text-slate-200", "text-xs font-mono text-cyan-200", "text-xs font-mono text-amber-200", "text-xs font-mono text-slate-400"];
mount(() => {
  const global = globalThis as typeof globalThis & { ui?: HostUI; __pocketshellOutput?: string };
  const host = global.ui;
  const [active, setActive] = createSignal(0);
  const [rows, setRows] = createSignal(names.map((name) => [`${name} starting…`]) as string[][]);
  const [input, setInput] = createSignal("");
  const [commandOpen, setCommandOpen] = createSignal(false);
  const [offset, setOffset] = createSignal(names.map(() => 0));
  let armed = false;
  let previousButtons = 0;
  const send = (command: string) => host?.__pocketshell?.(command) ?? "";
  const log = (entry: string) => send(`LOG\t${entry.replace(/[\t\r\n]/g, " ").slice(0, 120)}`);
  const appendOutput = (payload: string) => {
    for (const record of payload.split("\n")) {
      if (!record) continue;
      const fields = record.split("\t");
      if (fields[0] !== "O" || fields.length < 3) continue;
      const id = Number(fields[1]);
      if (!Number.isInteger(id) || id < 0 || id >= 5) continue;
      const text = fields.slice(2).join("\t").replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\t/g, "    ").replace(/\\\\/g, "\\");
      setRows((old) => old.map((lines, index) => index === id ? [...lines, ...text.split("\n").filter(Boolean)].slice(-256) : lines));
    }
  };
  onMount(() => { for (let id = 0; id < 5; id++) send(`${id}\tSTART`); log("Workspace Created WS1..WS5"); });
  const switchTo = (id: number) => { const next = (id + names.length) % names.length; setActive(next); log(`Workspace Switched WS${next + 1}`); };
  const scroll = (delta: number) => setOffset((old) => old.map((value, id) => id === active() ? Math.max(0, Math.min(Math.max(0, rows()[id].length - 19), value + delta)) : value));
  const sendKey = (key: string) => send(`${active()}\tKEY ${key}`);
  const handleText = (event: TextEvent) => {
    if (event.kind === "commit") { if (commandOpen()) setInput((value) => value + event.text); else send(`${active()}\tTEXT ${event.text}`); return true; }
    if (event.kind !== "key" || !event.pressed) return false;
    if (commandOpen()) {
      if (event.key === "Escape") { setCommandOpen(false); setInput(""); }
      else if (event.key === "Backspace") setInput((value) => value.slice(0, -1));
      else if (event.key === "Enter") { const value = input(); setInput(""); setCommandOpen(false); if (value) send(`0\tTEXT ${value}`); send("0\tKEY ENTER"); log("Process Input WS1"); }
      return true;
    }
    const key = event.key.replace(/^Control\+/, "CTRL_").toUpperCase();
    if (["ENTER", "BACKSPACE", "ARROWUP", "ARROWDOWN", "ARROWLEFT", "ARROWRIGHT", "TAB", "ESC", "CTRL_C", "CTRL_D"].includes(key)) sendKey(key.replace("ARROW", ""));
    return true;
  };
  onFrame((buttons: number) => {
    if (buttons === 0) armed = true;
    appendOutput(global.__pocketshellOutput ?? "");
    delete global.__pocketshellOutput;
    if (active() === 4) { const log = send("4\tSNAP"); if (log) setRows((old) => old.map((lines, index) => index === 4 ? log.split("\n") : lines)); }
    if (!armed) { previousButtons = buttons; return; }
    const pressed = buttons & ~previousButtons;
    previousButtons = buttons;
    if (pressed & BTN.LEFT) switchTo(active() - 1);
    if (pressed & BTN.RIGHT) switchTo(active() + 1);
    if (pressed & BTN.LTRIGGER) scroll(15);
    if (pressed & BTN.RTRIGGER) scroll(-15);
    if (pressed & BTN.UP) scroll(1);
    if (pressed & BTN.DOWN) scroll(-1);
    if (pressed & BTN.CIRCLE) { sendKey("ENTER"); log(`Process Input WS${active() + 1}`); }
    if (pressed & BTN.CROSS) switchTo(0);
    if (pressed & BTN.START) switchTo(active() + 1);
    if (pressed & BTN.SELECT) { setActive(0); setInput(""); setCommandOpen(true); }
  });
  const visible = () => { const lines = rows()[active()]; const end = Math.max(1, lines.length - offset()[active()]); return lines.slice(Math.max(0, end - 19), end); };
  return <View class="w-[720px] h-[480px] bg-slate-950">
    <View class="absolute left-[20px] top-[8px] w-[680px] h-[31px] items-center"><Text class="text-base font-mono font-bold text-emerald-300">◀ WS{active() + 1}:{names[active()]} ▶</Text></View>
    <View class="absolute left-[20px] top-[45px] w-[680px] h-[390px] flex-col"><For each={visible()}>{(line) => <Text class={colors[active()]}>{line || " "}</Text>}</For>{active() === 0 ? <Text class="text-xs font-mono text-white">{commandOpen() ? ": " : "$ "}{input()}█</Text> : <View class="w-[1px] h-[1px]" />}</View>
    <View class="absolute left-[20px] top-[440px] w-[680px] h-[24px] items-center"><Text class="text-xs font-mono text-slate-500">L/R Workspace　L1/R1 翻页　↑↓ 滚动　A Enter　B Shell　START 列表　SELECT 命令面板</Text></View>
    <ActionHandler button={BTN.LEFT} onPress={() => switchTo(active() - 1)} /><ActionHandler button={BTN.RIGHT} onPress={() => switchTo(active() + 1)} /><ActionHandler button={BTN.LTRIGGER} onPress={() => scroll(15)} /><ActionHandler button={BTN.RTRIGGER} onPress={() => scroll(-15)} /><ActionHandler button={BTN.UP} onPress={() => scroll(1)} /><ActionHandler button={BTN.DOWN} onPress={() => scroll(-1)} /><ActionHandler button={BTN.CIRCLE} onPress={() => sendKey("ENTER")} /><ActionHandler button={BTN.CROSS} onPress={() => switchTo(0)} /><ActionHandler button={BTN.START} onPress={() => switchTo(active() + 1)} /><ActionHandler button={BTN.SELECT} onPress={() => { setActive(0); setInput(""); setCommandOpen(true); }} />
  </View>;
});