#!/usr/bin/env node
// Generates per-department and per-fund stub pages from a manifest.
// Existing hand-curated deep-dive pages (parks-and-recreation, parks-utility-fee)
// are NOT overwritten — they're listed in SKIP.
//
// Usage: node scripts/build-pages.js
//
// Output: departments/<slug>.html and funds/<slug>.html
//
// Each stub uses the site's shared CSS + format.js + data.js. The page
// renders KPI cards from data we have today and links prominently to the
// authoritative section in the proposed-budget PDF.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const VER = String(Date.now());

const SKIP = new Set([
  "departments/parks-and-recreation.html",
  "funds/parks-utility-fee.html",
]);

// ---------- DEPARTMENTS ----------
// printedPage = the page number printed on the PDF page
// pdfPage     = the actual PDF page index (used in the #page= anchor)
// personalServices = FY 26-27 proposed Personal Services budget where extracted
const DEPARTMENTS = [
  {
    slug: "city-council",
    name: "City Council",
    programArea: "Policy & Administration",
    fundedBy: ["General Fund"],
    printedPage: 122,
    pdfPage: 140,
    personalServices: 67350,
    description: "Six councilors plus the mayor. Sets policy direction, adopts the budget and tax rate, and represents the City to state and federal partners. Operates on small stipends and minimal materials — the smallest budget of any city department.",
    contextSentences: [
      "Council members participate in advocacy events including the League of Oregon Cities and the National League of Cities conferences.",
      "Council priorities for the year are set at the annual Council Advance, a focused goal-setting workshop, and inform every department's work plan.",
    ],
  },
  {
    slug: "administration",
    name: "Administration",
    programArea: "Policy & Administration",
    fundedBy: ["General Fund"],
    printedPage: 126,
    pdfPage: 145,
    personalServices: 2446520,
    description: "The City Manager's office. Includes the City Manager, Assistant City Manager / Finance Director, Deputy City Manager, Human Resources, Volunteer Services, Communications, and economic-development functions.",
    contextSentences: [
      "Tracks open rate on the Tualatin Today monthly e-newsletter as one of its performance measures (around 50%).",
      "Houses the citizen engagement, neighborhood involvement (CIO), and communications work that runs across departments.",
    ],
  },
  {
    slug: "finance",
    name: "Finance",
    programArea: "Policy & Administration",
    fundedBy: ["General Fund"],
    printedPage: 132,
    pdfPage: 156,
    personalServices: 574360,
    description: "Accounting, financial reporting, budget administration, utility billing, accounts payable and receivable, payroll, and management of the City's investment portfolio.",
    contextSentences: [
      "Tualatin has earned the GFOA Triple Crown Award — recognized for the Certificate of Achievement for Excellence in Financial Reporting, the Popular Annual Financial Reporting Award, and the Distinguished Budget Presentation Award.",
      "Annual property tax revenue and the City's $100M+ pooled investments are administered out of this office.",
    ],
  },
  {
    slug: "municipal-court",
    name: "Municipal Court",
    programArea: "Policy & Administration",
    fundedBy: ["General Fund"],
    printedPage: 137,
    pdfPage: 158,
    description: "Adjudicates city ordinance violations, traffic infractions, and certain misdemeanor offenses. Staffed by a Court Administrator and Court Clerks, with contracted judicial services.",
    contextSentences: [
      "Hears traffic citations issued through the photo-enforcement program, plus local code-compliance cases referred by Police and Code Compliance.",
      "Revenue from court fines flows back to the General Fund — under 1.5% of total City revenues but a steady contributor.",
    ],
  },
  {
    slug: "legal",
    name: "Legal",
    programArea: "Policy & Administration",
    fundedBy: ["General Fund"],
    printedPage: 142,
    pdfPage: 160,
    personalServices: 624445,
    description: "The City Attorney's office. Drafts ordinances and contracts, advises Council and staff, represents the City in litigation, and supports code compliance.",
    contextSentences: [
      "Provides training to Council, Departments, and City staff on a wide variety of topics, from public records to land use.",
      "Reviews every ordinance, intergovernmental agreement, and franchise the City executes.",
    ],
  },
  {
    slug: "information-services",
    name: "Information Services",
    programArea: "Policy & Administration",
    fundedBy: ["General Fund"],
    printedPage: 146,
    pdfPage: 165,
    personalServices: 1129190,
    description: "IT infrastructure, cybersecurity, GIS, audio-visual for Council chambers, and applications support across every City department.",
    contextSentences: [
      "Tracks the average phishing-email click rate as a security metric — typically under 6% against a target of less than 15%.",
      "Launching a redesigned City website in FY 26-27 is one of the year's flagship cross-department initiatives.",
    ],
  },
  {
    slug: "community-development",
    name: "Community Development",
    programArea: "Community Development",
    fundedBy: ["General Fund"],
    printedPage: 159,
    pdfPage: 181,
    personalServices: 1277010,
    description: "Long-range and current planning, land-use applications, the Transportation System Plan update, the Climate Action Plan, the Core Opportunity & Reinvestment Area (CORA), and housing strategy implementation.",
    contextSentences: [
      "Processes roughly 175–200 land-use applications a year, with much higher inquiry volumes from residents and developers.",
      "Hiring a new Climate Action Program Manager in FY 26-27 to implement the City's adopted Climate Action Plan.",
    ],
  },
  {
    slug: "engineering",
    name: "Engineering",
    programArea: "Community Development",
    fundedBy: ["General Fund"],
    printedPage: 165,
    pdfPage: 187,
    personalServices: 1200120,
    description: "Capital project delivery for transportation, water, sewer, and stormwater. Reviews development plans and oversees right-of-way work and Public Works permits.",
    contextSentences: [
      "Currently delivering the B-Level Reservoir, the Aquifer Storage and Recovery well, and Martinazzi Avenue + SW 108th sewer upsizing — the work driving FY 26-27's 35% jump in Capital Outlay.",
      "Processes a few hundred Public Works permits a year on top of capital project oversight.",
    ],
  },
  {
    slug: "building",
    name: "Building",
    programArea: "Community Development",
    fundedBy: ["Building Fund"],
    printedPage: 171,
    pdfPage: 192,
    personalServices: 1238735,
    description: "Plan review, building inspections, and code compliance under statewide building codes. Operates from a dedicated permit-revenue fund (Building Fund), not the General Fund.",
    contextSentences: [
      "Processed roughly 2,300 permits and 8,700 inspections last year, with code-compliance volume continuing to rise.",
      "Self-supporting from permit fees — the Building Fund is independent of the General Fund.",
    ],
  },
  {
    slug: "library",
    name: "Library",
    programArea: "Culture & Recreation",
    fundedBy: ["General Fund", "Intergovernmental (WCCLS, CCLD)"],
    printedPage: 177,
    pdfPage: 201,
    personalServices: 2592075,
    description: "Tualatin Public Library, Teen Room, Makerspace, programs, and the Summer Reading Program. About 72% of the budget is funded by intergovernmental revenue from the Washington County Cooperative Library System (WCCLS) and the Clackamas County Library District.",
    contextSentences: [
      "Over 22,800 program attendees, 639,000 checkouts, and 221,800 ebook checkouts in FY 2024-25.",
      "WCCLS funding rises 5% in FY 26-27 under the renewed countywide funding formula.",
    ],
  },
  {
    slug: "parks-maintenance",
    name: "Parks Maintenance",
    programArea: "Culture & Recreation",
    fundedBy: ["General Fund", "Parks Utility Fee Fund"],
    printedPage: 192,
    pdfPage: 216,
    personalServices: 1257165,
    description: "Day-to-day maintenance of twelve parks (340 acres), 180 acres of greenway and natural areas, athletic fields, playgrounds, and trails. Operates alongside the Parks & Recreation programming team but is its own division.",
    contextSentences: [
      "Maintains park land budgeted at roughly $5,210 per acre per year.",
      "Some maintenance costs (utility-related work in parks) flow through the Parks Utility Fee Fund.",
    ],
  },
  {
    slug: "police",
    name: "Police",
    programArea: "Public Safety",
    fundedBy: ["General Fund"],
    printedPage: 208,
    pdfPage: 235,
    personalServices: 9906655,
    description: "Patrol, investigations, traffic safety (including the photo-enforcement program), school resource officers contracted to the Tigard-Tualatin School District, and police services contracted to the City of Durham.",
    contextSentences: [
      "The largest single department by personnel-services budget — close to $10M.",
      "Roughly 23,800 calls for service per year. Reinstating a red-light photo enforcement intersection on Tualatin-Sherwood Road came online in early FY 26-27.",
    ],
  },
  {
    slug: "maintenance-services",
    name: "Maintenance Services",
    programArea: "Public Works",
    fundedBy: ["General Fund", "Vehicle Replacement Fund"],
    printedPage: 216,
    pdfPage: 245,
    personalServices: 1109510,
    description: "Public Works shared leadership and cross-utility services: facilities maintenance, fleet, equipment shop, and the coordination that supports every utility division.",
    contextSentences: [
      "Tracks tasks completed with no defects in workmanship as a quality metric (target 98%).",
      "Manages the City vehicle fleet via the internal-service Vehicle Replacement Fund.",
    ],
  },
  {
    slug: "water-operating",
    name: "Water Operating",
    programArea: "Public Works",
    fundedBy: ["Water Operating Fund"],
    printedPage: 225,
    pdfPage: 254,
    personalServices: 1490435,
    description: "Operates 115 miles of pipe, 6 reservoirs (14 million gallons), and 1,120 fire hydrants. Buys treated water wholesale from the City of Portland.",
    contextSentences: [
      "Tracks regulatory violations against a target of zero.",
      "FY 26-27 capital work includes the B-Level Reservoir, the Aquifer Storage and Recovery well, and a C-Level Pump Station.",
    ],
  },
  {
    slug: "sewer-operating",
    name: "Sewer Operating",
    programArea: "Public Works",
    fundedBy: ["Sewer Operating Fund"],
    printedPage: 236,
    pdfPage: 265,
    personalServices: 531650,
    description: "Sanitary sewer collection. Partners with Clean Water Services for treatment under a regional intergovernmental agreement. The largest capital growth in FY 26-27.",
    contextSentences: [
      "Cleans over 120,000 linear feet of sewer line each year as preventive maintenance.",
      "FY 26-27 capital work includes Martinazzi Avenue and SW 108th sewer upsizing projects in partnership with Clean Water Services.",
    ],
  },
  {
    slug: "stormwater-operating",
    name: "Stormwater Operating",
    programArea: "Public Works",
    fundedBy: ["Stormwater Operating Fund"],
    printedPage: 246,
    pdfPage: 275,
    personalServices: 499160,
    description: "Storm drain network and water-quality infrastructure: catch basins, conveyance, treatment facilities, and regulatory compliance.",
    contextSentences: [
      "Cleans roughly 1,700 catch basins (sumped and unsumped) per year.",
      "FY 26-27 includes stormwater improvements at Nyberg Creek and other flooding-susceptible areas.",
    ],
  },
  {
    slug: "road-operating",
    name: "Road Operating",
    programArea: "Public Works",
    fundedBy: ["Road Operating Fund"],
    printedPage: 259,
    pdfPage: 289,
    personalServices: 723285,
    description: "Street maintenance, traffic signs and signals (52 signals), and the mag-chloride de-icing program. Maintains 73 miles of streets.",
    contextSentences: [
      "Tracks laminated wood street-light pole replacements as a capital-renewal metric.",
      "FY 26-27 adds a mag-chloride storage tank so winter de-icing can run more efficiently.",
    ],
  },
];

