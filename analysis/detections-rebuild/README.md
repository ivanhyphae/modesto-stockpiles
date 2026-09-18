# Contaminant detections rebuild

Rebuild of a reliable "primary contaminant detections" table, replacing
`archive/outputs/health_risk_test_results.csv`, which was found to contain
fabricated values and well/analyte transpositions traced to LLM-summarized reads
of wide lab-result tables — the same failure mode documented in
`archive/data-quality-note.md` for an earlier contaminants primer.

## Analyte set: 3 designated COCs + 3 contextual parameters

This dataset covers six analytes, and they are not all the same kind of thing:

- **Designated Chemicals of Concern (COCs): Barium, Lead, Strontium.** Source
  documentation for this site states the "primary Chemicals of Concern (COC) are
  barium, lead, and strontium" — these three are the formally designated COCs for
  the site.
- **Additional contextual parameters: Arsenic, Manganese, Nitrate.** These three
  are not designated COCs. They are tracked in the site's HHRA as broader
  Chemicals of Potential Concern (COPCs) / secondary-standard exceedances (e.g.
  manganese against its Secondary MCL, nitrate against its health-based MCL) and
  are kept in this dataset because they provide useful additional context on
  groundwater conditions at the site — not because they carry COC status. Do not
  treat exceedances of these three as COC exceedances; they are exceedances of a
  different, non-COC standard (secondary MCL, notification level, etc.) unless a
  cited source says otherwise.

A reader who only cares about the site's actual designated COCs should look at the
barium, lead, and strontium columns/rows; the arsenic, manganese, and nitrate
columns/rows are included for context and should be labeled as such wherever this
data is summarized elsewhere.

## Sample role: not every transcribed row belongs in a distribution

*Added 2026-09-18, from a colleague's review of the dashboard's distribution
overlay. Assessment below was checked against the source documents; where the
check disagreed with the review, that is stated.*

The analyte-set section above says the six analytes are not all the same kind of
thing. The same is true of the **samples**. Every row in `raw/` is a faithful
transcription, but they were collected to answer different questions, and mixing
them into one distribution answers none of them:

- **Site samples** — characterise the contaminated material. These belong in a
  distribution of site conditions.
- **Control / background samples** — deliberately collected *away from* the
  contamination to establish what the local baseline is. Plotting them alongside
  site results makes the site look cleaner than it is and makes the background
  look contaminated. Surface water `BG1`, `BG2`, `BG3`, `BG-West` are these.
- **Clean-fill suitability samples** — test whether some *other* material is
  clean enough to be imported as cap. A low result here is a property of the
  candidate fill, not of the stockpiles.
- **Post-excavation confirmation resamples** — measure material that replaced
  what was removed. Including them alongside the pre-excavation results
  double-counts the same location and drags the distribution down. The RACR
  carries 14 such rows (7 barium + 7 lead), flagged `is_resample=yes`, one for
  each location that exceeded the removal threshold.

**Current state, checked 2026-09-18.** Background samples are already handled:
`build_percent_of_benchmark.py` skips `is_background`, and
`build_sample_points.py` additionally drops any stormwater `sample_id` starting
`BG`, so no `BG1/BG2/BG3/BG-West` result reaches either the maxima or the
distributions. **Resamples are not handled** — `build_sample_points.py` does not
read `is_resample`, so all 14 confirmation resamples are currently plotted as if
they were independent site results. That is a live defect regardless of how the
document-level question below is settled.

**A distribution must state which of these it contains.** A maximum can be drawn
from a wider set than a distribution, but then the two are not describing the
same population and the chart has to say so.

### Soil documents: which to use

| # | File | Use? | Why |
|---|---|---|---|
| 1 | `S9800-01-17 ... Final FS Report.0614.raw.csv` | **omit** | Narrative restatement of earlier investigations; contains no primary data table of its own |
| 2 | `S9525-06-44 Modesto Stockpiles SSI Report Rev.0313.raw.csv` | **use** | The 2012 per-boring/per-depth primary data |
| 3 | `S9525-06-44 HHRA UPDATE Rev.0313.raw.csv` | **omit** | Narrative, plus an Appendix B Shaw report carrying only summary tabular data |
| 4 | `S1908-01-01 Interim RACR_12.22.soil.raw.csv` | **partly** | Four tables, different purposes — see below |

