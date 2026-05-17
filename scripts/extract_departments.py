#!/usr/bin/env python3
"""Extract structured budget data per department from FY2026-27 proposed budget."""

import re
import json
import sys
from pathlib import Path

SRC = Path('/home/hermes/projects/tualatin-budget-analysis/extracted/raw/fy2026-27_proposed.txt')
OUT = Path('/home/hermes/projects/tualatin-budget-analysis/data/departments.json')

DEPARTMENTS = [
    ("city-council",          "City Council",          140),
    ("administration",        "Administration",        145),
    ("finance",               "Finance",               156),
    ("municipal-court",       "Municipal Court",       160),
    ("legal",                 "Legal",                 165),
    ("information-services",  "Information Services",  170),
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
    ("road-operating",        "Road Operating",        289),
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

# Words that strongly indicate the line is a continuation of the previous name
CONTINUATION_STARTERS = {
    "Back", "Tax", "Time", "Engagement", "Expense", "Meetings",
    "Furnishings", "Furniture", "Equipment", "Testing", "Program",
    "Recognition", "Agency", "Benefits", "Supplies", "Matl",
    "Computer/Laptop", "Tualatin", "OR Tax", "Loans", "Lines",
    "Stations", "Mgmt", "Periodicals", "Subscriptions",
    "Promotional", "Recruitment", "Informational", "Legis/Judicial",
    "Refunds", "Insurance", "Fees", "Reserve",
    "Defense", "Stabilization", "Projects", "Outside",
    "Services", "Tower", "Building", "Hydrants", "Reservoir",
    "Software", "Online", "Phones", "Postage", "Service",
    "Mowing", "Cleaning", "Sweeping", "Maintenance", "Repairs",
    "Lights", "Signs", "Markings", "Signal", "Operation",
    "Account", "Years", "Pump", "Vehicle", "Replacement",
    "Restitution", "Disposition", "Stormwater", "Inspection",
    "Centrifuge", "Detective", "Specialist", "Operations",
    "Liability", "Workers", "Marketing", "Communications",
    "Fund", "Co-Op", "WW", "Major", "Computers",
    "Plant", "Treatment", "Stormwater", "Materials",
    "Charge", "Loan", "Disposal", "Bond", "Holiday",
    "Fitness", "Council", "Mayor", "Police", "Court",
    "Permits", "Manuals", "Wells", "Tx Ln", "Gilbert",
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
    # 1. Trailing whitespace before newline indicates continuation
    if line.endswith(' '):
        return True
    # 2. Ends with "&"
    if line.rstrip().endswith('&'):
        return True
    # 3. Ends with "and" (word)
    if re.search(r'\band$', line.rstrip()):
        return True
    # 4. Next line starts with "-" (and isn't a number)
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
            cur = cur.rstrip() + ' ' + frags[i+1].lstrip()
            i += 1
        result.append(cur.strip())
        i += 1
    return result

def merge_with_count_match(names, target_count):
    """Iteratively merge adjacent fragments using continuation-word heuristic to match target count."""
    if len(names) <= target_count:
        return names
    # Identify mergeable pairs: (i, i+1) where names[i+1] starts with a continuation word
    # and names[i] is not a category header.
    while len(names) > target_count:
        merged_any = False
        for i in range(len(names) - 1):
            cur = names[i].strip()
            nxt = names[i+1].strip()
            if cur in CATEGORY_HEADERS or cur == "Grand Total":
                continue
            if nxt in CATEGORY_HEADERS or nxt == "Grand Total":
                continue
            first_word = nxt.split()[0] if nxt else ""
            # Continuation if next line starts with a word in our continuation set
            if first_word in CONTINUATION_STARTERS:
                names[i] = cur + ' ' + nxt
                del names[i+1]
                merged_any = True
                break
            # Or if the current line is a single short word and the next is also short
            # (common for wrapped 2-word names like "Community" + "Engagement")
            if len(cur.split()) == 1 and len(nxt.split()) <= 3 and not cur.endswith(':'):
                # Check if combination looks like a real budget line
                # We'll merge if next starts with capital letter and current is a capitalized single word
                if cur[:1].isupper() and nxt[:1].isupper():
                    # Only do this conservatively - check it's not a category
                    names[i] = cur + ' ' + nxt
                    del names[i+1]
                    merged_any = True
                    break
        if not merged_any:
            break
    return names

def extract_block(lines, page_starts, start_page, end_page):
    """Extract numeric rows and name fragments from pages [start_page, end_page)."""
    section_numbers = []
    section_names = []
    page_keys = sorted([p for p in page_starts if start_page <= p < end_page])
    for p in page_keys:
        p_start = page_starts[p]
        p_end = page_starts.get(p + 1, len(lines))
        i = p_start + 1
        page_nums = []
        page_names = []
        # Phase 1: collect numbers (skip blanks)
        while i < p_end:
            line = lines[i]
            if is_num_row(line):
                page_nums.append([parse_num(x) for x in line.strip().split()])
                i += 1
            elif line.strip() == '':
                i += 1
            elif re.match(r'^===== PAGE', line):
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
            if re.match(r'^\d+$', stripped):  # page number
                i += 1
                continue
            if re.match(r'^===== PAGE', line):
                break
            if is_num_row(line):
                # Stragglers - rare
                page_nums.append([parse_num(x) for x in line.strip().split()])
                i += 1
                continue
            page_names.append(line)
            i += 1
        section_numbers.extend(page_nums)
        section_names.extend(page_names)
    return section_numbers, section_names

def find_expenditure_start_page(lines, page_starts, approx_page):
    """Find page with 'FY 2026 - 2027 Personal Services: $X' marker near approx_page.
    Returns the page number where the numeric expenditure table begins (typically approx_page+1).
    """
    # Look for the marker in pages [approx_page-2, approx_page+3]
    for p in range(approx_page - 2, approx_page + 4):
        if p not in page_starts:
            continue
        p_start = page_starts[p]
        p_end = page_starts.get(p + 1, len(lines))
        for i in range(p_start, p_end):
            if 'FY 2026 - 2027 Personal Services' in lines[i] or 'FY 2025 - 2026 Personal Services' in lines[i]:
                # Numeric table starts on next page
                return p + 1
    return approx_page + 1

def find_objectives_and_metrics(lines, page_starts, start_page, end_page):
    """Find objectives list and performance metrics in the descriptive pages BEFORE the expenditure table."""
    # Look in pages [start_page-N, expenditure_start_page]
    objectives = []
    metrics = []
    # Find page where "Objectives for FY 2026 - 2027" appears
    obj_start_line = None
    obj_end_line = None
    perf_start_line = None
    perf_end_line = None

    p_search_start = page_starts.get(start_page - 10, 0)
    p_search_end = page_starts.get(end_page, len(lines))

    for i in range(p_search_start, p_search_end):
        line = lines[i].strip()
        if 'Objectives for FY 2026' in line or 'Objectives for FY 2026 - 2027' in line:
            obj_start_line = i + 1
        elif obj_start_line is not None and obj_end_line is None:
            if 'Performance Measures' in line:
                obj_end_line = i
                perf_start_line = i + 1
            elif 'FY 2026 - 2027 Personal Services' in line or 'FY 2025 - 2026 Personal Services' in line:
                obj_end_line = i
                break
        elif perf_start_line is not None and perf_end_line is None:
            if 'FY 2026 - 2027 Personal Services' in line or 'FY 2025 - 2026 Personal Services' in line:
                perf_end_line = i
                break

    if obj_start_line is not None and obj_end_line is None:
        # If no perf measures, end at expenditure table
        obj_end_line = perf_start_line or p_search_end
    if perf_start_line is not None and perf_end_line is None:
        perf_end_line = p_search_end

    # Extract objectives: each bullet/paragraph between obj_start and obj_end
    if obj_start_line is not None:
        objectives = extract_objectives(lines, obj_start_line, obj_end_line)

    # Extract performance metrics
    if perf_start_line is not None:
        metrics = extract_metrics(lines, perf_start_line, perf_end_line)

    return objectives, metrics

def extract_objectives(lines, start, end):
    """Extract list of objectives between line indices [start, end)."""
    # Objectives are paragraphs of text separated by page markers, page numbers, blank lines
    objectives = []
    current = []
    for i in range(start, end):
        line = lines[i].rstrip('\n')
        stripped = line.strip()
        if not stripped:
            if current:
                # End of paragraph
                text = ' '.join(current).strip()
                if len(text) > 5:
                    objectives.append(text)
                current = []
            continue
        if re.match(r'^===== PAGE', line):
            if current:
                text = ' '.join(current).strip()
                if len(text) > 5:
                    objectives.append(text)
                current = []
            continue
        if re.match(r'^\d+$', stripped):  # page number
            if current:
                text = ' '.join(current).strip()
                if len(text) > 5:
                    objectives.append(text)
                current = []
            continue
        # Heuristic: each objective is one sentence/paragraph ending with period.
        # Lines wrap, so accumulate then split.
        current.append(stripped)
        # If line ends with sentence-ending punctuation, treat as end of one objective
        if stripped.endswith('.') or stripped.endswith(':'):
            text = ' '.join(current).strip()
            if len(text) > 5:
                objectives.append(text)
            current = []
    if current:
        text = ' '.join(current).strip()
        if len(text) > 5:
            objectives.append(text)
    # Clean up: filter out anything that looks like noise
    objectives = [o for o in objectives if not re.match(r'^\d+$', o) and len(o) > 10]
    return objectives

def extract_metrics(lines, start, end):
    """Extract performance metrics between line indices [start, end).
    Metric rows look like: metric name then 4 values, possibly wrapped.
    """
    # Collect all non-empty content lines
    content = []
    for i in range(start, end):
        line = lines[i].rstrip('\n')
        stripped = line.strip()
        if not stripped:
            continue
        if re.match(r'^===== PAGE', line):
            continue
        if re.match(r'^\d+$', stripped) and len(stripped) <= 3:
            # Could be a page number; but could be a metric value. Skip if it's a small standalone integer in a position that looks like a page number
            # Use threshold: page numbers are usually 100-300 and standalone. Metric values can also be like 0 or 1.
            # We'll trust other context: if it appears between metric blocks, may be page num
            # For safety, only skip 3-digit numbers >= 100 that appear alone
            if int(stripped) >= 100:
                continue
        if 'Actual' in stripped and 'Adopted' in stripped:
            continue
        if re.match(r'^FY \d{4} - \d{4}', stripped):
            # Header row "FY 2023 - 2024 ... FY 2026 - 2027"
            continue
        content.append(stripped)

    # Now parse content. Each metric is: name line(s) followed by 4 value tokens.
    # Values can be: numbers (with commas), percentages, "N/A", "≤ 10", "< 10", etc.
    # Strategy: group tokens. A value is something like a number, percentage, or "N/A".

    metrics = []
    i = 0
    while i < len(content):
        # Accumulate name lines until we find a line that looks like values
        name_parts = []
        while i < len(content):
            line = content[i]
            # Check if this line has the value pattern: 4 tokens of numbers/percentages/N/A
            if looks_like_value_line(line):
                break
            # Sometimes the name and first values are on same line
            tokens = line.split()
            # Heuristic: if the line ends with what looks like values
            tail_values = extract_trailing_values(line)
            if tail_values is not None and len(tail_values) > 0:
                # Take the leading text as name and trailing tokens as values
                name_part_count = len(tokens) - len(tail_values)
                name_part = ' '.join(tokens[:name_part_count])
                if name_part:
                    name_parts.append(name_part)
                # Accumulate values across following lines if needed
                values = tail_values
                # Are there more values needed? We need 4
                j = i + 1
                while len(values) < 4 and j < len(content):
                    nxt = content[j]
                    if looks_like_value_line(nxt):
                        values.extend(nxt.split())
                        j += 1
                    else:
                        # Could be partial values
                        nxt_vals = extract_all_value_tokens(nxt)
                        if nxt_vals and len(nxt_vals) == len(nxt.split()):
                            values.extend(nxt_vals)
                            j += 1
                        else:
                            break
                if len(values) >= 4:
                    metric_name = ' '.join(name_parts).strip()
                    if metric_name:
                        metric_values = []
                        for v in values[:4]:
                            metric_values.append(parse_metric_value(v))
                        metrics.append({"metric": metric_name, "values": metric_values})
                    i = j
                    name_parts = []
                    break
                else:
                    # Couldn't find 4 values; skip this name
                    i += 1
                    name_parts = []
                    break
            else:
                # All text is name
                name_parts.append(line)
                i += 1
        else:
            # Reached end without finding value line
            break
        if name_parts and i < len(content):
            # name_parts had pure-text lines; now i should be at a value line
            line = content[i]
            tokens = line.split()
            values = tokens[:]
            j = i + 1
            while len(values) < 4 and j < len(content):
                nxt = content[j]
                if looks_like_value_line(nxt):
                    values.extend(nxt.split())
                    j += 1
                else:
                    break
            if len(values) >= 4:
                metric_name = ' '.join(name_parts).strip()
                metric_values = []
                for v in values[:4]:
                    metric_values.append(parse_metric_value(v))
                if metric_name:
                    metrics.append({"metric": metric_name, "values": metric_values})
                i = j
            else:
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

        # Objectives & metrics
        # Search starts from a few pages before this dept's exp_start
        obj_search_start = exp_start - 8
        # Find previous dept's exp_start to bound the search
        if idx > 0:
            prev_exp_end_page = find_expenditure_start_page(lines, page_starts, DEPARTMENTS[idx-1][2]) + 5
            obj_search_start = max(obj_search_start, prev_exp_end_page)
        objectives, metrics = find_objectives_and_metrics(
            lines, page_starts, obj_search_start, exp_start + 1
        )

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
