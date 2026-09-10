import { useState, useMemo } from "react";

// All values in ppm unless noted. "—" = not established. "LF" = lowest feasible.
// Sources: OSHA Z-Tables, NIOSH Pocket Guide, ACGIH TLV Book, EPA IRIS, ATSDR MRLs, WHO AQGs, Cal/OSHA AC-1
const chemicals = [
  {
    name: "Carbon Monoxide",
    abbr: "CO",
    cas: "630-08-0",
    category: "Combustion",
    hazard: "medium",
    osha_pel_twa: 50,
    osha_pel_stel: null,
    osha_pel_ceil: null,
    niosh_rel_twa: 35,
    niosh_rel_stel: null,
    niosh_ceil: 200,
    niosh_idlh: 1200,
    acgih_tlv_twa: 25,
    acgih_tlv_stel: null,
    calosha_twa: 25,
    epa_ambient: "9 ppm (8-hr NAAQS); 35 ppm (1-hr)",
    health_based: "WHO: 35 ppm (1-hr), 9 ppm (8-hr), 4 ppm (24-hr)",
    notes: "Displaces O₂; binds hemoglobin. Odorless. Standard 4-gas monitor required.",
    carcinogen: false,
  },
  {
    name: "Formaldehyde",
    abbr: "HCHO",
    cas: "50-00-0",
    category: "Combustion / Industrial",
    hazard: "high",
    osha_pel_twa: 0.75,
    osha_pel_stel: 2,
    osha_pel_ceil: null,
    niosh_rel_twa: 0.016,
    niosh_rel_stel: 0.1,
    niosh_ceil: null,
    niosh_idlh: 20,
    acgih_tlv_twa: null,
    acgih_tlv_stel: null,
    acgih_ceil: 0.3,
    calosha_twa: 0.75,
    epa_ambient: "EPA IRIS RfC: 0.0098 ppm (chronic inhalation)",
    health_based: "WHO: 0.08 ppm (30-min ceiling). IARC Group 1 carcinogen. NIOSH REL far below OSHA PEL.",
    notes: "Known human carcinogen (IARC 1). OSHA action level: 0.5 ppm. NIOSH considers no safe level.",
    carcinogen: true,
  },
  {
    name: "Benzene",
    abbr: "C₆H₆",
    cas: "71-43-2",
    category: "Industrial / Combustion",
    hazard: "high",
    osha_pel_twa: 1,
    osha_pel_stel: 5,
    osha_pel_ceil: null,
    niosh_rel_twa: "LF",
    niosh_rel_stel: null,
    niosh_ceil: 1,
    niosh_idlh: 500,
    acgih_tlv_twa: 0.5,
    acgih_tlv_stel: 2.5,
    calosha_twa: 0.5,
    epa_ambient: "Unit risk 2.2–7.8×10⁻⁶ per µg/m³. No safe threshold.",
    health_based: "ATSDR MRL: 0.006 ppm chronic. NIOSH: lowest feasible. A1 carcinogen — leukemia risk starts below 1 ppm.",
    notes: "IARC Group 1 carcinogen. Causes leukemia. OSHA action level: 0.5 ppm. No truly safe level.",
    carcinogen: true,
  },
  {
    name: "Acrolein",
    abbr: "CH₂CHCHO",
    cas: "107-02-8",
    category: "Combustion",
    hazard: "high",
    osha_pel_twa: 0.1,
    osha_pel_stel: null,
    osha_pel_ceil: null,
    niosh_rel_twa: 0.1,
    niosh_rel_stel: 0.3,
    niosh_ceil: null,
    niosh_idlh: 2,
    acgih_tlv_twa: 0.02,
    acgih_tlv_stel: 0.05,
    calosha_twa: 0.1,
    epa_ambient: "EPA IRIS RfC: 0.00002 ppm (0.02 µg/m³) chronic",
    health_based: "ACGIH lowered TLV to 0.02 ppm — 5× below OSHA PEL. Potent respiratory/eye irritant; cardiovascular effects at chronic low levels.",
    notes: "Major fire combustion product from acrylates. Detectable odor at ~0.05 ppm but olfactory fatigue occurs rapidly. No safe chronic level established.",
    carcinogen: false,
  },
  {
    name: "Hydrogen Sulfide",
    abbr: "H₂S",
    cas: "7783-06-4",
    category: "Industrial / Combustion",
    hazard: "high",
    osha_pel_twa: null,
    osha_pel_stel: null,
    osha_pel_ceil: 20,
    niosh_rel_twa: null,
    niosh_rel_stel: null,
    niosh_ceil: 10,
    niosh_idlh: 50,
    acgih_tlv_twa: 1,
    acgih_tlv_stel: 5,
    calosha_twa: 10,
    epa_ambient: "ATSDR MRL: 0.007 ppm (chronic); 0.07 ppm (intermediate)",
    health_based: "ACGIH TLV-TWA of 1 ppm is far more protective than OSHA ceiling of 20 ppm. Olfactory paralysis at 100–150 ppm masks presence.",
    notes: "Classic 'rotten egg' odor detectable at 0.001 ppm but olfactory fatigue at >100 ppm = no warning. Rapid knockdown at 300 ppm.",
    carcinogen: false,
  },
  {
    name: "Methyl Methacrylate",
    abbr: "MMA",
    cas: "80-62-6",
    category: "Industrial",
    hazard: "medium",
    osha_pel_twa: 100,
    osha_pel_stel: null,
    osha_pel_ceil: null,
    niosh_rel_twa: 100,
    niosh_rel_stel: null,
    niosh_ceil: null,
    niosh_idlh: 1000,
    acgih_tlv_twa: 50,
    acgih_tlv_stel: 100,
    calosha_twa: 50,
    epa_ambient: "No EPA IRIS RfC established",
    health_based: "ACGIH TLV half of OSHA PEL. Sensitizer — asthma induction at sub-PEL levels. Reproductive toxicant (animal data). Workers tolerated 200 ppm.",
    notes: "Respiratory/skin sensitizer. LEL 1.7%; IDLH is explosive range concern as much as toxicity. Acrid fruity odor; detectable ~0.05 ppm.",
    carcinogen: false,
  },
  {
    name: "Methacrylic Acid",
    abbr: "MAA",
    cas: "79-41-4",
    category: "Combustion / Industrial",
    hazard: "medium",
    osha_pel_twa: null,
    osha_pel_stel: null,
    osha_pel_ceil: null,
    niosh_rel_twa: 20,
    niosh_rel_stel: null,
    niosh_ceil: null,
    niosh_idlh: "N.D.",
    acgih_tlv_twa: 20,
    acgih_tlv_stel: null,
    calosha_twa: null,
    epa_ambient: "No NAAQS or IRIS RfC",
    health_based: "Skin notation (both NIOSH and ACGIH) — significant dermal absorption. Corrosive vapors. No chronic ambient standard exists.",
    notes: "MMA combustion/thermal decomposition product. OSHA has no PEL — NIOSH REL applies. Corrosive to skin/mucous membranes.",
    carcinogen: false,
  },
  {
    name: "Methanol",
    abbr: "CH₃OH",
    cas: "67-56-1",
    category: "Industrial / Combustion",
    hazard: "medium",
    osha_pel_twa: 200,
    osha_pel_stel: null,
    osha_pel_ceil: null,
    niosh_rel_twa: 200,
    niosh_rel_stel: 250,
    niosh_ceil: null,
    niosh_idlh: 6000,
    acgih_tlv_twa: 200,
    acgih_tlv_stel: 250,
    calosha_twa: 200,
    epa_ambient: "EPA IRIS RfC: 20 ppm (chronic)",
    health_based: "ATSDR MRL: 20 ppm chronic. Optic nerve damage at high exposure. Metabolizes to formaldehyde and formic acid.",
    notes: "Skin and eye absorber (Skin notation all agencies). Metabolizes to HCHO + formate — causes blindness/death. MMA thermal decomp product.",
    carcinogen: false,
  },
  {
    name: "Ammonia",
    abbr: "NH₃",
    cas: "7664-41-7",
    category: "Industrial",
    hazard: "medium",
    osha_pel_twa: 50,
    osha_pel_stel: null,
    osha_pel_ceil: null,
    niosh_rel_twa: 25,
    niosh_rel_stel: 35,
    niosh_ceil: null,
    niosh_idlh: 300,
    acgih_tlv_twa: 25,
    acgih_tlv_stel: 35,
    calosha_twa: 25,
    epa_ambient: "ATSDR MRL: 0.1 ppm chronic",
    health_based: "WHO: 0.25 ppm (24-hr). OSHA PEL (1968) is 2× NIOSH/ACGIH. Respiratory sensitizer at chronic sub-PEL levels.",
    notes: "Strong pungent odor; detectable at ~5 ppm. Corrosive to airways. Common in refrigeration, agriculture, industrial cleaning.",
    carcinogen: false,
  },
  {
    name: "Chlorine",
    abbr: "Cl₂",
    cas: "7782-50-5",
    category: "Industrial",
    hazard: "high",
    osha_pel_twa: null,
    osha_pel_stel: null,
    osha_pel_ceil: 1,
    niosh_rel_twa: null,
    niosh_rel_stel: null,
    niosh_ceil: 0.5,
    niosh_idlh: 10,
    acgih_tlv_twa: 0.5,
    acgih_tlv_stel: 1,
    calosha_twa: 0.5,
    epa_ambient: "ERPG-2 (1-hr community limit): 3 ppm",
    health_based: "WHO: 0.5 ppm (8-hr). AIHA ERPG-1: 1 ppm. Pulmonary edema threshold ~10 ppm. Chemical weapon agent > 10 ppm.",
    notes: "Yellowish-green gas; distinctive odor at 0.5 ppm. Used in water treatment, chemical manufacturing. WWI chemical weapon at high conc.",
    carcinogen: false,
  },
  {
    name: "Sulfur Dioxide",
    abbr: "SO₂",
    cas: "7446-09-5",
    category: "Combustion / Industrial",
    hazard: "medium",
    osha_pel_twa: 5,
    osha_pel_stel: null,
    osha_pel_ceil: null,
    niosh_rel_twa: 2,
    niosh_rel_stel: 5,
    niosh_ceil: null,
    niosh_idlh: 100,
    acgih_tlv_twa: null,
    acgih_tlv_stel: null,
    acgih_ceil: 0.25,
    calosha_twa: 2,
    epa_ambient: "NAAQS: 75 ppb (1-hr primary); 500 ppb (3-hr secondary)",
    health_based: "WHO AQG 2021: 40 µg/m³ (24-hr) = 0.015 ppm. ACGIH ceiling 20× below OSHA PEL. Asthmatic responses at <1 ppm.",
    notes: "Criteria air pollutant. Acid rain precursor. Asthmatics especially sensitive — bronchoconstriction at 0.1–0.5 ppm during exercise.",
    carcinogen: false,
  },
  {
    name: "Nitrogen Dioxide",
    abbr: "NO₂",
    cas: "10102-44-0",
    category: "Combustion / Industrial",
    hazard: "medium",
    osha_pel_twa: null,
    osha_pel_stel: null,
    osha_pel_ceil: 5,
    niosh_rel_twa: 1,
    niosh_rel_stel: 3,
    niosh_ceil: null,
    niosh_idlh: 20,
    acgih_tlv_twa: 0.2,
    acgih_tlv_stel: 1,
    calosha_twa: 1,
    epa_ambient: "NAAQS: 100 ppb (1-hr); 53 ppb (annual) = 0.053 ppm",
    health_based: "WHO AQG 2021: 0.01 ppm annual; 0.025 ppm 24-hr. ACGIH TLV 25× below OSHA ceiling. Pulmonary edema delayed 4–24 hrs.",
    notes: "Criteria air pollutant. Delayed pulmonary edema — workers may feel fine then deteriorate hours later. Combustion, welding, diesel exhaust.",
    carcinogen: false,
  },
  {
    name: "Toluene",
    abbr: "C₇H₈",
    cas: "108-88-3",
    category: "Industrial / Combustion",
    hazard: "medium",
    osha_pel_twa: 200,
    osha_pel_stel: null,
    osha_pel_ceil: 300,
    niosh_rel_twa: 100,
    niosh_rel_stel: 150,
    niosh_ceil: null,
    niosh_idlh: 500,
    acgih_tlv_twa: 20,
    acgih_tlv_stel: null,
    calosha_twa: 50,
    epa_ambient: "EPA IRIS RfC: 5 ppm (chronic inhalation)",
    health_based: "ACGIH TLV of 20 ppm is 10× below OSHA PEL — reproductive/developmental toxicant at high levels. Skin notation.",
    notes: "Major solvent. CNS depressant. ACGIH TLV sharply reduced due to reproductive effects. Not classified as carcinogen.",
    carcinogen: false,
  },
  {
    name: "Styrene",
    abbr: "C₈H₈",
    cas: "100-42-5",
    category: "Industrial",
    hazard: "medium",
    osha_pel_twa: 100,
    osha_pel_stel: null,
    osha_pel_ceil: 200,
    niosh_rel_twa: 50,
    niosh_rel_stel: 100,
    niosh_ceil: null,
    niosh_idlh: 700,
    acgih_tlv_twa: 20,
    acgih_tlv_stel: 40,
    calosha_twa: 50,
    epa_ambient: "EPA IRIS RfC: 1 ppm (chronic)",
    health_based: "ACGIH TLV 5× below OSHA PEL. A4 (not classifiable as human carcinogen) but NTP lists as reasonably anticipated carcinogen.",
    notes: "Fiberglass/plastic manufacturing. Sweet, pungent odor. Neurotoxic at chronic exposure. Olfactory fatigue impairs warning.",
    carcinogen: false,
  },
  {
    name: "Hydrogen Cyanide",
    abbr: "HCN",
    cas: "74-90-8",
    category: "Combustion / Industrial",
    hazard: "high",
    osha_pel_twa: null,
    osha_pel_stel: null,
    osha_pel_ceil: 10,
    niosh_rel_twa: 10,
    niosh_rel_stel: null,
    niosh_ceil: null,
    niosh_idlh: 50,
    acgih_tlv_twa: null,
    acgih_tlv_stel: null,
    acgih_ceil: 4.7,
    calosha_twa: 10,
    epa_ambient: "ERPG-2 (1-hr): 10 ppm",
    health_based: "ATSDR MRL: 0.005 ppm chronic. AIHA ERPG-3 (life threat): 25 ppm. Skin notation all agencies — significant dermal absorption.",
    notes: "Produced from burning polyurethane/nitrogen-containing plastics. Inhibits cellular respiration. Bitter almond odor — many cannot detect it.",
    carcinogen: false,
  },
  {
    name: "Vinyl Chloride",
    abbr: "VCM",
    cas: "75-01-4",
    category: "Industrial",
    hazard: "high",
    osha_pel_twa: 1,
    osha_pel_stel: null,
    osha_pel_ceil: 5,
    niosh_rel_twa: "LF",
    niosh_rel_stel: null,
    niosh_ceil: null,
    niosh_idlh: 100,
    acgih_tlv_twa: 1,
    acgih_tlv_stel: null,
    calosha_twa: 1,
    epa_ambient: "EPA IRIS IUR: 4.4×10⁻⁶ per µg/m³. No safe threshold.",
    health_based: "ATSDR MRL: 0.001 ppm chronic. IARC Group 1 — hepatic angiosarcoma. NIOSH: lowest feasible. Any exposure carries cancer risk.",
    notes: "IARC Group 1 carcinogen. PVC manufacturing. Cancer effects well-documented at historic PEL of 500 ppm. Current 1 ppm PEL still carries risk.",
    carcinogen: true,
  },
  {
    name: "Phosgene",
    abbr: "COCl₂",
    cas: "75-44-5",
    category: "Combustion / Industrial",
    hazard: "high",
    osha_pel_twa: 0.1,
    osha_pel_stel: null,
    osha_pel_ceil: null,
    niosh_rel_twa: 0.1,
    niosh_rel_stel: null,
    niosh_ceil: null,
    niosh_idlh: 2,
    acgih_tlv_twa: null,
    acgih_tlv_stel: null,
    acgih_ceil: 0.1,
    calosha_twa: 0.1,
    epa_ambient: "ERPG-2 (1-hr community): 0.2 ppm",
    health_based: "AIHA ERPG-3 (life threat 1-hr): 1.5 ppm. Delayed pulmonary edema 4–24 hrs post-exposure. Produced from burning chlorinated plastics.",
    notes: "Produced by combustion of PVC/chlorinated solvents. Sweet hay odor. Most WWI chemical warfare deaths. Delayed toxicity is lethal.",
    carcinogen: false,
  },
  {
    name: "Isocyanates (MDI/TDI)",
    abbr: "NCO",
    cas: "101-68-8",
    category: "Industrial",
    hazard: "high",
    osha_pel_twa: null,
    osha_pel_stel: null,
    osha_pel_ceil: 0.02,
    niosh_rel_twa: 0.005,
    niosh_rel_stel: 0.02,
    niosh_ceil: null,
    niosh_idlh: 0.075,
    acgih_tlv_twa: 0.005,
    acgih_tlv_stel: null,
    calosha_twa: 0.005,
    epa_ambient: "No NAAQS. Sensitizer — no safe level once sensitized.",
    health_based: "Potent sensitizer — once sensitized, microgram-level exposure triggers severe asthma. NIOSH considers any exposure hazardous post-sensitization.",
    notes: "Polyurethane foam/coating manufacturing. Leading cause of occupational asthma. No threshold after sensitization. Burning foam releases these.",
    carcinogen: false,
  },
  {
    name: "Ozone",
    abbr: "O₃",
    cas: "10028-15-6",
    category: "Combustion / Ambient",
    hazard: "medium",
    osha_pel_twa: 0.1,
    osha_pel_stel: null,
    osha_pel_ceil: null,
    niosh_rel_twa: 0.1,
    niosh_rel_stel: null,
    niosh_ceil: null,
    niosh_idlh: 5,
    acgih_tlv_twa: 0.05,
    acgih_tlv_stel: null,
    calosha_twa: 0.05,
    epa_ambient: "NAAQS: 0.070 ppm (8-hr). Cal standard: 0.070 ppm (8-hr), 0.09 ppm (1-hr)",
    health_based: "WHO AQG 2021: 0.051 ppm (8-hr). No safe level — linear dose response for respiratory effects. ACGIH TLV varies by work intensity (0.05–0.10 ppm).",
    notes: "Criteria air pollutant. Ground-level from VOC/NOx photochemistry. Inflammation at 0.06 ppm. Generated by arcing electrical equipment.",
    carcinogen: false,
  },
  {
    name: "Silica, Crystalline",
    abbr: "SiO₂",
    cas: "14808-60-7",
    category: "Industrial",
    hazard: "high",
    osha_pel_twa: "0.05 mg/m³",
    osha_pel_stel: null,
    osha_pel_ceil: null,
    niosh_rel_twa: "0.05 mg/m³",
    niosh_rel_stel: null,
    niosh_ceil: null,
    niosh_idlh: "25 mg/m³",
    acgih_tlv_twa: "0.025 mg/m³",
    acgih_tlv_stel: null,
    calosha_twa: "0.05 mg/m³",
    epa_ambient: "No NAAQS for specific compound",
    health_based: "IARC Group 1. ACGIH TLV half of OSHA/NIOSH. No safe level — silicosis + lung cancer. Respirable fraction only.",
    notes: "NOTE: Values in mg/m³ not ppm. IARC Group 1 carcinogen. Construction/mining. New OSHA PEL (2016) cut from 0.1 to 0.05 mg/m³.",
    carcinogen: true,
  },
  {
    name: "Lead (inorganic)",
    abbr: "Pb",
    cas: "7439-92-1",
    category: "Industrial",
    hazard: "high",
    osha_pel_twa: "0.05 mg/m³",
    osha_pel_stel: null,
    osha_pel_ceil: null,
    niosh_rel_twa: "0.05 mg/m³",
    niosh_rel_stel: null,
    niosh_ceil: null,
    niosh_idlh: "100 mg/m³",
    acgih_tlv_twa: "0.05 mg/m³",
    acgih_tlv_stel: null,
    calosha_twa: "0.05 mg/m³",
    epa_ambient: "NAAQS: 0.15 µg/m³ (rolling 3-month avg)",
    health_based: "CDC blood lead no safe level in children. ACGIH under review to lower significantly. Neurotoxic at any measurable blood level.",
    notes: "NOTE: mg/m³. Neurotoxin — no safe blood level especially in children. OSHA action level 0.03 mg/m³. Medical surveillance required.",
    carcinogen: true,
  },
  {
    name: "Mercury Vapor",
    abbr: "Hg",
    cas: "7439-97-6",
    category: "Industrial",
    hazard: "high",
    osha_pel_twa: "0.1 mg/m³",
    osha_pel_stel: null,
    osha_pel_ceil: null,
    niosh_rel_twa: "0.05 mg/m³",
    niosh_rel_stel: null,
    niosh_ceil: null,
    niosh_idlh: "10 mg/m³",
    acgih_tlv_twa: "0.025 mg/m³",
    acgih_tlv_stel: null,
    calosha_twa: "0.05 mg/m³",
    epa_ambient: "EPA MRL: 0.0002 mg/m³ (chronic); WHO: 0.001 mg/m³ (annual)",
    health_based: "ACGIH TLV 4× below OSHA PEL. CNS damage, renal effects at chronic sub-PEL. Skin notation. Particularly toxic to developing nervous system.",
    notes: "NOTE: mg/m³. Thermometers, fluorescent lamps, dental amalgam. Bioaccumulates. NIOSH/ACGIH far more protective than OSHA.",
    carcinogen: false,
  },
  {
    name: "Ethylene Oxide",
    abbr: "EtO",
    cas: "75-21-8",
    category: "Industrial",
    hazard: "high",
    osha_pel_twa: 1,
    osha_pel_stel: null,
    osha_pel_ceil: null,
    niosh_rel_twa: "LF",
    niosh_rel_stel: null,
    niosh_ceil: null,
    niosh_idlh: 800,
    acgih_tlv_twa: 1,
    acgih_tlv_stel: null,
    calosha_twa: 1,
    epa_ambient: "IRIS IUR 3×10⁻⁵ per µg/m³. No safe threshold.",
    health_based: "ATSDR MRL: 0.03 ppm chronic. NIOSH: lowest feasible (known carcinogen). 1 ppm PEL still carries cancer risk per EPA.",
    notes: "IARC Group 1 carcinogen. Hospital sterilization, plastics. EPA 2022 NESHAP tightened limits significantly. Leukemia, lymphoma risk.",
    carcinogen: true,
  },
];

