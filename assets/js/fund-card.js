// Fund card — single source of truth for the card layout used on:
//   - the homepage Fund Balances grid (index.html)
//   - every group on funds/index.html
//
// Edit this file to change the card design everywhere.
//
// Usage:
//   FundCard.render({
//     name:    "Road Utility Fee Fund",   // required
//     end:     3310000,                    // ending balance (the big number)
//     begin:   2740000,                    // optional — shown after change
//     change:  567000,                     // FY change; null = "see PDF"
//     page:    98,                          // printed PDF page for cite chip
//     href:    "funds/road-utility-fee.html", // when set, card is a link
//     label:   "Ending balance",           // eyebrow text (default)
//     showCta: true,                       // show "See breakdown" button (default true when href is set)
//   })

(function () {
  const PDF_BASE = "https://www.tualatinoregon.gov/sites/default/files/fileattachments/finance/page/6486/final_proposed_budget_fy2026-27-compressed.pdf";

  // Map printed page → PDF page anchor. Mirrors scripts/build-pages.js PAGE_MAP.
  const PAGE_TO_PDF = {
    58: 67,
    91: 103, 96: 108, 98: 110, 99: 111, 101: 113, 102: 114, 103: 115, 104: 116,
    105: 117, 106: 118, 107: 119, 108: 120, 110: 122, 111: 123, 113: 125,
    114: 126, 116: 128, 117: 129, 118: 130, 120: 132,
    314: 350, 315: 351, 321: 357, 325: 361, 329: 365, 332: 368, 336: 372,
  };

  function citeFor(printedPage) {
    if (printedPage == null) return "";
    const pdfPage = PAGE_TO_PDF[printedPage] || printedPage;
    return `<a class="cite" href="${PDF_BASE}#page=${pdfPage}" target="_blank" rel="noopener">p. ${printedPage}</a>`;
  }

  function render(opts) {
    const {
      name,
      end,
      begin,
      change,
      page,
      href,
      label = "Ending balance",
      showCta = href != null,
    } = opts;

    const isLinked = href != null;
    const balanceText = end == null ? "—" : fmt.currency(end, { short: true });
    const cite = citeFor(page);

    // Delta row: colored pill (change) + dimmed beginning. When change is null
    // (TDC funds without FY 26-27 data), show a fallback.
    let deltaRow;
    if (change == null) {
      deltaRow = `<div class="fund-card__meta">See PDF for current balances</div>`;
    } else {
      const cls = change > 0 ? "delta--up" : change < 0 ? "delta--down" : "delta--neutral";
      const arrow = change > 0 ? "▲" : change < 0 ? "▼" : "—";
      const pill = `<span class="delta ${cls}">${arrow} ${fmt.currency(Math.abs(change), { short: true })}</span>`;
      const beginPart = begin != null
        ? `<span class="fund-card__begin">begin ${fmt.currency(begin, { short: true })}</span>`
        : "";
      deltaRow = `<div class="fund-card__meta">${pill}${beginPart}</div>`;
    }

    const stretch = isLinked ? `<a class="fund-card__stretch" href="${href}" aria-label="${name}"></a>` : "";
    const cta = isLinked && showCta ? `<a class="fund-card__cta" href="${href}">See breakdown</a>` : "";
    const linkedCls = isLinked ? " fund-card--linked" : "";

    return `
      <div class="fund-card${linkedCls}">
        ${stretch}
        <div class="fund-card__head">
          <span class="fund-card__label">${label}</span>
          ${cite}
        </div>
        <div class="fund-card__name">${name}</div>
        <div class="fund-card__balance">${balanceText}</div>
        ${deltaRow}
        ${cta}
      </div>`;
  }

  window.FundCard = { render };
})();
