// Host bridge and persisted launcher state (issue #92).
//
// The launcher never touches the OS itself: every read and mutation goes
// through `ui.__launcher`, the Rust bridge in scripts/pocketshell-launcher.rs,
// which already owns backlight, volume, wireless, services and screen timeout.
// This module adds the two V2 preferences (favorites, recents) on the same
// persistent settings file, and degrades to in-memory state when the bridge is
// absent (browser preview, harness).

export interface HostUi {
  __launcher?: (command: string) => string;
  __pocketshell?: (command: string) => string;
}

export type LauncherState = {
  favorites: string[];
  recent: string[];
};

const EMPTY_STATE: LauncherState = { favorites: [], recent: [] };
const RECENT_LIMIT = 24;

function host(): HostUi | undefined {
  return (globalThis as typeof globalThis & { ui?: HostUi }).ui;
}

/** Read a launcher preference. The bridge answers `PREF` with raw JSON. */
export function readPreferences(): LauncherState {
  const raw = host()?.__launcher?.("PREF");
  if (!raw) return EMPTY_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<LauncherState>;
    const strings = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
    return { favorites: strings(parsed.favorites), recent: strings(parsed.recent) };
  } catch {
    return EMPTY_STATE;
  }
}

/** Persist the whole preference record; the bridge writes atomically. */
export function writePreferences(state: LauncherState): boolean {
  const result = host()?.__launcher?.(`PREFSET\t${JSON.stringify({ favorites: state.favorites, recent: state.recent.slice(0, RECENT_LIMIT) })}`);
  return result === "ok";
}

export function withRecent(state: LauncherState, key: string): LauncherState {
  return { ...state, recent: [key, ...state.recent.filter((entry) => entry !== key)].slice(0, RECENT_LIMIT) };
}

export function withFavoriteToggled(state: LauncherState, key: string): LauncherState {
  const starred = state.favorites.includes(key);
  return { ...state, favorites: starred ? state.favorites.filter((entry) => entry !== key) : [key, ...state.favorites] };
}

// ---------------------------------------------------------------------------
// Status reads (bridge VALUES, no local OS knowledge)
// ---------------------------------------------------------------------------

export type Status = {
  /** First non-loopback IPv4, or "--". */
  ip: string;
  /** Link state of the wireless interface: "on" once associated. */
  wifi: "on" | "off" | "unknown";
  /** Persisted Bluetooth radio state. */
  bluetooth: "on" | "off" | "unknown";
  /** Battery percentage, or undefined when the bridge has no fuel gauge. */
  battery?: number;
  charging: boolean;
};

const query = (command: string): string => host()?.__launcher?.(command) ?? "";

export function readStatus(): Status {
  const ip = query("LEVEL\tip");
  const wifi = query("LEVEL\twifi");
  const bluetooth = query("STATE\tbluetooth");
  const battery = query("LEVEL\tbattery");
  const level = Number.parseInt(battery, 10);
  return {
    ip: ip.startsWith("--") ? "--" : ip.split("|").slice(1).join("|"),
    wifi: wifi === "on" || wifi === "off" ? wifi : "unknown",
    bluetooth: bluetooth === "1" || bluetooth === "on" ? "on" : bluetooth === "0" || bluetooth === "off" ? "off" : "unknown",
    battery: Number.isFinite(level) ? Math.min(100, Math.max(0, level)) : undefined,
    charging: query("LEVEL\tcharging") === "1",
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Run a bridge command and report whether the host accepted it. */
export function sendBridge(command: string): string {
  return host()?.__launcher?.(command) ?? "";
}

export function launchNative(id: string): string {
  return sendBridge(`LAUNCH\t${id}`);
}

export function launchRom(path: string): string {
  return sendBridge(`ROMLAUNCH\t${path}`);
}

export function rescanLibrary(): string {
  return sendBridge("ROMSCAN");
}

export function readLibrary(): string {
  return sendBridge("ROMS");
}

export function readLevel(control: "brightness" | "volume"): number | undefined {
  const value = Number.parseInt(query(`LEVEL\t${control}`), 10);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : undefined;
}

export function setLevel(control: "brightness" | "volume", value: number): string {
  return sendBridge(`CONTROL\t${control}\t${Math.min(100, Math.max(0, Math.round(value)))}`);
}

export function setRadio(control: "wifi" | "bluetooth", on: boolean): string {
  return sendBridge(`CONTROL\t${control}\t${on ? "on" : "off"}`);
}

export function readService(key: string): "on" | "off" | "unknown" {
  const value = query(`STATE\t${key}`);
  return value === "1" || value === "on" ? "on" : value === "0" || value === "off" ? "off" : "unknown";
}

export function toggleService(key: string): string {
  return sendBridge(`SERVICE\t${key}.enabled`);
}

export function readTimeout(): string {
  return query("STATE\ttimeout") || "30m";
}

export function setTimeout_(value: string): string {
  return sendBridge(`SLEEP\t${value}`);
}

/** The terminal workspace channel, for apps that are still PTY programs. */
export function sendTerminal(command: string): string {
  return host()?.__pocketshell?.(command) ?? "";
}