**Confirmed.** Files 1 and 3 hold no primary per-sample soil data. This matches
what the Status section below already records for file 1 ("contains **no raw
boring-level data table**; every soil concentration in it is a narrative summary
statistic"). Their values are real and correctly transcribed, but they are
*reported statistics* (MDC / 95% UCL / EPC / range) restating investigations
whose sample-level tables are not in the corpus. They can support a cited
maximum; they cannot contribute points to a distribution.

**RACR (file 4), table by table** — page assignments verified against
`source_page` in the raw CSV:

| Page | Table | n (Ba) | Max Ba | Purpose per the RACR's own text | Review says |
|---|---|---|---|---|---|
| 40–41 | BCS Removal Verification (Stk 3; Stk 2 E/W) | 53 | 7,000 | Verification that contaminated material was removed; contains all seven >1,000 mg/kg exceedances | **use** |
| 60 | Stockpile 1 MSE Wall Footing | 15 | 420 | "sampled ... to determine if the excavated soil was suitable for clean capping material" (§3.5.3) | **omit** |
| 214 | Stockpile 2 MSE Wall Footing | 29 | 930 | same evaluation, Stockpile 2 side (§3.5.3; Appendix A clean-fill source memo) | **use** |
| 305 | Carpenter Road Shoofly | 8 | 96 | "clean fill characterization testing" on ~5,000 yd³ of native soil excavated *elsewhere*, for import as cap | **omit** |

**Confirmed: pages 40–41 in, page 305 out.** The shoofly material is not
stockpile soil at all — it is a separate borrow source being qualified for
import, and its eight results are **3-part composites**, not discrete samples,
so they could not go into a discrete-sample distribution even if the location
were right.

**Resolved 2026-09-18: both MSE footing tables are in.** The question above was
settled by asking *where the footings are*, rather than what the test was for.
§3.5.3 — titled "**BCS** Stockpiles 1 and 2 MSE Wall Soil Removal/Placement" —
puts them inside the stockpile footprint: "The southerly slopes of BCS
Stockpiles 1 and 2 were excavated (steepened) in March and April 2020 to
facilitate clean construction of the MSE walls", and the footing soil was
sampled in those excavations after the slope BCS was scraped off.

So this is not imported candidate fill, it is **soil from within the historic
stockpiles**, and the RACR confirms how it was ultimately classified: "Based on
the elevated barium concentrations, all of the excavated MSE wall footing
material was placed in the Stockpile 1 and 2 BCS Containment Zones." It failed
the clean-fill test and went back into containment as contaminated material.

The depth profiles corroborate it — contamination at the surface, attenuating
to background with depth, exactly as §3.5.3 describes ("generally to a depth of
3 feet"):

| Depth | Stk 1 footing (p.60) median / max | Stk 2 footing (p.214) median / max |
|---|---|---|
| 0 ft | 240 / 420 | 290 / 930 |
| 1 ft | 120 / 140 | 87 / 580 |
| 2 ft | 97 / 130 | 96 / 320 |
| 3–4 ft | 71–120 / 130 | 65–82 / 140 |

against a maximum site-specific background of 120 mg/kg.

**The operative distinction is provenance, not purpose.** A sample belongs to
the site dataset if the *material* came from the stockpiles, whatever question
the sampling was meant to answer. That keeps pages 40–41, 60 and 214, and still
excludes page 305: the shoofly is a different location entirely (Carpenter Road),
and its material *passed* the clean-cap criteria and was approved by DTSC for
import. Under this rule the RACR contributes 90 discrete samples (excluding the
14 confirmation resamples), barium max 7,000 mg/kg, lead max 53 mg/kg.

**Bent 2 checked, and it stays out.** A *bent* is the bridge-engineering term
for an intermediate substructure support — the columns and cap holding up a
span, numbered along the structure — so "Bent 2" is a foundation excavation for
the SR 132 overcrossing, not a place. Its memo puts it "just westerly of State
Route 99" and describes the material as "approximately 4,000 cubic yards of
**native soil**". That is a borrow source like the shoofly, not stockpile
material, so the provenance rule excludes it.

Two things make it confusing at first glance, and neither changes the answer:
the excavated soil was *placed* in end-dump rows on top of Stockpile 2, which is
where the samples were taken and where the photos show it; and unlike the other
candidate sources it **failed** the clean-cap criterion (barium 31–230 mg/kg
against the 120 mg/kg background), so the RACR notes that "with the exception of
the Bent 2 excavation stockpiles, each of the identified clean fill source areas
was approved by DTSC". Failing that test does not make it site material — it was
native soil that came back dirtier than expected, possibly because the piles sat
on Stockpile 2 and on a berm built from MSE footing spoil while awaiting
testing.

The original analysis follows, kept because it records why the split looked
arbitrary before the location question was asked.

**Not confirmed on the data alone: the page 60 / page 214 split.** Both tables are the *same
test* — MSE wall footing excavations along the southern boundaries of Stockpiles
1 and 2, sampled at one-foot intervals to determine suitability as clean cover
fill (RACR §3.5.3 and the Appendix A clean-fill source memo). Their data is also alike: medians 97 and
110 mg/kg, maxima 420 and 930 mg/kg, and **neither table contains a single
result above the 1,000 mg/kg removal threshold**. And the RACR states the
outcome for both together: "Based on the elevated barium concentrations, all of
the excavated MSE wall footing material was placed in the Stockpile 1 and 2 BCS
Containment Zones" (§3.5.3). So the ground for separating them is not in the
documents — whichever rule is chosen should apply to both:

- If the rule is *"exclude clean-fill suitability testing"*, both go.
- If the rule is *"include material that ended up classified as BCS"*, both stay
  — and then page 305 still goes, since that material was approved as clean cap.

That decision has since been made — see the resolution above; both are in.

**Also not extracted:** a fifth RACR table, Bent 2 excavation end-dump piles
(10 discrete samples, barium 31–230 mg/kg). It is another clean-fill suitability
test, so it stays out under either rule — but it is absent from `raw/` by
oversight rather than by decision, and the Status section's "four distinct
tables" should be read with that in mind.

### Impact on the dashboard if this is applied

`visualization/coc-percent-of-benchmark.html` and
`../scripts/build_percent_of_benchmark.py` currently draw soil maxima from all
four files. Restricting to files 2 and 4 (the RACR tables kept either way):

| Soil bar | Now | Source now | Would become | Source then |
|---|---|---|---|---|
| Barium | 130,000 mg/kg | SSI (file 2) | **unchanged** | SSI |
| Strontium | 270 mg/kg | SSI (file 2) | **unchanged** | SSI |
| Arsenic | 5.5 mg/kg | HHRA Appx B (file 3) | **2.1 mg/kg** | SSI |
| Lead | 1,500 mg/kg | FS Report (file 1) | **53 mg/kg** | RACR pp. 40–41 |

Two consequences worth deciding on deliberately:

1. **Lead in soil stops being an exceedance.** 1,875% of the residential CHHSL
   becomes 66%, and 53 mg/kg is below the 80 mg/kg removal threshold too. Its
   narrative panel ("two samples out of 278") would be removed along with the
   value it explains, dropping the chart from eight exceedances to seven.
2. **Arsenic in soil falls from 7,857% to 3,000%** of its residential CHHSL —
   still an exceedance, and still explained by the CHHSL sitting below natural
   background.

Both changes *narrow* what the chart claims, and both remove the two bars whose
`covers_max` flag already warned that no sample-level data stood behind them.
That is a consistency argument for the change: those were exactly the two bars
where the distribution overlay could not reach the peak.

### Open question on the groundwater side

The review covers soil. The same principle has an unresolved case in
groundwater: `raw/06A2542ct_TO97_GW Rpt_final.20230308.raw.csv` has **no
upgradient/background column at all**, so every well is treated as a site well.
But the 2024 statistical evaluation treats MW-6 and MW-10 as *upgradient*, and
concludes that elevated constituents in **MW-5, MW-6 and MW-10** "did not
originate from the Caltrans soil stockpiles" (§2, conclusion 3). The chart's
nitrate bar — the largest health-based exceedance on it, 400% of the MCL — is
MW-5. Whether upgradient wells are controls for this purpose is a judgement
call, but the raw file should carry the gradient designation either way so the
choice can be made in code rather than being unavailable.

## The 2004 PSI, acquired 2026-09-18 — and what it overturns

`raw/6-1-04 Heavy Metal PSI.pdf`, OCR'd to
`wiki/sources/6-1-04 Heavy Metal PSI/`. This is Shaw's *Heavy Metal
Contamination Preliminary Site Investigation Report* (June 1, 2004), the primary
source every later document restates when it says "the 2004 PSI". It was
acquired specifically to settle the contradictions the aggregation audit found.
It settles them, and it overturns a claim repeated across five documents.

**The PSI never analysed cadmium or lead.** Confirmed three independent ways:
the Task Order scope in the Executive Summary; §2.3 Laboratory Analyses
("analysis for total concentrations of arsenic, barium, chromium, iron, and
strontium", plus PAHs/nitrate/pH on selected samples); and the column headers on
the results tables themselves. The string "cadmium" appears **zero times** in the
report, and "lead" once, in a bibliography entry about a different site.

This matters because the FS Report, SSI Report, RAP, FEIR and DEIR all state
that "the Shaw 2004 PSI identified elevated cadmium concentrations (exceeding
the industrial CHHSL for cadmium of 7.5 mg/kg) for eleven soil samples ... with
corresponding elevated barium concentrations (25,800 to 196,000 mg/kg)."
**Neither half of that sentence is supported by the PSI.** Cadmium was not an
analyte, and neither 25,800 nor 196,000 appears anywhere in the report. The
later documents' conclusion that the 2004 cadmium data was unreliable was
therefore generous: by the PSI's own scope there was no 2004 cadmium data.

One coincidence, offered as a hypothesis and nothing more: the PSI reports
arsenic detected in exactly **11 samples** of 244. The downstream documents
attribute elevated cadmium to exactly **eleven samples**. An analyte confusion
propagated forward would explain both the phantom cadmium and its
irreproducibility, but nothing in the record proves it.

**The disputed maxima, resolved against the primary tables:**

| Question | Answer from the PSI |
|---|---|
| Stockpile 2 max barium — FS §2.2.1 says 60,700; FS §2.2.3 and FEIR imply 196,000 | **60,700 mg/kg** at SR132-35-4.5. FS §2.2.1 is correct; 196,000 does not exist |
| Stockpile 3 max barium — FS §2.2.1 says 44,900; FEIR says 126,000 | **44,900 mg/kg** at SR132-21-3.0. FS §2.2.1 correct; FEIR wrong |
| Stockpile 1 max barium | mean 154 mg/kg; no sample near the TTLC |
| Max arsenic | **57 mg/kg** at SR132-50-0.15 (soluble 5.8 mg/L, over the 5 mg/L STLC) |

So **FS §2.2.1 is the reliable restatement of the 2004 PSI, and §2.2.3 is not** —
which is what the `EXCLUDE_FROM_MAX` entry in
`../scripts/build_percent_of_benchmark.py` already assumed on internal evidence.
The exclusion stands, now on primary-source grounds rather than inference.

**Partial transcription: `raw/6-1-04 Heavy Metal PSI.hotspots.raw.csv`** (95
rows). Scoped to hot spots and summary statistics, not the full 244-sample
grid: every Stockpile 2 sample with barium ≥1,000 mg/kg, every arsenic
detection, both Stockpile 3 hot spots, the Stockpile 2 summary block, and the
regulatory reference values. Depth is recorded in **metres** as the sample ID
uses it (0.15/1.5/3.0/4.5/6.0 m = 0.5/5/10/15/20 ft) — a trap for anyone reading
`SR132-35-4.5` as 4.5 feet.

**Verification.** The eight Stockpile 2 samples transcribed as exceeding the
10,000 mg/kg TTLC are exactly the eight the narrative counts ("Eight soil
samples had total barium concentrations greater than the TTLC"), and the
transcribed arsenic maximum and soluble-arsenic value match §4.4.2 exactly. As
with the RACR, the source encodes meaning in **highlighting** — bold for results
exceeding ten-times the STLC, yellow fill for soluble barium over the STLC or
TCLP — which no text extraction captures; the `notes` column records it.

### Strontium: the FS is the wrong one here

Tables 2 and 4 have since been read, and the strontium contradiction is
resolved — **in the opposite direction to barium**:

**765 mg/kg is correct.** It is SR132-28-3.0 (Stockpile 2, 3.0 m / 10 ft), the
same sample as the 58,200 mg/kg barium result. The SSI Report and HHRA Update
are right; **the FS Report's 231 mg/kg is wrong**. 231 is real, but it is only
the *Stockpile 1* maximum (SR132-09-6.0, a native-soil sample) — the FS
promotes a per-stockpile figure to a site-wide one.

Strontium tracks barium closely, which is what the site's history predicts: the
FMC plant processed barite (barium sulfate) *and* celestite (strontium
sulfate). The five highest strontium results are all hot-spot samples:

| Sample | Strontium | Barium in the same sample |
|---|---|---|
| SR132-28-3.0 (Stk 2) | **765** | 58,200 |
| SR132-35-4.5 (Stk 2) | 726 | 60,700 |
| SR132-37-3.0 (Stk 2) | 665 | 57,700 |
| SR132-39-1.5 (Stk 2) | 547 | 57,800 |
| SR132-17-4.5 (Stk 3) | 397 | 44,300 |

**So neither restating document is uniformly reliable.** FS §2.2.1 is right
about barium and wrong about strontium; the SSI/HHRA are right about strontium.
Any value taken from a narrative restatement needs checking against the PSI
individually — the document-level judgement in the table above governs which
*tables* to use, not which *sentences* to believe.

**Stockpile maxima and summary statistics, all now from the primary tables:**

| | Stk 1 | Stk 2 | Stk 3 |
|---|---|---|---|
| Max total barium | 1,730 | **60,700** | 44,900 |
| Mean barium | 154 | 3,607 | 1,954 |
| 95% UCL barium | 194 | 5,474 | 4,041 |
| Max strontium | 231 | **765** | 397 |
| Mean strontium | 58.4 | 79.6 | 51 |

**Second verification.** The 11 arsenic detections transcribed across all three
tables are exactly the 11 the narrative counts, spanning exactly its stated
8.8–57 mg/kg range — an independent check on Tables 2 and 4 equivalent to the
eight-over-TTLC check on Table 3.

**Still not transcribed:** the ~190 samples that are neither hot spots nor
detections. Those are needed only if the PSI is ever to contribute
*distribution* points rather than maxima; the maxima, means and 95% UCLs are now
all primary-sourced.

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

## Combined table

`combined_detections_summary.csv` (in this directory) unions all six
per-document `summary/*.csv` files into one long-format table — one row per
(location or well, analyte, value_type), spanning both groundwater and soil.
It does not recompute anything; it only reshapes and unions values that were
already computed in each per-document summary. Generated by
`../scripts/combine_detections.py`; regenerate it any time a per-document
summary CSV changes.

Long format was used deliberately rather than one wide row per location,
because different documents report different analyte sets and different
kinds of value (a raw detection min/max vs. a consultant's own reported MDC,
95% UCL, EPC, or background statistic) — forcing that into a wide table would
either be very sparse or silently blend incompatible kinds of number. The
`value_type` and `status` columns tell you what kind of number each row is and
how well-supported it is; five rows are explicitly `status=UNSUPPORTED /
FABRICATED` — kept in the table on purpose, as a record of what the old CSV
claimed that doesn't actually exist in the cited source, rather than being
silently dropped.

## Layout

Two data shapes exist, because groundwater and soil results are reported very
differently in the source documents (well/date grid vs. per-boring/per-depth
narrative and tables):

- `raw/<document>.raw.csv` — cell-by-cell transcription. **Groundwater documents**
  are wide, one row per (well, date), duplicates and non-samples flagged.
  **Soil documents** are long, one row per (location/boring, depth, analyte,
  value_type), since different soil tables report different analyte sets and
  much of the soil data is the consultant's own reported statistic (MDC, 95%
  UCL, EPC) rather than a raw per-sample grid — those rows are tagged by
  `value_type` rather than mixed in with raw detections.
- `summary/<document>.summary.csv` — computed min/max, dates, sample counts,
  regulatory limit, limit type, and exceedance ratio per (well or location,
  analyte), generated from the matching `raw/` file. For soil documents this
  also lists the source's own reported summary statistics as-is (not
  recomputed) alongside the raw-detection min/max.
- `../scripts/aggregate_detections.py` — groundwater aggregation (well/date grid,
  µg/L and mg/L nitrate).
- `../scripts/aggregate_soil_detections.py` and `aggregate_soil_detections_ssi.py`
  — two soil aggregation scripts with slightly different raw-CSV schemas (the
  first was written against the FS Report's range/statistic-only data, the
  second against the SSI Report/HHRA UPDATE's per-boring/per-depth data, and
  they were built in parallel without being reconciled into one schema). Treat
  this as a known follow-up: before adding a fourth soil document, unify these
  into one script/schema rather than writing a third variant.

## Status

**Groundwater — piloted on the one document that matters most:**
`06A2542ct_TO97_GW Rpt_final.20230308.pdf` (2023 consolidated groundwater
monitoring report) contains the **full well-by-well historical record from
2006–2023** for all 10 wells, which subsumes everything originally reported in
the individual monthly/annual event PDFs (May 2012, July 2012, Sept 2012, Nov
2012, March 2013, April 2017, April 2019 groundwater reports) — those
individual reports were deliberately **not** separately re-extracted, since
doing so would just duplicate detections already captured here. All 6 analytes
(barium, lead, strontium, arsenic, manganese, nitrate) are covered. Findings
were cross-checked against hand-read PDF page images and held up exactly,
overturning two of the old CSV's specific errors (manganese's true peak was
MW-8/410 µg/L in 2018 — absent from the old CSV entirely — and lead never
approaches its reference value in this well set at all). The strontium column
was cross-checked with two independent text-extraction passes plus a direct
visual page re-read for the one ambiguous cell (the Table 3 MCL/reference row),
which matched exactly.

