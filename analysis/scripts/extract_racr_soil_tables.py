#!/usr/bin/env python3
"""Mechanically transcribe the RACR barium/lead soil tables to long-format CSV.

Source: `S1908-01-01 Caltrans Modesto Stockpile Interim RACR_12.22 (1).pdf`
(December 1, 2022 -- accepted as final by DTSC on January 18, 2023).

These tables are simple (SAMPLE ID / TOTAL BARIUM / TOTAL LEAD / COMMENTS), but
both the sample IDs and the comments contain spaces, so a whitespace token split
cannot tell where the id ends and the first value begins. Columns are therefore
binned by x-coordinate from `pdftotext -bbox-layout`, the same approach as
extract_stormwater_tables.py and for the same reason.

Output is long format -- one row per (sample, analyte, value_type) -- matching
the soil convention described in analysis/detections-rebuild/README.md, because
these tables mix raw per-sample detections with the consultant's own reported
statistics (95% UCL, mean) and with reference rows (maximum site-specific
background, BCS removal verification threshold) that must not be blended into
the detection min/max.
"""

import csv
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_stormwater_tables import words_for_page  # noqa: E402

# Non-sample rows: the consultant's own statistics and the regulatory reference
# values, tagged by value_type so aggregation never mixes them with detections.
STATISTIC_ROWS = {
    "95% ucl /mean for all data": "95_percent_ucl_and_mean",
    "95% ucl/mean for all data": "95_percent_ucl_and_mean",
    "maximum site-specific background": "max_site_specific_background",
    "bcs removal verification threshold": "bcs_removal_verification_threshold",
}

NUM_RE = re.compile(r"^<?\d[\d,]*\.?\d*$")

# Vertical span below the BARIUM/LEAD line that still counts as header.
HEADER_WINDOW = 25.0


def group_lines(words, tol=2.5):
    """Group words into text lines by y, returned top to bottom."""
    lines = []
    for w in sorted(words, key=lambda w: w[1]):
        if lines and abs(w[1] - lines[-1][0]) <= tol:
            lines[-1][1].append(w)
        else:
            lines.append((w[1], [w]))
            lines[-1] = (w[1], lines[-1][1])
    return [(y, sorted(ws, key=lambda w: w[3])) for y, ws in lines]


def find_columns(lines):
    """Locate the barium / lead / comments column centres from the header."""
    ba = pb = com = None
    ba_y = None
    for y, ws in lines:
        texts = [w[2] for w in ws]
        if "BARIUM" in texts and "LEAD" in texts:
            ba = next(w[0] for w in ws if w[2] == "BARIUM")
            pb = next(w[0] for w in ws if w[2] == "LEAD")
            ba_y = y
        if "COMMENTS" in texts:
            com = next(w[0] for w in ws if w[2] == "COMMENTS")
    if ba_y is None:
        return None, None, None, None

    # The header block spans several lines in no fixed order: where there is no
    # COMMENTS column the "SAMPLE ID" and "(mg/kg)" lines sit BELOW the
    # BARIUM/LEAD line, and would otherwise be read as a section heading and a
    # data row. Only look within a short window below BARIUM/LEAD -- "mg/kg"
    # also appears in the footnotes at the bottom of every page, and keying on
    # that would push the header past all the data.
    header_y = ba_y
    for y, ws in lines:
        if not (ba_y - 4 <= y <= ba_y + HEADER_WINDOW):
            continue
        texts = [w[2] for w in ws]
        if ("COMMENTS" in texts
                or ("SAMPLE" in texts and "ID" in texts)
                or any(t.strip("()") == "mg/kg" for t in texts)):
            header_y = max(header_y, y)
    return ba, pb, com, header_y


