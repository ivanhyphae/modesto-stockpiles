"""
Aggregation script for the S9800-01-17 Modesto Soil Stockpiles Final FS Report
(soil data). This is deliberately separate from aggregate_detections.py, which
is shaped for the groundwater well/date/analyte pilot -- the soil source
document reports almost no raw per-boring lab results at all; it is a
narrative FS report that quotes the *consultants' own* summary statistics
(MDC, 95% UCL, EPC, background range) computed from underlying PSI/SI/SSI
reports that are not themselves in this raw CSV. So this script does NOT
recompute min/max the way the groundwater script does for individual well
detections -- it:

  1. Computes min/max ONLY over rows whose value_type is a genuine raw
     detection or a reported detection range (value_type in
     {"detection", "detection_range"}), grouped by (location, analyte).
  2. Lists the reported summary statistics (MDC, 95_UCL, EPC,
     background_range) as-is, per (investigation_event, location, analyte),
     with their citation -- never averaged or recomputed.
  3. Compares reported values against regulatory limits that are actually
     stated in the source document (see LIMITS below), flagging any exceedance.
"""
import csv
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)  # analysis/
RAW = os.path.join(
    _ROOT, "detections-rebuild", "raw",
    "S9800-01-17 Modesto Soil Stockpiles Final FS Report.0614.raw.csv",
)
OUT = os.path.join(
    _ROOT, "detections-rebuild", "summary",
    "S9800-01-17 Modesto Soil Stockpiles Final FS Report.0614.summary.csv",
)

SOURCE_DOC = "S9800-01-17 Modesto Soil Stockpiles Final FS Report.0614.pdf"

# Regulatory limits actually cited IN THIS DOCUMENT for soil (mg/kg), with the
# exact page each figure was confirmed on. Do not add a limit here unless it
# is a number this FS report itself states -- e.g. no numeric arsenic RSL is
# ever stated in this document (only qualitative "residential CHHSLs or
# RSLs" language), so arsenic has no limit here; do not invent one.
LIMITS = {
    "barium": [
        {"limit": 5200, "limit_type": "CHHSL (residential)", "cited_page_printed": 16},
        {"limit": 63000, "limit_type": "CHHSL (industrial/commercial)", "cited_page_printed": 16},
    ],
    "strontium": [
        {"limit": 47000, "limit_type": "USEPA Regional Screening Level (residential); document states 'there is no CHHSL for strontium'", "cited_page_printed": 4},
    ],
    "lead": [],  # No numeric CHHSL/RSL for lead is stated anywhere in this FS
                 # report; lead is instead evaluated via the LeadSpread
                 # blood-lead model (see 95_UCL/MDC rows in the raw CSV), not
                 # a fixed mg/kg limit. Do not backfill one.
    "arsenic": [],  # No numeric arsenic RSL/CHHSL is stated in this document;
                     # arsenic risk is instead evaluated via 95% UCL cancer-risk
                     # comparison against background (see raw CSV). Leaving
                     # blank rather than repeating the fabricated 0.39 mg/kg
                     # RSL from a prior extraction, which does not appear here.
    "nitrate": [],
}

DETECTION_TYPES = {"detection", "detection_range"}
SUMMARY_TYPES = {"MDC", "95_UCL", "EPC", "background_range"}


def to_float(s):
    if s is None or s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def load_rows():
    with open(RAW, newline="") as f:
        return list(csv.DictReader(f))


