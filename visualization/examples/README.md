# Visualization Examples

Working prototypes (React/JSX, single-file components meant to be dropped into a
Claude Artifact or similar sandbox) exploring how to present toxic air contaminant
exposure thresholds and standards for community/emergency-planning use. All are
dark-themed, monospace ("IBM Plex Mono") dashboards with searchable/filterable
tables and inline citations. None of these are wired into the main app — they're
standalone design explorations by a colleague, kept here as reference.

Values, thresholds, and citations embedded in these files are hard-coded snapshots
for prototyping and have not been independently verified — treat them as
placeholders/demo data, not an authoritative source.

## Iteration history (chart prototypes)

These three build on each other, iterating on the same core idea: plotting each
chemical's regulatory/health thresholds (OSHA PEL, NIOSH REL, ACGIH TLV, IDLH, EPA
NAAQS/ERPG, WHO/ATSDR health-based limits) as markers along a shared concentration
axis, so gaps between standards are visible at a glance.

- **`toxic-air-thresholds.jsx`** — Earliest version. A single sortable/filterable
  **table** (one row per chemical, one column per standard) rather than a spatial
  chart. Includes expandable rows with field notes and Cal/OSHA values. Good
  baseline reference for the full standards data set (23 chemicals + 3 metals).

- **`toxic-air-chart.jsx`** — First "chart" iteration. Replaces the table with a
  **horizontal marker plot**: each chemical gets a row with lanes (health-based,
  EPA/ERPG, ACGIH, NIOSH, OSHA, IDLH) plotted on a shared log or linear ppm scale.
  ERPG-1/2/3 render as diamonds sized by severity, secondary limits (STEL/ceiling)
  as open rings, primary TWAs as filled circles. Includes a separate mg/m³ section
  for particulates/metals (silica, lead, mercury). Toggle between log/linear
  scales; hover for values; click a row to expand notes.

- **`toxic-air-chart-v3.jsx`** — Appears to be a byte-for-byte duplicate of
  `toxic-air-chart.jsx` (same constants, data, and component code). Likely a
  saved checkpoint/branch point rather than a distinct newer iteration — diff
  against `toxic-air-chart.jsx` before treating it as the "latest."

## Most advanced prototype

- **`tox-reference.jsx`** — The most developed piece, and likely what "v3" was
  informally referring to even though the file literally named `-v3` is a
  duplicate. This is a full multi-page app (`ToxApp`) with tabbed navigation:
  1. **Threshold Chart** — same marker-plot concept as above, plus a duration
     filter (ceiling / 15-min STEL / 1-hr ERPG / 8-hr TWA / 24-hr / chronic) that
     dims non-matching markers.
  2. **C-t Curves** — concentration-vs-time plots of **AEGL** (Acute Exposure
     Guideline Level) data for ~13 chemicals, each with AEGL-1/2/3 curves across
     five exposure durations (10 min–8 hr), plus IDLH, TWA/STEL, and chronic
     reference lines, odor threshold notes, and source/incident context.
  3. **Reference Guide** — a standards glossary/bibliography page explaining
     each limit type (OSHA PEL, NIOSH REL, ACGIH TLV, IDLH, AEGL, ERPG, TEEL/PAC,
     EPA NAAQS/IRIS, ATSDR MRL, WHO AQG, Cal/OSHA+OEHHA) with authority, binding
     status, time basis, and citations.

  This is the file to start from if extending or productionizing the concept.

## Supporting/adjacent files

- **`hazmat-mel-table.jsx`** — Unrelated to the threshold charts: a HazMat
  **Minimum Equipment List (MEL)** pricing/procurement reference table (FIRESCOPE
  SEL / Cal OES ICS-1120 style), listing detection, PPE, respiratory, and
  decontamination equipment with vendor links, prices, and certification-tier
  requirements.

- **`la_hazard_facilities.csv`** — Sample data: LA-area facilities from EPA's Risk
  Management Program (RMP) database, with worst-case release distances for toxic
  and flammable scenarios. Flagged in its own `verification` column as needing
  confirmation against ALOHA/RMP*Comp before publication — treat as draft data
  only.