def parse_page(pdf: Path, page: int):
    words = words_for_page(pdf, page)
    lines = group_lines(words)
    ba, pb, com, header_y = find_columns(lines)
    if ba is None or pb is None:
        return []
    # Split points midway between column centres; the id column is everything
    # left of the barium column, comments everything right of the lead column.
    id_max = ba - (ba - 0) * 0.0 - 45.0
    ba_pb_split = (ba + pb) / 2.0
    pb_com_split = (pb + com) / 2.0 if com else pb + 45.0

    rows = []
    area = ""
    for y, ws in lines:
        if header_y is None or y <= header_y + 4:
            continue
        ident, bav, pbv, comv = [], [], [], []
        for w in ws:
            xc, _yc, text, x0 = w
            if x0 < id_max:
                ident.append(text)
            elif xc < ba_pb_split:
                bav.append(text)
            elif xc < pb_com_split:
                pbv.append(text)
            else:
                comv.append(text)
        label = " ".join(ident).strip()
        bav, pbv = " ".join(bav).strip(), " ".join(pbv).strip()
        comment = " ".join(comv).strip()
        if not label and not bav and not pbv:
            continue
        # Footnotes and the "Notes:" block sit below the data with no values.
        if not bav and not pbv:
            if re.match(r"^(Notes?:|mg/kg|<|---|\*|BCS\b)", label):
                continue
            area = label  # section heading, e.g. "Stockpile 2 - West End"
            continue
        rows.append({
            "label": label, "barium": bav, "lead": pbv,
            "comment": comment, "area": area, "page": page,
        })
    return rows


def split_boring_depth(sample_id):
    """Split an MSE-wall style id (STK1-2-3) into boring and depth.

    Trailing segment is the depth interval index; the RACR's wall-footing
    borings were sampled at successive depths, and the Carpenter Shoofly
    composites encode depth in feet after the final hyphen instead.
    """
    m = re.match(r"^(STK\d+-\d+)-(\d+)\*?$", sample_id)
    if m:
        return m.group(1), m.group(2)
    m = re.match(r"^(CSF.*?)-(\d+)$", sample_id)
    if m:
        return m.group(1), m.group(2)
    return "", ""


def to_long(rows, source_table, source_doc, default_area=""):
    out = []
    for r in rows:
        # Only the BCS-removal table is divided into named sections; the
        # wall-footing and shoofly tables have a single implicit area, taken
        # from the table title.
        r = dict(r, area=r["area"] or default_area)
        key = r["label"].lower().strip()
        vtype = STATISTIC_ROWS.get(key, "raw_detection")
        boring, depth = ("", "")
        if vtype == "raw_detection":
            boring, depth = split_boring_depth(r["label"])
        for analyte, raw in (("barium", r["barium"]), ("lead", r["lead"])):
            raw = raw.strip()
            if not raw or raw in ("----", "---", "--"):
                continue
            out.append({
                "sample_id": r["label"] if vtype == "raw_detection" else "",
                "area": r["area"],
                "boring": boring,
                "depth_interval": depth,
                "analyte": analyte,
                "value_raw": raw,
                "unit": "mg/kg",
                "value_type": vtype,
                "is_nondetect": "yes" if raw.startswith("<") else "",
                # "*" marks a sample taken deeper than the planned footing
                # excavation; "Area Excavated" marks a result that triggered
                # removal, followed by an "A"-suffixed confirmation resample.
                "comment": r["comment"],
                "deeper_than_planned": "yes" if r["label"].endswith("*") else "",
                "is_resample": "yes" if re.search(r"\d+A-\d", r["label"]) else "",
                "source_table": source_table,
                "source_page": r["page"],
                "source_document": source_doc,
            })
    return out


# (pages, table title, default area). Page numbers are 1-indexed positions in
# the RACR PDF. Appendix copies of these same tables exist at pp. 72 and 132
# (reproducing the BCS-removal data) and p. 186 (byte-identical to p. 60); they
# are deliberately NOT extracted, to avoid double-counting the same samples.
TABLES = [
    ("40,41", "Table 1 - BCS Removal Verification Soil Sample Analytical Results", ""),
    ("60", "Table 1 - Stockpile 1 MSE Wall Footing Soil Analytical Results",
     "Stockpile 1 MSE Wall Footing"),
    ("214", "Table 1 - Stockpile 2 MSE Wall Footing Soil Analytical Results",
     "Stockpile 2 MSE Wall Footing"),
    ("305", "Table 1 - Carpenter Road Shoofly Soil Analytical Results",
     "Carpenter Road Shoofly"),
]


def main():
    pdf = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    doc = pdf.name
    all_rows = []
    for pages, table_name, default_area in TABLES:
        rows = []
        for p in [int(x) for x in pages.split(",")]:
            rows += parse_page(pdf, p)
        long_rows = to_long(rows, table_name, doc, default_area)
        print(f"  {table_name[:58]:60} pages {pages:6} -> {len(long_rows)} rows")
        all_rows += long_rows

    fields = list(all_rows[0].keys())
    with out_path.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(all_rows)
    print(f"wrote {len(all_rows)} rows -> {out_path}")


if __name__ == "__main__":
    main()
