# Reliability methodology: contaminant detections rebuild

This document demonstrates, with concrete before/after evidence, why the data
in this directory can be trusted more than `archive/outputs/health_risk_test_results.csv`,
which it replaces. It is not a promise that every number is perfect — it's a
record of what was actually checked, how, and what specific errors that
checking caught.

## 1. The failure mode being corrected

`health_risk_test_results.csv` was built by having an LLM read wide lab-result
tables (10+ wells, 19 analyte columns, sometimes spanning page breaks) and
write down a summary of what it recalled — the min, the max, which well held
it, the ratio to a regulatory limit. Auditing it against the actual source
PDFs found the errors were **systematic, not random noise**:

- Values transposed between wells (a Copper reading reported as Lead)
- Values transposed between wells for the *same* analyte (a Manganese peak
  attributed to the wrong monitoring well)
- Values transposed between a primary sample and its QA/QC duplicate
- A table column (sample depth in feet) misread as a concentration
- Regulatory limits invented that never appear in the cited document
- Ranges ("min X, max Y") that don't match the true extremes in the source
- Narrative claims ("downgradient," "extreme outlier," "capped in place")
  contradicted by the source's own text
- A stated ratio that doesn't arithmetically recompute from its own stated
  value and limit

This is not a new failure mode for this project — `archive/data-quality-note.md`
documents an earlier incident where a different tool (the sage-wiki compiler)
misaligned columns in the same kind of wide table and fabricated an entire
narrative from a monitoring-well ID. Two independent tools, hitting the same
class of table, produced the same class of error. That recurrence is the
actual case for why this rebuild uses a different *process*, not just a more
careful reading.

## 2. Method

Four rules, applied to every document in this rebuild:

1. **Transcribe, don't summarize.** Read the source table directly — as a
   page image, or via text extraction cross-checked by two independent
   extraction passes that must agree on every cell — and copy each cell
   verbatim. Never ask a model to recall or summarize a table from memory.
   Flag ambiguity (duplicate samples, dry wells, illegible cells) rather than
   resolving it silently.
2. **Compute, don't narrate.** Every min, max, date-of-max, and exceedance
   ratio is calculated by a script from the raw transcription — never
   asserted in prose by a model. A script re-derives the same number the same
   way every time; a model recalling a table does not.
3. **QA by re-reading.** After transcription, re-open the source for the
   highest-value / highest-stakes rows a second time, independently, and
   confirm the transcription matches. This is what caught this rebuild's own
   mistakes (see §4) as well as the old CSV's.
4. **Provenance per row.** Every number carries the exact document, table,
   and page it came from — not a narrative section-number guess. Section
   citations were themselves a repeated source of misattribution in the old
   CSV (a real number, attributed to the wrong section of the wrong
   document).

## 3. Evidence: specific errors this method caught

Every row below is a concrete, source-cited correction — not a general claim.

