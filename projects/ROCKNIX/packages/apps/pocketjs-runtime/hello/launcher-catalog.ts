// Launchable content catalog (issue #92: content first, icon + name only).
//
// Every entry carries a Pixelarticons icon name from the registry, a Japanese
// display name, and the content category it belongs to. There is no
// description field: the main screen shows an icon and a name, nothing else.

import type { IconName } from "./icons/registry.generated";

/** Where an entry lives in the Switch-style information architecture. */
export type ContentCategory = "media" | "games" | "tools";

export type LaunchKind = "native" | "terminal";

export interface LauncherApp {
  /** Stable id; also the bridge command argument. */
  id: string;
  /** Japanese display name — the only text the card shows. */
  name: string;
  icon: IconName;
  category: ContentCategory;
  kind: LaunchKind;
}

export const LAUNCHER_APPS: readonly LauncherApp[] = [
  // ゲーム: the games a handheld is bought for come first.
  { id: "gamepad", name: "ゲームパッド", icon: "games", category: "games", kind: "terminal" },
  { id: "clean-mac-files", name: "ROM 整理", icon: "refresh", category: "games", kind: "terminal" },
  { id: "cloud-backup", name: "バックアップ", icon: "cloud", category: "games", kind: "terminal" },
  { id: "cloud-restore", name: "復元", icon: "download", category: "games", kind: "terminal" },

  // メディア: players and documents.
  { id: "xmplayer", name: "再生", icon: "media", category: "media", kind: "native" },
  { id: "audio-mixer", name: "ミキサー", icon: "audio", category: "media", kind: "terminal" },
  { id: "disk", name: "ファイル", icon: "folder", category: "media", kind: "native" },

  // 設定: system utilities reached from the settings category, never the home rail.
  { id: "terminal", name: "ターミナル", icon: "terminal", category: "tools", kind: "terminal" },
  { id: "monitor", name: "モニター", icon: "monitor", category: "tools", kind: "terminal" },
  { id: "file-manager-text", name: "ファイル管理", icon: "file", category: "tools", kind: "terminal" },
  { id: "notes", name: "メモ", icon: "file", category: "tools", kind: "terminal" },
  { id: "system-info", name: "システム情報", icon: "info", category: "tools", kind: "terminal" },
  { id: "processes", name: "プロセス", icon: "system", category: "tools", kind: "terminal" },
  { id: "storage-info", name: "ストレージ", icon: "storage", category: "tools", kind: "terminal" },
  { id: "network-info", name: "ネットワーク", icon: "network", category: "tools", kind: "terminal" },
  { id: "usb-info", name: "USB", icon: "usb", category: "tools", kind: "terminal" },
  { id: "input-info", name: "入力機器", icon: "input", category: "tools", kind: "terminal" },
  { id: "kernel-log", name: "カーネルログ", icon: "file", category: "tools", kind: "terminal" },
  { id: "system-log", name: "システムログ", icon: "file", category: "tools", kind: "terminal" },
] as const;

const APP_BY_ID = new Map(LAUNCHER_APPS.map((app) => [app.id, app]));

export function findApp(id: string): LauncherApp | undefined {
  return APP_BY_ID.get(id);
}

/** Library section -> the icon and category its items inherit. */
export const SECTION_META: Readonly<Record<string, { icon: IconName; category: ContentCategory }>> = {
  games: { icon: "games", category: "games" },
  music: { icon: "music", category: "media" },
  videos: { icon: "media", category: "media" },
  books: { icon: "book", category: "media" },
};
