#!/usr/bin/env python3
"""Extract structured budget data per department from FY2026-27 proposed budget."""

import re
import json
import sys
from pathlib import Path

SRC = Path('/home/hermes/projects/tualatin-budget-analysis/extracted/raw/fy2026-27_proposed.txt')
OUT = Path('/home/hermes/projects/tualatin-budget-analysis/data/departments.json')

# Maps slug to (Name, PDF page where 'FY 2026-2027 Personal Services: $X' marker appears).
# These were verified by scanning the document for the marker.
DEPARTMENTS = [
    ("city-council",          "City Council",          140),
    ("administration",        "Administration",        145),
    ("finance",               "Finance",               151),
    ("municipal-court",       "Municipal Court",       156),
    ("legal",                 "Legal",                 160),
    ("information-services",  "Information Services",  165),
    ("community-development", "Community Development", 181),
    ("engineering",           "Engineering",           187),
    ("building",              "Building",              192),
    ("library",               "Library",               201),
    ("parks-maintenance",     "Parks Maintenance",     216),
    ("police",                "Police",                235),
    ("maintenance-services",  "Maintenance Services",  245),
    ("water-operating",       "Water Operating",       254),
    ("sewer-operating",       "Sewer Operating",       265),
    ("stormwater-operating",  "Stormwater Operating",  275),
    ("road-operating",        "Road Operating",        288),
]

CATEGORY_HEADERS = {
    "Personal Services",
    "Materials & Services",
    "Capital Outlay",
    "Debt Service",
    "Transfers Out",
    "Contingency",
    "Reserves & Unappropriated",
}

# Exact strings (full-line, stripped) that strongly indicate the line is a continuation of the previous name.
# These are short fragment lines that complete a wrapped phrase.
# CAUTION: Don't include words that can also be standalone line items
# (e.g., "Projects" is a sub-category in Capital Outlay, "Administration" is a dept name).
CONTINUATION_EXACT = {
    # Common wrapped continuations — short trailing words from chart-of-accounts names
    "Benefits", "Engagement", "Meetings", "Expense",
    "Furnishings", "Furniture", "Testing",
    "Agency", "Supplies", "Matl",
    "Computer/Laptop", "OR Tax", "Loans",
    "Stations", "Mgmt", "Subscriptions",
    "Promotional", "Recruitment", "Informational", "Legis/Judicial",
    "Defense Fund", "Excise Tax",
    "Services Building",
    "Software",
    "Sweeping",
    "Lights", "Signs", "Markings", "Signal",
    "Restitution", "Centrifuge", "Specialist",
    "Liability",
    "Co-Op", "WW",
    "Tx Ln", "Gilbert",
    "Back", "Buy Back",
    "Insurance & Tax",
    "Periodicals",
    "Loan Refunds",
    "Tualatin Library", "Major Projects",
    "Replacement Expense",
    "WW Plant",
    "Body Cameras",
    "& Mains",
    "Recognition",
    "Quality",
    "Acquisition",
    "Costs",
}

# Words that as first word of next line strongly indicate continuation.
# Be careful: these words must NOT also start independent line items.
SAFE_CONTINUATION_FIRST_WORDS = {
    "Back", "Tax", "Time", "Matl", "OR",
}

def parse_num(s):
    s = s.strip()
    if s == '' or s == '-':
        return None
    # Handle weird artifacts like ",2603" -> 2603
    if s.startswith(','):
        s = s[1:]
    neg = False
    if s.startswith('(') and s.endswith(')'):
        neg = True
        s = s[1:-1]
    s_clean = s.replace(',', '')
    if not s_clean.isdigit():
        return None
    val = int(s_clean)
    return -val if neg else val

def is_num_row(line):
    line = line.strip()
    if not line:
        return False
    parts = line.split()
    if len(parts) != 4:
        return False
    for p in parts:
        p2 = p.replace(',', '').replace('(', '').replace(')', '')
        if not p2.isdigit():
            return False
    return True

