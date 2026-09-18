#!/usr/bin/env python3
"""Extract per-sample detections for the distribution overlay on the chart.

Emits analysis/detections-rebuild/sample_points.json: for each (analyte,
medium), every individual sample result available in the raw transcriptions,
expressed as a percentage of the same benchmark the bar uses.

Three rules keep this honest:

1. Non-detects are counted, not plotted. A "<1.0" result is not a measurement
   of 1.0; plotting it as a point would invent data at the reporting limit and
   would visually pull every distribution downward. Each cell reports
   n_detected and n_nondetect so the page can say "14 of 37 samples detected".

2. QA/QC duplicates and dry/not-sampled wells are excluded, matching the rule
   the summary tables already use.

3. Coverage is declared, not assumed. Per-sample data exists only for the
   studies that were transcribed sample-by-sample (2012 SSI soil, the RACR
   removal-verification soil, all groundwater, all stormwater). The 2004 PSI,
   2006 SI and HHRA soil results survive only as reported aggregates, so for
   soil the points are a subset of the record and can sit well below the bar.
   Each cell carries `covers_max` saying whether the charted maximum is itself
   among the plotted points, so the page can label the gap instead of implying
   the distribution is complete.
"""

import csv
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
REBUILD = ROOT / "analysis" / "detections-rebuild"
RAW = REBUILD / "raw"
BENCH = REBUILD / "percent_of_benchmark.json"
OUT = REBUILD / "sample_points.json"

GW = RAW / "06A2542ct_TO97_GW Rpt_final.20230308.raw.csv"
SW_METALS = RAW / "06A2542ct_to97_SurfaceWaterLetter_final.20230328.T4-metals.raw.csv"
SW_MIN = RAW / "06A2542ct_to97_SurfaceWaterLetter_final.20230328.T5-minerals.raw.csv"
SW26_METALS = RAW / "S2350-01-02_2.17.2026 Stormwater Sampling Report_5.26.T2-metals.raw.csv"
SSI = RAW / "S9525-06-44 Modesto Stockpiles SSI Report Rev.0313.raw.csv"
RACR = RAW / "S1908-01-01 Interim RACR_12.22.soil.raw.csv"

ANALYTES = ["Barium", "Lead", "Strontium", "Arsenic", "Manganese", "Nitrate (as N)"]


def parse(raw):
    """Return (value, is_nondetect) or None if the cell holds no result."""
    if raw is None:
        return None
    s = str(raw).strip().replace(",", "")
    if not s or s in {"---", "‐‐‐", "--", "n/a", "NA", "ND", "dry", "DRY"}:
        return None
    nd = s.startswith("<")
    if nd:
        s = s[1:].strip()
    s = s.rstrip("JUBjub*+- ").strip()
    try:
        return float(s), nd
    except ValueError:
        return None


def truthy(s):
    return str(s).strip().lower() in {"true", "yes", "1", "t"}


def quantile(sorted_vals, q):
    """Linear-interpolation quantile (the method Excel's QUARTILE and numpy
    default to), so the box matches what a reviewer would get by hand."""
    if not sorted_vals:
        return None
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    pos = (len(sorted_vals) - 1) * q
    lo = int(pos)
    hi = min(lo + 1, len(sorted_vals) - 1)
    frac = pos - lo
    return sorted_vals[lo] * (1 - frac) + sorted_vals[hi] * frac


def add(store, analyte, medium, value, nd, loc, date):
    cell = store.setdefault((analyte, medium), {"pts": [], "nd": 0})
    if nd:
        cell["nd"] += 1
    else:
        cell["pts"].append({"v": value, "loc": loc, "d": date})