**Soil — 4 documents covered:**
- `S9800-01-17 Modesto Soil Stockpiles Final FS Report.0614.pdf` — contains
  **no raw boring-level data table**; every soil concentration in it is a
  narrative summary statistic (MDC/95%UCL/EPC/range) computed by the
  underlying Shaw/Geocon investigations. None of the old CSV's four fabricated
  arsenic values, nor its invented 80 mg/kg lead CHHSL limit, recur — this
  document states no numeric arsenic or lead limit at all.
- `S9525-06-44 Modesto Stockpiles SSI Report Rev.0313.pdf` and
  `S9525-06-44 HHRA UPDATE Rev.0313.pdf` — the actual per-boring 2012 data.
  Confirmed the old CSV's fenceline/perimeter barium "min 34 mg/kg" doesn't
  exist (true range is 76–4,300 mg/kg), confirmed all **six** Cadmium Boring
  deep barium values ≥50,000 mg/kg (58,000 up to 130,000 mg/kg, across
  Stockpiles 2 and 3 — not a single "edge outlier" as the old CSV implied),
  confirmed the true max arsenic concentration is 5.5 mg/kg (the old CSV's "14"
  was a misread depth-in-feet column, not a concentration), and confirmed the
  95% UCL of 7,556 mg/kg for barium is stated in the HHRA UPDATE, not the SSI
  Report the old CSV cited.
