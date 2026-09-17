#!/usr/bin/env python3
"""Build the chart dataset for "max detection as a percent of its benchmark".

Reads analysis/detections-rebuild/combined_detections_summary.csv and emits
analysis/detections-rebuild/percent_of_benchmark.json -- one record per
(analyte, medium) giving the maximum detected concentration, the benchmark it
is being compared against, and the resulting percentage.

Nothing here is asserted by hand: every maximum is selected from the verified
combined summary table, and every percentage is computed. The benchmarks are
transcribed from the limit columns of that same table (water) or from the
SSI/FS report soil screening levels carried in its regulatory_limit column
(soil), and are listed explicitly below so they can be audited in one place.

Important caveat, encoded in `benchmark_is_mcl`:
    An MCL is a *drinking-water* standard (ug/L). Soil results are mg/kg and
    have no MCL -- there is no such thing as "percent of the MCL" for soil.
    Soil bars are therefore plotted against the CHHSL (residential) screening
    level, a different kind of benchmark, and are flagged as such. Two of the
    six water benchmarks are also not MCLs (lead's action level, strontium's
    health advisory) and one is a secondary (aesthetic) MCL.
"""

import csv
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "analysis" / "detections-rebuild" / "combined_detections_summary.csv"
OUT = ROOT / "analysis" / "detections-rebuild" / "percent_of_benchmark.json"

# Designated COCs first, then the contextual (non-COC) parameters. README.md in
# detections-rebuild/ explains why these are not the same kind of thing.
ANALYTES = {
    "barium": ("Barium", "coc"),
    "lead": ("Lead", "coc"),
    "strontium": ("Strontium", "coc"),
    "arsenic": ("Arsenic", "context"),
    "manganese": ("Manganese", "context"),
    "nitrate_as_n": ("Nitrate (as N)", "context"),
}

MEDIA = {
    "soil": "Soil",
    "groundwater": "Groundwater",
    "surface_water": "Stormwater",
}

# value_type prefixes that denote an observed maximum. "MDC" is the reports' own
# abbreviation for maximum detected concentration (FS Report acronym list,
# printed p.iv: "MDC  maximum detected concentration") -- a real measurement,
# not a derived statistic, and it is sometimes the only place a study's maximum
# is recorded. Leaving it out understated arsenic in soil by more than half.
OBSERVED_MAX_TYPES = ("max_detected", "MDC")

