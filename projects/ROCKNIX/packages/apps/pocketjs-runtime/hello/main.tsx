// PocketShell Launcher V2 — the handheld home screen.
//
// Nintendo Switch information architecture on a 360x240 logical grid presented
// at an exact 2x (720x480): a 12 px status bar, one horizontal content flow, a
// persistent bottom navigation, and X/Y overlays for search and history.
//
// Input is complete on the pad alone (issue #92 item 5):
//   D-pad       move / adjust          A (CIRCLE)  open / apply
//   B (CROSS)   back / close overlay   L1/R1        previous / next category
//   START       open the terminal       SELECT       favorites toggle
//   X (SQUARE)  search                 Y (TRIANGLE) recent
//
// The app owns no OS knowledge: every read and mutation goes through the
// `ui.__launcher` bridge, and the PTY terminal stays on `ui.__pocketshell` in
// terminal-workspace.tsx.

import { createSignal, onMount, Show } from "solid-js";
import { mount } from "@pocketjs/framework/solid";
import { Text, View } from "@pocketjs/framework/solid/components";
import { BTN, onTextEvent, type TextEvent } from "@pocketjs/framework/input";
import { onFrame } from "@pocketjs/framework/lifecycle";
import { BottomNav } from "./bottom-nav";
import { ContentFlow } from "./content-flow";
import { Overlay } from "./overlay";
import { SettingsPage, buildSettingGroups, type SettingsValues } from "./settings-page";
import { StatusBar } from "./status-bar";
import { createTerminalWorkspace } from "./terminal-workspace";
import { CATEGORY_ORDER, itemsForCategory, itemsFromApps, itemsFromLibrary, recentItems, searchItems, toolItems, type CategoryId, type ContentItem, type LibraryPayload } from "./model";
import { COLORS, CONTENT_H, CONTENT_TOP, SCREEN } from "./theme";
import { JA, TIMEOUT_KEYS, SERVICE_KEYS, type TimeoutKey } from "./strings";
import * as bridge from "./bridge";

/** PTY apps are started by typing their command into the shell workspace. */
const TERMINAL_COMMANDS: Readonly<Record<string, string>> = {
  gamepad: "/usr/bin/evtest /dev/input/event3",
  "clean-mac-files": "/usr/bin/heya-tool clean-mac-files --inside",
  "cloud-backup": "/usr/bin/heya-tool cloud-backup --inside",
  "cloud-restore": "/usr/bin/heya-tool cloud-restore --inside",
  "audio-mixer": "/usr/bin/heya-tool audio-mixer --inside",
  "file-manager-text": "/usr/bin/heya-tool file-manager-text --inside",
  notes: "/usr/bin/heya-tool notes --inside",
  monitor: "/usr/bin/heya-tool monitor --inside",
  "system-info": "/usr/bin/heya-tool system-info --inside",
  processes: "/usr/bin/heya-tool processes --inside",
  "storage-info": "/usr/bin/heya-tool storage-info --inside",
  "network-info": "/usr/bin/heya-tool network-info --inside",
  "usb-info": "/usr/bin/heya-tool usb-info --inside",
  "input-info": "/usr/bin/heya-tool input-info --inside",
  "kernel-log": "/usr/bin/heya-tool kernel-log --inside",
  "system-log": "/usr/bin/heya-tool system-log --inside",
};

const CATEGORY_TITLES: Readonly<Record<CategoryId, string>> = {
  all: JA.categories.all,
  media: JA.categories.media,
  games: JA.categories.games,
  favorites: JA.categories.favorites,
  settings: JA.categories.settings,
};

const SETTING_GROUP_COUNT = 5;

