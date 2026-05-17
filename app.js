// Renders the Tualatin budget microsite from window.BUDGET_DATA.

(function () {
  const data = window.BUDGET_DATA;
  if (!data) return;

  // --- formatting helpers ---
  const fmtUSD = (n, opts = {}) => {
    if (n == null) return "—";
    const abs = Math.abs(n);
    if (opts.compact) {
      if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
      if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
      if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
      return `$${n.toLocaleString()}`;
    }
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };
  const fmtPct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

  const years = data.fiscal_years;
  const proposed = years.find((y) => y.kind === "proposed");
  const prior = years[years.indexOf(proposed) - 1];

  // --- HERO STATS ---
  const heroStats = document.getElementById("hero-stats");
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

  heroStats.innerHTML = `
    <div class="stat">
      <div class="stat-value">${fmtUSD(proposed.total_resources, { compact: true })}</div>
      <div class="stat-label">Total proposed budget</div>
      <div class="stat-trend ${yoyTotal >= 0 ? "up" : "down"}">${fmtPct(yoyTotal)} vs. ${prior.short} adopted</div>
    </div>
    <div class="stat">
      <div class="stat-value">${fmtUSD(opsBudget, { compact: true })}</div>
      <div class="stat-label">Operating expenditures</div>
      <div class="stat-trend ${opsYoy >= 0 ? "up" : "down"}">${fmtPct(opsYoy)} — Personal Services + Materials &amp; Services</div>
    </div>
    <div class="stat">
      <div class="stat-value">${fmtUSD(proposed.expenditures.capital_outlay, { compact: true })}</div>
      <div class="stat-label">Capital outlay</div>
      <div class="stat-trend ${capYoy >= 0 ? "up" : "down"}">${fmtPct(capYoy)} vs. ${prior.short}</div>
    </div>
    <div class="stat">
      <div class="stat-value">${proposed.fte}</div>
      <div class="stat-label">Full-time-equivalent staff</div>
      <div class="stat-trend up">+${proposed.fte_change} FTE vs. ${prior.short}</div>
    </div>
  `;

  // --- HIGHLIGHTS ---
  const highlights = document.getElementById("highlights");
  highlights.innerHTML = data.proposed_highlights
    .map(
      (h) => `
      <article class="highlight">
        <h3>${h.title}</h3>
        <p>${h.body}</p>
      </article>`
    )
    .join("");

  // --- YEAR CARDS ---
  const yearGrid = document.getElementById("year-grid");
  // Show most recent first.
  const yearsDesc = [...years].reverse();
  yearGrid.innerHTML = yearsDesc
    .map((y) => {
      const isProposed = y.kind === "proposed";
      const ops = (y.expenditures.personal_services || 0) + (y.expenditures.materials_services || 0);
      const cap = y.expenditures.capital_outlay || 0;
      const cr  = y.expenditures.contingencies_reserves || 0;
      const links = [];
      if (y.proposed_pdf) {
        links.push(linkChip(y.proposed_pdf, "Proposed Budget"));
      }
      if (y.adopted_pdf) {
        links.push(linkChip(y.adopted_pdf, "Adopted Budget"));
      }
      if (y.brief_pdf) {
        links.push(linkChip(y.brief_pdf, "Budget in Brief"));
      }
      if (y.notice_pdf) {
        links.push(linkChip(y.notice_pdf, "Meeting Notice"));
      }
      const actualLine = y.actual_total
        ? `<div class="splits"><span class="label">Actual (final)</span><span class="val">${fmtUSD(y.actual_total, { compact: true })}</span></div>`
        : "";
      return `
        <article class="year-card ${isProposed ? "proposed" : ""}">
          <span class="kind">${isProposed ? "Proposed" : "Adopted"}</span>
          <div class="fy">${y.fy}</div>
          <div class="total-label">Total ${isProposed ? "proposed" : "adopted"} budget</div>
          <div class="total tabular">${fmtUSD(y.total_resources, { compact: true })}</div>
          <div class="splits">
            <span class="label">Personal Services</span>
            <span class="val tabular">${fmtUSD(y.expenditures.personal_services, { compact: true })}</span>
            <span class="label">Materials &amp; Services</span>
            <span class="val tabular">${fmtUSD(y.expenditures.materials_services, { compact: true })}</span>
            <span class="label">Capital Outlay</span>
            <span class="val tabular">${fmtUSD(cap, { compact: true })}</span>
            <span class="label">Contingencies &amp; Reserves</span>
            <span class="val tabular">${fmtUSD(cr, { compact: true })}</span>
            ${y.actual_total ? `<span class="label">Actuals (final)</span><span class="val tabular">${fmtUSD(y.actual_total, { compact: true })}</span>` : ""}
          </div>
          <div class="links">${links.join("")}</div>
        </article>`;
    })
    .join("");

  function linkChip(href, label) {
    return `<a href="${href}" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
        <path d="M14 3h7v7M21 3l-9 9M5 7h6M5 12h6M5 17h11M5 5v14"/>
      </svg>
      ${label}</a>`;
  }

  // --- CHARTS ---
  // Palette — navy-leaning for revenue, warmer for expenditures.
  const revPalette = ["#1f4a8a", "#2e63aa", "#4a82c9", "#8aa9d4", "#c79100", "#e0a93f", "#7a8fae", "#a7b8d2"];
  const expPalette = ["#1f4a8a", "#4a82c9", "#a05a2c", "#c79100", "#5e7480", "#8a99a8"];

  Chart.defaults.font.family = '"Inter", system-ui, sans-serif';
  Chart.defaults.color = "#374151";
  Chart.defaults.borderColor = "#e5e7eb";

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
    { key: "debt_service",            name: "Debt Service" },
    { key: "transfers",               name: "Transfers" },
    { key: "contingencies_reserves",  name: "Contingencies & Reserves" },
  ];

  new Chart(document.getElementById("revenueStackedChart"), {
    type: "bar",
    data: {
      labels,
      datasets: revCats.map((cat, i) => ({
        label: cat.name,
        data: years.map((y) => y.revenues[cat.key] || 0),
        backgroundColor: revPalette[i % revPalette.length],
        borderWidth: 0,
      })),
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${fmtUSD(ctx.parsed.y)}`,
          },
        },
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } },
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          ticks: { callback: (v) => fmtUSD(v, { compact: true }) },
          grid: { color: "#eef2f8" },
        },
      },
    },
  });

  new Chart(document.getElementById("totalsChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Total resources (incl. fund balance)",
          data: years.map((y) => y.total_resources),
          backgroundColor: years.map((y) =>
            y.kind === "proposed" ? "#c79100" : "#1f4a8a"
          ),
          borderRadius: 4,
          borderWidth: 0,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => fmtUSD(ctx.parsed.y) },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => fmtUSD(v, { compact: true }) },
          grid: { color: "#eef2f8" },
        },
      },
    },
  });

  new Chart(document.getElementById("expenditureStackedChart"), {
    type: "bar",
    data: {
      labels,
      datasets: expCats.map((cat, i) => ({
        label: cat.name,
        data: years.map((y) => y.expenditures[cat.key] || 0),
        backgroundColor: expPalette[i % expPalette.length],
        borderWidth: 0,
      })),
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${fmtUSD(ctx.parsed.y)}`,
          },
        },
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } },
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          ticks: { callback: (v) => fmtUSD(v, { compact: true }) },
          grid: { color: "#eef2f8" },
        },
      },
    },
  });

  new Chart(document.getElementById("operatingVsCapitalChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Operating (PS + M&S)",
          data: years.map((y) =>
            (y.expenditures.personal_services || 0) +
            (y.expenditures.materials_services || 0)
          ),
          borderColor: "#1f4a8a",
          backgroundColor: "#1f4a8a22",
          tension: 0.25,
          fill: true,
        },
        {
          label: "Capital Outlay",
          data: years.map((y) => y.expenditures.capital_outlay || 0),
          borderColor: "#c79100",
          backgroundColor: "#c7910022",
          tension: 0.25,
          fill: true,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtUSD(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => fmtUSD(v, { compact: true }) },
          grid: { color: "#eef2f8" },
        },
      },
    },
  });
})();