# Narrative for every (analyte, medium) pair that exceeds its benchmark.
#
# Each entry is sourced from the compiled reports in wiki/sources/ and cites
# them. "short" is the one-line hover summary; why / meaning / action are the
# fuller read. Where a statement is an inference drawn from two documented facts
# rather than a conclusion a report states itself, it is marked INFERENCE in the
# text -- no source is put behind a claim it does not make.
NARRATIVES = {
    ("barium", "soil"): {
        "short": "Barite (barium sulfate) residue from the former FMC plant — the site's primary contaminant, and largely insoluble.",
        "why": "The stockpiles are residue from the FMC/Barium Products plant, which processed barite (barium sulfate) and celestite. Barium is the site's primary chemical of potential concern. The highest values sit deep within Stockpiles 2 and 3; surface soil is far lower — the 2012 SSI found a maximum of 4,300 mg/kg in surface samples, with concentrations falling consistently with depth. NOTE ON THIS FIGURE: the 2004 PSI is reported inconsistently across the record — the FS gives a Stockpile 2 maximum of 60,700 mg/kg in §2.2.1 but recalls a range to 196,000 mg/kg in §2.2.3, and the FEIR states 196,000. The 2004 report itself is not in the compiled sources to settle it, so this bar uses the 2012 SSI instead — 130,000 mg/kg in a Cadmium Boring sample at 11 feet depth in Stockpile 2, recorded in that report's own Table 3 and re-verified against the page image. That is a primary measurement rather than a recollection, and it comes from the period when three separate laboratories were producing consistent barium results.",
        "meaning": "The barium here is mostly barite, which is highly insoluble. The FS notes that the Title 22 soluble-threshold criteria “are not strictly applicable to the Site” because the barium present is primarily barium sulfate. That is also why soil concentrations are enormous while groundwater barium stays near background.",
        "action": "DTSC's Human and Ecological Risk Office concluded the stockpiles pose no cancer risk or noncancer hazard “as long as the stockpiles remain in place and are properly managed,” while warning that the elevated concentrations at depth “will have to be evaluated” if the stockpiles were ever graded or removed. Stockpile 3 was removed and Stockpiles 1 and 2 encapsulated beneath SR 132 by October 2021; a recorded land use covenant now bars residential development.",
        "cite": "FS Report pp. 15–17, §3.2; HERO memo 14 Feb 2013; Updated Statistical Evaluation (2024) §1",
    },
    ("lead", "soil"): {
        "short": "Two samples out of 278. Soluble lead was low and blood-lead modeling cleared it.",
        "why": "An isolated result. Of the 278 soil samples analyzed in the 2006 SI, only two contained lead above 50 mg/kg — one at 150 mg/kg and one at 1,500 mg/kg, the value charted here.",
        "meaning": "Soluble testing on those same two samples returned DI-WET lead of just 0.07 and 0.1 mg/L. Shaw's LeadSpread modeling found an onsite pica child exposed to the 95% UCL lead concentration would not exceed 10 µg/dL blood lead, and that the 1,500 mg/kg maximum works out to a respirable dust concentration of 0.15 µg/m³ — an order of magnitude below the model's own 1.5 µg/m³ default.",
        "action": "Lead was not a driver of the remedy. It is covered by the same encapsulation and land use covenant as barium.",
        "cite": "FS Report pp. 15–16, §3.1.4 (soluble metals) and §3.2.2 (LeadSpread)",
    },
    ("arsenic", "soil"): {
        "short": "Barely above background — and the screening level itself sits below background everywhere in California.",
        "why": "This is not a stockpile signal. The maximum is 5.5 mg/kg, from one sample at 14 feet depth among the 165 collected across all three stockpiles in the 2006 investigation. The site's own background soil reaches 4.1 mg/kg, with a 95% UCL of 1.2 mg/kg and a mean of 0.97 mg/kg — against a residential CHHSL of 0.07 mg/kg, which essentially all California soil exceeds. For Stockpiles 1 and 3 the risk assessment did not select arsenic as a chemical of potential concern at all, because their maximum detections were at or below the maximum background concentration.",
        "meaning": "The risk assessment makes the point arithmetically: Stockpile 2's arsenic cancer risk estimate was 1.45E-5, against 1.15E-5 for background soil — statistically indistinguishable. Arsenic was therefore excluded from Stockpile 2's final risk total, which dropped from 1E-5 to 1E-7.",
        "action": "None. Arsenic is not a designated Chemical of Concern and drove no part of the remedy.",
        "cite": "HHRA Update, Appendix B Table 5 (PDF p.76) for the 5.5 mg/kg maximum and Tables 2 and 4 for the background comparison; FS Report §3.2.1 for the risk calculation",
    },
    ("barium", "surface_water"): {
        "short": "The highest barium in the runoff record, sampled during active excavation of the stockpiles.",
        "why": "PL1 collected runoff along North Emerald Avenue from Stockpile 1. No report narrating this specific event is in the compiled source set, so no consultant explanation of the value exists here. INFERENCE: the sample date falls inside the window when Stockpile 3 was being removed and the Emerald Avenue bridge abutment end of Stockpile 2 excavated — February to March 2020 — which is when disturbed material would most readily reach runoff. The reports do not themselves draw that link.",
        "meaning": "An earlier isolated barium high in runoff (2,000 µg/L at SW03) was judged “isolated,” with runoff in the area confined to the Caltrans right-of-way. Barium's MCL is health-based, so an exceedance is meaningful — but this is ponded runoff on a construction site, not a drinking-water supply.",
        "action": "Sampling locations PL1 and PL2 ceased to exist as construction advanced; straw wattles and K-rail best management practices were installed to stop offsite discharge. Every stormwater event since encapsulation (March 2023 through February 2025) reports barium below its MCL.",
        "cite": "Surface Water Letter 28 Mar 2023, Tables 4–5; Interim RACR §4 (2020 excavation); Stormwater Sampling Report 6/25",
    },
    ("lead", "surface_water"): {
        "short": "A street puddle sampled outside the Caltrans fence — flagged by the consultant as the event's one exception.",
        "why": "PL3 was a puddle where Bennett Street meets the alley behind Loletta Street. Geocon's own description places it “outside the Caltrans right-of-way beyond the chainlink fence that encloses the south side of Stockpile 2.”",
        "meaning": "Geocon singled it out: “Except for the elevated concentration of lead in the sample collected outside the right-of-way at location PL3, analytical results for the remainder of the samples... are generally consistent with the results from previous events.” Because the sample is an offsite street puddle, an ordinary urban-runoff source for the lead cannot be ruled out.",
        "action": "Site reconnaissance that day identified no location where stormwater appeared to be migrating offsite, and runoff was judged to be retained within the right-of-way. Vegetative cover, straw wattles and the Bennett Street interceptor berm were maintained, and further sampling was scheduled for later in 2018.",
        "cite": "Modesto Stockpiles March 2018 SW Sampling report (04.18), §Analytical Results and §Surface Water Management",
    },
    ("manganese", "groundwater"): {
        "short": "An aesthetic standard, in a downgradient well that reads lower than the upgradient wells.",
        "why": "Manganese's 50 µg/L benchmark is a secondary MCL — it governs taste, odor and staining, not health. Manganese is naturally abundant in Central Valley alluvial groundwater and mobilizes readily under low-oxygen conditions.",
        "meaning": "MW-8 is a downgradient well. The 2024 statistical evaluation found that concentrations in downgradient wells MW7 and MW8 are lower than those in upgradient wells MW6 and MW10, which it treats as demonstrating “that Caltrans Stockpile 3 and the eastern part of Stockpile 2 are not impacting groundwater.” Manganese is not a designated Chemical of Concern, and the monitoring record characterises it as “sporadically reported for various wells at concentrations exceeding the secondary MCL; however, the concentrations have not been consistently elevated for any one well.”",
        "action": "MW-8 was decommissioned in 2019 ahead of highway construction, along with five other wells; monitoring had already been reduced from quarterly to annual in 2015 on the 2014 evaluation's recommendation.",
        "cite": "Updated Statistical Evaluation Report (2.24) §2, conclusions 3–4; GW April 2019 report §Summary; GW Monitoring Report 20230308 Table 3",
    },
    ("manganese", "surface_water"): {
        "short": "The background sampling location exceeded the same aesthetic standard on the same day.",
        "why": "Same sampling event as the PL3 lead exceedance. Geocon reported manganese between 54 and 370 µg/L across PL2, PL3, PL4 — and BG1, the background location.",
        "meaning": "Because the background sample exceeded the secondary MCL too, this is a characteristic of local water rather than a stockpile signal. The standard is aesthetic, not health-based.",
        "action": "No action is triggered by a secondary MCL exceedance. Manganese remained within the routine analyte list for subsequent events.",
        "cite": "Modesto Stockpiles March 2018 SW Sampling report (04.18), §Dissolved Metals",
    },
    ("nitrate_as_n", "groundwater"): {
        "short": "Four times a health-based MCL — but in a well the site's own evaluation attributes to the FMC plume, not the stockpiles.",
        "why": "Nitrate is one of the constituents the Regional Board identified in groundwater beneath the FMC property, and it is also ubiquitous in Central Valley groundwater from agriculture. Nitrate in the stockpile soil itself was measured within the range of background. This is not a single-well anomaly: in the April 2019 event nitrate ranged from 2.3 to 40 mg/L across the wells, with four of them — MW-1, MW-2, MW-5 and MW-6 — above the 10 mg/L MCL, and the monitoring record describes nitrate as consistently exceeding it in MW-1, MW-5, MW-6 and MW-10.",
        "meaning": "The 2024 statistical evaluation groups MW-5 with the wells that “typically have elevated levels of most constituents of concern,” and attributes their declining trends to FMC's groundwater extraction and treatment system rather than to anything at the stockpiles — concluding that “the groundwater impacts in wells MW5, MW6, and MW10 did not originate from the Caltrans soil stockpiles.” This is nonetheless the largest exceedance of a genuinely health-based drinking-water standard on this chart.",
        "action": "MW-5 was decommissioned in 2019. Preventing future impact to groundwater remains a stated Remedial Action Objective, and the Central Valley Regional Water Quality Control Board's concern about water-quality degradation is recorded as still open.",
        "cite": "Updated Statistical Evaluation Report (2.24) §2, conclusion 3; GW April 2019 report §General Minerals; FS Report §3.3; GW Monitoring Report 20230308 Table 4",
    },
}