- `SR_132_DEIR_EA.pdf` — confirmed the ADL lead survey range (3.0–100 mg/kg)
  and reconfirmed the old CSV's "CHHSL residential 80 mg/kg" limit for this
  document is unsupported (neither "CHHSL" nor "80 mg" appears anywhere in the
  source).

**Soil — the 2019–2022 construction-phase data (RACR, the latest on file):**

`S1908-01-01 Caltrans Modesto Stockpile Interim RACR_12.22 (1).pdf`, dated
December 1, 2022 and **accepted as final by DTSC on January 18, 2023** — despite
"Interim" in the title there is no separate Final RACR; Phase 2 build-out and
its RACR are 8–10 years out. This is the newest soil data in the document set:
nothing after December 2022 contains soil results (the 2023 GW report, 2024
statistical evaluation, 2024–2026 stormwater reports, 2025 well destruction
report and annual inspections are all other media). Scripts:
`../scripts/extract_racr_soil_tables.py` and
`../scripts/aggregate_racr_soil_detections.py`.

**Scope caution: these tables report barium and lead only.** They are
construction verification sampling, not characterisation — for the full
multi-metal picture the 2013 SSI Report / HHRA UPDATE remain the comprehensive
source. Four distinct tables were extracted (105 samples, 210 detections):

