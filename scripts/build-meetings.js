#!/usr/bin/env node
// Generates per-meeting pages from extracted minutes text.
// Reads meetings/extracted/<date>-minutes.txt and writes meetings/<date>.html
// quoting the full minutes.

const fs = require("fs");
const path = require("path");
const { head, aiBanner, siteHeader, siteFooter, bustCache } = require("./lib/partials");

const ROOT = path.resolve(__dirname, "..");
const EXTRACTED = path.join(ROOT, "meetings", "extracted");
const OUT_DIR = path.join(ROOT, "meetings");

// Meta for each meeting — mirrors meetings/index.html. Keyed by date.
const MEETINGS = {
  "2026-02-09": {
    label: "February 9, 2026",
    time: "5:00 p.m.",
    cycle: "FY 2026-27",
    purpose: "Kickoff / FY 25-26 follow-up",
    uuid: "71a5f4edf4854e3a93d88975cbfdd364",
  },
  "2025-05-12": {
    label: "May 12, 2025",
    time: "evening",
    cycle: "FY 2025-26",
    purpose: "Kickoff — chair election &amp; budget overview",
    uuid: "e206efae0b4b4cdfb0000484395dbe1d",
  },
  "2025-05-28": {
    label: "May 28, 2025",
    time: "evening",
    cycle: "FY 2025-26",
    purpose: "Public hearing &amp; adoption",
    uuid: "b210c61eea204e94a9df0129d5a544d8",
  },
  // The May 29, 2024 minutes are embedded in the May 12, 2025 kickoff packet
  // (PDF UUID e206efae0b4b4cdfb0000484395dbe1d). No standalone minutes UUID
  // exists — extractedMinutesSource notes the host PDF for the citation link.
  "2024-05-29": {
    label: "May 29, 2024",
    time: "evening",
    cycle: "FY 2024-25",
    purpose: "Public hearing &amp; budget recommendation",
    uuid: "569e5c15acc04ce19dc9dded5b7dc6d0",
    extractedMinutesSource: { kind: "Packet", uuid: "e206efae0b4b4cdfb0000484395dbe1d", label: "May 12, 2025 packet" },
  },
  // The May 30, 2023 minutes are embedded in the May 13, 2024 continuation
  // packet (PDF UUID 3e890d7993a8478785a8567b7dafb9d8).
  "2023-05-30": {
    label: "May 30, 2023",
    time: "evening",
    cycle: "FY 2023-24",
    purpose: "Public hearing &amp; budget recommendation",
    uuid: "5e1de1b81ea3485d8c9e1c24fffb7d32",
    extractedMinutesSource: { kind: "Packet", uuid: "3e890d7993a8478785a8567b7dafb9d8", label: "May 13, 2024 packet" },
  },
  "2022-05-16": {
    label: "May 16, 2022",
    time: "evening",
    cycle: "FY 2022-23",
    purpose: "Kickoff — chair election &amp; budget message",
    uuid: "4a44e9345df54b7eb7b3e3a6fa9f7f2b",
  },
  "2022-05-31": {
    label: "May 31, 2022",
    time: "evening",
    cycle: "FY 2022-23",
    purpose: "Public hearing &amp; budget recommendation",
    uuid: "b09bd60932b3403c9e497b4002a4513b",
  },
  // The May 25, 2021 page hosts the minutes of the May 10, 2021 meeting.
  "2021-05-10": {
    label: "May 10, 2021",
    time: "evening",
    cycle: "FY 2021-22",
    purpose: "Kickoff — chair election &amp; budget overview (COVID era)",
    uuid: "7828f35a4b5e44059a291dec99414863",
    minutesNote: "Minutes hosted on the May 25, 2021 meeting page.",
  },
  "2020-05-20": {
    label: "May 20, 2020",
    time: "evening",
    cycle: "FY 2020-21",
    purpose: "Public hearing &amp; budget recommendation",
    uuid: "26d8e775ce2041d59d1dd5cace3eb5a7",
  },
};

