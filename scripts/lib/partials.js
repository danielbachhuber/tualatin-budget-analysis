// Shared HTML partials for the site. Anything that should be identical
// across every page (the AI disclaimer, the site header + nav, the footer)
// lives here so it can be updated in exactly one place.
//
// upPath: relative path back to the repo root, "" for root-level pages,
// ".." for one-level-deep pages (funds/, departments/, meetings/, process/).

const VER = String(Date.now());

const NAV_ORDER = ["Overview", "Process", "Funds", "Departments", "Meetings"];

function navHref(label, upPath) {
  const base = upPath ? upPath + "/" : "";
  switch (label) {
    case "Overview":    return `${base}index.html`;
    case "Process":     return `${base}process/index.html`;
    case "Funds":       return `${base}funds/index.html`;
    case "Departments": return `${base}departments/index.html`;
    case "Meetings":    return `${base}meetings/index.html`;
    default: throw new Error(`unknown nav label ${label}`);
  }
}

function head({ title, upPath = "", version = VER, extra = "" }) {
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${upPath ? upPath + "/" : ""}assets/css/site.css?v=${version}">${extra ? "\n" + extra : ""}
</head>`;
}

function aiBanner() {
  return `<div class="ai-disclaimer" role="note">
  <div class="ai-disclaimer__inner">
    <span class="ai-disclaimer__icon" aria-hidden="true">⚠</span>
    <span class="ai-disclaimer__text"><strong>This isn't an official city publication.</strong> It was generated in a few hours with a large language model. Please click through and verify facts and figures on the associated PDFs.</span>
  </div>
</div>`;
}

function siteHeader({ activeNav, upPath = "" }) {
  const links = NAV_ORDER.map((label) => {
    const isActive = label === activeNav;
    const href = navHref(label, upPath);
    const cls = isActive ? ' class="is-active"' : "";
    return `      <a${cls} href="${href}">${label}</a>`;
  }).join("\n");
  return `<header class="site-header">
  <div class="container site-header__inner">
    <a class="brand" href="${upPath ? upPath + "/" : ""}index.html">
      <span class="brand__seal">T</span>
      <span class="brand__text">
        <span class="brand__name">Tualatin Budget Explorer</span>
        <span class="brand__sub">FY 2026–2027 PROPOSED</span>
      </span>
    </a>
    <nav class="site-nav">
${links}
    </nav>
  </div>
</header>`;
}

// Pages can override the "Source: ..." line with their own attribution HTML.
// Everything else (the byline) stays consistent.
const DEFAULT_FOOTER_SOURCE = `Source: <a href="https://www.tualatinoregon.gov/sites/default/files/fileattachments/finance/page/6486/final_proposed_budget_fy2026-27-compressed.pdf" target="_blank" rel="noopener">FY 2026–2027 Proposed Budget</a> (City of Tualatin, OR · 405pp · PDF).<br>
      Historical budgets: <a href="https://www.tualatinoregon.gov/finance/adopted-budget-and-budget-brief">tualatinoregon.gov</a>.`;

function siteFooter({ sourceHtml = DEFAULT_FOOTER_SOURCE } = {}) {
  return `<footer class="site-footer">
  <div class="container site-footer__inner">
    <div>
      ${sourceHtml}
    </div>
    <div>Built as a personal study tool by Daniel Bachhuber, Budget Advisory Committee member.</div>
  </div>
</footer>`;
}

module.exports = { head, aiBanner, siteHeader, siteFooter, navHref, VER };