| Pages | Table | Samples |
|---|---|---|
| 40–41 | BCS Removal Verification (Stockpile 3, Stockpile 2 W/E) | 53 |
| 60 | Stockpile 1 MSE Wall Footing | 15 |
| 214 | Stockpile 2 MSE Wall Footing | 29 |
| 305 | Carpenter Road Shoofly | 8 |

Appendix copies at pp. 72 and 132 reproduce the BCS-removal data and p. 186 is
byte-identical to p. 60; these are deliberately **not** extracted, to avoid
double-counting the same samples.

**Verification.** Three independent signals agree exactly:

1. The 106 BCS-removal cells on pp. 40–41 match the appendix copies at
   pp. 72/132 **cell-for-cell with zero mismatches** — an end-to-end check
   equivalent to the surface-water cross-document check.
2. The seven samples computed as over the 1,000 mg/kg barium threshold are
   *exactly* the seven whose COMMENTS column reads "Area Excavated", and each
   has exactly one "A"-suffixed confirmation resample — an internal consistency
   check across three separate table features.
3. The highest-value rows were re-read as page images. Worth knowing: the PDF
   **highlights exceedances in yellow**, a visual encoding that neither
   `pdftotext` nor marker captures at all. The computed threshold comparison
   reproduces the highlighting independently, but any text-only read of these
   tables loses the source's own exceedance marking.

