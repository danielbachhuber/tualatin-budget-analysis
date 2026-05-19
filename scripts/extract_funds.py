#!/usr/bin/env python3
"""Extract structured budget data per fund from FY2026-27 proposed budget.

Strategy
========
The proposed budget contains several views of fund-level data:

1. **Fund summary pages** (PDF pages 68-88, one fund per page). Each page lists
   revenues and expenditures at CATEGORY level (no inner line items), which is
   exactly the shape we want for ``funds.json``.  This covers 19 of 25 slugs.

2. **TDC fund pages** (PDF pages 354-374). Each TDC fund has a revenue table
   followed by an expenditure table on the following page.

3. **CIP projects table** (PDF pages 324-326). A simple ``Fund Title | Project
   Name | Amount`` listing of every capital project proposed for FY 2026-27.

4. **Description / objectives / performance pages**. Most funds have a
   description page that begins with the fund name and contains:
   ``Objectives for FY 2026 - 2027`` followed by bullet sentences, and an
   optional ``Performance Measures`` table with 4 numeric columns.

The numeric tables in the PDF interleave numbers and labels in an unusual
order: ``N`` number rows come first, followed by ``N+1`` label fragments
(the extra is the "Grand Total" trailer).  Labels can wrap across multiple
text lines.  After dropping the "Grand Total" label, the remaining names are
paired positionally with the number rows.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SRC = Path('/home/hermes/projects/tualatin-budget-analysis/extracted/raw/fy2026-27_proposed.txt')
OUT = Path('/home/hermes/projects/tualatin-budget-analysis/data/funds.json')

# slug -> (display name, summary-page in PDF page numbering, description-page or None)
# summary-page is the one-page-per-fund summary block in PDF pages 68-88
# description-page is the page where the fund's text description / objectives begin (or None)
REGULAR_FUNDS = [
    # slug,                       name,                         summary_pg, desc_pg
    ("general-fund",              "General Fund",               68,         None),
    ("building",                  "Building Fund",              69,         191),  # description in Building dept page
    ("road-operating",            "Road Operating Fund",        70,         286),
    ("road-utility-fee",          "Road Utility Fee Fund",      71,         282),
    ("core-area-parking",         "Core Area Parking Fund",     72,         299),
    ("parks-utility-fee",         "Parks Utility Fee Fund",     73,         220),
    ("tdt",                       "Transportation Development Tax Fund", 74, 293),
    ("arp",                       "American Rescue Plan Fund",  75,         173),
    ("go-bond",                   "General Obligation Bond Fund", 76,       308),
    ("park-development",          "Park Development Fund",      77,         223),
    ("parks-project",             "Parks Project Fund",         78,         226),
    ("scholarship",               "Tualatin Scholarship Fund",  81,         205),
    ("water-operating",           "Water Operating Fund",       82,         252),
    ("water-development",         "Water Development Fund",     83,         260),
    ("sewer-operating",           "Sewer Operating Fund",       84,         263),
    ("sewer-development",         "Sewer Development Fund",     85,         270),
    ("stormwater-operating",      "Stormwater Operating Fund",  86,         273),
    ("stormwater-development",    "Stormwater Development Fund", 87,        279),
    ("vehicle-replacement",       "Vehicle Replacement Fund",   88,         250),
]

# TDC funds use a different layout (separate revenue and expenditure pages).
# slug -> (name, revenue_pg, expenditure_pg, description_pg)
TDC_FUNDS = [
    ("tdc-admin",        "TDC Administration Fund",                              354, [355, 356], 351),
    ("tdc-leveton",      "Leveton Projects Fund",                                359, [360],      357),
    ("tdc-sw-bond",      "Southwest Urban Renewal District Bond Fund",           363, [364],      361),
    ("tdc-sw-project",   "Southwest Urban Renewal District Project Fund",        366, [367],      365),
    ("tdc-cora-bond",    "Core Opportunity and Reinvestment Area Bond Fund",     370, [371],      368),
    ("tdc-cora-project", "Core Opportunity and Reinvestment Area Project Fund",  373, [374],      372),
]

# CIP table maps "Fund Title" strings in PDF to fund slugs. Some entries name a
# department within the General Fund (e.g. "General Fund - Information Services").
CIP_FUND_TITLE_TO_SLUG = {
    "General Fund":                      "general-fund",
    "American Rescue Plan Fund":         "arp",
    "Building Fund":                     "building",
    "Park Development Fund":             "park-development",
    "Parks Utility Fee Fund":            "parks-utility-fee",
    "Parks Project Fund":                "parks-project",
    "Vehicle Replacement Fund":          "vehicle-replacement",
    "Water Operating Fund":              "water-operating",
    "Sewer Operating Fund":              "sewer-operating",
    "Stormwater Operating Fund":         "stormwater-operating",
    "Road Operating Fund":               "road-operating",
    "Transportation Development Tax Fund": "tdt",
    "Transportation Development":        "tdt",   # wrap variant
    "Core Area Parking Fund":            "core-area-parking",
    "SWURD Project Fund":                "tdc-sw-project",
}

NUM_ROW_RE = re.compile(r'^[\d,\(\)\-\$]+(\s+[\d,\(\)\-\$]+){3}$')
PAGE_RE = re.compile(r'^===== PAGE (\d+) =====')


# ---------------------------------------------------------------------------
# Generic helpers
# ---------------------------------------------------------------------------

def parse_num(s: str):
    """Parse a budget number; return int or None."""
    s = s.strip().replace('$', '')
    if not s or s == '-':
        return None
    neg = False
    if s.startswith('(') and s.endswith(')'):
        neg = True
        s = s[1:-1]
    s = s.replace(',', '')
    try:
        v = int(s)
        return -v if neg else v
    except ValueError:
        return None


def is_num_row(line: str) -> bool:
    parts = line.strip().split()
    if len(parts) != 4:
        return False
    for p in parts:
        if parse_num(p) is None:
            return False
    return True


def load_lines() -> list[str]:
    with open(SRC) as f:
        return [l.rstrip('\n').rstrip('\r') for l in f]


def index_pages(lines: list[str]) -> dict[int, int]:
    """Return {page_number: index_of_marker_line_in_lines}."""
    out: dict[int, int] = {}
    for i, line in enumerate(lines):
        m = PAGE_RE.match(line.strip())
        if m:
            out[int(m.group(1))] = i
    return out


def page_slice(lines: list[str], page_starts: dict[int, int], page: int) -> list[str]:
    """Return the lines on a given PDF page (excluding the page-marker itself)."""
    start = page_starts[page]
    end = page_starts.get(page + 1, len(lines))
    return lines[start + 1:end]


def merge_label_fragments(frags: list[str]) -> list[str]:
    """Combine wrapped category labels back into one string per label.

    The PDF text layer wraps long names; sometimes the wrap is marked with a
    trailing space on the first fragment, sometimes not. We merge when:

    - the previous fragment ends with a trailing space, ``&``, ``-``, or ``/``
    - the current fragment starts with ``-`` (e.g. ``"- SWURD Bond"``)
    - the current fragment is one of a small set of "obvious continuation"
      tokens (``Balance``, ``Investments``, ``Fund``, etc.) that are never
      standalone budget categories on their own
    """
    # We keep the ORIGINAL strings (with any trailing whitespace) so we can
    # check the trailing-space marker; we strip only when emitting.
    merged_raw: list[str] = []
    for frag in frags:
        if not frag.strip():
            continue
        if merged_raw and _looks_like_continuation(merged_raw[-1], frag):
            merged_raw[-1] = merged_raw[-1].rstrip() + ' ' + frag.strip()
        else:
            merged_raw.append(frag)
    return [m.strip() for m in merged_raw]


# Words that are NEVER standalone budget categories. If they show up as a
# line of their own, they're the second half of a wrapped label.
SAFE_CONTINUATION_WORDS = {
    "Balance", "Unappropriated", "Sources", "Uses",
    "Investments", "Projects", "Fund", "Bond Fund", "Project Fund",
    "Reserve", "Expense", "Plant", "Programs", "Program",
    "Acquisition", "Costs", "Stations", "Mains",
    "Excise Tax", "Development", "Development Expense",
    "Computer/Laptop", "OR Tax", "Loans", "Mgmt", "Subscriptions",
    "Promotional", "Recruitment", "Informational",
    "Equipment", "Furnishings", "Furniture", "Testing", "Supplies",
    "Software", "Maintenance", "Operation",
}

# Prefixes that mean the line is a continuation of the previous one.
SAFE_CONTINUATION_PREFIXES = ("- ", "-", "& ", "and ")


def _looks_like_continuation(prev: str, cur: str) -> bool:
    cur_strip = cur.strip()
    prev_strip = prev.strip()
    if not prev_strip or not cur_strip:
        return False
    # Don't merge category-header → next entry (e.g. don't merge "Transfers In"
    # into the previous category).
    if cur_strip in TOP_LEVEL_CATEGORIES:
        return False
    # Trailing-space marker from the PDF text layer
    if prev.endswith(' '):
        return True
    if prev_strip.endswith(('&', '-', '/')):
        return True
    if cur_strip in SAFE_CONTINUATION_WORDS:
        return True
    if cur_strip.startswith(SAFE_CONTINUATION_PREFIXES):
        return True
    return False


TOP_LEVEL_CATEGORIES = {
    # Revenue categories
    "Property Taxes", "Intergovernmental", "Investment Earnings",
    "Charges For Services", "Licenses And Permits", "Fees & Charges",
    "Fines And Forfeitures", "Miscellaneous", "Other Financing Sources",
    "Transfers In", "Beginning Fund Balance",
    # Expenditure categories
    "Personal Services", "Materials & Services", "Capital Outlay",
    "Debt Service", "Transfers Out", "Other Financing Uses",
    "Contingency", "Reserves & Unappropriated",
    # End
    "Grand Total",
}


# ---------------------------------------------------------------------------
# Fund summary section (PDF pages 68-88)
# ---------------------------------------------------------------------------

def parse_summary_page(lines: list[str], page_starts: dict[int, int],
                       page: int, fund_name: str) -> tuple[list[dict], list[dict]]:
    """Parse a one-page fund summary into (revenues, expenditures).

    Each section is:  Header word ("Revenues" / "Expenditures"), then
    N number rows (each 4 ints), then N+1 label fragments (last is
    "Grand Total"), then a "Actual FY..." footer.
    """
    page_lines = page_slice(lines, page_starts, page)

    # Sanity check: first non-empty line should match the fund name (or close).
    first_lines = [l for l in page_lines[:3] if l.strip()]
    expected_alts = {fund_name, fund_name.replace(" Fee", ""), fund_name.replace(" Fund", "")}
    if first_lines and not any(alt in first_lines[0] or first_lines[0] in alt for alt in expected_alts):
        print(f"  warn: first line of page {page} is {first_lines[0]!r} (expected {fund_name})",
              file=sys.stderr)

    revenues = _parse_summary_block(page_lines, "Revenues")
    expenditures = _parse_summary_block(page_lines, "Expenditures")
    return revenues, expenditures


def _parse_summary_block(page_lines: list[str], header: str) -> list[dict]:
    """Find ``header`` in page_lines, then collect numbers + labels for that
    section until ``Actual FY...`` is reached or the next header appears.
    """
    try:
        start = next(i for i, l in enumerate(page_lines) if l.strip() == header)
    except StopIteration:
        return []

    nums: list[list[int | None]] = []
    labels: list[str] = []
    i = start + 1

    # Phase 1: collect number rows (with possible blank lines)
    while i < len(page_lines):
        line = page_lines[i]
        s = line.strip()
        if not s:
            i += 1
            continue
        if is_num_row(line):
            nums.append([parse_num(x) for x in s.split()])
            i += 1
            continue
        break

    # Phase 2: collect labels until "Actual FY" footer or next section header
    while i < len(page_lines):
        line = page_lines[i]
        s = line.strip()
        if not s:
            i += 1
            continue
        if s.startswith('Actual FY'):
            break
        if s in ("Revenues", "Expenditures"):
            break
        if is_num_row(line):
            # Should not happen, but bail gracefully.
            break
        labels.append(line)
        i += 1

    merged = merge_label_fragments(labels)
    # Drop the "Grand Total" trailer label.
    merged = [m for m in merged if m.strip() != "Grand Total"]
    # Drop the matching "Grand Total" trailer number row (the last row is the
    # sum of the previous rows).
    if len(nums) == len(merged) + 1:
        nums = nums[:-1]

    if len(merged) != len(nums):
        print(f"  warn: {header} mismatch: {len(nums)} number rows vs {len(merged)} labels",
              file=sys.stderr)
        print(f"        labels: {merged}", file=sys.stderr)

    return [{"name": name.strip(), "values": vals}
            for name, vals in zip(merged, nums)]


# ---------------------------------------------------------------------------
# TDC funds (revenue page + expenditure page)
# ---------------------------------------------------------------------------

def parse_tdc_table(lines: list[str], page_starts: dict[int, int],
                    pages: list[int]) -> list[dict]:
    """Parse a TDC numeric table that may span one or more pages.

    Format on each page:
        <fund name?> (optional first line)
        N number rows
        N+1 label fragments (last == "Grand Total")  -- only on the final page
        "Actual FY..." footer

    For multi-page expenditure tables (e.g. TDC Admin spans 355-356), labels
    continue from one page to the next.  We collect numbers and labels
    across pages, then merge and pair.
    """
    all_nums: list[list[int | None]] = []
    all_labels: list[str] = []

    for pg in pages:
        page_lines = page_slice(lines, page_starts, pg)
        in_labels = False
        for line in page_lines:
            s = line.strip()
            if not s:
                continue
            if s.startswith('Actual FY'):
                continue
            # Skip the page-number footer (a 1-3 digit standalone number).
            if re.fullmatch(r'\d{1,3}', s):
                continue
            if is_num_row(line):
                # If we already started labels and now see numbers again, we've
                # crossed a page boundary that has its own number block.
                # That doesn't actually happen in this PDF, but stay safe.
                if in_labels:
                    all_nums.append([parse_num(x) for x in s.split()])
                else:
                    all_nums.append([parse_num(x) for x in s.split()])
                continue
            # Non-numeric, non-footer line: it's a label fragment.  But also
            # skip lines that look like a fund name (only on revenue pages,
            # always the first non-empty line).
            in_labels = True
            all_labels.append(line)

    # Strip optional fund-name title lines (very first labels that exactly
    # match a known TDC fund prefix).
    # Easier: drop labels that appear BEFORE we've collected any numbers and
    # that aren't a known category word.  Since labels are appended in order,
    # but we don't know which order on disk... let's instead just remove labels
    # whose stripped text matches a common fund-title prefix.
    title_prefixes = (
        "TDC Admin Fund", "Leveton Projects Fund",
        "Southwest Urban Renewal District",
        "Core Opportunity and Reinvestment",
    )
    while all_labels and any(all_labels[0].strip().startswith(p) for p in title_prefixes):
        all_labels.pop(0)
    # Also remove a stray standalone "Bond Fund" / "Project Fund" wrap-line
    # that follows a SWURD/CORA title.
    if all_labels and all_labels[0].strip() in ("Bond Fund", "Project Fund", "Area Bond Fund", "Area Project Fund"):
        all_labels.pop(0)

    merged = merge_label_fragments(all_labels)
    # Drop Grand Total trailer label and matching number row
    merged = [m for m in merged if m.strip() != "Grand Total"]
    if len(all_nums) == len(merged) + 1:
        all_nums = all_nums[:-1]

    if len(merged) != len(all_nums):
        print(f"  warn: TDC table mismatch on pages {pages}: "
              f"{len(all_nums)} number rows vs {len(merged)} labels",
              file=sys.stderr)
        print(f"        labels: {merged}", file=sys.stderr)

    return [{"name": name.strip(), "values": vals}
            for name, vals in zip(merged, all_nums)]


def collapse_to_categories(rows: list[dict]) -> list[dict]:
    """The TDC tables list categories alongside their line items (in the same
    column).  A category appears, immediately followed by one or more line
    items whose values are the SUBTOTAL of that category split by line item.
    For ``funds.json`` we only want category-level rows.

    Strategy: a row is a CATEGORY header iff its name matches one of the known
    top-level categories.  Drop all other rows.
    """
    out: list[dict] = []
    seen: set[str] = set()
    for r in rows:
        name = r["name"].strip()
        if name in TOP_LEVEL_CATEGORIES and name != "Grand Total" and name not in seen:
            out.append(r)
            seen.add(name)
    return out


# ---------------------------------------------------------------------------
# CIP projects table (PDF pages 324-326)
# ---------------------------------------------------------------------------

CIP_DOLLAR_RE = re.compile(r'\$\s*([\d,]+)')


def parse_cip(lines: list[str], page_starts: dict[int, int]) -> dict[str, list[dict]]:
    """Return ``{slug: [{name, amount}, ...]}``."""
    out: dict[str, list[dict]] = {}
    # CIP table runs roughly from PDF pages 324 through 326.
    pages = [324, 325, 326]
    buf: list[str] = []
    for pg in pages:
        if pg in page_starts:
            buf.extend(page_slice(lines, page_starts, pg))

    # Each project line is one of:
    #   "<Fund Title> <Project Name> $<amount>"
    # Some entries split the project name across two consecutive lines, with
    # the dollar amount on the second line (a few examples in the source).
    i = 0
    while i < len(buf):
        line = buf[i].rstrip()
        s = line.strip()
        if not s:
            i += 1
            continue
        if s.startswith("Total ") or s.startswith("Projects Included"):
            i += 1
            continue
        if s.startswith("Fund Title"):
            i += 1
            continue
        # Find the Fund Title prefix.
        matched_slug = None
        matched_title = None
        # Match longest prefix first to avoid e.g. "Transportation Development"
        # eating "Transportation Development Tax Fund".
        candidates = sorted(CIP_FUND_TITLE_TO_SLUG.keys(), key=len, reverse=True)
        for title in candidates:
            if s.startswith(title):
                matched_title = title
                matched_slug = CIP_FUND_TITLE_TO_SLUG[title]
                break
        if not matched_slug:
            i += 1
            continue
        rest = s[len(matched_title):].strip()
        # Strip leading dash sometimes used in "General Fund - Department"
        # The CIP listing uses department-qualified titles for the general
        # fund (e.g. "General Fund - Maintenance Services"). Strip after the
        # first dash so the project name is what's left.
        if rest.startswith('- '):
            # find the next two-or-more-space chunk that ends the dept name
            # easier: split on a long run of spaces (>=2)
            m = re.match(r'-\s*([^\s].*?)\s{2,}(.+)', rest)
            if m:
                rest = m.group(2).strip()
            else:
                # No double-space split; just keep rest as project name (won't
                # happen often).
                rest = rest[2:].strip()
        # Look for the dollar amount on this line; if not, peek at the next.
        amount_match = CIP_DOLLAR_RE.search(rest)
        if amount_match:
            project_name = rest[:amount_match.start()].strip()
            amount = int(amount_match.group(1).replace(',', ''))
            i += 1
        else:
            project_name = rest
            # Look ahead 1-2 lines for the amount.
            amount = None
            j = i + 1
            extra: list[str] = []
            while j < len(buf) and amount is None and j - i <= 3:
                next_line = buf[j].strip()
                m2 = CIP_DOLLAR_RE.search(next_line)
                if m2:
                    pre = next_line[:m2.start()].strip()
                    if pre:
                        extra.append(pre)
                    amount = int(m2.group(1).replace(',', ''))
                else:
                    extra.append(next_line)
                j += 1
            if extra:
                project_name = (project_name + ' ' + ' '.join(extra)).strip()
            i = j if amount is not None else i + 1
        if amount is None:
            continue
        out.setdefault(matched_slug, []).append({"name": project_name, "amount": amount})
    return out


# ---------------------------------------------------------------------------
# Description, objectives, performance metrics
# ---------------------------------------------------------------------------

def extract_purpose_objectives_metrics(lines: list[str], page_starts: dict[int, int],
                                       desc_page: int, fund_name: str) -> tuple[str, list[str], list[dict]]:
    """Pull purpose paragraph(s), objectives bullets, and performance metrics
    from a fund's description section starting at PDF page ``desc_page``.

    Most fund description sections look like:

        <Fund Name>
        Purpose paragraph(s)...
        Objectives for FY 2026 - 2027
        Objective 1.
        Objective 2.
        ...
        Performance Measures
        Actual Actual Adopted Proposed
        FY 2023 - 2024 FY 2024 - 2025 FY 2025 - 2026 FY 2026 - 2027
        <metric name>  v1 v2 v3 v4
        ...
        <page footer / next section>

    We scan up to ~6 pages following ``desc_page``.
    """
    purpose = ""
    objectives: list[str] = []
    metrics: list[dict] = []

    if desc_page is None:
        return purpose, objectives, metrics

    # Gather lines for the next ~6 pages, stopping at a clear new-section marker.
    all_lines: list[str] = []
    for offset in range(0, 6):
        pg = desc_page + offset
        if pg not in page_starts:
            break
        page_lines = page_slice(lines, page_starts, pg)
        # Stop if this page is a numeric expenditure/revenue table (first
        # non-empty content line is a 4-number row).
        first_content = next((l for l in page_lines if l.strip()), "")
        if offset > 0 and is_num_row(first_content):
            break
        # Stop if this page starts a new fund's description (its first non-empty
        # line is a different fund name).
        if offset > 0:
            first_strip = first_content.strip()
            if (first_strip.endswith('Fund')
                    and first_strip != fund_name
                    and 'Fund' in first_strip
                    and not first_strip.startswith(fund_name.split()[0])):
                break
            # Also stop on common section markers
            if first_strip in ("Budget Resolutions", "Financial Policies",
                               "Authorized Positions", "Salary Schedules",
                               "Definition of Terms", "Acronyms", "Appendix"):
                break
        all_lines.extend(page_lines)
        all_lines.append("===PAGEBREAK===")

    # Identify sections
    obj_idx = None
    perf_idx = None
    for i, line in enumerate(all_lines):
        s = line.strip()
        if s.startswith("Objectives for FY 2026") or s == "Objectives":
            if obj_idx is None:
                obj_idx = i
        elif s == "Performance Measures":
            if perf_idx is None:
                perf_idx = i

    # Purpose: everything between the fund-name title (start) and Objectives /
    # Performance Measures (or the first numeric row, whichever comes first).
    purpose_end = obj_idx
    if purpose_end is None:
        purpose_end = perf_idx
    if purpose_end is None:
        purpose_end = len(all_lines)
    purpose_lines: list[str] = []
    seen_title = False
    for line in all_lines[:purpose_end]:
        s = line.strip()
        if not s or s == "===PAGEBREAK===":
            continue
        if is_num_row(line):
            break
        if not seen_title:
            # Skip the first occurrence of the fund-name title (or wrapped fragment thereof).
            if s == fund_name or fund_name.startswith(s):
                seen_title = True
                continue
            # Some funds break the title across two lines (e.g. "Southwest Urban Renewal District" / "Bond Fund").
            if any(s.startswith(p) for p in (
                    "Southwest Urban Renewal District", "Core Opportunity and Reinvestment",
                    "Tualatin Scholarship Fund", "TDC Admin Fund", "Leveton Projects Fund",
                    "American Rescue Plan Fund", "Park Development Fund",
                    "Parks Project Fund", "Parks Utility Fee Fund",
                    "General Obligation Bond Fund", "Road Utility Fund",
                    "Transportation Development Tax", "Vehicle Replacement Fund",
                    "Stormwater Development", "Water Operating",
            )) and not s.endswith('.'):
                # Title wrap line; consume it as part of the title.
                continue
            seen_title = True
        # Skip caption-like single sentences that don't look like budget text
        # (e.g. "City trail", "Storm drain cleaning").  Heuristic: short and
        # missing a period.
        if len(s) < 40 and not s.endswith('.'):
            continue
        # Skip standalone page numbers
        if re.fullmatch(r'\d{1,3}', s):
            continue
        purpose_lines.append(s)
    if purpose_lines:
        # Take first 2 sentences as the purpose.
        full = ' '.join(purpose_lines)
        # Split into sentences (very loose).
        sentences = re.split(r'(?<=[.!?])\s+', full)
        purpose = ' '.join(sentences[:2]).strip()
        if len(purpose) > 500:
            purpose = sentences[0].strip()

    # Objectives: between Objectives header and the next section header.
    if obj_idx is not None:
        obj_end = perf_idx if perf_idx is not None else len(all_lines)
        objectives = _extract_objectives(all_lines[obj_idx + 1:obj_end])

    # Performance metrics: between Performance Measures and the next section
    # or a numeric block (the metric values).
    if perf_idx is not None:
        # Find end: a "FY 2026 - 2027 Personal Services" marker line, or the
        # next standalone all-caps-fund-name line.
        end_idx = len(all_lines)
        for j in range(perf_idx + 1, len(all_lines)):
            s = all_lines[j].strip()
            if "Personal Services:" in s:
                end_idx = j
                break
            if is_num_row(all_lines[j]):
                # Continue past the metric value rows; this is normal.
                pass
        metrics = _extract_metrics(all_lines[perf_idx + 1:end_idx])

    return purpose, objectives, metrics


def _extract_objectives(lines: list[str]) -> list[str]:
    """An "objective" is one or more lines forming a sentence ending in . or ?.

    Skip page breaks, page numbers, and blank lines.
    """
    objectives: list[str] = []
    current: list[str] = []
    for line in lines:
        s = line.strip()
        if not s or s == "===PAGEBREAK===":
            continue
        if re.fullmatch(r'\d{1,3}', s):
            continue
        # Stop if we hit another known section header
        if s == "Performance Measures":
            break
        if "Personal Services:" in s:
            break
        current.append(s)
        if s.endswith('.') or s.endswith('?'):
            text = ' '.join(current).strip()
            if len(text) > 15:
                objectives.append(text)
            current = []
    if current:
        text = ' '.join(current).strip()
        if len(text) > 15:
            objectives.append(text)
    return objectives


def _extract_metrics(lines: list[str]) -> list[dict]:
    """Extract performance metrics. Each metric is a (possibly multi-line) name
    followed by 4 value tokens, which may appear at the end of the last name
    line or on a line of their own.

    We accumulate name tokens and, whenever a line ends with >=4 value tokens,
    emit a metric.
    """
    metrics: list[dict] = []
    name_acc: list[str] = []
    for line in lines:
        s = line.strip()
        if not s or s == "===PAGEBREAK===":
            continue
        if s == "Actual Actual Adopted Proposed":
            continue
        if re.fullmatch(r'FY 2023 - 2024 FY 2024 - 2025 FY 2025 - 2026 FY 2026 - 2027', s):
            continue
        if re.fullmatch(r'\d{1,3}', s):
            continue
        tokens = _tokenize_metric(s)
        trailing = _count_trailing_values(tokens)
        if trailing >= 4:
            name_part = tokens[:-4]
            values = [_parse_metric_value(v) for v in tokens[-4:]]
            if name_part:
                name_acc.extend(name_part)
            metric_name = ' '.join(name_acc).strip()
            if metric_name:
                metrics.append({"metric": metric_name, "values": values})
            name_acc = []
        else:
            name_acc.extend(tokens)
    return metrics


def _tokenize_metric(line: str) -> list[str]:
    """Split a metric line into tokens, combining `< 10` -> `< 10`."""
    raw = line.split()
    out: list[str] = []
    j = 0
    while j < len(raw):
        if raw[j] in ('<', '>', '≤', '≥') and j + 1 < len(raw):
            out.append(raw[j] + ' ' + raw[j + 1])
            j += 2
        else:
            out.append(raw[j])
            j += 1
    return out


VALUE_TOK_RE = re.compile(r'^[<>≤≥]?\s*\$?[\d,\.]+%?$')


def _is_value_token(t: str) -> bool:
    if t in ('N/A', 'n/a'):
        return True
    return bool(VALUE_TOK_RE.match(t.strip()))


def _count_trailing_values(tokens: list[str]) -> int:
    n = 0
    for t in reversed(tokens):
        if _is_value_token(t):
            n += 1
        else:
            break
    return n


def _parse_metric_value(s: str):
    s = s.strip()
    if s in ('N/A', 'n/a'):
        return None
    if '%' in s or any(c in s for c in '<>≤≥$'):
        return s
    try:
        return int(s.replace(',', ''))
    except ValueError:
        try:
            return float(s.replace(',', ''))
        except ValueError:
            return s


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

def main() -> int:
    lines = load_lines()
    page_starts = index_pages(lines)
    cip_by_slug = parse_cip(lines, page_starts)

    results: list[dict] = []
    summary: list[tuple] = []

    # Regular funds
    for slug, name, summary_pg, desc_pg in REGULAR_FUNDS:
        print(f"--- {slug} (page {summary_pg}, desc page {desc_pg}) ---", file=sys.stderr)
        revs, exps = parse_summary_page(lines, page_starts, summary_pg, name)
        purpose, objectives, metrics = extract_purpose_objectives_metrics(
            lines, page_starts, desc_pg, name)

        rec = _build_record(slug, name, purpose, objectives, metrics,
                            revs, exps, cip_by_slug.get(slug, []))
        results.append(rec)
        rev_total = _sum_last(revs)
        exp_total = _sum_last(exps)
        summary.append((slug, len(revs), len(exps), len(objectives), len(metrics),
                        len(rec["cipProjects"]), rev_total, exp_total))

    # TDC funds
    for slug, name, rev_pg, exp_pgs, desc_pg in TDC_FUNDS:
        print(f"--- {slug} (rev {rev_pg}, exp {exp_pgs}, desc {desc_pg}) ---", file=sys.stderr)
        rev_rows = parse_tdc_table(lines, page_starts, [rev_pg])
        exp_rows = parse_tdc_table(lines, page_starts, exp_pgs)
        revs = collapse_to_categories(rev_rows)
        exps = collapse_to_categories(exp_rows)
        purpose, objectives, metrics = extract_purpose_objectives_metrics(
            lines, page_starts, desc_pg, name)
        rec = _build_record(slug, name, purpose, objectives, metrics,
                            revs, exps, cip_by_slug.get(slug, []))
        results.append(rec)
        rev_total = _sum_last(revs)
        exp_total = _sum_last(exps)
        summary.append((slug, len(revs), len(exps), len(objectives), len(metrics),
                        len(rec["cipProjects"]), rev_total, exp_total))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump(results, f, indent=2)

    print(f"\nWrote {OUT} ({len(results)} funds)")
    print(f"\n{'slug':<22} {'rev':>3} {'exp':>3} {'obj':>3} {'mtr':>3} {'cip':>3} {'rev_tot':>14} {'exp_tot':>14} {'bal':>6}")
    for slug, nr, ne, no, nm, nc, rt, et in summary:
        bal = ""
        if rt is not None and et is not None:
            bal = "OK" if rt == et else f"DIFF"
        print(f"{slug:<22} {nr:>3} {ne:>3} {no:>3} {nm:>3} {nc:>3} {rt!r:>14} {et!r:>14} {bal:>6}")
    return 0


def _sum_last(rows: list[dict]):
    total = 0
    seen_any = False
    for r in rows:
        v = r["values"][-1] if r["values"] else None
        if v is not None:
            total += v
            seen_any = True
    return total if seen_any else None


def _build_record(slug, name, purpose, objectives, metrics, revenues, expenditures, cip_projects):
    # Compute totals at the proposed (last) column.
    return {
        "slug": slug,
        "name": name,
        "purpose": purpose,
        "fy27Objectives": objectives,
        "performance": metrics,
        "cipProjects": cip_projects,
        "revenues": revenues,
        "expenditures": expenditures,
    }


if __name__ == "__main__":
    sys.exit(main())
