# Contaminant detections rebuild

Rebuild of a reliable "primary contaminant detections" table (Barium, Lead, Arsenic,
Manganese, Nitrate), replacing `archive/outputs/health_risk_test_results.csv`, which
was found to contain fabricated values and well/analyte transpositions traced to
LLM-summarized reads of wide lab-result tables — the same failure mode documented in
`archive/data-quality-note.md` for an earlier contaminants primer.

## Why a rebuild instead of a patch

Spot-checking the old CSV against source PDFs found errors were systematic, not
random: values swapped between wells (e.g. a Copper reading mislabeled as Lead),
values swapped between dates, ranges that didn't match the true min/max in the
source table, and computed ratios that didn't recompute from their own stated
value/limit. These came from an LLM reading/summarizing a table and writing down
what it recalled, rather than transcribing it. The fix is procedural: keep
transcription mechanical and push all aggregation into code.

## Method

1. **Transcribe, don't summarize.** Read each source PDF's data-table pages directly
   as images. Copy every cell verbatim into a raw CSV — no rounding, no inferring,
   no skipping rows. Flag QA/QC duplicate samples and dry/not-sampled wells rather
   than silently including or omitting them.
2. **Compute, don't narrate.** All mins, maxes, dates-of-max, and exceedance ratios
   are calculated by a script (`analysis/scripts/aggregate_detections.py`) from the
   raw CSV — never asserted by an LLM from memory of the table.
3. **QA by re-reading.** After transcription, re-open the page images for the
   highest-value rows a second time and confirm the transcription matches.
4. **Provenance per row.** Every summary row carries the source document, table
   name, and exact page range — not a narrative section-number guess (a repeated
   source of misattribution in the old CSV).

## Layout

- `raw/<document>.raw.csv` — cell-by-cell transcription, one row per (well, date),
  duplicates and non-samples flagged, one file per source document.
- `summary/<document>.summary.csv` — one row per (well, analyte) with min/max
  detected, dates, sample counts, regulatory limit, limit type, and exceedance
  ratio, all computed from the matching `raw/` file.
- `../scripts/aggregate_detections.py` — the aggregation script (reusable across
  documents; regenerate a summary CSV from any raw CSV with the same schema).

## Status

Piloted on one document: `06A2542ct_TO97_GW Rpt_final.20230308.pdf` (2023
consolidated groundwater monitoring report, 2006–2023, wells MW-1–MW-10). Findings
were cross-checked against hand-read PDF page images and held up exactly, including
overturning two of the old CSV's specific errors (manganese's true peak was
MW-8/410 µg/L in 2018 — absent from the old CSV entirely — and lead never
approaches its reference value in this well set at all).

Remaining source documents (FS Report, SSI Report, HHRA UPDATE, and the individual
groundwater event reports) have not yet been run through this pipeline.