**What the data shows.** Seven barium results exceeded the 1,000 mg/kg BCS
removal verification threshold — S3 9-0 at 7,000, S3 10-0 at 5,100, S2E 8-0 at
4,100, S2W 1-0 at 3,200, S3 11-0 at 2,200, S2E 3-0 at 1,400, S2W 3-0 at 1,100.
Every one triggered excavation, and every post-excavation resample came back far
below threshold (63–570 mg/kg). **Lead never exceeded its threshold anywhere in
this dataset** — the maximum lead result across all 105 samples is 53 mg/kg
against an 80 mg/kg threshold.

**On the two reference values, which are not interchangeable:**

- *BCS removal verification threshold* — barium 1,000 / lead 80 mg/kg. The
  action level; stated in the RACR's own tables (pp. 41, 60, 214).
- *Maximum site-specific background* — barium 120 / lead 3.8 mg/kg. A
  characterisation reference, **not** an action level. Most samples sit above
  the barium background and that is expected here; do not report "above
  background" as a compliance failure.

Note on the number 80: the lead **80 mg/kg** in these tables is the BCS Removal
Verification Threshold, *not* a CHHSL. The old fabricated CSV attributed an "80
mg/kg lead CHHSL" to the FS Report and DEIR/EA, where no such value appears
(see the soil entries above). This is the real 80 in the record — a different
document, and a different meaning.

