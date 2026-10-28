import { chromium } from "/home/tetsuya/development/heya-pocketjs-prototype/pocketjs/node_modules/playwright-core/index.js";
import { mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const repo = resolve(process.cwd());
const outDir = join(repo, "tools/pocketshell-dev/screenshots");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 760, height: 520 } });

const steps = [
  { name: "library-home", wait: 1200 },
  { name: "library-list", wait: 1200, click: ".screen .row:nth-child(2)" },
  { name: "library-reading", wait: 1200, click: ".screen .row:nth-child(2)", waitAfter: 1000 },
  { name: "library-bookmarks", wait: 1200, key: "q", waitAfter: 800 },
  { name: "library-search", wait: 1200, key: "y", waitAfter: 800 },
  { name: "library-settings", wait: 1200, key: "Enter", waitAfter: 800 },
];

for (const step of steps) {
  await page.goto("http://127.0.0.1:8137/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(step.wait);
  if (step.click) await page.click(step.click).catch(() => {});
  if (step.key) await page.keyboard.press(step.key);
  if (step.waitAfter) await page.waitForTimeout(step.waitAfter);
  const out = join(outDir, `${step.name}.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log(`${step.name}: ${existsSync(out) ? "captured" : "MISSING"}`);
}

await browser.close();