// ---------- FUNDS ----------
// Pulls beginning/change/end from data.js fundBalances by slug.
const FUNDS = [
  // General & supporting
  { slug: "general-fund",            group: "General",        type: "General Fund",        printedPage: 91,  description: "The unrestricted operating fund. Pays for Police, Library, most of Parks & Recreation, City Council, City Manager, Finance, Legal, IT, Community Development, and Municipal Court. About 27% of the total city budget. Funded primarily by property taxes (~43%), franchise fees, and intergovernmental revenue." },
  { slug: "building",                group: "General",        type: "Special Revenue",     printedPage: 96,  description: "Self-supporting fund for the Building Division. Funded by building permit fees; pays for plan review, inspections, and code compliance. Operates independently from the General Fund so permit volumes drive the division's capacity, not council priority calls." },

  // Transportation
  { slug: "road-utility-fee",        group: "Transportation", type: "Special Revenue",     printedPage: 98,  description: "Pavement Maintenance Program funded by the Road Utility Fee — a monthly charge on every utility account. Rate increases are tied to a three-pronged index Washington County uses for the Transportation Development Tax. FY 26-27 is a lower-volume PMP year after last year's high-project cycle." },
  { slug: "road-operating",          group: "Transportation", type: "Special Revenue",     printedPage: 99,  description: "Day-to-day street maintenance, signs, signals, and snow & ice response. Funded by State shared revenues (gas tax) and transfers in." },
  { slug: "tdt",                     group: "Transportation", type: "Capital Projects",    printedPage: 104, description: "Transportation Development Tax — a Washington County-administered impact fee on new development. The City uses the funds for capacity-adding transportation improvements." },
  { slug: "core-area-parking",       group: "Transportation", type: "Special Revenue",     printedPage: 101, description: "Funds parking facilities and management in the Core Opportunity & Reinvestment Area (CORA). Small fund relative to the rest of the transportation portfolio." },

  // Parks
  { slug: "park-development",        group: "Parks",          type: "Capital Projects",    printedPage: 107, description: "Parks system-development charges (SDCs) collected from new development. Restricted to capacity-adding parks improvements and acquisition." },
  { slug: "parks-project",           group: "Parks",          type: "Capital Projects",    printedPage: 108, description: "Bond-financed parks capital fund. Houses spending from the 2022 voter-approved $25M Parks and Trails Bond — $15M sold in 2023, remaining $10M projected to sell in 2027." },

  // Utilities
  { slug: "water-operating",         group: "Utilities",      type: "Enterprise",          printedPage: 111, description: "Operating fund for the water utility. Revenue from water rates; pays for operations, purchased water from Portland, distribution-system maintenance, and water-related capital." },
  { slug: "water-development",       group: "Utilities",      type: "Enterprise",          printedPage: 113, description: "System Development Charges for the water utility — paid by new development for growth-related capital. Pairs with the Water Operating Fund for project financing." },
  { slug: "sewer-operating",         group: "Utilities",      type: "Enterprise",          printedPage: 114, description: "Operating fund for the sanitary sewer utility. Includes Tualatin's share of regional treatment costs paid to Clean Water Services." },
  { slug: "sewer-development",       group: "Utilities",      type: "Enterprise",          printedPage: 116, description: "Sewer System Development Charges paid by new development. Funds capacity-adding sewer infrastructure." },
  { slug: "stormwater-operating",    group: "Utilities",      type: "Enterprise",          printedPage: 117, description: "Operating fund for stormwater services — catch basin maintenance, water-quality treatment facilities, regulatory compliance, and flooding improvements." },
  { slug: "stormwater-development",  group: "Utilities",      type: "Enterprise",          printedPage: 118, description: "Stormwater System Development Charges. Funds growth-related stormwater capital." },

  // Special-purpose
  { slug: "arp",                     group: "Special",        type: "Federal Grant",       printedPage: 105, description: "American Rescue Plan Act funds. FY 26-27 is the federal spend-down deadline; the remaining balance is being deployed to projects including Las Casitas Park renovation and Basalt Creek linear park design." },
  { slug: "go-bond",                 group: "Special",        type: "Debt Service",        printedPage: 106, description: "General Obligation Bond Fund. Pays principal and interest on voter-approved GO bonds, including the 2023 Parks Improvement Bond series. The 2026-27 bond levy rate drops because the remaining $10M bond sale is pushed to 2027." },
  { slug: "vehicle-replacement",     group: "Special",        type: "Internal Service",    printedPage: 120, description: "Internal-service fund used to even out the cost of replacing the City vehicle fleet over time. Departments contribute on a usage basis; the fund pays when vehicles are bought." },
  { slug: "scholarship",             group: "Special",        type: "Special Revenue",     printedPage: 102, description: "Tualatin Scholarship Fund. Small dedicated fund underwriting the City's Science and Technology scholarships — two $1,500 scholarships will be awarded in FY 25-26 (up from one in prior years)." },
];