# Rows excluded from the maximum-selection, with the reason. The combined
# summary CSV keeps them -- this only stops them anchoring a chart bar.
#
# Selecting a plain maximum across every row assumes the rows do not contradict
# each other. For 2004 PSI barium they do. The FS reports three different
# figures for the same investigation:
#   FS 2.2.1 (p.13): Stockpile 2 max 60,700 mg/kg; Stockpile 3 max 44,900
#   FS 2.2.3 (p.17): a cadmium-correlated subset of 11 samples, 25,800-196,000
#   FEIR main doc:   Stockpile 2 196,000; Stockpile 3 126,000
# The p.17 figure is a narrative recollection of the 2004 data inside a section
# about 2012 borings, not a primary table, and the 2004 PSI report itself is not
# in wiki/sources/ to adjudicate. Rather than let the largest of several
# contradictory numbers silently anchor the chart, the contested row is dropped
# and soil barium rests on the 2012 Cadmium Borings maximum of 130,000 mg/kg --
# the most recent measurement of the same stockpiles, corroborated across three
# laboratories.
EXCLUDE_FROM_MAX = {
    ("barium", "soil", "Stockpiles 2 and 3 (cadmium-correlated subset)"):
        "2004 PSI figure contradicted by the same report's 2.2.1 summary "
        "(60,700 mg/kg); superseded here by the 2012 Cadmium Borings maximum.",
}

