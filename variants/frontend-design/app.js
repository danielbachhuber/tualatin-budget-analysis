// "The Tualatin Almanac" — editorial variant. Renders from window.BUDGET_DATA
// (loaded from ../../data.js — the canonical dataset is shared with the
// civic-tech variant at the repo root, so numbers stay in sync).

(function () {
  const d = window.BUDGET_DATA;
  if (!d) return;

  // ---------- formatters ----------
  const fmtUSD = (n, { compact = false } = {}) => {
    if (n == null) return "—";
    if (compact) {
      const a = Math.abs(n);
      if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
      if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
      if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    }
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };
  const fmtSignedPct = (n) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`;
  const upDown = (n) => (n >= 0 ? "up" : "down");
  const arrow = (n) => (n >= 0 ? "▲" : "▼");

  const years = d.fiscal_years;
  const proposed = years.find((y) => y.kind === "proposed");
  const prior = years[years.indexOf(proposed) - 1];

  // ---------- HERO STATS ----------
  const yoyTotal = ((proposed.total_resources - prior.total_resources) / prior.total_resources) * 100;
  const opsBudget =
    proposed.expenditures.personal_services +
    proposed.expenditures.materials_services;
  const priorOps =
    prior.expenditures.personal_services + prior.expenditures.materials_services;
  const opsYoy = ((opsBudget - priorOps) / priorOps) * 100;
  const capYoy =
    ((proposed.expenditures.capital_outlay - prior.expenditures.capital_outlay) /
      prior.expenditures.capital_outlay) *
    100;

  const stats = [
    {
      label: "Total proposed budget",
      value: "$176.9",
      unit: "M",
      delta: yoyTotal,
      context: `against ${prior.short} adopted of ${fmtUSD(prior.total_resources, { compact: true })}`,
    },
    {
      label: "Operating expenditures",
      value: `$${(opsBudget / 1e6).toFixed(1)}`,
      unit: "M",
      delta: opsYoy,
      context: "Personal Services plus Materials & Services",
    },
    {
      label: "Capital outlay",
      value: `$${(proposed.expenditures.capital_outlay / 1e6).toFixed(1)}`,
      unit: "M",
      delta: capYoy,
      context: "the largest year-over-year jump in the budget",
    },
    {
      label: "Full-time-equivalent staff",
      value: String(proposed.fte),
      unit: "",
      deltaText: `+${proposed.fte_change} FTE`,
      deltaDirection: 1,
      context: "Recreation Supervisor, Storm/Sewer Technician, plus one new manager",
    },
  ];

  document.getElementById("hero-stats").innerHTML = stats
    .map((s, i) => {
      const dir = s.deltaDirection != null ? s.deltaDirection : s.delta;
      const klass = upDown(dir);
      const txt = s.deltaText || fmtSignedPct(s.delta);
      return `
      <div class="stat" data-i="No. ${String(i + 1).padStart(2, "0")}">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value tabular">${s.value}${s.unit ? `<small>${s.unit}</small>` : ""}</div>
        <div class="stat-delta ${klass}"><span class="arrow">${arrow(dir)}</span><span>${txt}</span></div>
        <div class="stat-context">${s.context}</div>
      </div>`;
    })
    .join("");

  // ---------- FINDINGS ----------
  const findings = document.getElementById("findings");
  findings.innerHTML = d.proposed_highlights
    .map(
      (h, i) => `
      <article class="finding">
        <div class="marker">§${String(i + 1).padStart(2, "0")}</div>
        <h3>${h.title}</h3>
        <p>${h.body}</p>
      </article>`
    )
    .join("");

  // ---------- LEDGER (year cards) ----------
  // For each year, compute a horizontal mini-bar showing the proportional
  // split of expenditures. Categories ordered for visual rhythm.
  const ledger = document.getElementById("ledger");
  const expOrder = [
    { key: "personal_services",      cls: "ps", label: "Personal" },
    { key: "materials_services",     cls: "ms", label: "M & S" },
    { key: "capital_outlay",         cls: "co", label: "Capital" },
    { key: "transfers",              cls: "tr", label: "Transfers" },
    { key: "debt_service",           cls: "ds", label: "Debt" },
    { key: "contingencies_reserves", cls: "cr", label: "Reserves" },
  ];

  const yearsDesc = [...years].reverse();
  ledger.innerHTML = yearsDesc
    .map((y) => {
      const isProposed = y.kind === "proposed";
      const total = y.total_requirements;
      const bars = expOrder
        .map((c) => {
          const v = y.expenditures[c.key] || 0;
          const pct = total > 0 ? (v / total) * 100 : 0;
          return `<div class="bar ${c.cls}" style="height:${Math.max(3, pct * 1.6)}px" title="${c.label}: ${fmtUSD(v)}"></div>`;
        })
        .join("");
      const links = [];
      if (y.proposed_pdf) links.push(linkChip(y.proposed_pdf, "Proposed Budget"));
      if (y.adopted_pdf) links.push(linkChip(y.adopted_pdf, "Adopted Budget"));
      if (y.brief_pdf) links.push(linkChip(y.brief_pdf, "Budget in Brief"));
      if (y.notice_pdf) links.push(linkChip(y.notice_pdf, "Meeting Notice"));
      return `
        <article class="entry ${isProposed ? "is-proposed" : ""}">
          <div class="entry-year">
            ${y.fy.replace("FY", "")}
            <small>${isProposed ? "Proposed" : "Adopted"}</small>
          </div>
          <div class="entry-total tabular">
            <span class="label">Total ${isProposed ? "proposed" : "adopted"}</span>
            ${fmtUSD(y.total_requirements, { compact: true })}
          </div>
          <div>
            <div class="entry-bars" aria-hidden="true">${bars}</div>
            <div class="entry-bars-cap">Personal · M&amp;S · Capital · Transfers · Debt · Reserves</div>
          </div>
          <div class="entry-links">${links.join("")}</div>
        </article>`;
    })
    .join("");

  function linkChip(href, label) {
    return `<a href="${href}" target="_blank" rel="noopener">${label} ↗</a>`;
  }

  // ---------- CHARTS ----------
  // Theme Chart.js for paper.
  const PAPER = "#f0e9d6";
  const INK   = "#1a1814";
  const INK_S = "#4a3f2a";
  const INK_F = "#6f614a";
  const RULE_L = "#b7ac8e";
  const BRICK = "#a13d2d";
  const MOSS  = "#2d4a36";
  const MUSTARD = "#c8a03b";
  const BONE  = "#d4c8a3";
  const PLUM  = "#5a2a3d";
  const SLATE = "#3a5063";

  // Subtle desaturated palette for stacks; brick reserved for the proposed-year
  // accent (used in the totals bar) so it reads as the "headline" year.
  const revColors = [BRICK, MOSS, MUSTARD, SLATE, PLUM, BONE, "#7a6b4a", "#85786a"];
  const expColors = [BRICK, MOSS, MUSTARD, SLATE, PLUM, BONE];

  Chart.defaults.font.family = '"Newsreader", "Iowan Old Style", Georgia, serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = INK_S;
  Chart.defaults.borderColor = RULE_L;

  const monoTicks = {
    color: INK_F,
    font: { family: '"Space Mono", monospace', size: 10 },
  };

  const tooltipStyle = {
    backgroundColor: "#1a1814",
    titleColor: PAPER,
    bodyColor: PAPER,
    titleFont: { family: '"Space Mono", monospace', size: 11, weight: "700" },
    bodyFont:  { family: '"Newsreader", serif', size: 12 },
    padding: 10,
    cornerRadius: 0,
    borderColor: BRICK,
    borderWidth: 1,
    boxPadding: 4,
    displayColors: true,
  };

  const labels = years.map((y) => y.short);

  const revCats = [
    { key: "property_taxes",        name: "Property Taxes" },
    { key: "charges_for_service",   name: "Charges for Service" },
    { key: "transfers_and_other",   name: "Transfers & Other" },
    { key: "intergovernmental",     name: "Intergovernmental" },
    { key: "fees_charges",          name: "Fees & Charges" },
    { key: "licenses_permits_fees", name: "Licenses, Permits & Fees" },
    { key: "fines_forfeitures",     name: "Fines & Forfeitures" },
    { key: "investment_earnings",   name: "Investment Earnings" },
  ];
  const expCats = [
    { key: "personal_services",       name: "Personal Services" },
    { key: "materials_services",      name: "Materials & Services" },
    { key: "capital_outlay",          name: "Capital Outlay" },
    { key: "transfers",               name: "Transfers" },
    { key: "debt_service",            name: "Debt Service" },
    { key: "contingencies_reserves",  name: "Contingencies & Reserves" },
  ];

  // Figure 1 — stacked revenues (no fund balance: those are not new revenue)
  new Chart(document.getElementById("revenueStackedChart"), {
    type: "bar",
    data: {
      labels,
      datasets: revCats.map((c, i) => ({
        label: c.name,
        data: years.map((y) => y.revenues[c.key] || 0),
        backgroundColor: revColors[i % revColors.length],
        borderColor: PAPER,
        borderWidth: 1,
        borderSkipped: false,
      })),
    },
    options: chartOptions({ stacked: true }),
  });

  // Figure 2 — totals (proposed year accented in brick)
  new Chart(document.getElementById("totalsChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Total resources",
          data: years.map((y) => y.total_resources),
          backgroundColor: years.map((y) => (y.kind === "proposed" ? BRICK : INK_S)),
          borderColor: PAPER,
          borderWidth: 1,
          borderRadius: 0,
        },
      ],
    },
    options: chartOptions({ stacked: false, hideLegend: true }),
  });

  // Figure 3 — stacked expenditures
  new Chart(document.getElementById("expenditureStackedChart"), {
    type: "bar",
    data: {
      labels,
      datasets: expCats.map((c, i) => ({
        label: c.name,
        data: years.map((y) => y.expenditures[c.key] || 0),
        backgroundColor: expColors[i % expColors.length],
        borderColor: PAPER,
        borderWidth: 1,
        borderSkipped: false,
      })),
    },
    options: chartOptions({ stacked: true }),
  });

  // Figure 4 — operating vs capital, line
  new Chart(document.getElementById("operatingVsCapitalChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Operating (PS + M&S)",
          data: years.map((y) =>
            (y.expenditures.personal_services || 0) + (y.expenditures.materials_services || 0)
          ),
          borderColor: MOSS,
          backgroundColor: "rgba(45, 74, 54, 0.14)",
          pointBackgroundColor: MOSS,
          pointBorderColor: PAPER,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.25,
          fill: true,
          borderWidth: 2.4,
        },
        {
          label: "Capital outlay",
          data: years.map((y) => y.expenditures.capital_outlay || 0),
          borderColor: BRICK,
          backgroundColor: "rgba(161, 61, 45, 0.14)",
          pointBackgroundColor: BRICK,
          pointBorderColor: PAPER,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.25,
          fill: true,
          borderWidth: 2.4,
        },
      ],
    },
    options: chartOptions({ stacked: false }),
  });

  function chartOptions({ stacked, hideLegend = false }) {
    return {
      maintainAspectRatio: false,
      responsive: true,
      animation: { duration: 720, easing: "easeOutCubic" },
      plugins: {
        legend: hideLegend
          ? { display: false }
          : {
              position: "bottom",
              labels: {
                color: INK_S,
                boxWidth: 10,
                boxHeight: 10,
                padding: 14,
                font: { family: '"Space Mono", monospace', size: 10 },
                usePointStyle: false,
              },
            },
        tooltip: {
          ...tooltipStyle,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${fmtUSD(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          stacked,
          grid: { display: false, drawBorder: false },
          ticks: monoTicks,
        },
        y: {
          stacked,
          beginAtZero: true,
          grid: { color: RULE_L, drawBorder: false, lineWidth: 0.5 },
          border: { display: false },
          ticks: {
            ...monoTicks,
            callback: (v) => fmtUSD(v, { compact: true }),
          },
        },
      },
    };
  }

  // ---------- SCROLL REVEAL ----------
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in-view");
          observer.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll(".dispatch, .lede, .pullquote").forEach((el) => observer.observe(el));
})();