| # | Old CSV claim | What the source actually shows | How it was caught |
|---|---|---|---|
| 1 | GW report: MW-5 Lead = 8.3 µg/L | MW-5's Lead result that date is `<3.6` (non-detect); 8.3 is **MW-4's Copper** value in the adjacent column | Direct read of the raw PDF table image (Table 3, p.21–29) |
| 2 | GW report: MW-1 Manganese = 260 µg/L (3/18/2013) | MW-1's true value that date is 160 µg/L; 260 belongs to **MW-7**, same date | Same table, cross-checked cell by cell against the page image |
| 3 | GW report: MW-4 Manganese = 71 µg/L, "1.4×" | 71 belongs to **MW-1** (4/12/2017); MW-4's true max is 88 µg/L (1.76×) | Same table |
| 4 | GW report: MW-8 Manganese max = 160 µg/L, "3.2×" | True max is **410 µg/L** (4/11/2018, 8.2×) — the single largest exceedance in the dataset, absent from the old CSV entirely | Same table; independently reproduced by the extraction pipeline's mechanical aggregation (§5) |
| 5 | GW report: consolidated nitrate = "0 mg/L, multiple wells exceeded" | Actual range across the record is ~2.1–40 mg/L, with 71 individual results over the 10 mg/L MCL | Table 4 (General Minerals), read directly |
| 6 | GW nitrate reports (5 rows): MW-5 labeled "downgradient" | None of the five source reports ever call MW-5 downgradient; they describe it as beneath the stockpiles. "Downgradient" is only ever applied to MW-3/MW-6/MW-8 | Full-text read of five separate monthly GW reports |
| 7 | April 2017 GW report: Manganese values for MW-4, MW-6, MW-7, MW-10 | The report's own text states manganese was detected at **only one of five wells sampled** (MW-1); MW-6/MW-8/MW-9/MW-10 were dry and not sampled at all that round | Plain narrative sentence, independent of any table-reading method |
| 8 | April 2019 GW report: Arsenic/Lead detected at MW-1/3/5/7 | The report states twice, in plain text: lead and arsenic "were not reported at concentrations equal to or greater than their...MDL for each of the samples" — every well was non-detect | Same — plain narrative, not table-dependent |
| 9 | 2024 Statistical Evaluation Report: Lead 8.3 µg/L, Arsenic 6.6 µg/L | Neither analyte has any numeric value anywhere in this document; it's groundwater-only and only carries TDS/sulfate/barium/strontium in its statistical analysis | Full-text search + page read confirmed absence |
| 10 | Same report: "sitewide mean ~210 µg/L barium," "40× below target" | No 210 µg/L figure exists in the document; the real ~40× ratio is 6,210 (site-specific target) ÷ 151 (background) = 41.1 — the old CSV's own two numbers didn't even recompute to its own stated ratio | Direct read of the cited page; simple arithmetic check |
| 11 | Same report: Stockpile 3 "concentration in place under deed restriction" | The document states Stockpile 3 **was physically removed**, material relocated onto Stockpiles 1/2; no Land Use Covenant or deed restriction is mentioned anywhere | Direct read |
| 12 | FS Report: four specific Arsenic values (0.7, 4.9, 0.2, 4.1 mg/kg), RSL of 0.39 mg/kg | None of these five numbers appear anywhere in this document | Full-text search across the entire document |
| 13 | FS Report §2.2.2: Lead fenceline values, cited "80 mg/kg CHHSL residential" | The real lead values (12 vs. 34 mg/kg) are genuine but belong to a **2012 SSI comparison in §3.2.3**, not the 2006-SI-era section cited; this document never states a numeric lead CHHSL anywhere | Section-by-section page read |
| 14 | SSI Report: fenceline/perimeter Barium "min 34 mg/kg" | No such value exists; the true combined surface-soil range is 76–4,300 mg/kg | Table read, reproduced by mechanical min/max computation |
| 15 | SSI Report: 130,000 mg/kg Barium at a "single boring, Stockpile 2/3 edge, extreme outlier" | The number is real (boring CB2-11.0) but there are **six** separate deep values ≥50,000 mg/kg across Stockpiles 2 and 3 (CB1, CB2, CB3, CB5) — not one outlier at an edge | Full table read of all Cadmium Boring rows, each re-verified a second time |
| 16 | SSI Report: Arsenic max = 14 mg/kg | **14 is a sample depth in feet**, misread from the depth column; the true max concentration in that row is 5.5 mg/kg | Careful column-header re-read of the HHRA UPDATE's COPC table |
| 17 | SSI Report: 95% UCL of 7,556 mg/kg (barium) | This figure is stated in the **HHRA UPDATE**, not the SSI Report the old CSV cited | Grep + page read across both documents |
| 18 | DEIR/EA: ADL lead survey, "CHHSL residential 80 mg/kg" | Neither "CHHSL" nor "80 mg" appears anywhere in this 382-page document | Full-text search, confirmed twice (independently, by two separate extraction passes) |

