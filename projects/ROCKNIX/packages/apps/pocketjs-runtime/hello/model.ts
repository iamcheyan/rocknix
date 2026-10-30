// Launcher content model (issue #92 information architecture).
//
// One flat list of launchable content — applications and library media —
// tagged with the category it belongs to. The five top-level categories are
// views over this list plus the persisted favorite/recent sets; there is no
// tree, no nesting, no per-screen app groups.

import { LAUNCHER_APPS, SECTION_META, type ContentCategory, type LauncherApp } from "./launcher-catalog";
import type { IconName } from "./icons/registry.generated";

/** Top-level category, in rail order. */
export type CategoryId = "all" | "media" | "games" | "favorites" | "settings";

export const CATEGORY_ORDER: readonly CategoryId[] = ["all", "media", "games", "favorites", "settings"];

/** Content categories a rail entry can filter to. */
export type ContentFilter = "all" | "media" | "games" | "favorites";

export interface ContentItem {
  /** Stable identity: `app:<id>` or `rom:<path>`. Also the favorite key. */
  key: string;
  label: string;
  icon: IconName;
  category: ContentCategory;
  kind: "app" | "rom";
  app?: LauncherApp;
  /** Library path for a ROM or media file. */
  path?: string;
  /** Library section/group the item came from (e.g. `gba`). */
  group?: string;
}

export interface LibraryPayload {
  total?: number;
  sections?: Record<string, { name: string; count: number; items: { title: string; path: string }[] }[]>;
}

export const itemKeyForApp = (app: LauncherApp): string => `app:${app.id}`;

/** Parse the game scanner's library.json into content items, in page order. */
export function itemsFromLibrary(payload: LibraryPayload | undefined): ContentItem[] {
  if (!payload?.sections) return [];
  const out: ContentItem[] = [];
  for (const [section, groups] of Object.entries(payload.sections)) {
    const meta = SECTION_META[section];
    if (!meta) continue;
    for (const group of groups) {
      for (const entry of group.items) {
        out.push({
          key: `rom:${entry.path}`,
          label: entry.title,
          icon: meta.icon,
          category: meta.category,
          kind: "rom",
          path: entry.path,
          group: group.name,
        });
      }
    }
  }
  return out;
}

/** Every application as content, in catalog order. Tools stay in 設定. */
export function itemsFromApps(): ContentItem[] {
  return LAUNCHER_APPS.map((app) => ({
    key: itemKeyForApp(app),
    label: app.name,
    icon: app.icon,
    category: app.category,
    kind: "app",
    app,
  }));
}

/**
 * Order a category's items: recently used first (issue #92's DESC(last_launch)),
 * then the catalog/library order for everything the user has not launched yet.
 */
export function orderByRecent(items: readonly ContentItem[], recent: readonly string[]): ContentItem[] {
  if (recent.length === 0) return [...items];
  const rank = new Map(recent.map((key, index) => [key, index]));
  return [...items].sort((a, b) => (rank.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.key) ?? Number.MAX_SAFE_INTEGER));
}

/** The items a rail category shows, before search filtering. */
export function itemsForCategory(
  category: ContentFilter,
  apps: readonly ContentItem[],
  library: readonly ContentItem[],
  favorites: readonly string[],
  recent: readonly string[],
): ContentItem[] {
  const all = [...library, ...apps];
  switch (category) {
    case "all":
      // Favorites are a separate rail entry; the mixed feed stays unstarred.
      return orderByRecent(all, recent);
    case "media":
      return orderByRecent(all.filter((item) => item.category === "media"), recent);
    case "games":
      return orderByRecent(all.filter((item) => item.category === "games"), recent);
    case "favorites": {
      const starred = new Set(favorites);
      return orderByRecent(all.filter((item) => starred.has(item.key)), recent);
    }
  }
}

/**
 * Live search over name, category and group (issue #92's 名称/标签/分类 and
 * recents). Case folding uses the locale-insensitive lowercase, which is
 * correct for both kana and Latin names.
 */
export function searchItems(query: string, apps: readonly ContentItem[], library: readonly ContentItem[], recent: readonly string[]): ContentItem[] {
  const needle = query.trim().toLowerCase();
  const all = [...orderByRecent(library, recent), ...orderByRecent(apps, recent)];
  if (!needle) return all;
  return all.filter((item) => {
    const haystack = [item.label, item.category, item.group ?? "", item.app?.id ?? "", item.path ?? ""].join(" ").toLowerCase();
    return haystack.includes(needle);
  });
}

/** Recently used content, newest first, resolved against the live catalog. */
export function recentItems(recent: readonly string[], apps: readonly ContentItem[], library: readonly ContentItem[], limit = 20): ContentItem[] {
  const byKey = new Map([...library, ...apps].map((item) => [item.key, item]));
  const out: ContentItem[] = [];
  for (const key of recent) {
    const item = byKey.get(key);
    if (!item) continue;
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

/** Tool entries (設定 category's application list). */
export function toolItems(): ContentItem[] {
  return itemsFromApps().filter((item) => item.category === "tools");
}
