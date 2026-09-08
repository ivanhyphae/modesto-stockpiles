import csv
import re
from datetime import datetime

RAW = "/tmp/claude-1000/-home-ivanh-hyphae-hyphae-work-sr132-envirostor-wiki/698718b9-2844-43ab-b3b7-a6ef0abef829/scratchpad/gw2023_raw_extraction.csv"
OUT = "/tmp/claude-1000/-home-ivanh-hyphae-hyphae-work-sr132-envirostor-wiki/698718b9-2844-43ab-b3b7-a6ef0abef829/scratchpad/gw2023_detections_summary.csv"

SOURCE_DOC = "06A2542ct_TO97_GW Rpt_final.20230308.pdf"

ANALYTES = {
    "arsenic": {
        "col": "arsenic_ugl", "unit": "ug/L", "table": "Table 3",
        "pages": "21-29 (values); 30 (footnote key); 29 (MCL row)",
        "limit": 10.0, "limit_type": "MCL",
    },
    "barium": {
        "col": "barium_ugl", "unit": "ug/L", "table": "Table 3",
        "pages": "21-29 (values); 30 (footnote key); 29 (MCL row)",
        "limit": 1000.0, "limit_type": "MCL",
    },
    "lead": {
        "col": "lead_ugl", "unit": "ug/L", "table": "Table 3",
        "pages": "21-29 (values); 30 (footnote key); 29 (MCL row)",
        "limit": 15.0, "limit_type": "Regulatory Action Level (California Department of Public Health; NOT an MCL per Table 3 footnote 3)",
    },
    "manganese": {
        "col": "manganese_ugl", "unit": "ug/L", "table": "Table 3",
        "pages": "21-29 (values); 30 (footnote key); 29 (MCL row)",
        "limit": 50.0, "limit_type": "Secondary MCL",
    },
    "nitrate_as_n": {
        "col": "nitrate_mgl", "unit": "mg/L", "table": "Table 4",
        "pages": "31-39 (values); 39 (MCL row)",
        "limit": 10.0, "limit_type": "MCL (health-based)",
    },
}


def parse_date(s):
    s = s.strip()
    if not s:
        return None
    try:
        return datetime.strptime(s, "%m/%d/%Y")
    except ValueError:
        return None


def parse_cell(raw):
    """Return (kind, value_float, reporting_limit_float).
    kind in {"detect", "nondetect", "excluded", "blank"}.
    """
    if raw is None:
        return ("blank", None, None)
    v = raw.strip()
    if v == "" :
        return ("blank", None, None)
    if v.upper() == "ILLEGIBLE":
        return ("illegible", None, None)
    if v.startswith("EXCLUDED"):
        return ("excluded", None, None)
    if v.startswith("<"):
        try:
            rl = float(v[1:])
        except ValueError:
            return ("illegible", None, None)
        return ("nondetect", None, rl)
    # plain numeric detect (strip any trailing qualifier letters just in case)
    m = re.match(r"^-?\d+(\.\d+)?", v)
    if not m:
        return ("illegible", None, None)
    return ("detect", float(m.group(0)), None)


def load_rows():
    with open(RAW, newline="") as f:
        rows = list(csv.DictReader(f))
    return [r for r in rows if r["well"] not in ("", "REFERENCE")]


