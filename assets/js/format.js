// Shared formatting helpers.
window.fmt = {
  currency(n, opts = {}) {
    if (n == null || Number.isNaN(n)) return "—";
    const abs = Math.abs(n);
    if (opts.short) {
      if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
      if (abs >= 1e6) return "$" + (n / 1e6).toFixed(abs >= 10e6 ? 1 : 2) + "M";
      if (abs >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
      return "$" + n.toFixed(0);
    }
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  },
  number(n) {
    if (n == null) return "—";
    return n.toLocaleString("en-US");
  },
  delta(n, pct) {
    if (n == null) return "";
    const cls = n > 0 ? "delta--up" : n < 0 ? "delta--down" : "delta--neutral";
    const arrow = n > 0 ? "▲" : n < 0 ? "▼" : "—";
    const value = pct == null ? this.currency(Math.abs(n), { short: true }) : Math.abs(pct).toFixed(2) + "%";
    return `<span class="delta ${cls}">${arrow} ${value}</span>`;
  },
  pct(n) {
    if (n == null) return "—";
    return n.toFixed(1) + "%";
  },
  cite(printedPage, label) {
    if (printedPage == null) return "";
    const meta = (window.BUDGET && window.BUDGET.meta) || {};
    const base = meta.pdfSource || "";
    const pageMap = meta.pageMap || {};
    // The PDF has front matter, so printed page != PDF page index.
    // We map printed → PDF page index for accurate #page anchors.
    const pdfPage = pageMap[String(printedPage)] || printedPage;
    const url = base + "#page=" + pdfPage;
    const text = label || "p. " + printedPage;
    return `<a class="cite" href="${url}" target="_blank" rel="noopener" title="Open PDF at printed page ${printedPage}">${text}</a>`;
  }
};
