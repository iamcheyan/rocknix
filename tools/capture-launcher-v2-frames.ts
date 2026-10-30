// Capture every PocketShell Launcher V2 screen at the panel's real resolution.
//
//   bun tools/capture-launcher-v2-frames.ts <pocketjs-tree> <output-dir>
//
// `<pocketjs-tree>` is the pinned PocketJS checkout the package builds against
// (package.mk PKG_VERSION) after `bun tools/pocket.ts compile` has produced
// apps/rocknix-h700/dist. Frames come from the official WASM pixel renderer at
// 360x240 logical x raster density 2 = 720x480, which is exactly what the
// RG34XX presents; nothing is rescaled by the capture.
//
// Each screen boots a fresh host so navigation state cannot leak between
// frames, and every frame's draw hash is printed: identical hashes across two
// screens would mean the renderer never changed the output.

import { mkdirSync } from "node:fs";

const tree = process.argv[2];
const out = process.argv[3] ?? "docs/evidence/launcher-v2";
if (!tree) throw new Error("usage: capture-launcher-v2-frames.ts <pocketjs-tree> <output-dir>");
const { createWasmUi } = await import(`${tree}/platforms/web/wasm-ops.js`);
const { encodePNG } = await import(`${tree}/tools/png.ts`);
mkdirSync(out, { recursive: true });

const wasm = await Bun.file(`${tree}/platforms/web/pocketjs.wasm`).arrayBuffer();
const bundle = await Bun.file(`${tree}/apps/rocknix-h700/dist/rocknix-pocketjs-boot.js`).text();
const pak = await Bun.file(`${tree}/apps/rocknix-h700/dist/rocknix-pocketjs-boot.pak`).arrayBuffer();

const LIBRARY = {
  total: 3,
  sections: {
    games: [{ name: "gba", count: 2, items: [{ title: "Metroid Fusion", path: "/storage/content/games/gba/mf.gba" }, { title: "Golden Sun", path: "/storage/content/games/gba/gs.gba" }] }],
    books: [{ name: "txt", count: 1, items: [{ title: "Manual", path: "/storage/content/books/m.txt" }] }],
  },
};

type Options = { battery?: string; favorites?: string[]; recent?: string[]; library?: unknown };

async function boot(options: Options = {}) {
  const ui = await createWasmUi(wasm.slice(0), { width: 360, height: 240, rasterDensity: 2, host: "rocknix-h700-kms" });
  const host = globalThis as { ui: unknown; __pak?: ArrayBuffer; frame?: (buttons: number) => void };
  host.ui = ui.ops;
  const values: Record<string, string> = { brightness: "62", volume: "48", bluetooth: "0", timeout: "30m", adbusb: "1", avahi: "1", http: "1", telnet: "1" };
  (ui.ops as { __launcher: (command: string) => string }).__launcher = (command) => {
    const [op, key] = command.split("\t");
    if (op === "PREF") return JSON.stringify({ favorites: options.favorites ?? ["app:xmplayer"], recent: options.recent ?? ["app:disk"] });
    if (op === "PREFSET") return "ok";
    if (op === "ROMS") return JSON.stringify(options.library ?? LIBRARY);
    if (op === "LEVEL" && key === "battery") return options.battery ?? "55";
    if (op === "LEVEL" && key === "charging") return "0";
    if (op === "LEVEL" && key === "ip") return "wlan0|192.168.3.57";
    if (op === "LEVEL" && key === "wifi") return "on";
    if (op === "LEVEL") return values[key] ?? "62";
    return "1";
  };
  (ui.ops as { __pocketshell: (command: string) => string }).__pocketshell = () => "";
  host.__pak = pak.slice(0);
  (0, eval)(bundle);
  for (let i = 0; i < 4; i++) { host.frame!(0); ui.tick(); }
  return { ui, host };
}

const L1 = 0x0100, R1 = 0x0200, SQUARE = 0x8000, TRIANGLE = 0x1000;

async function capture(name: string, presses: number[], options: Options = {}) {
  const { ui, host } = await boot(options);
  for (const mask of presses) {
    host.frame!(mask); ui.tick();
    host.frame!(mask); ui.tick();
    host.frame!(0); ui.tick();
    host.frame!(0); ui.tick();
  }
  for (let i = 0; i < 6; i++) { host.frame!(0); ui.tick(); }
  const png = encodePNG(ui.renderScaled(2), 720, 480);
  await Bun.write(`${out}/${name}.png`, png);
  const hash = ui.drawHash();
  ui.dispose();
  console.log(`${name}: 720x480 hash=${hash}`);
  return String(hash);
}

const hashes: Record<string, string> = {};
hashes["01-all"] = await capture("01-all", []);
hashes["02-media"] = await capture("02-media", [R1]);
hashes["03-games"] = await capture("03-games", [R1, R1]);
hashes["04-favorites"] = await capture("04-favorites", [R1, R1, R1]);
hashes["05-settings"] = await capture("05-settings", [R1, R1, R1, R1]);
hashes["06-search"] = await capture("06-search", [SQUARE]);
hashes["07-recent"] = await capture("07-recent", [TRIANGLE]);
hashes["08-empty-library"] = await capture("08-empty-library", [], { library: { total: 0, sections: {} } });
hashes["09-battery-low"] = await capture("09-battery-low", [], { battery: "15" });
hashes["10-battery-critical"] = await capture("10-battery-critical", [], { battery: "3" });
// Long titles must be fitted, not clipped: a card label truncates to the card
// width and the title band truncates to the screen, so nothing overflows.
hashes["11-long-title-truncation"] = await capture("11-long-title-truncation", [], {
  library: {
    total: 2,
    sections: { games: [{ name: "gba", count: 2, items: [
      { title: "The Legend of Zelda Minish Cap Ultra Edition", path: "/storage/content/games/gba/zelda.gba" },
      { title: "ゴールデンサン 完全版 スペシャル", path: "/storage/content/games/gba/gs.gba" },
    ] }] },
  },
});

// The four battery bands must differ: >60 full/white, 21..60 medium/white,
// 6..20 low/orange, <=5 critical/red. Two levels inside one band are
// deliberately identical — issue #93 shows an icon and a colour, never a
// percentage — so only the band boundaries are asserted.
const bands = ["01-all", "09-battery-low", "10-battery-critical"];
const collide = bands.filter((name, index) => bands.some((other, otherIndex) => otherIndex !== index && hashes[other] === hashes[name]));
if (collide.length > 0) throw new Error(`battery bands rendered identical frames: ${collide.join(", ")}`);
