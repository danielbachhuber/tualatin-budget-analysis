// One-off screenshot script for the new Process page + modified indexes.
// Usage: node scripts/screenshot-process.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = "http://127.0.0.1:8765";
const OUT = path.resolve(__dirname, "..", ".screenshots");
fs.mkdirSync(OUT, { recursive: true });

const targets = [
  { name: "process",        url: `${BASE}/process/index.html` },
  { name: "overview",       url: `${BASE}/index.html` },
  { name: "meetings-index", url: `${BASE}/meetings/index.html` },
  { name: "funds-index",    url: `${BASE}/funds/index.html` },
];
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile",  width: 390,  height: 844 },
];

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const t of targets) {
    for (const v of viewports) {
      const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height } });
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errors.push(`${t.name} ${v.name} PAGEERROR: ${e.message}`));
      page.on("console", (m) => { if (m.type() === "error") errors.push(`${t.name} ${v.name} CONSOLE: ${m.text()}`); });
      console.log(`→ ${t.name} @ ${v.name}`);
      await page.goto(t.url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(400);
      const full = path.join(OUT, `${t.name}-${v.name}-full.png`);
      await page.screenshot({ path: full, fullPage: true });
      const fold = path.join(OUT, `${t.name}-${v.name}-fold.png`);
      await page.screenshot({ path: fold, fullPage: false });
      console.log(`   wrote ${path.relative(process.cwd(), full)}`);
      await ctx.close();
    }
  }
  await browser.close();
  if (errors.length) {
    console.log("\nPage errors:");
    for (const e of errors) console.log("  " + e);
    process.exit(1);
  } else {
    console.log("\nNo page errors.");
  }
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
