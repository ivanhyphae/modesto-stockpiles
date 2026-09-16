#!/usr/bin/env python3
"""
Combine the per-document summary CSVs in analysis/detections-rebuild/summary/
into one long-format table.

Each source document reports contaminant data in a different shape (well/date
grid for groundwater, per-boring/per-depth for soil, narrative metric/value
for statistical rollups, a single narrative range for the DEIR/EA). Rather than
force these into one wide schema (which would be sparse and misleading), this
script normalizes every row from every summary CSV into one common long-format
schema, tagging what kind of value it is (`value_type`) and what medium it
belongs to, while preserving the original file's provenance.

This does not recompute anything — every value here already exists in one of
the per-document summary CSVs, which were themselves computed (not narrated)
from the raw transcriptions. This script only reshapes and unions.
"""
import csv
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SUMMARY_DIR = REPO / "detections-rebuild" / "summary"
OUT_PATH = REPO / "detections-rebuild" / "combined_detections_summary.csv"

FIELDS = [
    "medium", "source_document", "location_or_well", "analyte", "value_type",
    "value", "unit", "date_or_event", "depth_ft", "is_background",
    "n_samples", "regulatory_limit", "limit_type", "exceedance_ratio",
    "source_citation", "status", "notes",
]


def row(**kwargs):
    r = {f: "" for f in FIELDS}
    r.update(kwargs)
    return r


def read_csv_skip_comments(path):
    """Yield (header, list-of-dict-rows) for each '#'-delimited section of a CSV."""
    sections = []
    with open(path, newline="", encoding="utf-8") as fh:
        lines = fh.readlines()
    i = 0
    while i < len(lines):
        # skip blank lines and comment lines, remembering the comment as a label
        label = None
        while i < len(lines) and (lines[i].strip() == "" or lines[i].lstrip().startswith("#")):
            if lines[i].lstrip().startswith("#"):
                label = lines[i].lstrip("#").strip()
            i += 1
        if i >= len(lines):
            break
        # header + rows until next blank/comment run or EOF
        start = i
        i += 1
        while i < len(lines) and lines[i].strip() != "" and not lines[i].lstrip().startswith("#"):
            i += 1
        chunk = lines[start:i]
        reader = csv.DictReader(chunk)
        sections.append((label, list(reader)))
    return sections


