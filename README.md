# SR132 EnviroStor Wiki

A sage-wiki knowledge base compiled from environmental remediation documents
for the Caltrans State Route 132 / Modesto Soil Stockpiles project — soil and
groundwater investigations, remedial actions, regulatory correspondence, and
monitoring reports spanning roughly 2003–2026.

sage-wiki reads raw source documents, summarizes them, extracts concepts, and
writes an interlinked set of wiki articles with provenance back to the source
material. Current state: 141 sources compiled, 157 concepts, 540 entities /
1,385 relations indexed. Check `sage-wiki status` for live numbers — this file
is a snapshot, not a dashboard.

## Layout

| Path | What it is |
|---|---|
| `raw/` | Original source documents (PDF, mostly) — the ground truth. Nothing here is generated. |
| `config.yaml` | Project config: compiler settings, ontology, source watch path (`wiki/sources`), MCP server. |
| `wiki/sources/` | Marker's PDF→markdown output, one folder per document (`<name>/<name>.md` + `_meta.json`). This is what `config.yaml` points sage-wiki at — **not** a raw PDF dump. |
| `wiki/concepts/` | Compiled wiki articles, one per extracted concept. |
| `wiki/summaries/` | Per-source summaries (the layer between raw sources and concepts). |
| `wiki/outputs/` | sage-wiki's own generated output artifacts (distinct from `analysis/`, see below). |
| `wiki/under_review/` | Flagged articles/claims pending human review before being trusted. |
| `wiki/archive/` | Retired/superseded wiki content. |
| `wiki/index.md` | Wiki home page. |
| `wiki/CHANGELOG.md` | Compilation history (auto-appended each compile run). |
| `analysis/` | Hand-verified data products built *outside* the sage-wiki compile pipeline — see below. |
| `scripts/process-pdfs.sh` | Runs new PDFs in `raw/` through `marker` OCR to produce `wiki/sources/`. |
| `scripts/sync-quartz-sources.sh` | Flattens `wiki/sources/<name>/<name>.md` into `site/content/sources/<name>.md` for Quartz. |
| `prompts/` | The actual prompt templates driving summarization/extraction/article-writing for this project. |
| `docs/` | Diagnostic reports on marker's table-OCR reliability (see **Data quality** below) — read before trusting any table pulled from `wiki/sources/`. |
| `site/` | Quartz static site generator; `site/public/` is the built site. |
| `.sage/` | sage-wiki's local engine state (SQLite index, lock file, usage ledger) — not source of truth, rebuildable. |
| `events/` | Raw compile-run event logs (JSONL). |

## Adding new documents

1. Drop the PDF into `raw/`.
2. Run it through marker OCR, **with table recognition disabled**:
   ```bash
   cd ~/hyphae/hyphae-work/sr132/envirostor-wiki
   ./scripts/process-pdfs.sh --no-tables
   ```
   This writes `wiki/sources/<name>/<name>.md`. Use `--no-tables` (not the
   plain default) — see **Data quality** for why: table recognition on this
   corpus's wide lab-result tables is unreliable enough that sage-wiki's
   configured source path is only ever populated via the `--no-tables` run,
   which renders tables as a placeholder and image regions as LLM-generated
   text descriptions instead.