18 distinct, source-cited corrections, spanning every one of the six source
documents in this rebuild — not concentrated in one weak spot.

## 4. This rebuild also caught its own mistakes

Reliability isn't claimed by asserting the new process is infallible — it's
demonstrated by showing the QA step actually found and fixed real mistakes
made *during* this rebuild, not just in the document it replaced:

- A CSV-escaping bug (unescaped comma in a notes field) shifted several
  2020–2021 groundwater columns during transcription; caught by validating
  the raw CSV's structure in code before computing any aggregate, not by
  trusting the transcription was clean.
- The pilot's first attempt correctly extracted 5 analytes but used the
  wrong analyte *scope* — it omitted Strontium, an actual designated
  Chemical of Concern, while including three analytes that are only
  secondary/contextual parameters. This was caught by checking the source
  documents' own language ("the primary Chemicals of Concern (COC) are
  barium, lead, and strontium") rather than assuming the old CSV's analyte
  list was the right one to reproduce.
- One low-confidence transcribed cell (a manganese value at the very edge of
  a scanned table image) was explicitly flagged as low-confidence rather than
  silently accepted, once it was confirmed the value was far from any
  regulatory threshold and therefore low-stakes either way.

## 5. Independent cross-validation of the method itself

Because the source PDFs in this project have previously been run through an
LLM-assisted OCR/table-reconstruction pipeline (`marker`, with an LLM
correcting table cells) to produce `archive/pdf2md/` and `wiki/pdf2md/`, there
was a live risk that "verifying against the source" could mean verifying
against another LLM's reconstruction of the source — not the source itself.
This was checked directly: the actual `wiki/sources/` corpus that sage-wiki
indexes replaces tables with bare placeholders specifically because that
table-reconstruction step was judged unreliable (`marker-config-no-tables.json`,
`skip_table_processors: true`). Where this rebuild used LLM-reconstructed
tables at all, every one of ~15 disputed cells was independently re-checked
against the **raw PDF page images** (not the reconstruction) and matched
exactly — the well/analyte transpositions were real defects in the old CSV,
not artifacts of the checking method. Where source PDFs had genuine embedded
text layers (not scanned images), extraction was done with two independent
text-extraction methods (layout-preserving and raw reading-order) and only
accepted where both agreed on every cell.

## 6. Known limitations — not yet resolved

- Two soil-data aggregation scripts (`aggregate_soil_detections.py` and
  `aggregate_soil_detections_ssi.py`) were built in parallel against slightly
  different schemas and haven't been unified.
- A handful of individually-flagged low-confidence cells remain (see each
  document's raw CSV `notes` column) — none affect any exceedance
  determination, but they haven't been independently re-verified by a second
  person.
- This is a point-in-time snapshot, not a regression-tested pipeline — if a
  source PDF is replaced or a new document is added, the same manual
  transcribe → compute → QA-reread sequence has to be repeated; nothing here
  runs automatically on new inputs.
- Coverage is 6 of the site's source documents (the ones that materially
  determine primary contaminant detections); many other project documents
  (workplans, approval letters, cost estimates) were out of scope and were
  not touched.

## 7. How to keep trusting this data going forward

- Regenerate `combined_detections_summary.csv` via
  `analysis/scripts/combine_detections.py` after any change to a
  per-document `summary/*.csv` — never hand-edit the combined table.
- Regenerate a `summary/*.csv` via its aggregation script after any change to
  the matching `raw/*.csv` — never hand-edit a summary CSV.
- If a `raw/*.csv` needs a correction, make it by re-reading the actual
  source page again, not by "fixing" the number based on what looks right.
- Extending this to a new document should repeat all four rules in §2,
  including the QA re-read — skipping the re-read is exactly the shortcut
  that produced the original errors this rebuild fixes.
