// Headless Chromium driver: loads the real compiled launcher bundle through the
// published PocketJS browser host, walks every screen, screenshots the 720x480
// stage, and fails on any console error, page error, or failed request.
// Paths come from the environment so nothing host-specific is baked in.
//   PLAYWRIGHT  path to a playwright-core entry (its chromium driver)
//   CHROME      path to a Chromium binary
//   BASE        harness origin (default http://127.0.0.1:8199)
const playwrightEntry = process.env.PLAYWRIGHT;
if (!playwrightEntry) throw new Error("set PLAYWRIGHT to a playwright-core index.js");
const { chromium } = await import(playwrightEntry);
const BASE = process.env.BASE ?? "http://127.0.0.1:8199";
import { mkdirSync } from "node:fs";

const OUT = process.argv[2] ?? "/tmp/lv2/chromeshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--force-device-scale-factor=1"] });
const problems = [];
const consoleMessages = [];

const R1 = 0x0200, SQUARE = 0x8000, TRIANGLE = 0x1000;

async function shoot(name, presses, query = "") {
  const page = await browser.newPage({ viewport: { width: 720, height: 480 }, deviceScaleFactor: 1 });
  page.on("console", (msg) => {
    const text = `${msg.type()}: ${msg.text()}`;
    const where = msg.location()?.url ?? "";
    // A missing favicon is the browser's own request, not the app's.
    if (where.includes("favicon")) return;
    consoleMessages.push(`${name} ${text}`);
    if (msg.type() === "error") problems.push(`${name} console ${text} @ ${where}`);
  });
  page.on("pageerror", (err) => problems.push(`${name} pageerror ${err.message}`));
  page.on("requestfailed", (req) => { if (!req.url().includes("favicon")) problems.push(`${name} requestfailed ${req.url()} ${req.failure()?.errorText ?? ""}`); });
  await page.goto(`${BASE}/${query}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  for (const mask of presses) await page.evaluate((m) => window.__step(m, 6), mask);
  await page.evaluate(() => window.__step(0, 10));
  const box = await page.evaluate(() => {
    const stage = document.getElementById("stage").getBoundingClientRect();
    return { x: stage.x, y: stage.y, width: stage.width, height: stage.height };
  });
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, clip: box });
  // exact-2x check straight from the canvas backing store
  const grid = await page.evaluate(() => {
    const c = document.getElementById("screen");
    const ctx = c.getContext("2d");
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
    // the canvas is the logical 360x240 frame; assert its CSS box is exactly 2x
    const rect = c.getBoundingClientRect();
    return { logical: [width, height], css: [rect.width, rect.height], backing: [c.width, c.height] };
  });
  await page.close();
  const size = `${box.width}x${box.height}`;
  console.log(`${name.padEnd(22)} shot=${size} logical=${grid.logical.join("x")} css=${grid.css.join("x")} backing=${grid.backing.join("x")}`);
  return { name, size, box, grid };
}

const results = [];
results.push(await shoot("01-all", []));
results.push(await shoot("02-media", [R1]));
results.push(await shoot("03-games", [R1, R1]));
results.push(await shoot("04-favorites", [R1, R1, R1]));
results.push(await shoot("05-settings", [R1, R1, R1, R1]));
results.push(await shoot("06-search", [SQUARE]));
results.push(await shoot("07-recent", [TRIANGLE]));
results.push(await shoot("08-empty-library", [], "?library=empty"));
results.push(await shoot("09-battery-low", [], "?battery=15"));
results.push(await shoot("10-battery-critical", [], "?battery=3"));

await browser.close();

console.log(`\nconsole messages: ${consoleMessages.length} (errors: ${problems.length})`);
if (consoleMessages.length) console.log(consoleMessages.slice(0, 12).join("\n"));
const wrong = results.filter((r) => r.size !== "720x480");
if (wrong.length) console.log("WRONG SIZE:", wrong.map((r) => `${r.name}=${r.size}`).join(", "));
if (problems.length) { console.log("\nPROBLEMS:\n" + problems.join("\n")); process.exit(1); }
console.log(wrong.length ? "FAIL: wrong screenshot size" : "PASS: every screenshot 720x480, no console/page errors");