def main():
    rows = load_rows()

    # Split out duplicates / dry-or-no-sample rows from primary aggregation,
    # but keep everything in the raw file untouched.
    primary_rows = [
        r for r in rows
        if r["is_duplicate"].strip().lower() != "true"
        and r["is_dry_or_no_sample"].strip().lower() != "true"
    ]

    wells = sorted(set(r["well"] for r in primary_rows if r["well"]))

    out_rows = []

    def summarize(subset, well_label, scope_label):
        for analyte, meta in ANALYTES.items():
            col = meta["col"]
            detects = []  # (value, date, row)
            nondetects = []  # (reporting_limit, date, row)
            n_samples = 0
            n_nondetect = 0
            for r in subset:
                kind, val, rl = parse_cell(r.get(col))
                if kind == "blank" or kind == "excluded" or kind == "illegible":
                    continue
                n_samples += 1
                if kind == "detect":
                    detects.append((val, r["date"], r))
                elif kind == "nondetect":
                    n_nondetect += 1
                    nondetects.append((rl, r["date"], r))

            if not detects and not nondetects:
                continue  # nothing analyzed for this analyte/scope

            min_detected = min(detects, key=lambda t: t[0]) if detects else None
            max_detected = max(detects, key=lambda t: t[0]) if detects else None
            max_rl = max(nondetects, key=lambda t: t[0]) if nondetects else None

            limit = meta["limit"]
            exceedance_ratio = None
            if max_detected is not None and limit:
                exceedance_ratio = round(max_detected[0] / limit, 3)

            out_rows.append({
                "well": well_label,
                "analyte": analyte,
                "scope": scope_label,
                "min_detected": min_detected[0] if min_detected else "",
                "min_detected_date": min_detected[1] if min_detected else "",
                "max_detected": max_detected[0] if max_detected else "",
                "max_detected_date": max_detected[1] if max_detected else "",
                "max_reporting_limit_nondetect": max_rl[0] if max_rl else "",
                "max_reporting_limit_date": max_rl[1] if max_rl else "",
                "n_samples_analyzed": n_samples,
                "n_nondetect": n_nondetect,
                "n_detect": len(detects),
                "unit": meta["unit"],
                "regulatory_limit": limit,
                "limit_type": meta["limit_type"],
                "exceedance_ratio_at_max": exceedance_ratio if exceedance_ratio is not None else "",
                "source_document": SOURCE_DOC,
                "source_table": meta["table"],
                "source_pages": meta["pages"],
            })

    # Per well
    for well in wells:
        subset = [r for r in primary_rows if r["well"] == well]
        summarize(subset, well, "per_well_all_dates")

    # Overall, all wells, full record (2006-2023)
    summarize(primary_rows, "ALL_WELLS", "overall_2006_2023")

    # Overall, all wells, restricted to 2012-2019 (to match original inventory's scoping)
    def in_2012_2019(r):
        d = parse_date(r["date"])
        return d is not None and 2012 <= d.year <= 2019

    subset_2012_2019 = [r for r in primary_rows if in_2012_2019(r)]
    summarize(subset_2012_2019, "ALL_WELLS", "overall_2012_2019")

    fieldnames = [
        "well", "analyte", "scope", "min_detected", "min_detected_date",
        "max_detected", "max_detected_date", "max_reporting_limit_nondetect",
        "max_reporting_limit_date", "n_samples_analyzed", "n_nondetect", "n_detect",
        "unit", "regulatory_limit", "limit_type", "exceedance_ratio_at_max",
        "source_document", "source_table", "source_pages",
    ]
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(out_rows)

    print(f"Wrote {len(out_rows)} summary rows to {OUT}")

    # Print a quick console report of per-well maxima for each analyte, highlighting
    # the well/date holding the true max for manganese and lead specifically.
    print("\n=== Per-well MAX detected values (primary samples only) ===")
    for analyte in ANALYTES:
        print(f"\n-- {analyte} --")
        cand = [r for r in out_rows if r["analyte"] == analyte and r["scope"] == "per_well_all_dates" and r["max_detected"] != ""]
        cand.sort(key=lambda r: float(r["max_detected"]), reverse=True)
        for r in cand:
            flag = " <<< EXCEEDS LIMIT" if r["exceedance_ratio_at_max"] != "" and float(r["exceedance_ratio_at_max"]) > 1 else ""
            print(f"  {r['well']:8s} max={r['max_detected']:>8} {meta_unit(analyte)} on {r['max_detected_date']:>10}  ratio={r['exceedance_ratio_at_max']}{flag}")


def meta_unit(analyte):
    return ANALYTES[analyte]["unit"]


if __name__ == "__main__":
    main()