def combine_groundwater():
    path = SUMMARY_DIR / "06A2542ct_TO97_GW Rpt_final.20230308.summary.csv"
    out = []
    with open(path, newline="", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            well = r["well"]
            is_bg = "TRUE" if well == "ALL_WELLS" else ""
            for vt, val, date in [
                ("min_detected", r["min_detected"], r["min_detected_date"]),
                ("max_detected", r["max_detected"], r["max_detected_date"]),
            ]:
                if not val:
                    continue
                out.append(row(
                    medium="groundwater",
                    source_document=r["source_document"],
                    location_or_well=well,
                    analyte=r["analyte"],
                    value_type=f"{vt}_{r['scope']}",
                    value=val,
                    unit=r["unit"],
                    date_or_event=date,
                    n_samples=r["n_samples_analyzed"],
                    regulatory_limit=r["regulatory_limit"],
                    limit_type=r["limit_type"],
                    exceedance_ratio=r["exceedance_ratio_at_max"] if vt == "max_detected" else "",
                    source_citation=f"{r['source_table']}, pp. {r['source_pages']}",
                    status="VERIFIED (computed from raw transcription)",
                    notes=f"n_nondetect={r['n_nondetect']}",
                ))
    return out


def _collapse_multi_limit_part1(rows, key_fields, min_field, max_field, unit_str):
    """Rows repeat the same (location, analyte) min/max once per regulatory
    limit compared against. Collapse each group into one min row and one max
    row, combining the repeated limit/ratio pairs into semicolon-joined
    fields instead of duplicating the whole record per limit."""
    groups = {}
    for r in rows:
        key = tuple(r[f] for f in key_fields)
        groups.setdefault(key, []).append(r)
    out_groups = []
    for key, grp in groups.items():
        limits = [
            f"{g.get('limit_type','')}={g.get('regulatory_limit_mgkg') or g.get('regulatory_limit','')}"
            for g in grp if g.get('limit_type')
        ]
        ratios = [
            f"{g.get('limit_type','')}={g.get('exceedance_ratio_at_max','')}"
            for g in grp if g.get('limit_type') and g.get('exceedance_ratio_at_max')
        ]
        out_groups.append((grp[0], "; ".join(limits), "; ".join(ratios)))
    return out_groups


def combine_ssi_report():
    path = SUMMARY_DIR / "S9525-06-44 Modesto Stockpiles SSI Report Rev.0313.summary.csv"
    out = []
    for label, rows in read_csv_skip_comments(path):
        if rows and "location" in rows[0] and "min_detected_mgkg" in rows[0]:
            for r, limits, ratios in _collapse_multi_limit_part1(
                rows, ["location", "analyte"], "min_detected_mgkg", "max_detected_mgkg", "mg/kg"
            ):
                for vt, val, sid, depth in [
                    ("min_detected", r["min_detected_mgkg"], r.get("min_sample_id"), r.get("min_depth_ft")),
                    ("max_detected", r["max_detected_mgkg"], r.get("max_sample_id"), r.get("max_depth_ft")),
                ]:
                    out.append(row(
                        medium="soil",
                        source_document=r["source_document"],
                        location_or_well=r["location"],
                        analyte=r["analyte"],
                        value_type=vt,
                        value=val,
                        unit="mg/kg",
                        date_or_event="2012 SSI",
                        depth_ft=depth,
                        n_samples=r.get("n_detections_contributing"),
                        regulatory_limit=limits if vt == "max_detected" else "",
                        exceedance_ratio=ratios if vt == "max_detected" else "",
                        source_citation="SSI Report Table 2/3",
                        status="VERIFIED (computed from raw transcription)",
                        notes=f"sample_id={sid}; {r.get('extreme_deep_barium_flag','')}",
                    ))
            continue
        for r in rows:
            if "sample_id" in r and "value_mgkg" in r and "location" in r:
                # Part 2 (extreme deep barium detail) or Part 3 (background stats)
                out.append(row(
                    medium="soil",
                    source_document=r.get("source_document") or "S9525-06-44 Modesto Stockpiles SSI Report Rev.0313.pdf",
                    location_or_well=r["location"],
                    analyte=r.get("analyte", "Barium"),
                    value_type=r.get("value_type", "extreme_deep_detection"),
                    value=r["value_mgkg"],
                    unit="mg/kg",
                    date_or_event=r.get("investigation_event", "2012 SSI"),
                    depth_ft=r.get("depth_ft"),
                    is_background=r.get("is_background", ""),
                    source_citation="SSI Report Table 2/3",
                    status="VERIFIED",
                    notes=f"sample_id={r['sample_id']}; {r.get('notes','')}",
                ))
    return out


def combine_fs_report():
    path = SUMMARY_DIR / "S9800-01-17 Modesto Soil Stockpiles Final FS Report.0614.summary.csv"
    out = []
    for label, rows in read_csv_skip_comments(path):
        if rows and "min_detected_mgkg" in rows[0]:
            for r, limits, ratios in _collapse_multi_limit_part1(
                rows, ["location", "analyte"], "min_detected_mgkg", "max_detected_mgkg", "mg/kg"
            ):
                for vt, val in [("min_detected", r["min_detected_mgkg"]), ("max_detected", r["max_detected_mgkg"])]:
                    out.append(row(
                        medium="soil",
                        source_document=r["source_document"],
                        location_or_well=r["location"],
                        analyte=r["analyte"],
                        value_type=vt,
                        value=val,
                        unit="mg/kg",
                        date_or_event=r.get("max_source_investigation_event"),
                        n_samples=r.get("n_raw_rows_contributing"),
                        regulatory_limit=limits if vt == "max_detected" else "",
                        exceedance_ratio=ratios if vt == "max_detected" else "",
                        source_citation=f"FS Report, printed p.{r.get('max_source_page_printed','')}",
                        status="VERIFIED (computed from raw transcription)",
                        notes="",
                    ))
            continue
        for r in rows:
            if "value_mgkg" in r:
                out.append(row(
                    medium="soil",
                    source_document=r["source_document"],
                    location_or_well=r["location"],
                    analyte=r["analyte"],
                    value_type=r["value_type"],
                    value=r["value_mgkg"] or f"{r.get('range_low_mgkg','')}-{r.get('range_high_mgkg','')}",
                    unit="mg/kg",
                    date_or_event=r.get("investigation_event"),
                    is_background=r.get("is_background", ""),
                    n_samples=r.get("n_samples"),
                    source_citation=f"FS Report {r.get('source_section','')}, printed p.{r.get('source_page_printed','')}",
                    status="VERIFIED (reported statistic, quoted as-is)",
                    notes=r.get("notes", ""),
                ))
    return out


def combine_hhra_update():
    path = SUMMARY_DIR / "S9525-06-44 HHRA UPDATE Rev.0313.summary.csv"
    out = []
    for label, rows in read_csv_skip_comments(path):
        for r in rows:
            out.append(row(
                medium="soil",
                source_document=r["source_document"],
                location_or_well=r["location"],
                analyte=r["analyte"],
                value_type=r["value_type"],
                value=r["value_mgkg"],
                unit="mg/kg",
                date_or_event=r.get("investigation_event"),
                depth_ft=r.get("depth_ft"),
                is_background=r.get("is_background", ""),
                source_citation="HHRA UPDATE",
                status="VERIFIED (reported statistic, quoted as-is)",
                notes=f"sample_id={r.get('sample_id','')}; {r.get('notes','')}",
            ))
    return out


def combine_deir_ea():
    path = SUMMARY_DIR / "SR_132_DEIR_EA.summary.csv"
    out = []
    with open(path, newline="", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            for vt, val in [("min_detected", r["min_detected"]), ("max_detected", r["max_detected"])]:
                out.append(row(
                    medium="soil",
                    source_document=r["source_document"],
                    location_or_well=r["well"],
                    analyte=r["analyte"],
                    value_type=f"{vt}_{r['scope']}",
                    value=val,
                    unit=r["unit"],
                    regulatory_limit=r.get("regulatory_limit"),
                    limit_type=r.get("limit_type"),
                    source_citation=f"{r['source_table']}, pp. {r['source_pages']}",
                    status="VERIFIED",
                    notes="No numeric regulatory limit is stated in this source document.",
                ))
    return out


def combine_stat_eval():
    path = SUMMARY_DIR / "S2350-01-02 Updated Statistical Evaluation Report_2.24.summary.csv"
    out = []
    with open(path, newline="", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            if r["analyte"] == "scope":
                continue
            m = re.match(r"^([\d.]+)\s*(\S+)?$", (r["value"] or "").strip())
            val, unit = (m.group(1), m.group(2) or r.get("unit", "")) if m else (r["value"], r.get("unit", ""))
            out.append(row(
                medium="groundwater",
                source_document="S2350-01-02 Updated Statistical Evaluation Report_2.24.pdf",
                location_or_well=r["analyte"].split(" (")[0] if "(" in r["analyte"] else "",
                analyte=r["analyte"],
                value_type=r["metric"],
                value=val,
                unit=unit,
                source_citation=f"p. {r['source_page']}",
                status=r["status"],
                notes=r["citation"],
            ))
    return out


SURFACE_WATER_SUMMARIES = [
    ("06A2542ct_to97_SurfaceWaterLetter_final.20230328.stormwater.summary.csv",
     "Table 4 (metals) pp. 19-22; Table 5 (general minerals) pp. 23-26"),
    ("S2350-01-02_2.17.2026 Stormwater Sampling Report_5.26.stormwater.summary.csv",
     "Table 2 (metals) p. 10; Table 1 (TDS/sulfate) p. 9"),
]

# BG* locations are the designated upgradient/background stations. Tagging them
# matters for interpretation: several of this site's headline surface-water
# exceedances (barium 3/17/2020, thallium 12/19/2023) occur AT the background
# station as well as at the runoff stations, which is inconsistent with a
# stockpile release and must not be read as one.
BACKGROUND_LOCATIONS = {"BG1", "BG2", "BG3", "BG-West"}


def combine_surface_water():
    out = []
    for fname, citation in SURFACE_WATER_SUMMARIES:
        path = SUMMARY_DIR / fname
        if not path.exists():
            continue
        with open(path, newline="", encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                loc = r["location"]
                is_bg = "TRUE" if loc in BACKGROUND_LOCATIONS else ""
                notes = [f"n_nondetect={r['n_nondetect']}"]
                if r.get("max_detected_qualifier"):
                    notes.append(f"max_qualifier={r['max_detected_qualifier']}")
                if r.get("nondetect_rl_above_limit") == "yes":
                    notes.append(
                        "reporting limit for non-detects exceeds the limit -- "
                        "compliance not assessable for those events"
                    )
                for vt, val, date in [
                    ("min_detected", r["min_detected"], r["min_detected_date"]),
                    ("max_detected", r["max_detected"], r["max_detected_date"]),
                ]:
                    if not val:
                        continue
                    out.append(row(
                        medium="surface_water",
                        source_document=r["source_document"],
                        location_or_well=loc,
                        analyte=r["analyte"],
                        value_type=f"{vt}_per_location_all_dates",
                        value=val,
                        unit=r["unit"],
                        date_or_event=date,
                        is_background=is_bg,
                        n_samples=r["n_analyzed"],
                        regulatory_limit=r["regulatory_limit"],
                        limit_type=r["limit_type"],
                        exceedance_ratio=(
                            r["exceedance_ratio_at_max"] if vt == "max_detected" else ""
                        ),
                        source_citation=citation,
                        status="VERIFIED (computed from raw transcription)",
                        notes="; ".join(notes),
                    ))
    return out


def combine_racr_soil():
    """RACR (Dec 2022) barium/lead soil results -- the latest soil data on file.

    Two reference values travel with these rows and mean different things: the
    BCS removal verification threshold (barium 1,000 / lead 80 mg/kg) is the
    action level that triggered excavation, while the maximum site-specific
    background (barium 120 / lead 3.8 mg/kg) is a characterisation reference,
    not a compliance standard.
    """
    path = SUMMARY_DIR / "S1908-01-01 Interim RACR_12.22.soil.summary.csv"
    out = []
    if not path.exists():
        return out
    with open(path, newline="", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            citation = f"{r['source_table']}, p. {r['source_pages']}"
            notes = [f"n_nondetect={r['n_nondetect']}"]
            if r["n_resamples"] != "0":
                notes.append(
                    f"{r['n_resamples']} post-excavation confirmation resamples "
                    "(A-suffixed) included"
                )
            if r["samples_over_threshold"]:
                notes.append(f"over threshold: {r['samples_over_threshold']}")
            notes.append(
                f"{r['n_over_background']} of {r['n_detect']} detections above "
                f"max site-specific background ({r['max_site_specific_background']} mg/kg) "
                "-- reference only, not an action level"
            )
            for vt, val, sample in [
                ("min_detected", r["min_detected"], r["min_detected_sample"]),
                ("max_detected", r["max_detected"], r["max_detected_sample"]),
            ]:
                if not val:
                    continue
                out.append(row(
                    medium="soil",
                    source_document=r["source_document"],
                    location_or_well=r["area"],
                    analyte=r["analyte"],
                    value_type=f"{vt}_per_area",
                    value=val,
                    unit=r["unit"],
                    date_or_event=sample,
                    n_samples=r["n_samples"],
                    regulatory_limit=r["bcs_removal_verification_threshold"],
                    limit_type="BCS removal verification threshold",
                    exceedance_ratio=(
                        r["exceedance_ratio_at_max"] if vt == "max_detected" else ""
                    ),
                    source_citation=citation,
                    status="VERIFIED (computed from raw transcription)",
                    notes="; ".join(notes),
                ))
    return out


def main():
    all_rows = []
    all_rows += combine_groundwater()
    all_rows += combine_ssi_report()
    all_rows += combine_fs_report()
    all_rows += combine_hhra_update()
    all_rows += combine_deir_ea()
    all_rows += combine_stat_eval()
    all_rows += combine_surface_water()
    all_rows += combine_racr_soil()

    with open(OUT_PATH, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"Wrote {len(all_rows)} rows to {OUT_PATH}")
    by_medium = {}
    for r in all_rows:
        by_medium[r["medium"]] = by_medium.get(r["medium"], 0) + 1
    print("By medium:", by_medium)


if __name__ == "__main__":
    main()
