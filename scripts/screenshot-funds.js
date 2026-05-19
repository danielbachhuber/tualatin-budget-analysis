// Screenshot a sample of generated fund pages.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const BASE = "http://127.0.0.1:8765";
const OUT = path.resolve(__dirname, "..", ".screenshots");
fs.mkdirSync(OUT, { recursive: true });

const targets = [
  { name: "fund-general",       url: `${BASE}/funds/general-fund.html` },
  { name: "fund-water-op",      url: `${BASE}/funds/water-operating.html` },
  { name: "fund-sewer-op",      url: `${BASE}/funds/sewer-operating.html` },
  { name: "fund-arp",           url: `${BASE}/funds/arp.html` },
  { name: "fund-scholarship",   url: `${BASE}/funds/scholarship.html` },
  { name: "fund-tdc-leveton",   url: `${BASE}/funds/tdc-leveton.html` },
  { name: "fund-parks-util",    url: `${BASE}/funds/parks-utility-fee.html` },
];

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const t of targets) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${t.name} PAGEERROR: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error") errors.push(`${t.name} CONSOLE: ${m.text()}`); });
    console.log(`→ ${t.name}`);
    await page.goto(t.url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `${t.name}-full.png`), fullPage: true });
    await page.screenshot({ path: path.join(OUT, `${t.name}-fold.png`), fullPage: false });
    await ctx.close();
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