def main():
    rows = load_rows()

    detection_out = []
    summary_out = []

    # --- Part 1: min/max over raw detections / detection ranges, grouped by
    # (location, analyte). A "detection_range" row contributes both its low
    # and high bound as candidate min/max values; a "detection" row
    # contributes its single value_mgkg to both.
    groups = {}
    for r in rows:
        if r["value_type"] not in DETECTION_TYPES:
            continue
        key = (r["location"], r["analyte"])
        vals = []
        v = to_float(r["value_mgkg"])
        if v is not None:
            vals.append(v)
        lo = to_float(r["range_low_mgkg"])
        hi = to_float(r["range_high_mgkg"])
        if lo is not None:
            vals.append(lo)
        if hi is not None:
            vals.append(hi)
        if not vals:
            continue
        groups.setdefault(key, []).append((vals, r))

    for (location, analyte), entries in sorted(groups.items()):
        all_vals = [v for vals, _ in entries for v in vals]
        min_v = min(all_vals)
        max_v = max(all_vals)
        # find which row/citation produced the max, for provenance
        max_row = None
        for vals, r in entries:
            if max_v in vals:
                max_row = r
                break
        n_rows = len(entries)
        limit_rows = LIMITS.get(analyte, [])
        for lim in (limit_rows or [{"limit": None, "limit_type": "", "cited_page_printed": ""}]):
            ratio = round(max_v / lim["limit"], 3) if lim["limit"] else ""
            detection_out.append({
                "location": location,
                "analyte": analyte,
                "min_detected_mgkg": min_v,
                "max_detected_mgkg": max_v,
                "n_raw_rows_contributing": n_rows,
                "max_source_investigation_event": max_row["investigation_event"] if max_row else "",
                "max_source_page_printed": max_row["source_page_printed"] if max_row else "",
                "regulatory_limit_mgkg": lim["limit"] if lim["limit"] else "",
                "limit_type": lim["limit_type"],
                "limit_cited_page_printed": lim["cited_page_printed"],
                "exceedance_ratio_at_max": ratio,
                "source_document": SOURCE_DOC,
            })

    # --- Part 2: reported summary statistics, listed as-is (not recomputed)
    for r in rows:
        if r["value_type"] not in SUMMARY_TYPES:
            continue
        v = to_float(r["value_mgkg"])
        lo = to_float(r["range_low_mgkg"])
        hi = to_float(r["range_high_mgkg"])
        summary_out.append({
            "investigation_event": r["investigation_event"],
            "location": r["location"],
            "analyte": r["analyte"],
            "value_type": r["value_type"],
            "value_mgkg": v if v is not None else "",
            "range_low_mgkg": lo if lo is not None else "",
            "range_high_mgkg": hi if hi is not None else "",
            "is_background": r["is_background"],
            "n_samples": r["n_samples"],
            "source_section": r["source_section"],
            "source_page_printed": r["source_page_printed"],
            "source_page_pdf": r["source_page_pdf"],
            "source_document": SOURCE_DOC,
            "notes": r["notes"],
        })

    detection_fields = [
        "location", "analyte", "min_detected_mgkg", "max_detected_mgkg",
        "n_raw_rows_contributing", "max_source_investigation_event",
        "max_source_page_printed", "regulatory_limit_mgkg", "limit_type",
        "limit_cited_page_printed", "exceedance_ratio_at_max", "source_document",
    ]
    summary_fields = [
        "investigation_event", "location", "analyte", "value_type", "value_mgkg",
        "range_low_mgkg", "range_high_mgkg", "is_background", "n_samples",
        "source_section", "source_page_printed", "source_page_pdf",
        "source_document", "notes",
    ]

    with open(OUT, "w", newline="") as f:
        f.write("# Part 1: min/max computed from RAW DETECTIONS / DETECTION RANGES ONLY "
                "(value_type in {detection, detection_range}); excludes MDC/95_UCL/EPC/"
                "background_range rows, which are the consultants' own calculated "
                "statistics and are listed separately below, as-is.\n")
        w = csv.DictWriter(f, fieldnames=detection_fields)
        w.writeheader()
        w.writerows(detection_out)
        f.write("\n# Part 2: reported summary statistics (MDC / 95% UCL / EPC / "
                "background_range), quoted as-is from the source document -- not "
                "recomputed.\n")
        w2 = csv.DictWriter(f, fieldnames=summary_fields)
        w2.writeheader()
        w2.writerows(summary_out)

    print(f"Wrote {len(detection_out)} detection-range summary rows and "
          f"{len(summary_out)} reported-statistic rows to {OUT}")

    print("\n=== Raw-detection min/max by location/analyte ===")
    for row in detection_out:
        flag = ""
        if row["exceedance_ratio_at_max"] not in ("", None):
            try:
                if float(row["exceedance_ratio_at_max"]) > 1:
                    flag = " <<< EXCEEDS LIMIT"
            except ValueError:
                pass
        print(f"  {row['location']:55s} {row['analyte']:10s} "
              f"min={row['min_detected_mgkg']:>10} max={row['max_detected_mgkg']:>10} mg/kg "
              f"limit={row['regulatory_limit_mgkg']}{flag}")


if __name__ == "__main__":
    main()