**Groundwater statistics rollup:**
- `S2350-01-02 Updated Statistical Evaluation Report_2.24.pdf` — confirmed
  real figures (FMC background 151 µg/L, SSTL 6,210 µg/L barium /
  61,900 µg/L strontium, ~40x ratio based on background-vs-SSTL) and confirmed
  this document is groundwater-only with no soil table. Reconfirmed the old
  CSV's Lead 8.3 µg/L, Arsenic 6.6 µg/L, "210 µg/L mean," soil barium/CHHSL
  rows, and "Land Use Covenant" claim are all fabricated/unsupported — the
  document instead states Stockpile 3 was physically removed with material
  relocated onto Stockpiles 1 and 2, not capped in place under a deed
  restriction.

**Surface water / stormwater — 2 documents, covering the whole record
2013–2026:**

Same consolidating trick as the groundwater pilot. Two documents each carry a
*historical* table that subsumes the individual event letters, so the ~11
separate event reports were deliberately **not** re-extracted:

- `06A2542ct_to97_SurfaceWaterLetter_final.20230328.pdf` — **Table 4**
  (pp. 19–22, historical Title 22 dissolved metals, 23 analytes) and **Table 5**
  (pp. 23–26, historical general minerals, 9 analytes). Covers locations
  PL1–PL7, BG1–BG3 across 19 sampling dates, 4/4/2013 → 3/10/2023.
- `S2350-01-02_2.17.2026 Stormwater Sampling Report_5.26.pdf` — **Table 2**
  (p. 10, metals, reduced 18-analyte list) and **Table 1** (p. 9, TDS and
  sulfate). Covers SW-East/SW-West/BG-West across 5 dates, 3/10/2023 →
  2/17/2026. This table is itself cumulative, so it subsumes the 2024 and 2025
  reports.

Scripts: `../scripts/extract_stormwater_tables.py` (transcription) and
`../scripts/aggregate_stormwater_detections.py` (aggregation).

**Why positional extraction was required here.** These tables float J-flag
qualifiers and wrapped values onto adjacent text lines, so a `pdftotext -layout`
whitespace split silently shifts values between analyte columns — precisely the
transposition failure mode this rebuild exists to prevent. The extractor bins
words into columns by x-coordinate from `pdftotext -bbox-layout` instead.
Three real defects were caught and fixed this way, each of which would have
corrupted values had the transcription been eyeballed:

1. The CVRWQCB split sample (a duplicate submitted by the Regional Board to
   Excelchem, 12/12/2014) wraps its label across three text lines, so
   id-anchored rows swallowed its values into PL5's row. Rows are now anchored
   on the date column and the split sample is kept as its own row (`RWQCB`).