// TDC funds are separate from data.js fundBalances; values transcribed from
// the proposed budget's Changes in Fund Balance schedule (printed p. 58).
const TDC_FUNDS = [
  { slug: "tdc-admin",          name: "TDC Administration",                              type: "Urban Renewal", printedPage: 315, begin: 159875,  change:  105045, end:  264920, description: "Administrative operations of the Tualatin Development Commission — the City's urban renewal agency." },
  { slug: "tdc-leveton",        name: "Leveton Projects",                                type: "Urban Renewal", printedPage: 321, begin: null,    change: null,    end: null,    description: "Project fund for the Leveton Tax Increment Financing district." },
  { slug: "tdc-sw-bond",        name: "Southwest Urban Renewal District Bond",           type: "Urban Renewal", printedPage: 325, begin: 3368255, change: 2816950, end: 6185205, description: "Bond proceeds and reserves for the Southwest Urban Renewal District. Funds public improvements within the district." },
  { slug: "tdc-sw-project",     name: "Southwest Urban Renewal District Project",        type: "Urban Renewal", printedPage: 329, begin: null,    change: null,    end: null,    description: "Project-level spending for the Southwest Urban Renewal District." },
  { slug: "tdc-cora-bond",      name: "Core Opportunity & Reinvestment Area Bond",       type: "Urban Renewal", printedPage: 332, begin: 150000,  change:  176380, end:  326380, description: "Bond fund for the Core Opportunity & Reinvestment Area (CORA) — the downtown urban renewal district." },
  { slug: "tdc-cora-project",   name: "Core Opportunity & Reinvestment Area Project",    type: "Urban Renewal", printedPage: 336, begin: 12450,   change:  -12450, end:       0, description: "CORA project fund. Closes to zero in FY 26-27 as the prior balance is fully deployed." },
];

