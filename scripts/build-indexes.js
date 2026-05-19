#!/usr/bin/env node
// Generates the 5 index/landing pages from body fragments + shared chrome
// partials. Each page's body content lives in scripts/indexes/<slug>.body.html
// — edit that file to change the page; this script wraps it in the standard
// header/nav/footer.
//
// Usage: node scripts/build-indexes.js

const fs = require("fs");
const path = require("path");
const { head, aiBanner, siteHeader, siteFooter } = require("./lib/partials");

const ROOT = path.resolve(__dirname, "..");
const FRAGMENTS = path.join(__dirname, "indexes");

function readBody(slug) {
  return fs.readFileSync(path.join(FRAGMENTS, `${slug}.body.html`), "utf8").trimEnd();
}
function readHeadExtra(slug) {
  const p = path.join(FRAGMENTS, `${slug}.head.html`);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8").trimEnd() : "";
}

function render({ slug, title, activeNav, upPath, outPath, footerSource }) {
  const body = readBody(slug);
  const extraHead = readHeadExtra(slug);
  const html = `<!doctype html>
<html lang="en">
${head({ title, upPath, extra: extraHead })}
<body>
${aiBanner()}

${siteHeader({ activeNav, upPath })}

${body}

${siteFooter(footerSource ? { sourceHtml: footerSource } : undefined)}

</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, outPath), html);
  console.log(`  wrote ${outPath}`);
}

const MEETINGS_FOOTER_SOURCE = `Source: <a href="https://www.tualatinoregon.gov/bac" target="_blank" rel="noopener">Tualatin Budget Advisory Committee</a>, official minutes via the Municode Meetings system.`;

const PAGES = [
  { slug: "homepage",    title: "Tualatin FY 2026–27 Proposed Budget",                       activeNav: "Overview",    upPath: "",   outPath: "index.html" },
  { slug: "process",     title: "How Oregon's local budget law works · Tualatin FY 2026–27", activeNav: "Process",     upPath: "..", outPath: "process/index.html" },
  { slug: "funds",       title: "Funds · Tualatin FY 2026–27",                               activeNav: "Funds",       upPath: "..", outPath: "funds/index.html" },
  { slug: "tdc",         title: "Tualatin Development Commission · FY 2026–27",              activeNav: "TDC",         upPath: "..", outPath: "tdc/index.html" },
  { slug: "departments", title: "Departments · Tualatin FY 2026–27",                         activeNav: "Departments", upPath: "..", outPath: "departments/index.html" },
  { slug: "meetings",    title: "Meetings · Tualatin FY 2026–27",                            activeNav: "Meetings",    upPath: "..", outPath: "meetings/index.html", footerSource: MEETINGS_FOOTER_SOURCE },
];

for (const p of PAGES) render(p);
console.log(`\nwrote ${PAGES.length} index pages`);