def should_merge_with_next(line, next_line):
    """Strict merge rules - only merge when we're highly confident."""
    if not next_line:
        return False
    nstrip = next_line.strip()
    if not nstrip:
        return False
    # Don't merge into a category header
    if nstrip in CATEGORY_HEADERS or nstrip == "Grand Total":
        return False
    rstrip = line.rstrip()
    # 1. Trailing whitespace before newline indicates continuation
    if line.endswith(' '):
        return True
    # 2. Ends with "&"
    if rstrip.endswith('&'):
        return True
    # 3. Ends with "and" (word)
    if re.search(r'\band$', rstrip):
        return True
    # 4. Ends with "-" (hyphen indicating continuation, e.g., "Advertising -")
    if rstrip.endswith('-') and not rstrip.endswith('--'):
        return True
    # 5. Ends with "=" (PDF artifact for line wrap, e.g., "Benefits-Employee=")
    if rstrip.endswith('='):
        return True
    # 6. Next line starts with "-" (and isn't a number)
    if nstrip.startswith('-') and not is_num_row(next_line):
        return True
    return False

def merge_name_fragments_strict(frags):
    """First pass: merge based on strict rules."""
    result = []
    i = 0
    while i < len(frags):
        cur = frags[i]
        while i + 1 < len(frags) and should_merge_with_next(cur, frags[i+1]):
            # Strip trailing "=" or "-" artifact when concatenating
            joiner_left = cur.rstrip()
            if joiner_left.endswith('='):
                joiner_left = joiner_left[:-1].rstrip()
            cur = joiner_left + ' ' + frags[i+1].lstrip()
            i += 1
        cleaned = cur.strip()
        # Strip trailing "=" if any leftover
        if cleaned.endswith('='):
            cleaned = cleaned[:-1].rstrip()
        result.append(cleaned)
        i += 1
    return result