const categories = ["All", ...Array.from(new Set(chemicals.map((c) => c.category.split(" / ")[0])))];

const COLS = [
  { key: "name", label: "Chemical", width: "140px" },
  { key: "osha_pel_twa", label: "OSHA PEL TWA", sub: "8-hr regulatory", width: "110px" },
  { key: "osha_pel_stel", label: "OSHA STEL/Ceil", sub: "15-min / ceiling", width: "110px" },
  { key: "niosh_rel_twa", label: "NIOSH REL TWA", sub: "8–10 hr rec.", width: "110px" },
  { key: "niosh_ceil", label: "NIOSH Ceiling", sub: "10-min max", width: "105px" },
  { key: "niosh_idlh", label: "IDLH", sub: "Immediate danger", width: "90px" },
  { key: "acgih_tlv_twa", label: "ACGIH TLV-TWA", sub: "8-hr best practice", width: "115px" },
  { key: "acgih_tlv_stel", label: "ACGIH STEL", sub: "15-min best prac.", width: "105px" },
  { key: "epa_ambient", label: "EPA Ambient / NAAQS", sub: "Community outdoor", width: "180px" },
  { key: "health_based", label: "Health-Based / Cutting Edge", sub: "WHO, ATSDR, IRIS, NTP", width: "220px" },
];

