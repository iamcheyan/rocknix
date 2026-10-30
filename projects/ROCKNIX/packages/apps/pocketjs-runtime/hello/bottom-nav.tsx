// Persistent bottom navigation (issue #92 item 9): always visible, current
// entry highlighted with the theme colour and a pixel underline.
//
// The five entries are the five categories, in rail order, each with its
// permanent Pixelarticons glyph (#93 category icons).

import { Index } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { Icon } from "./icon";
import { COLORS, NAV_H, SCREEN } from "./theme";
import { JA } from "./strings";
import type { CategoryId } from "./model";
import { CATEGORY_ORDER } from "./model";
import type { IconName } from "./icons/registry.generated";

const CATEGORY_ICONS: Readonly<Record<CategoryId, IconName>> = {
  all: "all",
  games: "games",
  media: "media",
  favorites: "favorites",
  settings: "settings",
};

const CATEGORY_LABELS: Readonly<Record<CategoryId, string>> = {
  all: JA.categories.all,
  games: JA.categories.games,
  media: JA.categories.media,
  favorites: JA.categories.favorites,
  settings: JA.categories.settings,
};

export type BottomNavProps = {
  active: CategoryId;
};

export function BottomNav(props: BottomNavProps) {
  return (
    <View
      class="absolute left-0 flex-row items-center justify-around"
      style={{ insetT: SCREEN.h - NAV_H, width: SCREEN.w, height: NAV_H, bgColor: COLORS.nav }}
    >
      <Index each={CATEGORY_ORDER}>{(id, index) => {
        const active = () => props.active === id();
        return (
          <View class="flex-col items-center justify-center" style={{ width: 64, height: NAV_H }}>
            <Icon name={CATEGORY_ICONS[id()]} size={12} color={active() ? COLORS.highlight : COLORS.textDim} />
            <Text
              class="text-2xs"
              style={{ textColor: active() ? COLORS.highlight : COLORS.textDim, paddingT: 1, textAlign: 1 }}
            >
              {CATEGORY_LABELS[id()]}
            </Text>
          </View>
        );
      }}</Index>
    </View>
  );
}