# Specific (left, right) fragment pairs that should be merged.
# These come from chart of accounts names that wrap in the PDF without a trailing-space marker.
SPECIFIC_MERGE_PAIRS = {
    ("Staff/Dept", "Recognition"),
    ("Vehicle", "Replacement Expense"),
    ("Vehicle Replacement", "Expense"),
    ("Future Years", "Projects"),
    ("Rate Stabilization", "Reserve"),
    ("R&M - Pump", "Stations"),
    ("Minor Vehicle", "Equipment"),
    ("Ammun & Defense", "Equip"),
    ("Community", "Engagement Supplies"),
    ("Community", "Engagement"),
    ("Body Worn", "Cameras"),
    ("Benefits-TriMet", "Excise Tax"),
    ("Community", "Engagement"),
    ("Community", "Engagement Supplies"),
    ("Administrative", "Expense"),
    ("Vehicle", "Replacement"),
    ("Vehicle Replacement", "Expense"),
    ("Concerts on", "The Commons"),
    ("Concerts on The", "Commons"),
    ("Recreation Program", "Expend"),
    ("Recreation Program", "Expend-JPC"),
    ("Equipment &", "Furnishings"),
    ("Land", "Acquisition"),
    ("Issuance", "Costs"),
    ("Capital", "Reserve"),
    ("General Account", "Reserve"),
    ("Rate Stabilization", "Reserve"),
    ("Future Years", "Projects"),
    ("Future Years", "Reserve"),
    ("Construction", "Fund Projects"),
    ("Professional Svc", "Projects"),
    ("Administration", "Projects"),
    ("Administration", "Projects="),
    ("Construction Fund", "Projects"),
    ("Projects=", "Professional Svc"),
    ("Equipment", "Furnishings"),
    ("Bank", "Fees"),
    ("Special", "Programs"),
    ("Special Investigative", "Fund"),
    ("Donations - Outside", "Agency"),
    ("HEROES", "Program"),
    ("Special Investigative", "Fund"),
    ("Canine", "Program"),
    ("Mental Health", "Response"),
    ("ORPAT-Fitness", "Incentive"),
    ("PORAC-Legal", "Defense Fund"),
    ("Benefits-Sick Leave", "Buy Back"),
    ("Benefits-Holiday Buy", "Back"),
    ("Benefits-WC", "Contra"),
    ("Inventory", "Adjustment"),
    ("Water", "Conservation"),
    ("Water Purchases", "-For Tualatin"),
    ("Water Purchases -For Tualatin", "Hydrants"),
    ("Hydrant", "Meters"),
    ("TVWD", "- Jointline"),
    ("TVWD - Jointline", "TVWD"),
    ("TVWD", "- WA CO"),
    ("TVWD - WA CO", "Lines"),
    ("Personal", "Computer/Laptop"),
    ("Water System", "- Electricity"),
    ("Merchant Discount", "Fees"),
    ("Meter", "Reading"),
    ("Contr R&M", "- Systems"),
    ("R&M - Pump", "Stations"),
    ("R&M -", "Hydrants"),
    ("R&M - Major", "Projects"),
    ("Transfers Out", "-"),
    ("Transfers Out -", "General Fund"),
    ("Transfers Out -", "Enterprise Bond"),
    ("Transfers Out -", "Water Operating"),
    ("Transfers Out -", "Sewer Operating"),
    ("Transfers Out -", "Stormwater"),
    ("Transfers Out -", "Stormwater Operating"),
    ("Transfers Out -", "Building"),
    ("Transfers Out -", "Road Operating"),
    ("Transfers Out -", "Road Utility"),
    ("Transfers Out -", "Tualatin City"),
    ("Transfers Out - Tualatin City", "Services Building"),
    ("Transfers Out -", "Vehicle"),
    ("Transfers Out - Vehicle", "Replacement"),
    ("Other Financing", "Uses"),
    ("Property", "Restitution"),
    ("Crash", "Disposition"),
    ("Asset", "Disposition"),
    ("Police K9", "Capital"),
    ("Department", "Recognition"),
    ("Major", "Investigation"),
    ("Major", "Crime Unit"),
    ("Tualatin", "Sherwood"),
    ("Storm", "Water Quality"),
    ("Storm Water", "Quality"),
    ("Stormwater Quality", "Projects"),
    ("Streetlight", "Maintenance"),
    ("Street", "Sweeping"),
    ("R&M - Street", "Sweeping"),
    ("Street Lights", "Operation"),
    ("Pavement", "Markings"),
    ("Street", "Signs"),
    ("Street", "Markings"),
    ("R&M - Street", "Lights"),
    ("Materials -", "Pavement"),
    ("Snow", "Removal"),
    ("Bond Registration &", "Exp"),
    ("Safety/Risk Mgmt", "Program"),
    ("Bond", "Principal"),
    ("Bond", "Interest"),
    ("Loan", "Refunds"),
    ("Major Mtnc Wells &", "Mains"),
    ("Mtnc Wells", "& Mains"),
    ("Sanitary Sewer", "Maintenance"),
    ("Sewer Co-Op", "WW Plant"),
    ("Sewer Co-Op WW Plant", "Tx Ln"),
    ("CWS", "Sewer"),
    ("Mental Health", "Response Team"),
    ("Body", "Cameras"),
    ("Body Worn", "Cameras"),
    ("Body Worn Cameras", "Program"),
    ("Inventory", "Supplies"),
    ("Periodicals &", "Subscriptions"),
    ("Books, Periodicals &", "Subscriptions"),
    ("Library Tech", "- Public"),
    ("Library Tech -", "Public"),
    ("Collection", "Development"),
    ("Youth", "Development"),
    ("Concerts on The", "Commons"),
    ("Concerts on The Commons", "Arts Program"),
    ("Arts", "Program"),
    ("Tualatin", "Library"),
    ("Library", "Foundation"),
    ("Library", "District"),
    ("Friends of", "Tualatin Library"),
    ("Friends of Tualatin", "Library"),
    ("Special", "Programs"),
    ("Recreation Program", "Expend"),
    ("Recreation Program Expend", "-JPC"),
    ("Recreation Program Expend-JPC", "Consultants"),
    ("Project", "Loans"),
    ("Bond Project", "Loans"),
    ("Conferences &", "Meetings"),
    ("Conferences &", "Meetings -Mayor"),
    ("Conferences &", "Meetings -Council"),
    ("Publication, Rpt, Ref", "Matl"),
    ("Publications, Rpt, Ref", "Matl"),
    ("Network", "/Online"),
    ("R&M", "- Lines"),
    ("R&M", "- Systems"),
    ("R&M", "- Equipment"),
    ("R&M", "- Computers"),
    ("R&M", "- Reservoir"),
    ("R&M -", "Equipment"),
    ("R&M -", "Computers"),
    ("R&M -", "Lines"),
    ("R&M -", "Systems"),
    ("R&M -", "Reservoir"),
    ("R&M -", "Hydrants"),
    ("R&M -", "Pump Stations"),
    ("Sewer", "Centrifuge"),
    ("Major", "Investigations"),
}