const hazardColor = {
  high: { bg: "rgba(248,81,73,0.08)", border: "#da3633", dot: "#ff7b72" },
  medium: { bg: "rgba(210,153,34,0.08)", border: "#9e6a03", dot: "#d29922" },
  low: { bg: "rgba(63,185,80,0.08)", border: "#2ea043", dot: "#3fb950" },
};

function fmt(val, unit = "ppm") {
  if (val === null || val === undefined) return <span style={{ color: "#484f58" }}>—</span>;
  if (val === "LF") return <span style={{ color: "#f0883e", fontSize: "10px", fontWeight: 700 }}>LOWEST FEASIBLE</span>;
  if (val === "N.D.") return <span style={{ color: "#484f58" }}>N.D.</span>;
  if (typeof val === "string") return <span style={{ color: "#c9d1d9", fontSize: "11px" }}>{val}</span>;
  return (
    <span>
      <span style={{ color: "#3fb950", fontWeight: 700 }}>{val}</span>
      <span style={{ color: "#484f58", fontSize: "10px" }}> {unit}</span>
    </span>
  );
}

export default function ToxicAirChart() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [showCarcinogens, setShowCarcinogens] = useState(false);
  const [selectedChem, setSelectedChem] = useState(null);

  const filtered = useMemo(() =>
    chemicals.filter((c) => {
      const matchCat = activeCategory === "All" || c.category.includes(activeCategory);
      const matchCarc = !showCarcinogens || c.carcinogen;
      const q = search.toLowerCase();
      const matchSearch = !q || c.name.toLowerCase().includes(q) || c.abbr.toLowerCase().includes(q) || c.cas.includes(q);
      return matchCat && matchCarc && matchSearch;
    }),
    [activeCategory, search, showCarcinogens]
  );

  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", background: "#090c10", minHeight: "100vh", color: "#c9d1d9" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(180deg, #0d1117 0%, #090c10 100%)", borderBottom: "1px solid #21262d", padding: "20px 24px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <span style={{ color: "#f0883e", fontSize: "10px", letterSpacing: "3px", fontWeight: 700 }}>AIR TOXICOLOGY REFERENCE</span>
          <span style={{ color: "#30363d", fontSize: "10px" }}>v2025 · {chemicals.length} substances</span>
        </div>
        <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#e6edf3", margin: "0 0 3px", letterSpacing: "-0.3px" }}>
          Toxic Air Contaminant Exposure Thresholds
        </h1>
        <p style={{ color: "#8b949e", fontSize: "11px", margin: 0 }}>
          OSHA PELs · NIOSH RELs · ACGIH TLVs · IDLH · EPA NAAQS/IRIS · WHO · ATSDR MRLs — All values in ppm unless noted
        </p>
      </div>

      {/* Legend */}
      <div style={{ background: "#0d1117", borderBottom: "1px solid #21262d", padding: "10px 24px", display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "center", fontSize: "10px" }}>
        <div style={{ display: "flex", gap: "12px" }}>
          {[["high", "High Hazard"], ["medium", "Moderate Hazard"]].map(([k, l]) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: hazardColor[k].dot, display: "inline-block" }} />
              <span style={{ color: "#8b949e" }}>{l}</span>
            </span>
          ))}
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ color: "#f0883e", fontWeight: 700 }}>★</span>
            <span style={{ color: "#8b949e" }}>Known/Suspected Carcinogen</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ color: "#388bfd", fontWeight: 700 }}>LF</span>
            <span style={{ color: "#8b949e" }}>= Lowest Feasible (no safe level)</span>
          </span>
        </div>
        <div style={{ marginLeft: "auto", color: "#484f58", fontSize: "10px", maxWidth: "340px", lineHeight: 1.4 }}>
          ⚠ OSHA PELs largely unchanged since 1971. NIOSH RELs and ACGIH TLVs reflect current toxicology. Health-based limits are most protective.
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: "12px 24px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", background: "#0d1117", borderBottom: "1px solid #21262d" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chemical, abbreviation, CAS..."
          style={{ background: "#161b22", border: "1px solid #30363d", color: "#c9d1d9", padding: "6px 11px", borderRadius: "5px", fontSize: "11px", width: "230px", outline: "none", fontFamily: "inherit" }}
        />
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "10px", fontFamily: "inherit", cursor: "pointer",
                border: activeCategory === cat ? "1px solid #388bfd" : "1px solid #30363d",
                background: activeCategory === cat ? "#1f3a5f" : "#161b22",
                color: activeCategory === cat ? "#58a6ff" : "#8b949e" }}>
              {cat}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCarcinogens(!showCarcinogens)}
          style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "10px", fontFamily: "inherit", cursor: "pointer",
            border: showCarcinogens ? "1px solid #f0883e" : "1px solid #30363d",
            background: showCarcinogens ? "rgba(240,136,62,0.12)" : "#161b22",
            color: showCarcinogens ? "#f0883e" : "#8b949e" }}>
          ★ Carcinogens only
        </button>
        <span style={{ color: "#484f58", fontSize: "10px", marginLeft: "auto" }}>{filtered.length} chemicals shown</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", padding: "0 24px 40px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", marginTop: "16px", minWidth: "1200px" }}>
          <thead>
            <tr style={{ background: "#161b22" }}>
              {COLS.map((col) => (
                <th key={col.key} style={{ padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #21262d", minWidth: col.width, position: "sticky", top: 0, background: "#161b22", zIndex: 1 }}>
                  <div style={{ color: "#e6edf3", fontWeight: 700, fontSize: "10px", letterSpacing: "0.5px" }}>{col.label}</div>
                  <div style={{ color: "#484f58", fontSize: "9px", fontWeight: 400, marginTop: "1px" }}>{col.sub}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((chem, i) => {
              const hc = hazardColor[chem.hazard];
              const isSelected = selectedChem === chem.cas;
              return (
                <>
                  <tr key={chem.cas}
                    onClick={() => setSelectedChem(isSelected ? null : chem.cas)}
                    style={{ borderBottom: "1px solid #21262d", cursor: "pointer",
                      background: isSelected ? "rgba(56,139,253,0.06)" : i % 2 === 0 ? "#0d1117" : "#090c10",
                      transition: "background 0.1s" }}
                    onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = "#161b22")}
                    onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = i % 2 === 0 ? "#0d1117" : "#090c10")}>

                    {/* Chemical Name */}
                    <td style={{ padding: "9px 10px", borderLeft: `2px solid ${hc.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: hc.dot, display: "inline-block", flexShrink: 0 }} />
                        <div>
                          <div style={{ color: "#e6edf3", fontWeight: 600 }}>
                            {chem.name}
                            {chem.carcinogen && <span style={{ color: "#f0883e", marginLeft: "4px" }}>★</span>}
                          </div>
                          <div style={{ color: "#484f58", fontSize: "9px" }}>{chem.abbr} · {chem.cas}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: "9px 10px" }}>{fmt(chem.osha_pel_twa)}</td>
                    <td style={{ padding: "9px 10px" }}>
                      {chem.osha_pel_stel ? fmt(chem.osha_pel_stel) : chem.osha_pel_ceil ? <span>{fmt(chem.osha_pel_ceil)}<span style={{color:"#484f58",fontSize:"9px"}}> ceil</span></span> : fmt(null)}
                    </td>
                    <td style={{ padding: "9px 10px" }}>{fmt(chem.niosh_rel_twa)}</td>
                    <td style={{ padding: "9px 10px" }}>{fmt(chem.niosh_ceil)}</td>
                    <td style={{ padding: "9px 10px" }}>
                      {chem.niosh_idlh ? (
                        <span style={{ color: "#ff7b72", fontWeight: 700 }}>
                          {typeof chem.niosh_idlh === "string" ? chem.niosh_idlh : chem.niosh_idlh}
                          <span style={{ color: "#484f58", fontSize: "9px", fontWeight: 400 }}> ppm</span>
                        </span>
                      ) : fmt(null)}
                    </td>
                    <td style={{ padding: "9px 10px" }}>
                      {chem.acgih_ceil
                        ? <span>{fmt(chem.acgih_ceil)}<span style={{color:"#484f58",fontSize:"9px"}}> ceil</span></span>
                        : fmt(chem.acgih_tlv_twa)}
                    </td>
                    <td style={{ padding: "9px 10px" }}>{fmt(chem.acgih_tlv_stel)}</td>
                    <td style={{ padding: "9px 10px", color: "#8b949e", fontSize: "10px", lineHeight: 1.4 }}>{chem.epa_ambient}</td>
                    <td style={{ padding: "9px 10px", color: "#a5d6ff", fontSize: "10px", lineHeight: 1.4 }}>{chem.health_based}</td>
                  </tr>

                  {/* Expanded row */}
                  {isSelected && (
                    <tr key={`${chem.cas}-exp`} style={{ background: "rgba(56,139,253,0.04)", borderBottom: "1px solid #388bfd" }}>
                      <td colSpan={10} style={{ padding: "10px 16px 12px 28px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                          <div>
                            <div style={{ color: "#8b949e", fontSize: "9px", letterSpacing: "1px", marginBottom: "4px" }}>FIELD NOTES & CONTEXT</div>
                            <div style={{ color: "#c9d1d9", fontSize: "11px", lineHeight: 1.6 }}>{chem.notes}</div>
                          </div>
                          <div>
                            <div style={{ color: "#8b949e", fontSize: "9px", letterSpacing: "1px", marginBottom: "4px" }}>CAL/OSHA PEL TWA</div>
                            <div style={{ color: "#c9d1d9", fontSize: "11px" }}>{chem.calosha_twa ? `${chem.calosha_twa} ppm` : "None established"}</div>
                            <div style={{ color: "#8b949e", fontSize: "9px", letterSpacing: "1px", marginTop: "8px", marginBottom: "4px" }}>HAZARD CATEGORY</div>
                            <div style={{ color: hc.dot, fontSize: "11px", fontWeight: 700 }}>{chem.category}</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #21262d", padding: "14px 24px", color: "#484f58", fontSize: "9px", lineHeight: 1.7 }}>
        <strong style={{ color: "#8b949e" }}>Sources:</strong> OSHA 29 CFR 1910.1000 Z-Tables · NIOSH Pocket Guide to Chemical Hazards (current ed.) · ACGIH TLV/BEI Book (2024) · EPA IRIS Database · ATSDR Minimal Risk Levels · WHO Air Quality Guidelines (2021) · AIHA Emergency Response Planning Guidelines (ERPGs) · Cal/OSHA Title 8 Table AC-1 · IARC Monographs<br />
        <strong style={{ color: "#8b949e" }}>Disclaimer:</strong> For reference only. Verify current limits with authoritative sources before use in compliance or emergency response decisions. ACGIH TLVs are copyrighted — purchase the annual TLV/BEI book for official use. Click any row to expand field notes.
      </div>
    </div>
  );
}
