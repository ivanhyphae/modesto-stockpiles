#!/usr/bin/env python3
"""Aggregate the RACR soil transcription into a per-area summary CSV.

Per analysis/detections-rebuild/README.md, every statistic here is COMPUTED
from the raw transcription, never asserted from narrative.

Two reference values apply, and they are different kinds of number -- keeping
them apart is the point of this script:

  BCS removal verification threshold  barium 1,000 / lead 80 mg/kg
      The action level. A result above it triggered excavation of that area,
      followed by an "A"-suffixed confirmation resample. These thresholds are
      stated in the RACR's own tables (pp. 41, 60, 214).

  Maximum site-specific background     barium 120 / lead 3.8 mg/kg
      A characterisation reference, NOT an action level. Most samples sit above
      the barium background and that is expected for this site -- do not report
      "exceeds background" as a compliance failure.

Note on the lead threshold: 80 mg/kg here is the BCS Removal Verification
Threshold, printed in these tables. It is NOT a CHHSL. The old fabricated CSV
attributed an "80 mg/kg lead CHHSL" to the FS Report and DEIR/EA, where no such
value appears; this is the real 80 in the record, in a different document and
meaning a different thing.
"""

import csv
import re
import sys
from collections import defaultdict
from pathlib import Path

THRESHOLDS = {
    "barium": 1000.0,
    "lead": 80.0,
}
BACKGROUND = {
    "barium": 120.0,
    "lead": 3.8,
}


def num(raw):
    m = re.search(r"[\d,]+\.?\d*", raw or "")
    return float(m.group(0).replace(",", "")) if m else None


def main():
    src = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    rows = list(csv.DictReader(open(src)))

    groups = defaultdict(list)
    for r in rows:
        if r["value_type"] != "raw_detection":
            continue
        v = num(r["value_raw"])
        if v is None:
            continue
        groups[(r["area"], r["analyte"])].append((r, v))

    out = []
    for (area, analyte), obs in sorted(groups.items()):
        thr = THRESHOLDS[analyte]
        bg = BACKGROUND[analyte]
        detects = [(r, v) for r, v in obs if r["is_nondetect"] != "yes"]
        nds = [(r, v) for r, v in obs if r["is_nondetect"] == "yes"]
        over = [(r, v) for r, v in detects if v > thr]
        # Resamples confirm an excavated area; they are results in their own
        # right but describe post-removal condition, so they are counted
        # separately from the initial characterisation samples.
        resamples = [(r, v) for r, v in obs if r["is_resample"] == "yes"]
        mx = max(detects, key=lambda t: t[1]) if detects else None
        mn = min(detects, key=lambda t: t[1]) if detects else None
        pages = sorted({r["source_page"] for r, _ in obs}, key=int)

        out.append({
            "area": area,
            "analyte": analyte,
            "unit": "mg/kg",
            "n_samples": len(obs),
            "n_detect": len(detects),
            "n_nondetect": len(nds),
            "n_resamples": len(resamples),
            "min_detected": mn[1] if mn else "",
            "min_detected_sample": mn[0]["sample_id"] if mn else "",
            "max_detected": mx[1] if mx else "",
            "max_detected_sample": mx[0]["sample_id"] if mx else "",
            "bcs_removal_verification_threshold": thr,
            "n_over_threshold": len(over),
            "samples_over_threshold": "; ".join(
                f"{r['sample_id']}={r['value_raw']}" for r, _ in
                sorted(over, key=lambda t: -t[1])
            ),
            "exceedance_ratio_at_max": round(mx[1] / thr, 3) if mx else "",
            "max_site_specific_background": bg,
            "n_over_background": sum(1 for _r, v in detects if v > bg),
            "source_document": rows[0]["source_document"],
            "source_table": obs[0][0]["source_table"],
            "source_pages": ", ".join(pages),
        })

    with out_path.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)
    print(f"wrote {len(out)} summary rows -> {out_path}")


if __name__ == "__main__":
    main()