2. The `Sample ID` column heading bled into the first data row of each page.
3. The `MCLs` row sits directly below the last sample row, and its superscript
   secondary-MCL markers were being appended to that sample's values — zinc
   `20` became `201` for BG-West on 2/17/2026.

**Verification.** The 3/10/2023 event appears in *both* documents under
different location names (Stantec's PL6/PL7/BG3 = Geocon's
SW-East/SW-West/BG-West, per the latter's own footnote). All **54 overlapping
cells match exactly** across the two independently prepared documents — an
end-to-end check on column mapping and transcription. Column order in each
table was separately confirmed against that table's own `MCLs` row, whose
values match the published California MCLs analyte-for-analyte (antimony 6.0,
arsenic 10, barium 1,000, lead 15, thallium 2.0, …), and the highest-value rows
were re-read as page images per the QA step above.

**What the computed exceedances show.** Seven primary-MCL and six
secondary-MCL exceedances across the whole 2013–2026 surface-water record.
Three points matter for interpretation and are easy to get wrong:

- **Two barium exceedances on 3/17/2020 — PL1 at 1,600 µg/L and BG2 at
  1,700 µg/L against a 1,000 µg/L MCL — appear in no narrative summary in the
  document set.** Stantec's tables don't bold exceedances (Geocon's later ones
  do), and no event report for March 2020 is in the corpus; the data survives
  only inside Table 4. Note the shape: on that same day PL3/PL4/PL5/BG1 read
  85–160 µg/L, and the **background** station BG2 was the highest of all. BG2
  also spiked for antimony (10 µg/L) and copper (52 µg/L). A stockpile release
  cannot raise the background station above the runoff stations, so this reads
  as a localized sampling/turbidity artifact at two stations, not a site-wide
  release — the same interpretive pattern as the December 2023 thallium event.
- The December 2023 thallium exceedance (SW-East 18, SW-West 15, BG-West
  17 µg/L) likewise includes the background station, and all three sit at or
  just above the 15 µg/L laboratory reporting limit against a 2.0 µg/L MCL.
- **Manganese exceedances are of a *secondary* (taste/odour/welfare-based)
  MCL, not a health-based one**, and manganese is not a designated COC for this
  site. Two of the six occur at background stations. Do not report these as COC
  exceedances — the same caution the analyte-set section above gives for
  arsenic, manganese and nitrate.

Also recorded by the aggregation: analyte/event combinations where the
laboratory **reporting limit for a non-detect sits above the MCL**, so
compliance cannot be assessed at all (antimony in the March 2023 round is the
clearest case, MDL 8.8 µg/L against a 6.0 µg/L MCL). These carry
`nondetect_rl_above_limit=yes` rather than a misleading "no exceedance".

**Known gaps on the surface-water side:**
- **Pre-2013 data is not in any table.** The March 2006 Shaw event
  (SW01–SW07), including the often-cited **2,000 µg/L barium at SW03** on the
  northwestern side of Stockpile 3, survives only as narrative prose repeated in
  each later report. Table 4 begins 4/4/2013. That 2,000 µg/L figure is
  therefore *not* in this dataset and has not been transcribed from a primary
  table.
- The 2024–2026 reports disagree with themselves on one date: Table 1 dates the
  2025 event 2/4/2025, Table 2 dates it 2/5/2025. Transcribed as printed.
- Several rounds were inspection-only with no samples collected (no qualifying
  rain event); those are carried as `row_annotation` values ("No Sample - Dry",
  "Removed From Network", `***` = dry conditions) and excluded from all counts
  rather than silently dropped.

**Provenance in the raw files.** Every `raw/*.csv` row carries both
`source_document` (the PDF filename) and `source_page`, so any cell can be
traced back to the exact page it was transcribed from without consulting this
README. Soil rows additionally carry `source_table`.

**Not yet reconciled:** the soil-side outputs now use *three* raw-CSV schemas —
the two pre-existing ones (see Layout above) plus the RACR's long format, which
is the cleanest of them and the best candidate to standardise on. They still
haven't been merged into one cross-document soil summary table the way the
groundwater side has a single script; before adding a fifth soil document,
unify these rather than writing a fourth variant. The groundwater, soil and
surface-water summary CSVs are unioned by `combine_detections.py` into
`combined_detections_summary.csv` (153 groundwater / 196 soil / 518
surface-water rows), but each document's `summary/*.csv` still stands alone as
the per-document record.