def merge_with_count_match(names, target_count):
    """Iteratively merge adjacent fragments using continuation heuristics.

    Multiple passes:
    1. Merge specific known compound pairs (SPECIFIC_MERGE_PAIRS) - regardless of count.
    2. Merge when next line is exactly in CONTINUATION_EXACT - regardless of count.
    3. Merge when next line's first word is in SAFE_CONTINUATION_FIRST_WORDS - up to target only.
    4. If still over target, do aggressive single-word merge - up to target only.
    """
    def try_merge(predicate, max_merges=None):
        nonlocal names
        merge_count = 0
        i = 0
        while i < len(names) - 1:
            if max_merges is not None and merge_count >= max_merges:
                break
            cur = names[i].strip()
            nxt = names[i+1].strip()
            if cur in CATEGORY_HEADERS or cur == "Grand Total":
                i += 1
                continue
            if nxt in CATEGORY_HEADERS or nxt == "Grand Total":
                i += 1
                continue
            if predicate(cur, nxt):
                names[i] = cur + ' ' + nxt
                del names[i+1]
                merge_count += 1
            else:
                i += 1

    # Pass 1: specific compound pairs (always merge regardless of count)
    try_merge(lambda cur, nxt: (cur, nxt) in SPECIFIC_MERGE_PAIRS)
    # Pass 2: exact continuation
    try_merge(lambda cur, nxt: nxt in CONTINUATION_EXACT)
    if len(names) <= target_count:
        return names
    # Pass 3: safe first-word continuation, bounded
    try_merge(lambda cur, nxt: nxt.split() and nxt.split()[0] in SAFE_CONTINUATION_FIRST_WORDS,
              max_merges=len(names) - target_count)
    if len(names) <= target_count:
        return names
    # Pass 4: aggressive single-word merge as last resort, bounded
    def aggressive(cur, nxt):
        if len(cur.split()) == 1 and len(nxt.split()) <= 3 and cur[:1].isupper() and nxt[:1].isupper():
            if '-' in cur or '&' in cur:
                return False
            # Don't merge if next starts with an all-caps acronym (like "HEROES", "ORPAT", "PORAC", "TVWD")
            first_word = nxt.split()[0]
            if first_word.isupper() and len(first_word) >= 2 and first_word.isalpha():
                return False
            return True
        return False
    try_merge(aggressive, max_merges=len(names) - target_count)
    return names

def extract_block(lines, page_starts, start_page, end_page):
    """Extract numeric rows and name fragments from pages [start_page, end_page).
    Stops once 'Grand Total' has been seen in the names AND a subsequent page has no more table data.
    """
    section_numbers = []
    section_names = []
    page_keys = sorted([p for p in page_starts if start_page <= p < end_page])
    grand_total_seen = False
    for p in page_keys:
        p_start = page_starts[p]
        p_end = page_starts.get(p + 1, len(lines))
        i = p_start + 1
        page_nums = []
        page_names = []
        # Phase 1: collect numbers, skipping captions/short text at the top
        # Look ahead: are there number rows in the next ~20 lines?
        has_numbers = any(is_num_row(lines[j]) for j in range(i, min(i + 30, p_end)))
        while i < p_end:
            line = lines[i]
            if is_num_row(line):
                page_nums.append([parse_num(x) for x in line.strip().split()])
                i += 1
            elif line.strip() == '':
                i += 1
            elif re.match(r'^===== PAGE', line):
                i += 1
            elif has_numbers and len(page_nums) == 0 and len(line.strip()) < 60:
                # Skip a leading caption-like line if numbers are still coming
                i += 1
            else:
                break
        # Phase 2: collect names
        while i < p_end:
            line = lines[i]
            stripped = line.strip()
            if not stripped:
                i += 1
                continue
            if 'Actual FY' in line and 'Adopted' in line and 'Proposed' in line:
                i += 1
                continue
            if re.match(r'^\d+$', stripped):
                i += 1
                continue
            if re.match(r'^===== PAGE', line):
                break
            if is_num_row(line):
                page_nums.append([parse_num(x) for x in line.strip().split()])
                i += 1
                continue
            # Skip lines that look like photo captions or descriptive text
            # Budget line items are short (< 60 chars) and don't contain long sentences
            if len(stripped) > 60 and ' ' in stripped:
                i += 1
                continue
            page_names.append(line)
            i += 1

        # If grand_total_seen already, stop - we're past the dept's table
        if grand_total_seen:
            break

        section_numbers.extend(page_nums)
        section_names.extend(page_names)

        # Check if 'Grand Total' is in this page's names
        for name in page_names:
            if name.strip() == 'Grand Total':
                grand_total_seen = True
                break
    return section_numbers, section_names

