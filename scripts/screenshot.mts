/**
 * Screenshots app pages with a local Chromium-based browser (no browser download).
 *   pnpm shots [baseUrl] [outDir]
 * BROWSER_PATH overrides the executable (defaults to Chrome, then Brave).
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://127.0.0.1:3000";
const out = process.argv[3] ?? path.join(process.cwd(), "data", "screenshots");
const candidates = [process.env.BROWSER_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"].filter(Boolean) as string[];
const executablePath = candidates.find((p) => fs.existsSync(p));
if (!executablePath) throw new Error("No Chromium-based browser found; set BROWSER_PATH");

const pages = [
  ["overview", "/?range=30"], ["goals", "/goals"], ["body", "/body?range=90"], ["nutrition", "/nutrition?range=30"],
  ["training", "/training?range=90"], ["connections", "/relationships?range=90"], ["import", "/import"], ["settings", "/settings"],
] as const;

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const errors: string[] = [];
for (const [name, url] of pages) {
  for (const [label, viewport] of [["desktop", { width: 1440, height: 2400 }], ["mobile", { width: 390, height: 3200 }]] as const) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => errors.push(`${name}/${label}: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error") errors.push(`${name}/${label} console: ${m.text()}`); });
    await page.goto(base + url, { waitUntil: "load" });
    await page.waitForTimeout(3500); // let charts + count-up animations settle (tall viewport avoids a resize-triggered re-animation)
    await page.screenshot({ path: path.join(out, `${name}-${label}.png`), fullPage: true });
    await page.close();
  }
  console.log("✓", name);
}
await browser.close();
if (errors.length) { console.log("\nBrowser errors:"); for (const e of [...new Set(errors)]) console.log(" -", e); }