# Display-only rewrites for location strings that are opaque out of context.
# The combined summary CSV keeps its own wording -- that is the provenance
# record and is not edited here; this only changes what the chart prints.
LOCATION_LABEL = {
    "Stockpiles (2 of 278 samples, stockpile unspecified)":
        "Stockpiles · 2006 SI (2 of 278 samples)",
}

# Water benchmarks, ug/L. Same standard applies to groundwater and stormwater;
# both are being screened against drinking-water criteria.
WATER_BENCHMARK = {
    "arsenic": (10.0, "Primary MCL", True),
    "barium": (1000.0, "Primary MCL", True),
    "nitrate_as_n": (10000.0, "Primary MCL (health-based), 10 mg/L as N", True),
    "manganese": (50.0, "Secondary MCL (aesthetic, not health-based)", False),
    "lead": (15.0, "CDPH regulatory action level - not an MCL", False),
    "strontium": (4000.0, "EPA drinking-water health advisory - not an MCL", False),
}

# Soil benchmarks, mg/kg, transcribed from the regulatory_limit column of the
# SSI/FS rows. No MCL exists for soil. Both CHHSL land-use scenarios are carried
# because the source record uses both: the 2004 PSI framed its barium and cadmium
# findings against commercial/industrial CHHSLs, while the 2012 SSI and the FS
# report state their pass/fail conclusions against residential CHHSLs. The site
# is a fenced Caltrans right-of-way whose remedy relies on a land use covenant
# barring residential development, but the HHRA's driving receptor is the offsite
# resident/trespasser -- so neither scenario is the single obviously correct one.
SOIL_BENCHMARK = {
    "residential": {
        "arsenic": (0.07, "CHHSL, residential"),
        "barium": (5200.0, "CHHSL, residential"),
        "lead": (80.0, "CHHSL, residential"),
        "strontium": (47000.0, "USEPA RSL, residential (no CHHSL for strontium)"),
    },
    "industrial": {
        "arsenic": (0.24, "CHHSL, commercial/industrial"),
        "barium": (63000.0, "CHHSL, commercial/industrial"),
        "lead": (320.0, "CHHSL, commercial/industrial"),
        "strontium": (610000.0, "CHHSL, commercial/industrial"),
    },
}


def to_ug_per_l(value, unit):
    unit = unit.replace("µ", "u")
    if unit == "ug/L":
        return value
    if unit == "mg/L":
        return value * 1000.0
    return None