def find_expenditure_start_page(lines, page_starts, marker_page):
    """Given the marker page (where 'FY 2026 - 2027 Personal Services: $X' appears),
    return the page number where the numeric expenditure table begins (marker_page + 1).
    """
    return marker_page + 1

def find_objectives_and_metrics(lines, page_starts, exp_start_page):
    """Find objectives list and performance metrics in the descriptive pages BEFORE the expenditure table.
    The expenditure table starts on page `exp_start_page`. The 'FY 2026 - 2027 Personal Services: $X'
    marker is on page exp_start_page - 1 (or exp_start_page - 2). Look BACKWARD for the most recent
    'Objectives for FY 2026' header, and use it.
    """
    objectives = []
    metrics = []

    p_end = page_starts.get(exp_start_page, len(lines))

    # Walk backward to find the most recent 'Objectives for FY 2026' before exp_start_page
    # First marker we hit is this dept's own; we want to find Objectives BEFORE that marker.
    obj_start_line = None
    seen_own_marker = False
    for i in range(p_end - 1, -1, -1):
        line = lines[i].strip()
        if 'Objectives for FY 2026' in line:
            obj_start_line = i + 1
            break
        # Stop if we hit a previous department's expenditure marker (going too far back)
        if 'FY 2026 - 2027 Personal Services:' in line or 'FY 2025 - 2026 Personal Services:' in line:
            if not seen_own_marker:
                seen_own_marker = True
                continue
            # Second marker = previous dept's
            break

    if obj_start_line is None:
        return [], []

    # Find Performance Measures or Personal Services marker after obj_start
    obj_end_line = p_end
    perf_start_line = None
    perf_end_line = p_end
    for i in range(obj_start_line, p_end):
        line = lines[i].strip()
        if 'Performance Measures' in line:
            obj_end_line = i
            perf_start_line = i + 1
            break
        if 'FY 2026 - 2027 Personal Services:' in line or 'FY 2025 - 2026 Personal Services:' in line:
            obj_end_line = i
            break

    if perf_start_line is not None:
        for i in range(perf_start_line, p_end):
            line = lines[i].strip()
            if 'FY 2026 - 2027 Personal Services:' in line or 'FY 2025 - 2026 Personal Services:' in line:
                perf_end_line = i
                break

    objectives = extract_objectives(lines, obj_start_line, obj_end_line)
    if perf_start_line is not None:
        metrics = extract_metrics(lines, perf_start_line, perf_end_line)

    return objectives, metrics

def extract_objectives(lines, start, end):
    """Extract list of objectives between line indices [start, end).
    Each objective is a sentence (or run of sentences) ending with period.
    Page markers, page numbers, and blank lines are NOT paragraph breaks; objectives
    can span page breaks. The only delimiter is "ends in period/colon".
    """
    objectives = []
    current = []
    for i in range(start, end):
        line = lines[i].rstrip('\n')
        stripped = line.strip()
        if not stripped:
            continue
        if re.match(r'^===== PAGE', line):
            continue
        if re.match(r'^\d{1,3}$', stripped):  # page number
            continue
        current.append(stripped)
        # If line ends with sentence-ending punctuation, treat as end of one objective
        if stripped.endswith('.') or stripped.endswith(':') or stripped.endswith('?'):
            text = ' '.join(current).strip()
            if len(text) > 10:
                objectives.append(text)
            current = []
    if current:
        text = ' '.join(current).strip()
        if len(text) > 10:
            objectives.append(text)
    return objectives

