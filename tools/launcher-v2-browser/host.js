// Runs the real compiled PocketShell Launcher V2 bundle in Chromium through the
// PocketJS browser host, using the same harness-mount path the framework's own
// golden tests use: globalThis.ui and globalThis.__pak are installed, the bridge
// is in place BEFORE the bundle evaluates (the Rust runtime's order), then the
// bundle is evaluated and driven by frame() + tick().
import { createWasmUi } from "./platforms/web/wasm-ops.js";

const SETTINGS = { brightness: "62", volume: "48", bluetooth: "0", timeout: "30m", adbusb: "1", avahi: "1", http: "1", telnet: "1" };
const LIBRARY = {
  total: 3,
  sections: {
    games: [{ name: "gba", count: 2, items: [
      { title: "Metroid Fusion", path: "/storage/content/games/gba/mf.gba" },
      { title: "Golden Sun", path: "/storage/content/games/gba/gs.gba" },
    ] }],
    books: [{ name: "txt", count: 1, items: [{ title: "Manual", path: "/storage/content/books/m.txt" }] }],
  },
};

const params = new URLSearchParams(location.search);
const battery = params.get("battery") ?? "55";
const empty = params.get("library") === "empty";

const canvas = document.getElementById("screen");
const context = canvas.getContext("2d");

const [wasmBytes, bundle, pak] = await Promise.all([
  fetch("./platforms/web/pocketjs.wasm").then((r) => r.arrayBuffer()),
  fetch("./dist/rocknix-pocketjs-boot.js").then((r) => r.text()),
  fetch("./dist/rocknix-pocketjs-boot.pak").then((r) => r.arrayBuffer()),
]);

const ui = await createWasmUi(wasmBytes, { width: 360, height: 240, rasterDensity: 2, host: "rocknix-h700-kms" });

// Host contract, installed before the guest evaluates.
globalThis.ui = ui.ops;
globalThis.__pak = pak;
ui.ops.__launcher = (command) => {
  const [op, key] = command.split("\t");
  if (op === "PREF") return JSON.stringify({ favorites: ["app:xmplayer"], recent: ["app:disk"] });
  if (op === "PREFSET") return "ok";
  if (op === "ROMS") return JSON.stringify(empty ? { total: 0, sections: {} } : LIBRARY);
  if (op === "LEVEL" && key === "battery") return battery;
  if (op === "LEVEL" && key === "charging") return "0";
  if (op === "LEVEL" && key === "ip") return "wlan0|192.168.3.57";
  if (op === "LEVEL" && key === "wifi") return "on";
  if (op === "LEVEL") return SETTINGS[key] ?? "62";
  return "1";
};
ui.ops.__pocketshell = () => "";

(0, eval)(bundle);
if (typeof globalThis.frame !== "function") throw new Error("bundle did not install frame()");

function paint() {
  context.putImageData(new ImageData(new Uint8ClampedArray(ui.render()), 360, 240), 0, 0);
}

/** Hold `mask` for two frames then release, as a real button press does. */
globalThis.__step = (mask = 0, n = 6) => {
  for (let i = 0; i < n; i++) {
    globalThis.frame(i < 2 ? mask : 0);
    ui.tick();
  }
  paint();
  return String(ui.drawHash());
};

globalThis.__ready = true;
globalThis.__step(0, 10);