mount(() => {
  const terminal = createTerminalWorkspace();
  const [category, setCategory] = createSignal(0);
  const [selected, setSelected] = createSignal(0);
  const [overlay, setOverlay] = createSignal<"search" | "recent" | null>(null);
  const [query, setQuery] = createSignal("");
  const [notice, setNotice] = createSignal("");
  const [favorites, setFavorites] = createSignal<readonly string[]>([]);
  const [recent, setRecent] = createSignal<readonly string[]>([]);
  const [library, setLibrary] = createSignal<readonly ContentItem[]>([]);
  const [scanning, setScanning] = createSignal(false);
  const [status, setStatus] = createSignal(bridge.readStatus());
  const [settings, setSettings] = createSignal<SettingsValues>({ wifi: "unknown", bluetooth: "unknown", services: {}, timeout: "30m" });
  const [settingGroup, setSettingGroup] = createSignal(0);
  const [settingRow, setSettingRow] = createSignal(0);
  const [adbOn, setAdbOn] = createSignal(false);

  const apps = itemsFromApps();
  const tools = toolItems();
  const activeCategory = (): CategoryId => CATEGORY_ORDER[category()];

  const refreshLibrary = () => {
    setScanning(true);
    try {
      setLibrary(itemsFromLibrary(JSON.parse(bridge.readLibrary()) as LibraryPayload));
    } catch {
      setLibrary([]);
    }
    setScanning(false);
  };

  const refreshStatus = () => {
    setStatus(bridge.readStatus());
    setAdbOn(bridge.readService("adbusb") === "on");
  };

  const refreshSettings = () => {
    const services: Record<string, "on" | "off" | "unknown"> = {};
    for (const key of SERVICE_KEYS) services[key] = bridge.readService(key);
    setSettings({
      brightness: bridge.readLevel("brightness"),
      volume: bridge.readLevel("volume"),
      wifi: status().wifi,
      bluetooth: status().bluetooth,
      services,
      timeout: bridge.readTimeout(),
    });
  };

  const persist = () => bridge.writePreferences({ favorites: [...favorites()], recent: [...recent()] });

  const remember = (key: string) => {
    setRecent((current) => [key, ...current.filter((entry) => entry !== key)].slice(0, 24));
    persist();
  };

  const currentItems = (): ContentItem[] => {
    const active = activeCategory();
    if (active === "settings") return tools;
    return itemsForCategory(active, apps, library(), favorites(), recent());
  };

  const overlayItems = (): ContentItem[] => overlay() === "search"
    ? searchItems(query(), apps, library(), recent())
    : recentItems(recent(), apps, library());

  const itemCount = () => overlay() ? overlayItems().length : currentItems().length;

  const setCategoryBy = (step: number) => {
    setCategory((category() + step + CATEGORY_ORDER.length) % CATEGORY_ORDER.length);
    setSelected(0);
    setNotice("");
    if (activeCategory() === "settings") refreshSettings();
  };

  const move = (step: number) => {
    const count = itemCount();
    if (count > 0) setSelected((selected() + step + count) % count);
  };

  const openItem = (item: ContentItem | undefined) => {
    if (!item) return;
    remember(item.key);
    if (item.kind === "rom" && item.path) {
      setNotice(bridge.launchRom(item.path) || JA.notice.launchFailed);
      return;
    }
    const app = item.app;
    if (!app) return;
    if (app.kind === "native") {
      setNotice(bridge.launchNative(app.id) || JA.notice.starting);
      return;
    }
    terminal.show(0);
    const command = TERMINAL_COMMANDS[app.id];
    if (command) bridge.sendTerminal(`0\tTEXT ${command}\n`);
  };

  const toggleFavorite = () => {
    const item = currentItems()[selected()];
    if (!item) return;
    setFavorites((current) => current.includes(item.key)
      ? current.filter((key) => key !== item.key)
      : [item.key, ...current]);
    persist();
  };

  const adjustSetting = (direction: number) => {
    const row = buildSettingGroups(settings())[settingGroup()]?.rows[settingRow()];
    if (!row) return;
    switch (row.kind) {
      case "level": {
        const current = row.id === "brightness" ? settings().brightness : settings().volume;
        const floor = row.id === "brightness" ? 5 : 0;
        bridge.setLevel(row.id, Math.min(100, Math.max(floor, (current ?? 50) + direction * 5)));
        break;
      }
      case "timeout": {
        const index = TIMEOUT_KEYS.indexOf(row.value as TimeoutKey);
        bridge.setTimeout_(TIMEOUT_KEYS[(index + direction + TIMEOUT_KEYS.length) % TIMEOUT_KEYS.length]);
        break;
      }
      case "radio":
        bridge.setRadio(row.id, row.value !== "on");
        break;
      case "service":
        bridge.toggleService(row.id);
        break;
      case "open":
        terminal.show(1);
        bridge.sendTerminal("1\tTEXT /usr/libexec/pocketjs-legacy-settings\n");
        break;
    }
    refreshSettings();
    refreshStatus();
  };

  const openOverlay = (mode: "search" | "recent") => {
    setQuery("");
    setSelected(0);
    setOverlay(mode);
  };

  /** Keyboard support mirrors the pad, so a dev root or SSH session also works. */
  const handleKey = (key: string) => {
    if (overlay()) {
      if (key === "Escape") { setOverlay(null); setSelected(0); setQuery(""); return; }
      if (key === "Enter") { openItem(overlayItems()[selected()]); return; }
      if (key === "ArrowLeft") { move(-1); return; }
      if (key === "ArrowRight") { move(1); return; }
      if (key === "Backspace") { setQuery((value) => value.slice(0, -1)); setSelected(0); return; }
      if (key.length === 1) { setQuery((value) => value + key); setSelected(0); }
      return;
    }
    if (key === "ArrowLeft" || key === "ArrowRight") {
      const direction = key === "ArrowLeft" ? -1 : 1;
      if (activeCategory() === "settings") {
        const rows = buildSettingGroups(settings())[settingGroup()]?.rows.length ?? 1;
        setSettingRow((settingRow() + direction + rows) % rows);
      } else {
        move(direction);
      }
      return;
    }
    if (key === "ArrowUp" || key === "ArrowDown") {
      if (activeCategory() === "settings") {
        setSettingGroup((settingGroup() + (key === "ArrowUp" ? SETTING_GROUP_COUNT - 1 : 1)) % SETTING_GROUP_COUNT);
        setSettingRow(0);
      }
      return;
    }
    if (key === "Enter") {
      if (activeCategory() === "settings") adjustSetting(1);
      else openItem(currentItems()[selected()]);
    }
  };

  onMount(() => {
    const preferences = bridge.readPreferences();
    setFavorites(preferences.favorites);
    setRecent(preferences.recent);
    refreshLibrary();
    refreshStatus();
    refreshSettings();

    onTextEvent((event: TextEvent) => {
      if (terminal.active()) return false;
      if (event.kind === "key" && event.pressed) { handleKey(event.key); return true; }
      if (overlay() === "search" && event.kind === "commit") {
        setQuery((value) => value + event.text);
        setSelected(0);
        return true;
      }
      return false;
    });
  });

  let armed = false;
  let previous = 0;
  let framesSinceRefresh = 0;
  onFrame((buttons: number) => {
    // The status bar is live (issue #92): re-read it about once a second
    // without ever blocking the frame on a bridge call per tick.
    if (++framesSinceRefresh >= 60) {
      framesSinceRefresh = 0;
      refreshStatus();
    }
    if (buttons === 0) armed = true;
    if (!armed) { previous = buttons; return; }
    if (terminal.active()) return;
    const pressed = buttons & ~previous;
    previous = buttons;

    if (overlay()) {
      if (pressed & BTN.CROSS) { setOverlay(null); setSelected(0); setQuery(""); }
      if (pressed & BTN.LEFT) move(-1);
      if (pressed & BTN.RIGHT) move(1);
      if (pressed & BTN.CIRCLE) openItem(overlayItems()[selected()]);
      if (pressed & BTN.SQUARE) openOverlay(overlay() === "search" ? "recent" : "search");
      return;
    }

    if (pressed & BTN.LTRIGGER) setCategoryBy(-1);
    if (pressed & BTN.RTRIGGER) setCategoryBy(1);
    if (pressed & BTN.SQUARE) { openOverlay("search"); return; }
    if (pressed & BTN.TRIANGLE) { openOverlay("recent"); return; }

    if (activeCategory() === "settings") {
      if (pressed & BTN.LEFT) adjustSetting(-1);
      if (pressed & BTN.RIGHT) adjustSetting(1);
      if (pressed & BTN.UP) { setSettingGroup((settingGroup() + SETTING_GROUP_COUNT - 1) % SETTING_GROUP_COUNT); setSettingRow(0); }
      if (pressed & BTN.DOWN) { setSettingGroup((settingGroup() + 1) % SETTING_GROUP_COUNT); setSettingRow(0); }
      if (pressed & BTN.CIRCLE) adjustSetting(1);
      if (pressed & BTN.CROSS) setCategoryBy(-1);
      return;
    }

    if (pressed & BTN.LEFT) move(-1);
    if (pressed & BTN.RIGHT) move(1);
    if (pressed & BTN.CIRCLE) openItem(currentItems()[selected()]);
    if (pressed & BTN.CROSS) setCategoryBy(-1);
    if (pressed & BTN.SELECT) toggleFavorite();
    if (pressed & BTN.START) terminal.show(0);
  });

  return (
    <View class="absolute left-0 top-0" style={{ width: SCREEN.w, height: SCREEN.h, bgColor: COLORS.bg }}>
      <Show when={terminal.active()} fallback={
        <>
          <StatusBar
            status={status()}
            wifi={status().wifi}
            bluetooth={status().bluetooth}
            adb={adbOn()}
            category={CATEGORY_TITLES[activeCategory()]}
          />

          <Show when={overlay()}>
            <Overlay
              mode={overlay() ?? "search"}
              query={query()}
              items={overlayItems()}
              selected={selected()}
              favorites={favorites()}
            />
          </Show>

          <Show when={!overlay()}>
            <Show when={activeCategory() === "settings"} fallback={
              <ContentFlow
                items={currentItems()}
                selected={selected()}
                favorites={favorites()}
                emptyLabel={scanning() ? JA.scanning : JA.empty}
              />
            }>
              <SettingsPage groups={buildSettingGroups(settings())} group={settingGroup()} row={settingRow()} />
            </Show>
          </Show>

          <Show when={notice().length > 0}>
            <View class="absolute" style={{ insetL: 4, insetT: CONTENT_TOP + CONTENT_H - 12, width: 352, height: 12 }}>
              <Text class="text-2xs" style={{ textColor: COLORS.warning }}>{notice()}</Text>
            </View>
          </Show>

          <BottomNav active={activeCategory()} />
        </>
      }>
        {terminal.view()}
      </Show>
    </View>
  );
});