def extract_metrics(lines, start, end):
    """Extract performance metrics between line indices [start, end).
    Each metric: name (possibly spanning multiple lines), then 4 value tokens.
    The values appear at the END of the LAST name line (or on the next line).

    Strategy:
    - Process content lines as a stream.
    - For each line, look at TRAILING tokens that are values (numbers/percentages/N/A/<X).
    - If a line has 4 trailing values, the leading tokens are the tail of the name; combine with
      previously accumulated name fragments.
    - If a line has trailing values but fewer than 4, look at the next line(s) to complete.
    """
    content = []
    for i in range(start, end):
        line = lines[i].rstrip('\n')
        stripped = line.strip()
        if not stripped:
            continue
        if re.match(r'^===== PAGE', line):
            continue
        if 'Actual' in stripped and 'Adopted' in stripped:
            continue
        if re.match(r'^FY \d{4} - \d{4}( FY \d{4} - \d{4})*$', stripped):
            continue
        # Skip pure page-number lines (3-digit standalone, between 100-300)
        if re.match(r'^\d{3}$', stripped) and 100 <= int(stripped) <= 400:
            continue
        content.append(stripped)

    def line_tokens_with_combiners(line):
        """Split line into tokens, combining < N / > N / ≤ N / ≥ N pairs."""
        toks = line.split()
        out = []
        j = 0
        while j < len(toks):
            if toks[j] in ('<', '>', '≤', '≥') and j + 1 < len(toks):
                out.append(toks[j] + ' ' + toks[j+1])
                j += 2
            else:
                out.append(toks[j])
                j += 1
        return out

    def trailing_value_count(tokens):
        """Count how many trailing tokens are value-like."""
        c = 0
        for tok in reversed(tokens):
            if is_value_token(tok):
                c += 1
            else:
                break
        return c

    metrics = []
    name_acc = []  # accumulated name tokens
    i = 0
    while i < len(content):
        line = content[i]
        tokens = line_tokens_with_combiners(line)
        tv = trailing_value_count(tokens)
        if tv >= 4:
            # Last 4 tokens are values; prefix tokens are tail of name
            name_part = tokens[:-4]
            value_toks = tokens[-4:]
            if name_part:
                name_acc.extend(name_part)
            metric_name = ' '.join(name_acc).strip()
            if metric_name and not all(is_value_token(t) for t in line_tokens_with_combiners(metric_name)):
                metric_values = [parse_metric_value(v) for v in value_toks]
                metrics.append({"metric": metric_name, "values": metric_values})
            name_acc = []
            i += 1
        elif tv > 0 and tv < 4:
            # Partial trailing values. Look at next line(s) to complete.
            # Two scenarios:
            # (A) Name continues with embedded numeric (e.g., "per 1,000" then next line "customer accounts ..." would be unusual)
            # (B) Values are split across 2 lines (rare in this PDF)
            # Try scenario B: see if next line is all values
            if i + 1 < len(content):
                next_tokens = line_tokens_with_combiners(content[i+1])
                next_tv = trailing_value_count(next_tokens)
                if all(is_value_token(t) for t in next_tokens) and tv + len(next_tokens) >= 4:
                    # Combine
                    needed = 4 - tv
                    value_toks = tokens[-tv:] + next_tokens[:needed]
                    name_part = tokens[:-tv]
                    if name_part:
                        name_acc.extend(name_part)
                    metric_name = ' '.join(name_acc).strip()
                    if metric_name:
                        metric_values = [parse_metric_value(v) for v in value_toks]
                        metrics.append({"metric": metric_name, "values": metric_values})
                    name_acc = []
                    i += 2
                    continue
            # Scenario A: treat trailing as part of name (it's like "85%" being part of a name? rare)
            # OR: trailing values are the START of a 4-value group, with rest on next line(s)
            # Try aggregation
            agg = list(tokens)
            j = i + 1
            while trailing_value_count(agg) < 4 and j < len(content):
                next_tokens = line_tokens_with_combiners(content[j])
                next_tv = trailing_value_count(next_tokens)
                if next_tv == len(next_tokens):
                    # All values
                    agg.extend(next_tokens)
                    j += 1
                else:
                    break
            if trailing_value_count(agg) >= 4:
                value_toks = agg[-4:]
                name_part = agg[:-4]
                if name_part:
                    name_acc.extend(name_part)
                metric_name = ' '.join(name_acc).strip()
                if metric_name:
                    metric_values = [parse_metric_value(v) for v in value_toks]
                    metrics.append({"metric": metric_name, "values": metric_values})
                name_acc = []
                i = j
                continue
            # Couldn't resolve; treat whole line as name
            name_acc.extend(tokens)
            i += 1
        else:
            # No trailing values; entire line is part of name
            name_acc.extend(tokens)
            i += 1
    return metrics

