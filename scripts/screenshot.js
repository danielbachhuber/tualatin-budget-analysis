// Capture screenshots of both microsite variants via Playwright.
// Usage: node scripts/screenshot.js
// Expects a local server at http://127.0.0.1:8765 serving the repo root.

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://127.0.0.1:8765";
const OUT = path.resolve(__dirname, "..", ".screenshots");
fs.mkdirSync(OUT, { recursive: true });

const targets = [
  { name: "civic",   url: `${BASE}/` },
  { name: "almanac", url: `${BASE}/variants/frontend-design/` },
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
      const context = await browser.newContext({
        viewport: { width: v.width, height: v.height },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();

      page.on("pageerror", (err) => {
        errors.push(`${t.name} ${v.name} PAGEERROR: ${err.message}`);
      });
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push(`${t.name} ${v.name} CONSOLE: ${msg.text()}`);
        }
      });

      console.log(`→ ${t.name} @ ${v.name} (${v.width}x${v.height})`);
      await page.goto(t.url, { waitUntil: "networkidle", timeout: 30000 });
      // give fonts and charts a moment to settle
      await page.waitForTimeout(600);
      // disable animations for stable screenshots
      await page.addStyleTag({
        content: `*, *::before, *::after {
          animation-duration: 0ms !important;
          animation-delay: 0ms !important;
          transition-duration: 0ms !important;
        }`,
      });
      // force any IntersectionObserver-driven reveals to show
      await page.evaluate(() => {
        document.querySelectorAll(".dispatch, .lede, .pullquote").forEach((el) =>
          el.classList.add("in-view")
        );
      });
      await page.waitForTimeout(200);

      const full = path.join(OUT, `${t.name}-${v.name}-full.png`);
      await page.screenshot({ path: full, fullPage: true });

      const above = path.join(OUT, `${t.name}-${v.name}-fold.png`);
      await page.screenshot({ path: above, fullPage: false });

      console.log(`   wrote ${path.relative(process.cwd(), full)}`);
      console.log(`   wrote ${path.relative(process.cwd(), above)}`);

      await context.close();
    }
  }

  await browser.close();

  if (errors.length) {
    console.log("\nPage errors captured:");
    for (const e of errors) console.log("  " + e);
  } else {
    console.log("\nNo page errors.");
  }
})().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
