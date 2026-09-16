#!/usr/bin/env python3
"""Mechanically transcribe the stormwater/surface-water data tables to raw CSV.

Positional (x-coordinate) binning is used rather than whitespace token splitting
because these tables float J-flag qualifiers and wrapped values onto adjacent
text lines -- a plain `pdftotext -layout` split silently shifts values between
analyte columns, which is exactly the transposition failure mode that
analysis/detections-rebuild/README.md was written to avoid.

Reads `pdftotext -bbox-layout` XML; emits one row per (sample_id, sample_date)
with one column per analyte. No rounding, no inference: cell text is copied
verbatim, including `<`, `J`, `---` and "No Sample - Dry" style annotations.
"""

import csv
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"x": "http://www.w3.org/1999/xhtml"}

# Column order verified against the Table 4 "MCLs" row, whose values match the
# published California MCLs analyte-for-analyte (antimony 6.0, arsenic 10,
# barium 1,000, beryllium 4.0, cadmium 5.0, chromium 50, copper 1,300, lead 15,
# manganese 50*, nickel 100, selenium 50, silver 100*, thallium 2.0,
# zinc 5,000*, mercury 2.0). See METHODOLOGY notes.
METALS_COLUMNS = [
    ("antimony", "ug/L"),
    ("arsenic", "ug/L"),
    ("barium", "ug/L"),
    ("beryllium", "ug/L"),
    ("cadmium", "ug/L"),
    ("chromium", "ug/L"),
    ("cobalt", "ug/L"),
    ("copper", "ug/L"),
    ("lead", "ug/L"),
    ("manganese", "ug/L"),
    ("molybdenum", "ug/L"),
    ("nickel", "ug/L"),
    ("selenium", "ug/L"),
    ("silver", "ug/L"),
    ("thallium", "ug/L"),
    ("vanadium", "ug/L"),
    ("zinc", "ug/L"),
    ("strontium", "ug/L"),
    ("mercury", "ug/L"),
    ("calcium", "mg/L"),
    ("magnesium", "mg/L"),
    ("potassium", "mg/L"),
    ("sodium", "mg/L"),
]

# 2023-onward reports (Geocon, "Encapsulated Soil Stockpiles") use a reduced
# Title 22 list -- no manganese, no calcium/magnesium/potassium/sodium -- and
# place strontium after mercury rather than before it. Verified against this
# table's own MCL row (antimony 6.0 ... zinc 5,000*, mercury 2.0, strontium ---).
METALS_COLUMNS_2023 = [
    ("antimony", "ug/L"),
    ("arsenic", "ug/L"),
    ("barium", "ug/L"),
    ("beryllium", "ug/L"),
    ("cadmium", "ug/L"),
    ("chromium", "ug/L"),
    ("cobalt", "ug/L"),
    ("copper", "ug/L"),
    ("lead", "ug/L"),
    ("molybdenum", "ug/L"),
    ("nickel", "ug/L"),
    ("selenium", "ug/L"),
    ("silver", "ug/L"),
    ("thallium", "ug/L"),
    ("vanadium", "ug/L"),
    ("zinc", "ug/L"),
    ("mercury", "ug/L"),
    ("strontium", "ug/L"),
]

# Table 5 -- general minerals. Order verified against its MCL row
# (nitrate 10, sulfate 250*, chloride 250*, TDS 500*).
MINERALS_COLUMNS = [
    ("nitrate_as_n", "mg/L"),
    ("sulfate", "mg/L"),
    ("sulfide", "mg/L"),
    ("total_suspended_solids", "mg/L"),
    ("chloride", "mg/L"),
    ("alkalinity_bicarbonate", "mg/L"),
    ("alkalinity_carbonate", "mg/L"),
    ("alkalinity_total", "mg/L"),
    ("total_dissolved_solids", "mg/L"),
]

# Table 1 of the 2024-2026 reports.
TDS_SULFATE_COLUMNS = [
    ("total_dissolved_solids", "mg/L"),
    ("sulfate", "mg/L"),
]

COLUMN_SETS = {
    "metals23": METALS_COLUMNS,
    "metals18": METALS_COLUMNS_2023,
    "minerals": MINERALS_COLUMNS,
    "tds_sulfate": TDS_SULFATE_COLUMNS,
}