VAL_TOKEN_RE = re.compile(r'^(N/A|n/a|[<>≤≥]?\s*[\d,.\$]+%?|\d+%|\$[\d,]+)$')

def is_value_token(tok):
    if tok in ('N/A', 'n/a'):
        return True
    # Numeric with optional %, $, ,
    if re.match(r'^[<>≤≥]?\s*\$?[\d,\.]+%?$', tok):
        return True
    return False

def looks_like_value_line(line):
    tokens = line.split()
    if len(tokens) == 0:
        return False
    # All tokens should be value-like
    # Handle "< 10" as 2 tokens
    # Combine adjacent comparator + number tokens
    combined = []
    i = 0
    while i < len(tokens):
        if tokens[i] in ('<', '>', '≤', '≥') and i + 1 < len(tokens):
            combined.append(tokens[i] + ' ' + tokens[i+1])
            i += 2
        else:
            combined.append(tokens[i])
            i += 1
    # Now check each combined token
    for c in combined:
        if not is_value_token(c):
            return False
    return len(combined) >= 1

def extract_trailing_values(line):
    """Extract trailing value-like tokens from the line, return None if no values found."""
    tokens = line.split()
    # Combine comparators
    combined = []
    i = 0
    while i < len(tokens):
        if tokens[i] in ('<', '>', '≤', '≥') and i + 1 < len(tokens):
            combined.append(tokens[i] + ' ' + tokens[i+1])
            i += 2
        else:
            combined.append(tokens[i])
            i += 1
    # Find trailing run of value tokens
    trailing = []
    while combined and is_value_token(combined[-1]):
        trailing.insert(0, combined.pop())
    if not trailing:
        return None
    return trailing

def extract_all_value_tokens(line):
    """Extract all tokens if they're all value-like."""
    if looks_like_value_line(line):
        return line.split()
    return None

def parse_metric_value(s):
    s = s.strip()
    if s in ('N/A', 'n/a'):
        return None
    # Keep percentages and comparison operators as strings
    if '%' in s or any(op in s for op in ['<', '>', '≤', '≥']):
        return s
    if '$' in s:
        return s
    # Try integer
    try:
        return int(s.replace(',', ''))
    except ValueError:
        try:
            return float(s.replace(',', ''))
        except ValueError:
            return s

def build_expenditures(numbers, names):
    """Group numbers + names into category structure."""
    expenditures = []
    if not names or not numbers:
        return expenditures
    # Names and numbers should be in lockstep, with category headers in names corresponding to category totals in numbers
    # Find Grand Total index in names to truncate
    grand_idx = None
    for i, n in enumerate(names):
        if n.strip() == 'Grand Total':
            grand_idx = i
            break
    if grand_idx is not None:
        names = names[:grand_idx]
        numbers = numbers[:grand_idx]

    current_category = None
    current_items = []

    for name, nums in zip(names, numbers):
        name_clean = name.strip()
        if name_clean in CATEGORY_HEADERS:
            # Flush previous
            if current_category is not None:
                expenditures.append(current_category)
            current_category = {
                "category": name_clean,
                "values": nums,
                "lineItems": []
            }
            current_items = []
        else:
            if current_category is None:
                # Names without a category header; skip
                continue
            current_category["lineItems"].append({"name": name_clean, "values": nums})
            current_items.append(name_clean)

    if current_category is not None:
        expenditures.append(current_category)

    # Limit to ~10 most important line items per category by absolute value of proposed (last value)
    for cat in expenditures:
        items = cat["lineItems"]
        if len(items) > 10:
            # Sort by abs of proposed value (index 3) descending, take top 10
            def rank(item):
                v = item["values"][3] if item["values"] and len(item["values"]) > 3 else 0
                if v is None:
                    v = 0
                return abs(v)
            sorted_items = sorted(items, key=rank, reverse=True)
            top = sorted_items[:10]
            # Restore original order
            top_names = set(id(t) for t in top)
            cat["lineItems"] = [it for it in items if id(it) in top_names]

    return expenditures