def main():
    rows = list(csv.DictReader(SRC.open()))
    best = {}

    for r in rows:
        analyte = r["analyte"].strip().lower().replace(" (soil)", "")
        if analyte not in ANALYTES:
            continue
        # Only true observed maxima. MDC is "maximum detected concentration" --
        # an observed maximum that a consultant reported rather than one this
        # pipeline computed, so it belongs here. EPC, 95% UCL and background
        # statistics are genuinely derived numbers and stay excluded.
        if not r["value_type"].startswith(OBSERVED_MAX_TYPES):
            continue
        # Offsite background reference locations are not site detections.
        if str(r["is_background"]).strip().upper().startswith("T"):
            continue
        status = r["status"].upper()
        if "FABRICATED" in status or "UNSUPPORTED" in status:
            continue
        if (analyte, r["medium"], r["location_or_well"]) in EXCLUDE_FROM_MAX:
            continue
        try:
            value = float(r["value"])
        except ValueError:
            continue

        medium = r["medium"]
        if medium == "soil":
            if r["unit"] != "mg/kg":
                continue
        else:
            value = to_ug_per_l(value, r["unit"])
            if value is None:
                continue

        key = (analyte, medium)
        if key not in best or value > best[key]["value"]:
            best[key] = {
                "value": value,
                "unit": "mg/kg" if medium == "soil" else "ug/L",
                "location": r["location_or_well"],
                "date": r["date_or_event"],
                "source_document": r["source_document"],
                "source_citation": r["source_citation"],
                "value_type": r["value_type"],
            }

    records = []
    for analyte, (label, kind) in ANALYTES.items():
        for medium, medium_label in MEDIA.items():
            hit = best.get((analyte, medium))
            is_soil = medium == "soil"
            bench = (SOIL_BENCHMARK["residential"].get(analyte) if is_soil
                     else WATER_BENCHMARK.get(analyte))
            if hit is None or bench is None:
                records.append({
                    "analyte": label,
                    "analyte_kind": kind,
                    "medium": medium_label,
                    "no_data": True,
                    "reason": ("not analyzed in this medium in the compiled reports"
                               if hit is None else "no benchmark established"),
                })
                continue
            if is_soil:
                limit, limit_label = bench
                is_mcl = False
                # Soil carries both land-use scenarios so the page can switch
                # between them; the default record below stays residential.
                options = {}
                for scen in ("residential", "industrial"):
                    lim, lab = SOIL_BENCHMARK[scen][analyte]
                    options[scen] = {
                        "benchmark": lim,
                        "benchmark_label": lab,
                        "percent_of_benchmark": round(100.0 * hit["value"] / lim, 2),
                    }
            else:
                limit, limit_label, is_mcl = bench
                options = None
            records.append({
                "analyte": label,
                "analyte_kind": kind,
                "medium": medium_label,
                "no_data": False,
                "max_value": hit["value"],
                "unit": hit["unit"],
                "benchmark": limit,
                "benchmark_label": limit_label,
                "benchmark_is_mcl": is_mcl,
                "percent_of_benchmark": round(100.0 * hit["value"] / limit, 2),
                "soil_scenarios": options,
                "narrative": NARRATIVES.get((analyte, medium)),
                "location": LOCATION_LABEL.get(hit["location"], hit["location"]),
                "location_as_reported": hit["location"],
                "date": hit["date"],
                "source_document": hit["source_document"],
                "source_citation": hit["source_citation"],
                "value_type": hit["value_type"],
            })

    OUT.write_text(json.dumps(records, indent=1) + "\n")
    print(f"wrote {OUT} ({len(records)} records)")
    for rec in records:
        if rec["no_data"]:
            print(f"  {rec['analyte']:16s} {rec['medium']:12s}  -- {rec['reason']}")
        else:
            print(f"  {rec['analyte']:16s} {rec['medium']:12s} "
                  f"{rec['max_value']:>10g} {rec['unit']:6s} / {rec['benchmark']:>9g} "
                  f"= {rec['percent_of_benchmark']:>8.1f}%   {rec['benchmark_label']}")


if __name__ == "__main__":
    main()