def main():
    store = {}

    # ---- groundwater: one row per well per sampling date, wide by analyte
    cols = {"Arsenic": ("arsenic_ugl", 1), "Barium": ("barium_ugl", 1),
            "Lead": ("lead_ugl", 1), "Manganese": ("manganese_ugl", 1),
            "Strontium": ("strontium_ugl", 1), "Nitrate (as N)": ("nitrate_mgl", 1000)}
    for r in csv.DictReader(GW.open()):
        if truthy(r.get("is_duplicate")) or truthy(r.get("is_dry_or_no_sample")):
            continue
        # The transcription carries the Table 3 MCL row as well="REFERENCE";
        # it holds regulatory limits, not results.
        if (r.get("well") or "").strip().upper() == "REFERENCE":
            continue
        for analyte, (col, mult) in cols.items():
            p = parse(r.get(col))
            if p:
                add(store, analyte, "Groundwater", p[0] * mult, p[1], r["well"], r["date"])

    # ---- stormwater: metals tables (ug/L) plus the minerals table for nitrate
    for path in (SW_METALS, SW26_METALS):
        if not path.exists():
            continue
        for r in csv.DictReader(path.open()):
            if truthy(r.get("is_duplicate")):
                continue
            sid = (r.get("sample_id") or "").strip()
            if sid.upper().startswith("BG"):     # background locations
                continue
            # RWQCB is the Regional Board's split of an existing PL sample
            # (12/12/2014) -- a co-located duplicate, not a separate result.
            if sid.upper() == "RWQCB":
                continue
            for analyte, col in [("Arsenic", "arsenic"), ("Barium", "barium"),
                                 ("Lead", "lead"), ("Manganese", "manganese"),
                                 ("Strontium", "strontium")]:
                p = parse(r.get(col))
                if p:
                    add(store, analyte, "Stormwater", p[0], p[1], sid,
                        r.get("sample_date") or r.get("date") or "")
    for path in (SW_MIN,):
        for r in csv.DictReader(path.open()):
            sid = (r.get("sample_id") or "").strip()
            if sid.upper().startswith("BG"):
                continue
            for key in ("nitrate_as_n", "nitrate", "nitrate_mgl", "nitrate_as_nitrogen"):
                if key in r:
                    p = parse(r.get(key))
                    if p:
                        add(store, "Nitrate (as N)", "Stormwater", p[0] * 1000, p[1],
                            sid, r.get("sample_date") or "")
                    break

    # ---- soil: 2012 SSI, long format
    for r in csv.DictReader(SSI.open()):
        if truthy(r.get("is_background")):
            continue
        if r.get("value_type") not in {"detection", "nondetect", ""}:
            continue
        analyte = (r.get("analyte") or "").strip().title()
        if analyte not in ANALYTES:
            continue
        p = parse(r.get("value_mgkg"))
        if not p:
            continue
        nd = p[1] or (r.get("qualifier") or "").strip().upper() in {"U", "ND"}
        add(store, analyte, "Soil", p[0], nd, r.get("location") or "",
            r.get("sample_id") or "")

    # ---- soil: RACR construction-phase sampling
    #
    # Two exclusions here, both about what a sample represents rather than
    # whether it is correct:
    #
    #   is_resample=yes -- the confirmation sample taken at a location AFTER it
    #     exceeded the 1,000 mg/kg barium removal threshold and was excavated.
    #     Seven locations, 14 rows (barium + lead). They measure the material
    #     left behind, so they are low by construction (63-570 mg/kg against
    #     originals of 1,100-7,000) and would put two readings of the same spot
    #     into one distribution.
    #
    #   Carpenter Road Shoofly -- a separate borrow source being qualified for
    #     import as clean cap, not stockpile material, and reported as 3-part
    #     composites rather than discrete samples.
    #
    # The MSE wall footing tables ARE included: RACR 3.5.3 puts those
    # excavations in the southerly slopes of Stockpiles 1 and 2, and all the
    # excavated footing material was placed in the BCS Containment Zones.
    for r in csv.DictReader(RACR.open()):
        analyte = (r.get("analyte") or "").strip().title()
        if analyte not in ANALYTES:
            continue
        if (r.get("unit") or "").strip() != "mg/kg":
            continue
        # The RACR raw file carries reference values in the same shape as
        # results -- removal thresholds (barium 1,000 / lead 80), maximum
        # site-specific background (120 / 3.8) and a 95% UCL. They are not
        # samples and must not be plotted as points.
        if (r.get("value_type") or "").strip() != "raw_detection":
            continue
        if truthy(r.get("is_resample")):
            continue
        if (r.get("area") or "").strip() == "Carpenter Road Shoofly":
            continue
        p = parse(r.get("value_raw"))
        if not p:
            continue
        nd = p[1] or truthy(r.get("is_nondetect"))
        add(store, analyte, "Soil", p[0], nd, r.get("area") or "",
            r.get("sample_id") or "")

    # ---- express every point against the benchmark its bar uses
    bench = {(b["analyte"], b["medium"]): b
             for b in json.load(BENCH.open()) if not b["no_data"]}

    out = {}
    for (analyte, medium), cell in sorted(store.items()):
        b = bench.get((analyte, medium))
        if not b:
            continue
        pts = sorted(cell["pts"], key=lambda p: -p["v"])
        scen = b.get("soil_scenarios")
        entry = {
            "n_detected": len(pts),
            "n_nondetect": cell["nd"],
            "unit": b["unit"],
            "max_plotted": pts[0]["v"] if pts else None,
            "charted_max": b["max_value"],
            # Is the bar's own maximum inside this sample set? For soil it often
            # is not: the value comes from a study reported only in aggregate.
            "covers_max": bool(pts) and pts[0]["v"] >= b["max_value"] - 1e-9,
            "points": [],
        }
        # Only the percentage is carried per point -- the page draws position and
        # nothing else, so sample ids and dates would be dead weight in the
        # payload. They stay in the raw CSVs, which remain the record.
        vals = sorted(p["v"] for p in pts)

        def as_pct(v, benchmark):
            return round(100.0 * v / benchmark, 3)

        def stats(benchmark):
            if not vals:
                return None
            return {
                "min": as_pct(vals[0], benchmark),
                "q1": as_pct(quantile(vals, 0.25), benchmark),
                "median": as_pct(quantile(vals, 0.50), benchmark),
                "q3": as_pct(quantile(vals, 0.75), benchmark),
                "max": as_pct(vals[-1], benchmark),
            }

        entry["pts"] = [as_pct(v, b["benchmark"]) for v in vals]
        entry["stats"] = stats(b["benchmark"])
        if scen:
            ind = scen["industrial"]["benchmark"]
            entry["pts_ind"] = [as_pct(v, ind) for v in vals]
            entry["stats_ind"] = stats(ind)
        entry.pop("points")
        out[analyte + "|" + medium] = entry

    OUT.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    size = OUT.stat().st_size
    print(f"wrote {OUT} ({size/1024:.1f} KB)")

    # The published page loads this as a plain script rather than fetching the
    # JSON: an artifact's content security policy blocks fetch/XHR, so a data
    # file has to arrive as executable JS that assigns a global.
    js = ROOT / "visualization" / "points.js"
    js.write_text("window.__POINTS__ = " + json.dumps(out, separators=(",", ":")) + ";\n")
    print(f"wrote {js} ({js.stat().st_size/1024:.1f} KB)")
    total = 0
    for k, v in sorted(out.items()):
        total += v["n_detected"]
        gap = "" if v["covers_max"] else \
            f"   <-- plotted max {v['max_plotted']:g} < charted {v['charted_max']:g}"
        print(f"  {k:28s} n={v['n_detected']:>4d} detected, "
              f"{v['n_nondetect']:>3d} non-detect{gap}")
    print(f"  total plotted points: {total}")


if __name__ == "__main__":
    main()