// ---------- Render helpers ----------
const pdfBase = "https://www.tualatinoregon.gov/sites/default/files/fileattachments/finance/page/6486/final_proposed_budget_fy2026-27-compressed.pdf";

const fmtUSDshort = (n) => {
  if (n == null) return "—";
  const a = Math.abs(n);
  if (a >= 1e6) return `$${(n / 1e6).toFixed(a >= 10e6 ? 1 : 2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
};

function deptPage(d) {
  const fundedBy = d.fundedBy.map((f) => `<span class="tag">${f}</span>`).join(" ");
  const ps = d.personalServices;
  const kpiBlocks = [];
  if (ps != null) {
    kpiBlocks.push(`
      <div class="kpi">
        <div class="kpi__label">Personal Services FY 26-27</div>
        <div class="kpi__value">${fmtUSDshort(ps)}</div>
        <div class="kpi__sub">proposed budget <a class="cite" href="${pdfBase}#page=${d.pdfPage}" target="_blank" rel="noopener">↗ p. ${d.printedPage}</a></div>
      </div>`);
  }
  kpiBlocks.push(`
    <div class="kpi">
      <div class="kpi__label">Program area</div>
      <div class="kpi__value" style="font-family: var(--font-serif); font-size: 1.2rem;">${d.programArea}</div>
      <div class="kpi__sub">one of six budget program areas</div>
    </div>`);
  kpiBlocks.push(`
    <div class="kpi">
      <div class="kpi__label">Funded by</div>
      <div class="kpi__value" style="font-family: var(--font-serif); font-size: 1rem; line-height: 1.3;">${d.fundedBy.join(" + ")}</div>
      <div class="kpi__sub">primary funding source(s)</div>
    </div>`);
  kpiBlocks.push(`
    <div class="kpi">
      <div class="kpi__label">Source pages</div>
      <div class="kpi__value" style="font-family: var(--font-serif); font-size: 1.2rem;">PDF p. ${d.printedPage}</div>
      <div class="kpi__sub"><a class="cite" href="${pdfBase}#page=${d.pdfPage}" target="_blank" rel="noopener">↗ Open in PDF</a></div>
    </div>`);
  const context = d.contextSentences.map((s) => `<li>${s}</li>`).join("\n        ");
  return template({
    title: `${d.name} · Tualatin FY 2026–27`,
    crumb: `<a href="../index.html">Overview</a> · <a href="index.html">Departments</a> · ${d.programArea}`,
    h1: d.name,
    sub: d.description,
    tags: `${fundedBy} <span class="tag">${d.programArea}</span> <a class="tag" href="${pdfBase}#page=${d.pdfPage}" target="_blank" rel="noopener">↗ PDF p. ${d.printedPage}</a>`,
    kpis: kpiBlocks.join(""),
    contextList: context,
    activeNav: "Departments",
    upPath: "..",
    pageType: "department",
  });
}

function fundPage(f, bal) {
  const change = bal?.change;
  const begin  = bal?.begin;
  const end    = bal?.end;
  const sign   = change == null ? "" : change > 0 ? "+" : change < 0 ? "−" : "";
  const deltaCls = change == null ? "delta--neutral" : change > 0 ? "delta--up" : change < 0 ? "delta--down" : "delta--neutral";
  const arrow  = change == null ? "—" : change > 0 ? "▲" : change < 0 ? "▼" : "—";
  const kpiBlocks = [
    `
    <div class="kpi">
      <div class="kpi__label">Ending balance FY 26-27</div>
      <div class="kpi__value">${end == null ? "—" : fmtUSDshort(end)}</div>
      <div class="kpi__sub">proposed end-of-year <a class="cite" href="${pdfBase}#page=67" target="_blank" rel="noopener">↗ p. 58</a></div>
    </div>`,
    `
    <div class="kpi">
      <div class="kpi__label">Beginning balance</div>
      <div class="kpi__value">${begin == null ? "—" : fmtUSDshort(begin)}</div>
      <div class="kpi__sub">July 1, 2026</div>
    </div>`,
    `
    <div class="kpi">
      <div class="kpi__label">Net change</div>
      <div class="kpi__value" style="font-size: 1.6rem;">${change == null ? "—" : `<span class="delta ${deltaCls}">${arrow} ${fmtUSDshort(Math.abs(change))}</span>`}</div>
      <div class="kpi__sub">${change != null && change < 0 ? "spending down accumulated reserves" : change != null && change > 0 ? "growing reserves this year" : "see PDF for current values"}</div>
    </div>`,
    `
    <div class="kpi">
      <div class="kpi__label">Fund type</div>
      <div class="kpi__value" style="font-family: var(--font-serif); font-size: 1.2rem;">${f.type}</div>
      <div class="kpi__sub"><a class="cite" href="${pdfBase}#page=${printedToPdf(f.printedPage)}" target="_blank" rel="noopener">↗ p. ${f.printedPage}</a></div>
    </div>`,
  ];
  return template({
    title: `${f.name || nameFromSlug(f.slug)} · Tualatin FY 2026–27`,
    crumb: `<a href="../index.html">Overview</a> · <a href="index.html">Funds</a> · ${f.type}`,
    h1: f.name || nameFromSlug(f.slug),
    sub: f.description,
    tags: `<span class="tag tag--primary">${f.type}</span> <a class="tag" href="${pdfBase}#page=${printedToPdf(f.printedPage)}" target="_blank" rel="noopener">↗ PDF p. ${f.printedPage}</a>`,
    kpis: kpiBlocks.join(""),
    contextList: "",
    activeNav: "Funds",
    upPath: "..",
    pageType: "fund",
  });
}

// Map printed → PDF page using the pageMap in data.js (best-effort).
const PAGE_MAP = {
  91: 113, 96: 119, 98: 121, 99: 122, 101: 124, 102: 125, 103: 126, 104: 127,
  105: 128, 106: 129, 107: 130, 108: 131, 110: 133, 111: 134, 113: 136,
  114: 137, 116: 139, 117: 140, 118: 141, 120: 143,
  // TDC
  314: 337, 315: 338, 321: 344, 325: 348, 329: 352, 332: 355, 336: 359,
  58: 67,
};
function printedToPdf(p) { return PAGE_MAP[p] || p; }

function nameFromSlug(slug) {
  return slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

function template({ title, crumb, h1, sub, tags, kpis, contextList, activeNav, upPath }) {
  const navFunds       = activeNav === "Funds"       ? `<a class="is-active" href="${activeNav === "Funds" ? "index.html" : `${upPath}/funds/index.html`}">Funds</a>` : `<a href="${upPath}/funds/index.html">Funds</a>`;
  const navDepartments = activeNav === "Departments" ? `<a class="is-active" href="${activeNav === "Departments" ? "index.html" : `${upPath}/departments/index.html`}">Departments</a>` : `<a href="${upPath}/departments/index.html">Departments</a>`;
  const navMeetings    = `<a href="${upPath}/meetings/index.html">Meetings</a>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${upPath}/assets/css/site.css?v=${VER}">
</head>
<body>

<header class="site-header">
  <div class="container site-header__inner">
    <a class="brand" href="${upPath}/index.html">
      <span class="brand__seal">T</span>
      <span class="brand__text">
        <span class="brand__name">Tualatin Budget Explorer</span>
        <span class="brand__sub">FY 2026–2027 PROPOSED</span>
      </span>
    </a>
    <nav class="site-nav">
      <a href="${upPath}/index.html">Overview</a>
      ${navFunds}
      ${navDepartments}
      ${navMeetings}
    </nav>
  </div>
</header>

<div class="page-header">
  <div class="container">
    <div class="page-header__crumbs">${crumb}</div>
    <h1>${h1}</h1>
    <p class="page-header__sub">${sub}</p>
    <div class="tag-row">${tags}</div>
  </div>
</div>

<main>
<div class="container" style="padding-top: 32px;">
  <div class="kpi-strip">${kpis}</div>

  ${contextList ? `
  <section class="subsection" style="margin-top: 48px;">
    <h3>What's notable</h3>
    <ul class="bullets">
      ${contextList}
    </ul>
  </section>` : ""}

  <section class="subsection" style="margin-top: 48px;">
    <div class="callout callout--accent">
      <div class="callout__title">Source-of-truth: the proposed budget</div>
      <div class="callout__detail">
        This page is a quick index. The authoritative source — line-item budget tables, performance measures, division detail, and the city manager's commentary — is in the FY 2026–27 Proposed Budget document. <a href="${pdfBase}#page=${(activeNav === "Funds" ? printedToPdf : ((p) => PAGE_MAP[p] || p))((tags.match(/PDF p\. (\d+)/) || [])[1] || 1)}" target="_blank" rel="noopener">Open this section in the PDF →</a>
      </div>
    </div>
    <p class="note" style="margin-top: 12px;">A fuller deep-dive page like <a href="${upPath}/departments/parks-and-recreation.html">Parks and Recreation</a> or <a href="${upPath}/funds/parks-utility-fee.html">Parks Utility Fee Fund</a> is planned for this entry; until then, the PDF link above is the most complete source.</p>
  </section>
</div>
</main>

<footer class="site-footer">
  <div class="container site-footer__inner">
    <div>
      Source: <a href="${pdfBase}" target="_blank" rel="noopener">FY 2026–2027 Proposed Budget</a> (City of Tualatin, OR · 405pp · PDF).<br>
      Historical budgets: <a href="https://www.tualatinoregon.gov/finance/adopted-budget-and-budget-brief">tualatinoregon.gov</a>.
    </div>
    <div>Built as a personal study tool by Daniel Bachhuber, Budget Advisory Committee member.</div>
  </div>
</footer>

</body>
</html>
`;
}

// ---------- Generate ----------
function load(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function loadFundBalances() {
  // Cheap parse: eval data.js in a sandboxed shim.
  const code = load("assets/js/data.js");
  const sandbox = { window: {} };
  // eslint-disable-next-line no-new-func
  new Function("window", code)(sandbox.window);
  return sandbox.window.BUDGET.fundBalances;
}

const fundBalances = loadFundBalances();
const bySlug = Object.fromEntries(fundBalances.map((f) => [f.slug, f]));

let written = 0, skipped = 0;
for (const d of DEPARTMENTS) {
  const rel = `departments/${d.slug}.html`;
  if (SKIP.has(rel)) { skipped++; continue; }
  fs.writeFileSync(path.join(ROOT, rel), deptPage(d));
  written++;
  console.log(`  wrote ${rel}`);
}
for (const f of FUNDS) {
  const rel = `funds/${f.slug}.html`;
  if (SKIP.has(rel)) { skipped++; continue; }
  fs.writeFileSync(path.join(ROOT, rel), fundPage({ ...f, name: bySlug[f.slug]?.name || nameFromSlug(f.slug) }, bySlug[f.slug]));
  written++;
  console.log(`  wrote ${rel}`);
}
for (const t of TDC_FUNDS) {
  const rel = `funds/${t.slug}.html`;
  if (SKIP.has(rel)) { skipped++; continue; }
  fs.writeFileSync(path.join(ROOT, rel), fundPage(t, t));
  written++;
  console.log(`  wrote ${rel}`);
}
console.log(`\nwrote ${written} files, skipped ${skipped} (existing deep-dives)`);