DATE_RE = re.compile(r"^\d{1,2}/\d{1,2}/\d{4}$")
SAMPLE_ID_RE = re.compile(r"^(PL\d+|BG\d+|SW\d+|SW-[A-Za-z]+|BG-[A-Za-z]+)", re.I)
# Whole-row annotations that occupy the data area instead of per-analyte values.
ANNOTATION_RE = re.compile(
    r"No Sample|Dry|Removed From Network|Not Sampled|Not Accessible", re.I
)


def words_for_page(pdf: Path, page: int):
    """Return [(x_center, y_center, text)] for every word on `page`."""
    xml = subprocess.run(
        ["pdftotext", "-bbox-layout", "-f", str(page), "-l", str(page), str(pdf), "-"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    root = ET.fromstring(xml)
    out = []
    for w in root.iter("{http://www.w3.org/1999/xhtml}word"):
        text = (w.text or "").strip()
        if not text:
            continue
        x0, x1 = float(w.get("xMin")), float(w.get("xMax"))
        y0, y1 = float(w.get("yMin")), float(w.get("yMax"))
        out.append(((x0 + x1) / 2.0, (y0 + y1) / 2.0, text, x0))
    return out


def half_row_spacing(dates, default=6.0):
    """Half the median vertical gap between consecutive data rows."""
    gaps = [b[1] - a[1] for a, b in zip(dates, dates[1:]) if b[1] - a[1] > 1.0]
    if not gaps:
        return default
    gaps.sort()
    return gaps[len(gaps) // 2] / 2.0


def find_anchor_rows(words, id_x_max, date_x_max):
    """Locate data rows via the Sample Date column, then label from Sample ID.

    Anchoring on the date rather than the sample id matters: the CVRWQCB split
    samples ("RWQCB / <date> / Sample*") wrap their label across three text
    lines, so id-anchored bands swallow the split sample's values into the
    preceding location's row. Every data row carries exactly one date.
    """
    ids = [w for w in words if w[3] < id_x_max and w[2].strip()]
    dates = [w for w in words if w[3] < date_x_max and DATE_RE.match(w[2])]
    dates.sort(key=lambda d: d[1])

    # Edge bands (above the first date, below the last) must not reach into the
    # neighbouring non-data rows: the "MCLs" row sits directly below the last
    # sample row, and its secondary-MCL footnote markers would otherwise be
    # appended to that sample's values (e.g. zinc "20" + marker "1" -> "201").
    edge = half_row_spacing(dates)

    anchors = []
    for i, (_xc, yc, date_text, _x0) in enumerate(dates):
        # Band for the label: halfway to the neighbouring date rows, so a
        # multi-line label is collected in full but never crosses into another.
        top = (dates[i - 1][1] + yc) / 2.0 if i > 0 else yc - edge
        bot = (dates[i + 1][1] + yc) / 2.0 if i + 1 < len(dates) else yc + edge
        # The first data row on each page sits close enough to the "Sample ID"
        # column heading to absorb its words, so drop those tokens outright
        # rather than pattern-matching the joined string (the heading's two
        # words do not always land in the same band).
        label_words = [w for w in ids if top <= w[1] < bot
                       and w[2].strip("*") not in ("Sample", "ID", "Date")]
        label = " ".join(w[2] for w in sorted(label_words, key=lambda w: w[1]))
        label = label.replace("*", "").strip() or "UNLABELED"
        anchors.append((yc, label, date_text))
    return anchors


def cluster_columns(values, n_expected, tol=6.0):
    """Cluster value x-centers into columns; return sorted cluster centers."""
    xs = sorted(values)
    clusters = []
    for x in xs:
        if clusters and x - clusters[-1][-1] <= tol:
            clusters[-1].append(x)
        else:
            clusters.append([x])
    centers = [sum(c) / len(c) for c in clusters]
    return centers


def detect_geometry(words):
    """Locate the Sample Date column from the dates themselves.

    Layouts differ between the Stantec (2023) and Geocon (2024-2026) tables, so
    the id/date/data x-boundaries are derived per page instead of hardcoded.
    """
    dates = [w for w in words if DATE_RE.match(w[2])]
    if not dates:
        return None
    # The date column is the leftmost dense cluster of date-shaped words.
    x0s = sorted(w[3] for w in dates)
    left = x0s[len(x0s) // 2]
    col = [w for w in dates if abs(w[3] - left) < 40.0]
    date_x0 = min(w[3] for w in col)
    date_x1 = max(w[0] + (w[0] - w[3]) for w in col)  # approx right edge
    return date_x0 - 2.0, date_x1 + 6.0


def extract_grid(pdf: Path, pages, columns, id_x_max=None, date_x_max=None,
                 data_x_min=None):
    """Extract one row per anchor across `pages`, binning values into `columns`."""
    rows = []
    for page in pages:
        words = words_for_page(pdf, page)
        geom = detect_geometry(words)
        if geom is None:
            continue
        auto_id_max, auto_data_min = geom
        id_max = id_x_max if id_x_max is not None else auto_id_max
        date_max = date_x_max if date_x_max is not None else auto_data_min
        data_min = data_x_min if data_x_min is not None else auto_data_min
        anchors = find_anchor_rows(words, id_max, date_max)
        if not anchors:
            continue
        data_words = [w for w in words if w[3] >= data_min]

        # Row bands: midpoints between consecutive anchors. Words that float
        # above/below their row (superscript J flags) still land in the right band.
        # The first/last bands use half the median row spacing so they stop short
        # of the header above and the "MCLs" row below -- the latter's superscript
        # secondary-MCL markers sit high enough to be captured by a wider band and
        # would be appended to the last sample's values (zinc "20" -> "201").
        edge = half_row_spacing([(0.0, a[0], "", 0.0) for a in anchors])
        bands = []
        for i, (yc, sid, sdate) in enumerate(anchors):
            top = (anchors[i - 1][0] + yc) / 2.0 if i > 0 else yc - edge
            bot = (anchors[i + 1][0] + yc) / 2.0 if i + 1 < len(anchors) else yc + edge
            bands.append((top, bot, sid, sdate))

        # Column centers learned from this page's own data words, so per-page
        # layout shifts can't misalign the bins.
        col_centers = derive_column_centers(data_words, bands, len(columns))

        for top, bot, sid, sdate in bands:
            cells = [[] for _ in columns]
            in_band = [w for w in data_words if top <= w[1] < bot]
            joined = " ".join(w[2] for w in sorted(in_band, key=lambda w: w[0]))
            if ANNOTATION_RE.search(joined):
                rows.append({
                    "sample_id": sid, "sample_date": sdate,
                    "row_annotation": joined.strip(), "page": page,
                    "source_document": pdf.name,
                })
                continue
            for xc, yc, text, x0 in sorted(in_band, key=lambda w: w[0]):
                if col_centers:
                    idx = min(range(len(col_centers)),
                              key=lambda i: abs(col_centers[i] - xc))
                    cells[idx].append(text)
            rec = {"sample_id": sid, "sample_date": sdate,
                   "row_annotation": "", "page": page,
                   "source_document": pdf.name}
            for (name, _unit), parts in zip(columns, cells):
                rec[name] = "".join(parts)
            rows.append(rec)
    return rows


def derive_column_centers(data_words, bands, n_expected):
    """Learn column x-centers from the densest data rows on the page."""
    band_words = []
    for top, bot, _sid, _sdate in bands:
        in_band = [w for w in data_words if top <= w[1] < bot]
        joined = " ".join(w[2] for w in in_band)
        if ANNOTATION_RE.search(joined):
            continue
        band_words.append(in_band)
    # Use rows that look complete (one word per column) to fix the grid.
    full = [b for b in band_words if len(b) == n_expected]
    if not full:
        full = sorted(band_words, key=len, reverse=True)[:6]
    if not full:
        return []
    centers = []
    for i in range(n_expected):
        col = [sorted(b, key=lambda w: w[0])[i][0] for b in full
               if len(b) > i and len(b) == n_expected]
        if col:
            centers.append(sum(col) / len(col))
    if len(centers) != n_expected:
        # fall back to clustering every value on the page
        xs = [w[0] for b in band_words for w in b]
        centers = cluster_columns(xs, n_expected)
    return centers


def main():
    pdf = Path(sys.argv[1])
    pages = [int(p) for p in sys.argv[2].split(",")]
    out = Path(sys.argv[3])
    colset = sys.argv[4] if len(sys.argv) > 4 else "metals23"
    columns = COLUMN_SETS[colset]
    rows = extract_grid(pdf, pages, columns)
    fields = ["sample_id", "sample_date", "source_document", "page",
              "row_annotation"] + [c for c, _ in columns]
    with out.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)
    print(f"wrote {len(rows)} rows -> {out}")


if __name__ == "__main__":
    main()