def main():
    with open(SRC) as f:
        raw_lines = f.readlines()
    lines = [l.rstrip('\n').rstrip('\r') for l in raw_lines]

    page_starts = {}
    for i, line in enumerate(lines):
        m = re.match(r'^===== PAGE (\d+) =====', line.strip())
        if m:
            page_starts[int(m.group(1))] = i

    results = []
    summary = []

    for idx, (slug, name, approx_page) in enumerate(DEPARTMENTS):
        # Approx_page is the page WHERE THE SECTION BEGINS - typically the "FY 2026-27 Personal Services: $X" page
        # The numeric expenditure table starts on the next page
        # Find expenditure start page
        exp_start = find_expenditure_start_page(lines, page_starts, approx_page)
        # Find end: next department's approx_page or end of file
        if idx + 1 < len(DEPARTMENTS):
            next_approx = DEPARTMENTS[idx+1][2]
        else:
            next_approx = 9999
        # End at the page where the next department's "FY 2026 - 2027 Personal Services" appears
        # Conservatively, end at next_approx (which is where next dept's description ends and PS marker page begins)
        # We need to capture all of the current dept's expenditure table which can span multiple pages
        # The next dept's description section starts a few pages before next_approx
        # So set exp_end to next_approx - 4 or so (the descriptions for next dept usually start that far back)
        # But really we just need to capture numeric pages.
        # The expenditure tables for a dept usually span 1-4 pages.
        # We'll search for the next dept's expenditure marker page and end before it.

        # Determine search range for next department's section description
        next_exp_start_page = find_expenditure_start_page(lines, page_starts, next_approx) if next_approx <= 400 else None
        if next_exp_start_page is None:
            exp_end = 405
        else:
            # End before the next dept's description page (which is exp_start of next - some pages)
            exp_end = next_exp_start_page - 1

        # But we should cut at the END of THIS dept's expenditure table, which typically ends at "Grand Total"
        # For multi-page tables, just include all pages until next dept's expenditure section

        numbers, name_frags = extract_block(lines, page_starts, exp_start, exp_end)
        # Trim: stop name fragments at the first "Grand Total"
        # Also strict-merge first
        merged_names = merge_name_fragments_strict(name_frags)
        # Find Grand Total
        gt_idx = None
        for i, n in enumerate(merged_names):
            if n.strip() == 'Grand Total':
                gt_idx = i
                break
        if gt_idx is not None:
            merged_names = merged_names[:gt_idx + 1]
            # Trim numbers to same count
            numbers = numbers[:gt_idx + 1]

        # Match counts via continuation-word merge
        merged_names = merge_with_count_match(merged_names, len(numbers))

        # Build expenditures
        expenditures = build_expenditures(numbers, merged_names)

        # Objectives & metrics: look backward from exp_start
        objectives, metrics = find_objectives_and_metrics(lines, page_starts, exp_start)

        # Sanity: numbers count vs names count mismatch
        mismatch = len(numbers) != len(merged_names)

        dept_record = {
            "slug": slug,
            "name": name,
            "fy27Objectives": objectives,
            "performance": metrics,
            "expenditures": expenditures,
        }
        results.append(dept_record)

        total_line_items = sum(len(c["lineItems"]) for c in expenditures)
        summary.append({
            "slug": slug,
            "objectives": len(objectives),
            "metrics": len(metrics),
            "categories": len(expenditures),
            "lineItems": total_line_items,
            "mismatch": mismatch,
            "exp_start": exp_start,
            "exp_end": exp_end,
            "num_count": len(numbers),
            "name_count": len(merged_names),
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump(results, f, indent=2)

    print(f"Wrote {OUT}")
    print(f"\n{'slug':<25} {'obj':>4} {'mtr':>4} {'cat':>4} {'item':>5} {'#N':>4} {'#Nm':>4} {'mis':>4}")
    for s in summary:
        flag = '!' if s['mismatch'] else ''
        print(f"{s['slug']:<25} {s['objectives']:>4} {s['metrics']:>4} {s['categories']:>4} {s['lineItems']:>5} {s['num_count']:>4} {s['name_count']:>4} {flag:>4}")

if __name__ == '__main__':
    main()