const MUNICODE = "https://mccmeetings.blob.core.usgovcloudapi.net/tualtnor-pubu";
const docUrl = (kind, uuid) => `${MUNICODE}/MEET-${kind}-${uuid}.pdf`;

// Strip the Adobe Sign / DocuSign audit log appendix that appears in many
// minutes PDFs after the recording-secretary signature line.
function trimSignatureAppendix(raw) {
  const cutoffs = [
    /Final Audit Report\s+\d{4}-\d{2}-\d{2}/i,
    /Document created by /i,
    /Transaction ID:/i,
    /Adobe Acrobat Sign/i,
  ];
  let cut = raw.length;
  for (const re of cutoffs) {
    const m = raw.match(re);
    if (m && m.index < cut) cut = m.index;
  }
  return raw.slice(0, cut).trimEnd();
}

// Convert extracted minutes text into HTML paragraphs. Reliable blank-line
// paragraph splits don't exist in the extracted text, so we identify breaks
// from semantic markers instead.
function renderMinutes(raw) {
  // 1. Clean and normalise into one whitespace-collapsed string.
  let text = trimSignatureAppendix(raw)
    .replace(/={5,}\s*PAGE BREAK\s*={5,}/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();

  // 2. Drop masthead lines that we replace with our own page title.
  text = text.replace(/\bTUALATIN BUDGET ADVISORY COMMITTEE\s+OFFICIAL MEETING MINUTES\s+FOR [^.]{1,80}\d{4}\b/gi, " ").trim();
  text = text.replace(/^\s*MINUTES OF THE [^.]{1,120}\d{4}\b/i, "").trim();

  // 3. Drop signature placeholder lines (underscores and signers).
  text = text.replace(/_{3,}\s*\/\s*Nicole Morris,?\s*Recording Secretary/gi, "");
  text = text.replace(/_{3,}\s*\/\s*Frank Bubenik,?\s*Mayor/gi, "");
  text = text.replace(/_{3,}/g, "");
  text = text.replace(/\bSherilyn Lombos,?\s*City Manager\s*$/i, "");
  text = text.replace(/\s+/g, " ").trim();

  // 4. Section headers we want to force as block-level H3s. Order matters —
  //    earlier matches anchor earlier in the doc.
  const SECTION_RE = /\b(Call to Order|Welcome and Introductions|Welcome|Meeting Agenda and Materials|Committee Questions and Comments?|Public Comment|Approval of Minutes|Adjournment)\b/g;

  // 5. Speaker turn pattern. Any of these titles followed by a Capitalised
  //    surname starts a new paragraph. Includes "Councilor", "Mayor", etc.
  const SPEAKER_RE = /\b(Committee Member|Student Member|Member|Director|Chair|Vice Chair|Councilor|Council Member|Mayor|City Manager|Assistant City Manager|Deputy City Manager|Consultant|Recording Secretary)\s+(?:[A-Z][a-zA-Z\-]+\s+)?[A-Z][a-zA-Z\-]+(?:-[A-Z][a-zA-Z]+)?/g;

  // 6. Agenda items: "1. Title here" — anchor only the numbered intros at
  //    sensible item lengths.
  const AGENDA_RE = /\b(\d{1,2})\.\s+([A-Z][^.0-9][^.]{2,120}?)(?=(?:\s+[A-Z][a-zA-Z]+\s+(?:Director|Member|Chair|Manager|Councilor|stated|asked|expressed|reported|noted|reviewed|presented|highlighted|provided|requested|introduced|spoke|confirmed|opened|closed|explained|clarified)|\s+(?:Call to Order|Welcome|Meeting Agenda|Public Comment|Adjournment|Approval of Minutes|Committee Questions)))/g;

  // 7. PRESENT / ABSENT rosters — extract these explicitly because the PDF
  //    text loses the blank-line break between them.
  let preface = "";
  // Lookahead: stop ABSENT only at a recognized section header. We deliberately
  // do NOT use role lookaheads like "Member Last" because roster entries
  // legitimately read "Committee Member Frank Bubenik" — stopping on "Member"
  // would truncate the roster mid-name.
  const presentMatch = text.match(/\bPRESENT:\s*(.+?)\s+ABSENT:\s*(.+?)(?=\s+(?:Call to Order|Welcome and Introductions|Welcome|Meeting Agenda|Approval of Minutes|Public Comment|Committee Questions|Adjournment))/);
  if (presentMatch) {
    const present = presentMatch[1].trim().replace(/[,;]\s*$/, "");
    const absent  = presentMatch[2].trim().replace(/[,;]\s*$/, "");
    preface += `<p class="minutes-roster"><strong>PRESENT:</strong> ${escapeHTML(present)}</p>\n`;
    preface += `<p class="minutes-roster"><strong>ABSENT:</strong> ${escapeHTML(absent)}</p>\n`;
    text = text.replace(presentMatch[0], "").trim();
  } else {
    const lonePresent = text.match(/\bPRESENT:\s*(.+?)(?=\s+Call to Order|\s+Welcome|\s+Meeting Agenda|\s+Approval of Minutes)/);
    if (lonePresent) {
      preface += `<p class="minutes-roster"><strong>PRESENT:</strong> ${escapeHTML(lonePresent[1].trim())}</p>\n`;
      text = text.replace(lonePresent[0], "").trim();
    }
  }

  // 8. Insert paragraph-break markers () before each section header,
  //    speaker turn, and agenda item — then split.
  // First, mark agenda items as their own kind of break ().
  text = text.replace(AGENDA_RE, "$1. $2");
  text = text.replace(SECTION_RE, "$1");
  text = text.replace(SPEAKER_RE, (m) => "" + m);

  // 9. Split on  to get paragraphs.
  const paragraphs = text.split("").map((p) => p.trim()).filter(Boolean);

  let body = preface;
  for (const para of paragraphs) {
    // Section header marker
    if (para.startsWith("")) {
      const heading = para.slice(1).replace(/^[\s.:]+|[\s.:]+$/g, "");
      body += `<h3 class="minutes-section">${escapeHTML(heading)}</h3>\n`;
      continue;
    }
    // Agenda-item marker
    if (para.startsWith("")) {
      const m = para.slice(1).match(/^(\d{1,2})\.\s+(.+)$/);
      if (m) {
        body += `<h3 class="minutes-agenda-item"><span class="minutes-agenda-num">${m[1]}.</span> ${escapeHTML(m[2].trim())}</h3>\n`;
        continue;
      }
    }
    // Speaker turn
    const mSpk = para.match(/^((?:Committee Member|Student Member|Member|Director|Chair|Vice Chair|Councilor|Council Member|Mayor|City Manager|Assistant City Manager|Deputy City Manager|Consultant|Recording Secretary)\s+(?:[A-Z][a-zA-Z\-]+\s+)?[A-Z][a-zA-Z\-]+(?:-[A-Z][a-zA-Z]+)?)\s+(.+)$/);
    if (mSpk) {
      body += `<p class="minutes-turn"><strong class="minutes-speaker">${escapeHTML(mSpk[1])}</strong> ${escapeHTML(mSpk[2])}</p>\n`;
      continue;
    }
    body += `<p>${escapeHTML(para)}</p>\n`;
  }
  return { html: body, suppressedHeadingBlocks: 0 };
}

function escapeHTML(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(date, meta, body) {
  const agendaUrl = docUrl("Agenda", meta.uuid);
  const packetUrl = docUrl("Packet", meta.uuid);
  // Minutes can live either at this meeting's own UUID (standalone PDF) or
  // inside another packet (embedded). The about-these-minutes callout
  // explains the embedding so the reader knows where the source text comes from.
  const minutesSrc = meta.extractedMinutesSource;
  const minutesUrl = minutesSrc
    ? docUrl(minutesSrc.kind, minutesSrc.uuid)
    : docUrl("Minutes", meta.uuid);
  const minutesTagLabel = minutesSrc
    ? `↗ Minutes (in ${minutesSrc.label})`
    : `↗ Minutes (PDF)`;
  const aboutMinutes = minutesSrc
    ? `The text below is quoted from the City of Tualatin's official minutes for this Budget Advisory Committee meeting, embedded inside the <a href="${minutesUrl}" target="_blank" rel="noopener">${minutesSrc.label}</a> on the City's Municode Meetings system — the city stopped publishing standalone BAC minutes PDFs starting FY 2023-24 and instead embeds them in the following year's packet. Speakers, agenda items, and recognised section headings have been formatted for easier reading but the text is otherwise verbatim.`
    : `The text below is quoted from the City of Tualatin's official minutes for this Budget Advisory Committee meeting, as published on the City's Municode Meetings system. The signed PDF is the authoritative source — open it with the <a href="${minutesUrl}" target="_blank" rel="noopener">↗ Minutes (PDF)</a> link above. Speakers, agenda items, and recognised section headings have been formatted for easier reading but the text is otherwise verbatim.`;

  return `<!doctype html>
<html lang="en">
${head({ title: `${meta.label} BAC meeting · Tualatin FY 2026–27`, upPath: ".." })}
<body>
${aiBanner()}

${siteHeader({ activeNav: "Meetings", upPath: ".." })}

<div class="page-header">
  <div class="container">
    <div class="page-header__crumbs">
      <a href="../index.html">Overview</a> · <a href="index.html">Budget Advisory Committee</a> · ${meta.cycle}
    </div>
    <h1>${meta.label}</h1>
    <p class="page-header__sub">${meta.purpose}. Meeting of the Tualatin Budget Advisory Committee.</p>
    <div class="tag-row">
      <span class="tag tag--primary">${meta.cycle}</span>
      <span class="tag">${meta.time}</span>
      <a class="tag" href="${minutesUrl}" target="_blank" rel="noopener">${minutesTagLabel}</a>
      <a class="tag" href="${agendaUrl}" target="_blank" rel="noopener">↗ Agenda</a>
      <a class="tag" href="${packetUrl}" target="_blank" rel="noopener">↗ Packet</a>
    </div>
  </div>
</div>

<main>
<div class="container minutes-container" style="padding-top: 40px;">

  <div class="callout" style="margin-bottom: 32px;">
    <div class="callout__title">About these minutes</div>
    <div class="callout__detail">
      ${aboutMinutes}
    </div>
  </div>

  <article class="minutes">
    ${body}
  </article>

  <p class="note" style="font-size: 0.875rem; color: var(--ink-3); margin: 32px 0 0;">
    Source: City of Tualatin official meeting minutes &mdash; <a href="${minutesUrl}" target="_blank" rel="noopener">${path.basename(minutesUrl)}</a>.
  </p>

</div>
</main>

${siteFooter({ sourceHtml: `Source: <a href="https://www.tualatinoregon.gov/bac" target="_blank" rel="noopener">Tualatin Budget Advisory Committee</a>, official minutes via the Municode Meetings system.` })}

</body>
</html>
`;
}

// ---------- Run ----------
let written = 0;
for (const [date, meta] of Object.entries(MEETINGS)) {
  const txtPath = path.join(EXTRACTED, `${date}-minutes.txt`);
  if (!fs.existsSync(txtPath)) {
    console.log(`  skip ${date} (no extracted minutes)`);
    continue;
  }
  const raw = fs.readFileSync(txtPath, "utf8");
  const { html } = renderMinutes(raw);
  const out = path.join(OUT_DIR, `${date}.html`);
  fs.writeFileSync(out, bustCache(page(date, meta, html)));
  console.log(`  wrote ${path.relative(ROOT, out)}`);
  written++;
}
console.log(`\nwrote ${written} meeting pages`);