3. Compile:
   ```bash
   sage-wiki compile --project .
   ```
   sage-wiki only processes new/changed files — it tracks what it's already
   compiled via `.sage/wiki.db` and the manifest. Useful flags:
   `--dry-run` (preview), `--estimate` (cost preview without compiling),
   `--watch` (auto-recompile on change), `--batch` (async, ~50% cheaper),
   `--explain <doc>` (why a doc would/wouldn't recompile).
4. Sync flattened sources for Quartz:
   ```bash
   ./scripts/sync-quartz-sources.sh
   ```
5. Rebuild the site:
   ```bash
   cd site && npx quartz build
   ```

## Querying the wiki

Two ways in, same underlying data:

- **CLI**: `sage-wiki search "<topic>"`, `sage-wiki query "<question>"`,
  `sage-wiki status`, `sage-wiki list`, `sage-wiki provenance <article>`,
  `sage-wiki ontology query <entity>`.
- **MCP (Claude Code)**: `.mcp.json` registers the `sage-wiki` MCP server
  (`sage-wiki serve --transport stdio`), exposing `wiki_search`, `wiki_read`,
  `wiki_ontology_query`, `wiki_compile_topic`, `wiki_provenance`,
  `wiki_learn`, `wiki_capture`, etc. `CLAUDE.md` documents the expected
  workflow (search before answering, capture decisions/gotchas/conventions
  after). Follow that file's guidance on when to use `wiki_learn` vs.
  `wiki_capture` vs. a direct article edit — they are not interchangeable,
  and picking the wrong one has caused real problems on this project (see
  below).

Other useful commands: `sage-wiki lint` (structural checks),
`sage-wiki verify` (grounding checks on pending outputs), `sage-wiki coverage`
(source compilation coverage), `sage-wiki doctor` (config/connectivity
validation), `sage-wiki cost` (usage-ledger cost reporting).

## Data quality — read before trusting a number

This corpus has a documented, recurring failure mode: **wide lab-result
tables (10+ wells, ~19 analyte columns) get misread by LLM-assisted
OCR/table-reconstruction and by LLMs summarizing them**, producing
plausible-looking but wrong numbers — values swapped between wells, a column
misread as a different analyte, invented regulatory limits. This has happened
at least twice independently:

1. `archive/data-quality-note.md` documents an earlier incident where the
   sage-wiki compiler itself misaligned columns in a wide table and
   fabricated a "total mercury contamination" narrative from a well ID.
2. `docs/TABLE_MISALIGNMENT_REPORT.md` quantifies the underlying risk: of 141
   PDFs processed, 93 produced markdown tables, and of those, only 37 (40%)
   were judged well-formed; 54 (58%) are wide tables prone to OCR cell-merge
   errors, and 2 are flagged critical (wide **and** inconsistent cell counts).
3. `analysis/detections-rebuild/METHODOLOGY.md` documents an unrelated,
   independently-built contaminant-detections CSV that hit the exact same
   failure mode and catalogs 18 specific, source-cited corrections.

Practical implications:

- **Don't trust a table pulled from a compiled `wiki/concepts/*.md` article,
  or from `wiki/sources/*.md`, without checking it against the actual source
  PDF** — `wiki/sources/` deliberately renders tables as placeholders for
  exactly this reason (`marker-config-no-tables.json`:
  `skip_table_processors: true`), so any table content you do see reconstructed
  elsewhere (e.g. in an older `archive/pdf2md/` corpus) went through the LLM
  table-correction path this project doesn't trust for production use.
  Compiled article quality currently averages 0.66 (`sage-wiki status`), and
  4 sources have compile errors — check `sage-wiki status` / `sage-wiki lint`
  before treating any given article as settled.
- Articles in `wiki/under_review/` are explicitly not yet trusted — don't
  cite them as fact.
- If you need a reliable contaminant-detections dataset, use
  `analysis/detections-rebuild/` (below), not a compiled wiki article — the
  compiled articles are for narrative/relational context, not a source of
  numeric ground truth.

## `analysis/` — hand-verified data products

Distinct from `wiki/outputs/` (sage-wiki's own generated output): `analysis/`
holds data products built by directly reading source PDFs (page images or
cross-checked text extraction), with all aggregation done in code rather than
by an LLM summarizing a table — the opposite failure mode from the one
described above. Currently:

- `analysis/detections-rebuild/` — a rebuilt "primary contaminant detections"
  table (barium, lead, strontium as the site's designated COCs, plus arsenic,
  manganese, and nitrate for context), replacing a fabricated prior version.
  Read `analysis/detections-rebuild/README.md` for the dataset layout and
  `analysis/detections-rebuild/METHODOLOGY.md` for the reliability case —
  worked before/after examples of what was wrong and how it was caught.
- `analysis/scripts/` — the extraction/aggregation scripts behind that
  dataset. Regenerate a summary CSV from its script rather than hand-editing
  it.

## Schema & prompts

Prompt templates live in this project's own `prompts/` directory (not the
sage-wiki repo) — `summarize-*.md` (per source-type summarization),
`extract-concepts.md` / `extract_*.md` (concept and structured-entity
extraction), `write-article.md` (per-concept article writing). Ontology
(entity and relation types) is configured in `config.yaml` under `ontology:`.

## Local preview

```bash
cd site
npx quartz build --serve
```

Opens at `localhost:8080`.
