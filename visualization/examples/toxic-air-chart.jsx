import { useState, useMemo } from "react";

// ── SCALE CONSTANTS ─────────────────────────────────────────────────────────
const LOG_W     = 700;
const LINEAR_W  = 9000;
const LIN_MAX   = 800;
const LIN_MAX_MG= 10;
const VB_H      = 96;
const R1 = 9;    // primary TWA
const R2 = 6;    // secondary ring (STEL/ceiling)
const MIN_LOG   = -6;
const MAX_LOG   = 4;
const MG_MIN_LOG= -4;
const MG_MAX_LOG= 2;

// ── COLORS ──────────────────────────────────────────────────────────────────
const C = {
  health : "#c084fc",  // purple
  epa    : "#fde047",  // bright yellow  ← distinct from NIOSH green
  acgih  : "#60a5fa",  // blue
  niosh  : "#34d399",  // teal-green
  osha   : "#fb923c",  // orange
  idlh   : "#f87171",  // red
};
const LANES = [
  { id:"health", label:"Health-Based  (WHO / ATSDR / EPA IRIS)", color:C.health, y:9  },
  { id:"epa",    label:"EPA NAAQS / Community ERPG",             color:C.epa,    y:24 },
  { id:"acgih",  label:"ACGIH TLV",                              color:C.acgih,  y:39 },
  { id:"niosh",  label:"NIOSH REL",                              color:C.niosh,  y:54 },
  { id:"osha",   label:"OSHA PEL",                               color:C.osha,   y:69 },
  { id:"idlh",   label:"IDLH — Immediate Danger to Life",        color:C.idlh,   y:84 },
];
const LM = Object.fromEntries(LANES.map(l=>[l.id,l]));

// ── SCALE HELPERS ────────────────────────────────────────────────────────────
function xCalc(val, isLog, isMg=false){
  if(!val||val<=0) return -999;
  if(isLog){
    const mn=isMg?MG_MIN_LOG:MIN_LOG, mx=isMg?MG_MAX_LOG:MAX_LOG;
    return ((Math.log10(val)-mn)/(mx-mn))*LOG_W;
  } else {
    return Math.min((val/(isMg?LIN_MAX_MG:LIN_MAX))*LINEAR_W, LINEAR_W-2);
  }
}
function isOff(val,isLog,isMg=false){ return isLog ? val<=0 : val>(isMg?LIN_MAX_MG:LIN_MAX); }

function getTicks(isLog,isMg=false){
  const ticks=[];
  if(isLog){
    const mn=isMg?MG_MIN_LOG:MIN_LOG, mx=isMg?MG_MAX_LOG:MAX_LOG;
    for(let l=mn;l<=mx;l++){
      const v=Math.pow(10,l);
      const label=l>=3?`${v/1000}k`:l===2?"100":l===1?"10":l===0?"1":l===-1?"0.1":l===-2?"0.01":l===-3?"0.001":`10⁻${Math.abs(l)}`;
      ticks.push({x:xCalc(v,true,isMg),label,minor:false});
      for(let m=2;m<=9;m++) ticks.push({x:xCalc(m*v,true,isMg),minor:true});
    }
  } else {
    const mx=isMg?LIN_MAX_MG:LIN_MAX, maj=isMg?1:100, step=isMg?0.5:25;
    for(let v=0;v<=mx+0.001;v+=step){
      const isMaj=Math.abs(v%maj)<0.001;
      ticks.push({x:(v/mx)*LINEAR_W,label:isMaj?String(Math.round(v)):null,minor:!isMaj});
    }
  }
  return ticks;
}

function rangeLines(thresholds,isLog,isMg=false){
  const grp={};
  thresholds.forEach(th=>{
    if(!grp[th.lane]) grp[th.lane]=[];
    const off=isOff(th.value,isLog,isMg);
    grp[th.lane].push({x:off?(isLog?LOG_W:LINEAR_W)-4:xCalc(th.value,isLog,isMg),off});
  });
  return Object.entries(grp).filter(([,p])=>p.length>1).map(([lid,pts])=>({
    lid,
    x1:Math.min(...pts.map(p=>p.x)),
    x2:Math.max(...pts.map(p=>p.x)),
    arrow:pts.some(p=>p.off),
  }));
}

// ── DATA ─────────────────────────────────────────────────────────────────────
// threshold props:
//   lane, value, label, secondary? (open ring), erpg? (1|2|3 → diamond sized by severity)
const CHEMS=[
  { name:"Carbon Monoxide",abbr:"CO",cas:"630-08-0",cat:"Combustion",hazard:"medium",carcinogen:false,
    thresholds:[
      {value:4,    lane:"health",label:"WHO 24-hr"},
      {value:9,    lane:"epa",   label:"EPA NAAQS 8-hr"},
      {value:35,   lane:"epa",   label:"EPA NAAQS 1-hr",secondary:true},
      {value:200,  lane:"epa",   label:"ERPG-1 (mild/transient)",erpg:1},
      {value:350,  lane:"epa",   label:"ERPG-2 (escape impaired)",erpg:2},
      {value:500,  lane:"epa",   label:"ERPG-3 (life-threatening)",erpg:3},
      {value:25,   lane:"acgih", label:"ACGIH TLV-TWA"},
      {value:35,   lane:"niosh", label:"NIOSH REL TWA"},
      {value:200,  lane:"niosh", label:"NIOSH Ceiling",secondary:true},
      {value:50,   lane:"osha",  label:"OSHA PEL TWA"},
      {value:1200, lane:"idlh",  label:"IDLH"},
    ],
    notes:"Odorless, colorless — no sensory warning. Binds hemoglobin 240× more strongly than O₂. #1 cause of accidental poisoning deaths in the US. OSHA PEL unchanged since 1971 — NIOSH TWA (35 ppm) and ACGIH TLV (25 ppm) are far more protective. ERPG-1 (200 ppm) = mild effects for 1-hr; ERPG-2 (350 ppm) = escape impaired; ERPG-3 (500 ppm) = life-threatening. IDLH at 1,200 ppm causes collapse within 1 hour.",
  },
  { name:"Formaldehyde",abbr:"HCHO",cas:"50-00-0",cat:"Combustion",hazard:"high",carcinogen:true,
    thresholds:[
      {value:0.0098,lane:"health",label:"EPA IRIS RfC chronic"},
      {value:0.08,  lane:"health",label:"WHO 30-min ceiling",secondary:true},
      {value:1,     lane:"epa",   label:"ERPG-1 (mild/transient)",erpg:1},
      {value:10,    lane:"epa",   label:"ERPG-2 (escape impaired)",erpg:2},
      {value:25,    lane:"epa",   label:"ERPG-3 (life-threatening)",erpg:3},
      {value:0.3,   lane:"acgih", label:"ACGIH TLV-Ceiling"},
      {value:0.016, lane:"niosh", label:"NIOSH REL TWA"},
      {value:0.1,   lane:"niosh", label:"NIOSH STEL 15-min",secondary:true},
      {value:0.5,   lane:"osha",  label:"OSHA Action Level",secondary:true},
      {value:0.75,  lane:"osha",  label:"OSHA PEL TWA"},
      {value:2,     lane:"osha",  label:"OSHA STEL 15-min",secondary:true},
      {value:20,    lane:"idlh",  label:"IDLH"},
    ],
    notes:"IARC Group 1 carcinogen. OSHA PEL (0.75 ppm) is ~47× higher than NIOSH REL (0.016 ppm) — one of the largest regulatory gaps of any chemical. ERPG-3 at 25 ppm shows how rapidly life-threatening concentrations exceed occupational limits. Note: ERPG-2 (10 ppm) is ~13× OSHA PEL, illustrating how the PEL is genuinely protective against acute injury but NOT against cancer risk.",
  },
  { name:"Benzene",abbr:"C₆H₆",cas:"71-43-2",cat:"Industrial",hazard:"high",carcinogen:true,
    thresholds:[
      {value:0.006,lane:"health",label:"ATSDR MRL chronic"},
      {value:50,   lane:"epa",   label:"ERPG-1 (mild/transient)",erpg:1},
      {value:150,  lane:"epa",   label:"ERPG-2 (escape impaired)",erpg:2},
      {value:1000, lane:"epa",   label:"ERPG-3 (life-threatening)",erpg:3},
      {value:0.5,  lane:"acgih", label:"ACGIH TLV-TWA (A1)"},
      {value:2.5,  lane:"acgih", label:"ACGIH STEL",secondary:true},
      {value:1,    lane:"niosh", label:"NIOSH Ceiling (LF)",secondary:true},
      {value:0.5,  lane:"osha",  label:"OSHA Action Level",secondary:true},
      {value:1,    lane:"osha",  label:"OSHA PEL TWA"},
      {value:5,    lane:"osha",  label:"OSHA STEL 15-min",secondary:true},
      {value:500,  lane:"idlh",  label:"IDLH"},
    ],
    notes:"IARC Group 1 carcinogen. No safe threshold. ERPG-1 (50 ppm) is 50× the OSHA PEL — note that while acute injury threshold is relatively high, the chronic cancer risk begins at sub-ppm levels. ATSDR chronic MRL of 0.006 ppm reflects leukemia risk starting well below any occupational limit.",
  },
  { name:"Acrolein",abbr:"CH₂CHCHO",cas:"107-02-8",cat:"Combustion",hazard:"high",carcinogen:false,
    thresholds:[
      {value:0.0000087,lane:"health",label:"EPA IRIS RfC (~8.7×10⁻⁶ ppm)"},
      {value:0.05,     lane:"epa",   label:"ERPG-1 (mild/transient)",erpg:1},
      {value:0.15,     lane:"epa",   label:"ERPG-2 (escape impaired)",erpg:2},
      {value:1.5,      lane:"epa",   label:"ERPG-3 (life-threatening)",erpg:3},
      {value:0.02,     lane:"acgih", label:"ACGIH TLV-TWA"},
      {value:0.05,     lane:"acgih", label:"ACGIH STEL",secondary:true},
      {value:0.1,      lane:"niosh", label:"NIOSH REL TWA"},
      {value:0.3,      lane:"niosh", label:"NIOSH STEL",secondary:true},
      {value:0.1,      lane:"osha",  label:"OSHA PEL TWA"},
      {value:2,        lane:"idlh",  label:"IDLH"},
    ],
    notes:"One of the most acutely toxic fire byproducts. ERPG-3 (1.5 ppm) nearly equals IDLH (2 ppm) — essentially no margin between life-threatening community exposure and immediate danger. ERPG-1 (0.05 ppm) shows that even mild effects begin just above the ACGIH TLV (0.02 ppm). The EPA IRIS chronic RfC at ~9 ppb is 5,500× below ERPG-1. Key combustion product from acrylates, polyurethane, fats.",
  },
  { name:"Hydrogen Sulfide",abbr:"H₂S",cas:"7783-06-4",cat:"Industrial",hazard:"high",carcinogen:false,
    thresholds:[
      {value:0.007,lane:"health",label:"ATSDR MRL chronic"},
      {value:0.1,  lane:"epa",   label:"ERPG-1 (mild/transient)",erpg:1},
      {value:30,   lane:"epa",   label:"ERPG-2 (escape impaired)",erpg:2},
      {value:100,  lane:"epa",   label:"ERPG-3 (life-threatening)",erpg:3},
      {value:1,    lane:"acgih", label:"ACGIH TLV-TWA"},
      {value:5,    lane:"acgih", label:"ACGIH STEL",secondary:true},
      {value:10,   lane:"niosh", label:"NIOSH Ceiling (10-min)"},
      {value:10,   lane:"osha",  label:"Cal/OSHA TWA"},
      {value:20,   lane:"osha",  label:"OSHA Ceiling"},
      {value:50,   lane:"osha",  label:"OSHA 10-min peak",secondary:true},
      {value:50,   lane:"idlh",  label:"IDLH"},
    ],
    notes:"Olfactory paralysis at 100–150 ppm (the ERPG-3 range) — workers lose warning sense at the exact concentration that is life-threatening. ERPG-2 to ERPG-3 gap (30→100 ppm) is relatively narrow. IDLH (50 ppm) falls between ERPG-2 and ERPG-3, reflecting that 50 ppm impairs escape but acute lethality requires higher concentration. Never rely on odor.",
  },
  { name:"Methyl Methacrylate",abbr:"MMA",cas:"80-62-6",cat:"Industrial",hazard:"medium",carcinogen:false,
    thresholds:[
      {value:50,   lane:"acgih", label:"ACGIH TLV-TWA"},
      {value:100,  lane:"acgih", label:"ACGIH STEL",secondary:true},
      {value:100,  lane:"niosh", label:"NIOSH REL TWA"},
      {value:100,  lane:"osha",  label:"OSHA PEL TWA"},
      {value:1000, lane:"idlh",  label:"IDLH"},
    ],
    notes:"No ERPG values established (AIHA 2023). IDLH (1,000 ppm) is primarily an explosion hazard (LEL 17,000 ppm = 1.7%) rather than acute toxicity concern. Respiratory/skin sensitizer — occupational asthma at sub-PEL levels. ACGIH TLV (50 ppm) half of OSHA PEL. Garden Grove 2026 incident chemical.",
  },
  { name:"Methacrylic Acid",abbr:"MAA",cas:"79-41-4",cat:"Combustion",hazard:"medium",carcinogen:false,
    thresholds:[
      {value:20,lane:"acgih",label:"ACGIH TLV-TWA (skin)"},
      {value:20,lane:"niosh",label:"NIOSH REL TWA (skin)"},
    ],
    notes:"No OSHA PEL, no ERPG, no IDLH established. NIOSH REL and ACGIH TLV govern at 20 ppm (both carry Skin notation). MMA thermal decomposition product. Corrosive to airways, skin, eyes. Low vapor pressure at ambient temperatures, but dramatically increases during fires.",
  },
  { name:"Methanol",abbr:"CH₃OH",cas:"67-56-1",cat:"Industrial",hazard:"medium",carcinogen:false,
    thresholds:[
      {value:20,   lane:"health",label:"EPA IRIS RfC / ATSDR MRL"},
      {value:200,  lane:"epa",   label:"ERPG-1 (mild/transient)",erpg:1},
      {value:1000, lane:"epa",   label:"ERPG-2 (escape impaired)",erpg:2},
      {value:5000, lane:"epa",   label:"ERPG-3 (life-threatening)",erpg:3},
      {value:200,  lane:"acgih", label:"ACGIH TLV-TWA (skin)"},
      {value:250,  lane:"acgih", label:"ACGIH STEL",secondary:true},
      {value:200,  lane:"niosh", label:"NIOSH REL TWA"},
      {value:250,  lane:"niosh", label:"NIOSH STEL",secondary:true},
      {value:200,  lane:"osha",  label:"OSHA PEL TWA"},
      {value:6000, lane:"idlh",  label:"IDLH"},
    ],
    notes:"ERPG values are high because methanol's acute lethality threshold is also high — the primary concern is chronic toxicity (blindness via formaldehyde/formate metabolism). OSHA PEL aligns with ERPG-1, meaning workers at PEL experience mild transient effects. EPA IRIS RfC (20 ppm) is based on developmental/CNS effects — 10× below occupational limits. IDLH (6,000 ppm) and ERPG-3 (5,000 ppm) both off the 800 ppm linear scale.",
  },
  { name:"Ammonia",abbr:"NH₃",cas:"7664-41-7",cat:"Industrial",hazard:"medium",carcinogen:false,
    thresholds:[
      {value:0.1,  lane:"health",label:"ATSDR MRL chronic"},
      {value:0.25, lane:"epa",   label:"WHO 24-hr community"},
      {value:25,   lane:"epa",   label:"ERPG-1 (mild/transient)",erpg:1},
      {value:150,  lane:"epa",   label:"ERPG-2 (escape impaired)",erpg:2},
      {value:750,  lane:"epa",   label:"ERPG-3 (life-threatening)",erpg:3},
      {value:25,   lane:"acgih", label:"ACGIH TLV-TWA"},
      {value:35,   lane:"acgih", label:"ACGIH STEL",secondary:true},
      {value:25,   lane:"niosh", label:"NIOSH REL TWA"},
      {value:35,   lane:"niosh", label:"NIOSH STEL",secondary:true},
      {value:50,   lane:"osha",  label:"OSHA PEL TWA"},
      {value:300,  lane:"idlh",  label:"IDLH"},
    ],
    notes:"ACGIH TLV and ERPG-1 both land at 25 ppm — showing occupational workers at the TLV are essentially at the mild community effect threshold. OSHA PEL (50 ppm) slightly above ERPG-1. IDLH (300 ppm) between ERPG-2 and ERPG-3. Pungent odor gives good warning at 5 ppm.",
  },
  { name:"Chlorine",abbr:"Cl₂",cas:"7782-50-5",cat:"Industrial",hazard:"high",carcinogen:false,
    thresholds:[
      {value:0.001,lane:"health",label:"ATSDR MRL chronic"},
      {value:1,    lane:"epa",   label:"ERPG-1 (mild/transient)",erpg:1},
      {value:3,    lane:"epa",   label:"ERPG-2 (escape impaired)",erpg:2},
      {value:20,   lane:"epa",   label:"ERPG-3 (life-threatening)",erpg:3},
      {value:0.5,  lane:"acgih", label:"ACGIH TLV-TWA"},
      {value:1,    lane:"acgih", label:"ACGIH STEL",secondary:true},
      {value:0.5,  lane:"niosh", label:"NIOSH Ceiling"},
      {value:1,    lane:"osha",  label:"OSHA Ceiling"},
      {value:10,   lane:"idlh",  label:"IDLH"},
    ],
    notes:"ERPG values are key for chlorine community planning. OSHA ceiling (1 ppm) = ERPG-1 level — occupational ceiling is set at mild community effect threshold. IDLH (10 ppm) falls between ERPG-2 and ERPG-3. ERPG-3 (20 ppm) = pulmonary edema territory. These ERPGs drive evacuation/shelter-in-place radii for chlorine releases.",
  },
  { name:"Sulfur Dioxide",abbr:"SO₂",cas:"7446-09-5",cat:"Combustion",hazard:"medium",carcinogen:false,
    thresholds:[
      {value:0.015,lane:"health",label:"WHO AQG 2021 24-hr"},
      {value:0.075,lane:"epa",   label:"EPA NAAQS 1-hr primary"},
      {value:0.3,  lane:"epa",   label:"ERPG-1 (mild/transient)",erpg:1},
      {value:3,    lane:"epa",   label:"ERPG-2 (escape impaired)",erpg:2},
      {value:15,   lane:"epa",   label:"ERPG-3 (life-threatening)",erpg:3},
      {value:0.25, lane:"acgih", label:"ACGIH TLV-Ceiling"},
      {value:2,    lane:"niosh", label:"NIOSH REL TWA"},
      {value:5,    lane:"niosh", label:"NIOSH STEL",secondary:true},
      {value:5,    lane:"osha",  label:"OSHA PEL TWA"},
      {value:100,  lane:"idlh",  label:"IDLH"},
    ],
    notes:"ERPG-1 (0.3 ppm) falls between ACGIH ceiling (0.25 ppm) and NIOSH TWA (2 ppm) — showing that mild community effects begin near best-practice occupational limits. OSHA PEL (5 ppm) = above ERPG-1 but below ERPG-2. Asthmatics may react at 0.1–0.5 ppm, below ERPG-1.",
  },
  { name:"Nitrogen Dioxide",abbr:"NO₂",cas:"10102-44-0",cat:"Combustion",hazard:"medium",carcinogen:false,
    thresholds:[
      {value:0.010,lane:"health",label:"WHO AQG 2021 annual"},
      {value:0.025,lane:"health",label:"WHO AQG 2021 24-hr",secondary:true},
      {value:0.053,lane:"epa",   label:"EPA NAAQS annual"},
      {value:0.1,  lane:"epa",   label:"EPA NAAQS 1-hr",secondary:true},
      {value:0.2,  lane:"acgih", label:"ACGIH TLV-Ceiling"},
      {value:1,    lane:"niosh", label:"NIOSH REL TWA"},
      {value:3,    lane:"niosh", label:"NIOSH STEL",secondary:true},
      {value:5,    lane:"osha",  label:"OSHA Ceiling"},
      {value:20,   lane:"idlh",  label:"IDLH"},
    ],
    notes:"No ERPG values listed in AIHA 2023 (delayed toxicity mechanism makes 1-hr ERPGs difficult to set). CRITICAL: delayed pulmonary edema 4–24 hours post-exposure. OSHA ceiling (5 ppm) is 25× the ACGIH TLV ceiling (0.2 ppm). Any exposure above 10 ppm warrants 24-hour medical observation even if asymptomatic.",
  },
  { name:"Toluene",abbr:"C₇H₈",cas:"108-88-3",cat:"Industrial",hazard:"medium",carcinogen:false,
    thresholds:[
      {value:5,   lane:"health",label:"EPA IRIS RfC chronic"},
      {value:50,  lane:"epa",   label:"ERPG-1 (mild/transient)",erpg:1},
      {value:300, lane:"epa",   label:"ERPG-2 (escape impaired)",erpg:2},
      {value:700, lane:"epa",   label:"ERPG-3 (life-threatening)",erpg:3},
      {value:20,  lane:"acgih", label:"ACGIH TLV-TWA"},
      {value:100, lane:"niosh", label:"NIOSH REL TWA"},
      {value:150, lane:"niosh", label:"NIOSH STEL",secondary:true},
      {value:200, lane:"osha",  label:"OSHA PEL TWA"},
      {value:300, lane:"osha",  label:"OSHA Ceiling",secondary:true},
      {value:500, lane:"osha",  label:"OSHA 10-min peak",secondary:true},
      {value:500, lane:"idlh",  label:"IDLH"},
    ],
    notes:"ACGIH TLV (20 ppm) is 10× below OSHA PEL (200 ppm) due to reproductive/developmental toxicity — classic case of regulatory lag. ERPG-2 (300 ppm) aligns with OSHA ceiling, and IDLH (500 ppm) falls between ERPG-2 and ERPG-3, showing OSHA ceiling was set near where acute escape impairment begins.",
  },
  { name:"Styrene",abbr:"C₈H₈",cas:"100-42-5",cat:"Industrial",hazard:"medium",carcinogen:false,
    thresholds:[
      {value:1,   lane:"health",label:"EPA IRIS RfC chronic"},
      {value:50,  lane:"epa",   label:"ERPG-1 (mild/transient)",erpg:1},
      {value:250, lane:"epa",   label:"ERPG-2 (escape impaired)",erpg:2},
      {value:750, lane:"epa",   label:"ERPG-3 (life-threatening)",erpg:3},
      {value:20,  lane:"acgih", label:"ACGIH TLV-TWA"},
      {value:40,  lane:"acgih", label:"ACGIH STEL",secondary:true},
      {value:50,  lane:"niosh", label:"NIOSH REL TWA"},
      {value:100, lane:"niosh", label:"NIOSH STEL",secondary:true},
      {value:100, lane:"osha",  label:"OSHA PEL TWA"},
      {value:200, lane:"osha",  label:"OSHA Ceiling",secondary:true},
      {value:700, lane:"idlh",  label:"IDLH"},
    ],
    notes:"ERPG-1 (50 ppm) equals NIOSH REL — mild effects begin at recommended occupational limit. IDLH (700 ppm) near ERPG-3 (750 ppm). NTP lists as reasonably anticipated carcinogen. ACGIH TLV (20 ppm) is 5× below OSHA PEL. Fiberglass, polystyrene, rubber manufacturing.",
  },
  { name:"Hydrogen Cyanide",abbr:"HCN",cas:"74-90-8",cat:"Combustion",hazard:"high",carcinogen:false,
    thresholds:[
      {value:0.005,lane:"health",label:"ATSDR MRL chronic"},
      {value:10,   lane:"epa",   label:"ERPG-2 (escape impaired)",erpg:2},
      {value:25,   lane:"epa",   label:"ERPG-3 (life-threatening)",erpg:3},
      {value:4.7,  lane:"acgih", label:"ACGIH TLV-Ceiling (skin)"},
      {value:10,   lane:"niosh", label:"NIOSH REL TWA (skin)"},
      {value:10,   lane:"osha",  label:"OSHA Ceiling (skin)"},
      {value:50,   lane:"idlh",  label:"IDLH"},
    ],
    notes:"No ERPG-1 established (AIHA 2023). ERPG-2 (10 ppm) = OSHA ceiling and NIOSH REL, meaning occupational limits are set at escape-impairment threshold — essentially no buffer. ERPG-3 (25 ppm) is well below IDLH (50 ppm), indicating life-threatening effects begin at half the IDLH value. ~40% of population cannot detect bitter almond odor. Antidote: Hydroxocobalamin.",
  },
  { name:"Vinyl Chloride",abbr:"VCM",cas:"75-01-4",cat:"Industrial",hazard:"high",carcinogen:true,
    thresholds:[
      {value:0.001,lane:"health",label:"ATSDR MRL chronic"},
      {value:0.5,  lane:"osha",  label:"OSHA Action Level",secondary:true},
      {value:1,    lane:"acgih", label:"ACGIH TLV-TWA (A1)"},
      {value:1,    lane:"niosh", label:"NIOSH Ceiling (LF)"},
      {value:1,    lane:"osha",  label:"OSHA PEL TWA"},
      {value:5,    lane:"osha",  label:"OSHA Excursion 15-min",secondary:true},
      {value:100,  lane:"idlh",  label:"IDLH"},
    ],
    notes:"No ERPG values listed for vinyl chloride (flammability primarily governs community risk). IARC Group 1 — hepatic angiosarcoma. ATSDR chronic MRL (0.001 ppm = 1 ppb) is 1,000× below PEL. Current 1 ppm PEL still carries measurable lifetime cancer risk per EPA IUR. Burning PVC releases both vinyl chloride and phosgene.",
  },
  { name:"Phosgene",abbr:"COCl₂",cas:"75-44-5",cat:"Combustion",hazard:"high",carcinogen:false,
    thresholds:[
      {value:0.1,  lane:"epa",   label:"ERPG-1 (mild/transient)",erpg:1},
      {value:0.5,  lane:"epa",   label:"ERPG-2 (escape impaired)",erpg:2},
      {value:1.5,  lane:"epa",   label:"ERPG-3 (life-threatening)",erpg:3},
      {value:0.1,  lane:"acgih", label:"ACGIH TLV-Ceiling"},
      {value:0.1,  lane:"niosh", label:"NIOSH REL TWA"},
      {value:0.1,  lane:"osha",  label:"OSHA PEL TWA"},
      {value:2,    lane:"idlh",  label:"IDLH"},
    ],
    notes:"ERPG-1 (0.1 ppm) equals the PEL, NIOSH REL, and ACGIH TLV ceiling — meaning workers at any permissible exposure level are simultaneously at the mild community effect threshold. Essentially no safety margin. ERPG-3 (1.5 ppm) below IDLH (2 ppm). Delayed pulmonary edema 4–24 hrs post-exposure. Mandatory 24-hr medical observation for any known exposure. From burning PVC, chlorinated solvents.",
  },
  { name:"Isocyanates (MDI/TDI)",abbr:"–NCO",cas:"101-68-8",cat:"Industrial",hazard:"high",carcinogen:false,
    thresholds:[
      {value:0.005, lane:"acgih", label:"ACGIH TLV-TWA"},
      {value:0.005, lane:"niosh", label:"NIOSH REL TWA"},
      {value:0.02,  lane:"niosh", label:"NIOSH STEL",secondary:true},
      {value:0.02,  lane:"osha",  label:"OSHA Ceiling"},
      {value:0.075, lane:"idlh",  label:"IDLH"},
    ],
    notes:"No ERPG values (sensitizer — no predictable concentration-response for sensitized individuals). Once sensitized, microgram-level exposures trigger severe asthma — no safe threshold. ~5–10% of exposed workers become sensitized. IDLH (0.075 ppm) is only 3.75× OSHA ceiling — extremely narrow margin. Leading cause of occupational asthma.",
  },
  { name:"Ozone",abbr:"O₃",cas:"10028-15-6",cat:"Ambient",hazard:"medium",carcinogen:false,
    thresholds:[
      {value:0.051,lane:"health",label:"WHO AQG 2021 8-hr"},
      {value:0.07, lane:"epa",   label:"EPA NAAQS 8-hr"},
      {value:0.05, lane:"acgih", label:"ACGIH TLV-TWA (light work)"},
      {value:0.1,  lane:"acgih", label:"ACGIH TLV (moderate work)",secondary:true},
      {value:0.05, lane:"niosh", label:"NIOSH REL (heavy work)",secondary:true},
      {value:0.1,  lane:"niosh", label:"NIOSH REL TWA"},
      {value:0.1,  lane:"osha",  label:"OSHA PEL TWA"},
      {value:5,    lane:"idlh",  label:"IDLH"},
    ],
    notes:"No ERPG values established. No safe level — linear dose-response for respiratory inflammation from 0.06 ppm. WHO AQG 2021 tightened to 0.051 ppm. ACGIH uniquely adjusts TLV by work intensity. Occupational and ambient standards cluster tightly between 0.05–0.1 ppm, with IDLH at 5 ppm.",
  },
  { name:"Ethylene Oxide",abbr:"EtO",cas:"75-21-8",cat:"Industrial",hazard:"high",carcinogen:true,
    thresholds:[
      {value:0.03, lane:"health",label:"ATSDR MRL chronic"},
      {value:1,    lane:"acgih", label:"ACGIH TLV-TWA (A1)"},
      {value:0.5,  lane:"osha",  label:"OSHA Action Level",secondary:true},
      {value:1,    lane:"osha",  label:"OSHA PEL TWA"},
      {value:5,    lane:"osha",  label:"OSHA Excursion 15-min",secondary:true},
      {value:800,  lane:"idlh",  label:"IDLH"},
    ],
    notes:"No ERPG values (flammability primary community risk concern). IARC Group 1 carcinogen. NIOSH: lowest feasible. ATSDR MRL (0.03 ppm) is 33× below OSHA PEL. EPA 2022 NESHAP significantly tightened hospital sterilizer limits. Any exposure carries measurable lifetime cancer risk.",
  },
];

const MG_CHEMS=[
  { name:"Silica, Crystalline",abbr:"SiO₂",cas:"14808-60-7",carcinogen:true,hazard:"high",
    thresholds:[
      {value:0.025,lane:"acgih",label:"ACGIH TLV-TWA"},
      {value:0.05, lane:"niosh", label:"NIOSH REL TWA"},
      {value:0.05, lane:"osha",  label:"OSHA PEL TWA"},
      {value:25,   lane:"idlh",  label:"IDLH"},
    ],
    notes:"IARC Group 1 carcinogen. OSHA PEL cut from 0.1→0.05 mg/m³ in 2016. ACGIH TLV half of OSHA/NIOSH. No ERPG values. Silicosis + lung cancer from respirable fraction. Construction, mining, foundry operations.",
  },
  { name:"Lead (inorganic)",abbr:"Pb",cas:"7439-92-1",carcinogen:true,hazard:"high",
    thresholds:[
      {value:0.03, lane:"osha",  label:"OSHA Action Level",secondary:true},
      {value:0.05, lane:"acgih", label:"ACGIH TLV-TWA"},
      {value:0.05, lane:"niosh", label:"NIOSH REL TWA"},
      {value:0.05, lane:"osha",  label:"OSHA PEL TWA"},
      {value:100,  lane:"idlh",  label:"IDLH"},
    ],
    notes:"No safe blood lead level. OSHA action level (0.03 mg/m³) triggers medical surveillance. No ERPG values. CDC considers any detectable blood lead harmful to developing brains. ACGIH TLV under review for significant reduction.",
  },
  { name:"Mercury Vapor",abbr:"Hg°",cas:"7439-97-6",carcinogen:false,hazard:"high",
    thresholds:[
      {value:0.001, lane:"health",label:"WHO chronic guideline"},
      {value:0.025, lane:"acgih", label:"ACGIH TLV-TWA"},
      {value:0.05,  lane:"niosh", label:"NIOSH REL TWA"},
      {value:0.1,   lane:"osha",  label:"OSHA PEL TWA"},
      {value:10,    lane:"idlh",  label:"IDLH"},
    ],
    notes:"ACGIH TLV (0.025 mg/m³) is 4× below OSHA PEL. WHO chronic (0.001 mg/m³) is 100× below OSHA PEL. No ERPG values. CNS damage and renal effects at sub-PEL levels. Particularly toxic to developing nervous system. Skin notation all agencies.",
  },
];

// ── CHART ROW ─────────────────────────────────────────────────────────────────
function ChemRow({chem, isLog, isMg, expanded, onToggle}){
  const [hov, setHov] = useState(null);
  const vbW = isLog ? LOG_W : LINEAR_W;
  const ticks = useMemo(()=>getTicks(isLog,isMg),[isLog,isMg]);
  const rl = useMemo(()=>rangeLines(chem.thresholds,isLog,isMg),[chem,isLog,isMg]);

  // Zone positions
  const e1 = useMemo(()=>{const t=chem.thresholds.find(t=>t.erpg===1); return t&&!isOff(t.value,isLog,isMg)?xCalc(t.value,isLog,isMg):null;},[chem,isLog,isMg]);
  const e2 = useMemo(()=>{const t=chem.thresholds.find(t=>t.erpg===2); return t&&!isOff(t.value,isLog,isMg)?xCalc(t.value,isLog,isMg):null;},[chem,isLog,isMg]);
  const e3 = useMemo(()=>{const t=chem.thresholds.find(t=>t.erpg===3); return t&&!isOff(t.value,isLog,isMg)?xCalc(t.value,isLog,isMg):null;},[chem,isLog,isMg]);
  const idx = useMemo(()=>{const t=chem.thresholds.find(t=>t.lane==="idlh"); return t&&!isOff(t.value,isLog,isMg)?xCalc(t.value,isLog,isMg):null;},[chem,isLog,isMg]);

  const hbg = chem.hazard==="high" ? "#f87171" : "#fb923c";

  return (
    <div style={{borderBottom:"1px solid #1c2128"}}>
      <div onClick={onToggle} style={{display:"flex",alignItems:"center",cursor:"pointer",
        background:expanded?"rgba(56,139,253,0.05)":"transparent",transition:"background 0.1s"}}
        onMouseEnter={e=>{if(!expanded)e.currentTarget.style.background="#0d1117";}}
        onMouseLeave={e=>{if(!expanded)e.currentTarget.style.background="transparent";}}>

        {/* Sticky name */}
        <div style={{width:168,flexShrink:0,position:"sticky",left:0,zIndex:3,
          background:expanded?"#0a0e16":"#090c10",padding:"6px 8px 6px 12px",
          borderLeft:`2px solid ${hbg}`}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{fontSize:11,fontWeight:700,color:"#e6edf3",lineHeight:1.3}}>{chem.name}</span>
            {chem.carcinogen&&<span style={{color:"#f0883e",fontSize:10,flexShrink:0}}>★</span>}
          </div>
          <div style={{fontSize:9,color:"#484f58",marginTop:1}}>
            {chem.abbr}{isMg&&<span style={{color:"#6e7681",marginLeft:3}}>mg/m³</span>}
          </div>
          <div style={{fontSize:8,color:"#30363d"}}>{chem.cas}</div>
        </div>

        {/* SVG track */}
        <div style={{flex:1,minWidth:isLog?500:LINEAR_W,padding:"3px 4px 3px 0"}}>
          <svg viewBox={`0 0 ${vbW} ${VB_H}`}
            width={isLog?"100%":LINEAR_W}
            height={VB_H}
            style={{display:"block",overflow:"visible"}}>

            {/* Lane bands */}
            {LANES.map((ln,i)=>(
              <rect key={ln.id} x={0} y={ln.y-7} width={vbW} height={14}
                fill={i%2===0?"rgba(255,255,255,0.016)":"transparent"}/>
            ))}

            {/* Grid */}
            {ticks.map((t,i)=>(
              <line key={i} x1={t.x} y1={0} x2={t.x} y2={VB_H}
                stroke={t.minor?"#191e25":"#2a3040"} strokeWidth={t.minor?0.4:0.7}/>
            ))}

            {/* ERPG zone fills — drawn before lines */}
            {e1&&e2&&<rect x={e1} y={0} width={Math.max(0,e2-e1)} height={VB_H} fill="rgba(253,224,71,0.04)"/>}
            {e2&&e3&&<rect x={e2} y={0} width={Math.max(0,e3-e2)} height={VB_H} fill="rgba(251,146,60,0.05)"/>}
            {(e3||idx)&&<rect x={e3||(idx||0)} y={0} width={vbW-(e3||(idx||0))} height={VB_H} fill="rgba(248,113,113,0.04)"/>}

            {/* ERPG vertical zone lines */}
            {e1&&<line x1={e1} y1={0} x2={e1} y2={VB_H} stroke="#fde047" strokeWidth={0.9} strokeDasharray="4,3" opacity={0.45}/>}
            {e2&&<line x1={e2} y1={0} x2={e2} y2={VB_H} stroke="#fb923c" strokeWidth={0.9} strokeDasharray="4,3" opacity={0.45}/>}
            {e3&&<line x1={e3} y1={0} x2={e3} y2={VB_H} stroke="#f87171" strokeWidth={1.1} strokeDasharray="4,2" opacity={0.55}/>}

            {/* IDLH solid vertical line */}
            {idx&&<line x1={idx} y1={0} x2={idx} y2={VB_H} stroke="#f87171" strokeWidth={1.5} opacity={0.3}/>}

            {/* Range lines */}
            {rl.map((r,i)=>{
              const ln=LM[r.lid]; if(!ln) return null;
              return (
                <g key={i}>
                  <line x1={r.x1} y1={ln.y} x2={r.x2} y2={ln.y}
                    stroke={ln.color} strokeWidth={2.5} opacity={0.32} strokeLinecap="round"/>
                  {r.arrow&&(
                    <path d={`M${r.x2-2},${ln.y-4} L${r.x2+6},${ln.y} L${r.x2-2},${ln.y+4}`}
                      fill={ln.color} opacity={0.45}/>
                  )}
                </g>
              );
            })}

            {/* Threshold markers */}
            {chem.thresholds.map((th,i)=>{
              const ln=LM[th.lane]; if(!ln) return null;
              const off=isOff(th.value,isLog,isMg);
              const cx=off?(isLog?LOG_W:LINEAR_W)-10:xCalc(th.value,isLog,isMg);
              if(cx<-8) return null;
              const isH=hov===i;

              // ERPG → diamond
              if(th.erpg){
                const dr=[6,8,10][th.erpg-1];
                const pts=`${cx},${ln.y-dr} ${cx+dr},${ln.y} ${cx},${ln.y+dr} ${cx-dr},${ln.y}`;
                return (
                  <g key={i} onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)} style={{cursor:"crosshair"}}>
                    {off&&<text x={cx+1} y={ln.y+4} fontSize={11} fill={ln.color} opacity={0.5} fontFamily="monospace">→</text>}
                    <polygon points={pts}
                      fill={isH?ln.color:ln.color+"cc"}
                      stroke={isH?"#fff4":"transparent"} strokeWidth={1}/>
                  </g>
                );
              }

              // Secondary → open ring
              if(th.secondary){
                return (
                  <g key={i} onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)} style={{cursor:"crosshair"}}>
                    {off&&<text x={cx+1} y={ln.y+4} fontSize={11} fill={ln.color} opacity={0.5} fontFamily="monospace">→</text>}
                    <circle cx={cx} cy={ln.y} r={R2}
                      fill={isH?ln.color+"33":"transparent"}
                      stroke={ln.color} strokeWidth={isH?2.5:1.8} opacity={0.85}/>
                  </g>
                );
              }

              // Primary → solid circle
              return (
                <g key={i} onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)} style={{cursor:"crosshair"}}>
                  {off&&<text x={cx+1} y={ln.y+4} fontSize={11} fill={ln.color} opacity={0.5} fontFamily="monospace">→</text>}
                  <circle cx={cx} cy={ln.y} r={R1}
                    fill={isH?ln.color:ln.color+"cc"}
                    stroke={isH?"#fff3":"transparent"} strokeWidth={1.5}/>
                </g>
              );
            })}

            {/* Hover tooltip */}
            {hov!==null&&(()=>{
              const th=chem.thresholds[hov]; if(!th) return null;
              const ln=LM[th.lane]; if(!ln) return null;
              const off=isOff(th.value,isLog,isMg);
              const cx=off?(isLog?LOG_W:LINEAR_W)-10:xCalc(th.value,isLog,isMg);
              const unit=isMg?"mg/m³":"ppm";
              const v=th.value<0.0001?th.value.toExponential(2):String(th.value);
              const str=off?`${th.label}: >${isMg?LIN_MAX_MG:LIN_MAX} ${unit}`:
                `${th.label}: ${v} ${unit}`;
              const tw=Math.min(str.length*5.6+18, vbW*0.42);
              const tx=Math.max(4, Math.min(cx-tw/2, vbW-tw-4));
              const ty=ln.y<42?ln.y+13:ln.y-27;
              return (
                <g>
                  <line x1={cx} y1={0} x2={cx} y2={VB_H}
                    stroke={ln.color} strokeWidth={0.9} strokeDasharray="3,2" opacity={0.45}/>
                  <rect x={tx} y={ty} width={tw} height={17} rx={3}
                    fill="#161b22" stroke={ln.color} strokeWidth={0.9}/>
                  <text x={tx+tw/2} y={ty+12} textAnchor="middle"
                    fill={ln.color} fontSize={9} fontFamily="IBM Plex Mono,monospace">{str}</text>
                </g>
              );
            })()}
          </svg>
        </div>

        <div style={{width:20,flexShrink:0,color:"#484f58",fontSize:9,textAlign:"center",
          position:"sticky",right:0}}>
          {expanded?"▲":"▼"}
        </div>
      </div>

      {/* Expanded notes */}
      {expanded&&(
        <div style={{padding:"10px 12px 12px 16px",background:"rgba(56,139,253,0.03)",
          borderLeft:"2px solid #388bfd",marginLeft:14}}>
          <div style={{fontSize:9,color:"#8b949e",letterSpacing:"1.5px",marginBottom:5}}>NOTES & CONTEXT</div>
          <p style={{fontSize:11,color:"#c9d1d9",margin:"0 0 8px",lineHeight:1.7}}>{chem.notes}</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {chem.thresholds.map((th,i)=>{
              const ln=LM[th.lane];
              const unit=isMg?"mg/m³":"ppm";
              const v=th.value<0.0001?th.value.toExponential(2):th.value;
              return (
                <span key={i} style={{fontSize:9,padding:"2px 6px",borderRadius:3,
                  background:`${ln.color}15`,border:`1px solid ${ln.color}40`,color:ln.color}}>
                  {th.label}: {v} {unit}
                  {th.erpg ? ` ◆` : th.secondary ? " ◦" : " ●"}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SCALE HEADER ─────────────────────────────────────────────────────────────
function ScaleHeader({isLog,isMg}){
  const vbW=isLog?LOG_W:LINEAR_W;
  const ticks=useMemo(()=>getTicks(isLog,isMg),[isLog,isMg]);
  return (
    <div style={{display:"flex",alignItems:"flex-end",background:"#0d1117",
      borderBottom:"1px solid #30363d",paddingBottom:2}}>
      <div style={{width:168,flexShrink:0,position:"sticky",left:0,zIndex:3,
        background:"#0d1117",padding:"4px 8px 3px 12px",fontSize:8,color:"#484f58"}}>
        CHEMICAL {isMg?"(mg/m³)":"(ppm)"}
      </div>
      <div style={{flex:1,minWidth:isLog?500:LINEAR_W,padding:"0 4px 0 0"}}>
        <svg viewBox={`0 0 ${vbW} 22`} width={isLog?"100%":LINEAR_W} height={22} style={{display:"block"}}>
          {ticks.filter(t=>!t.minor&&t.label).map((t,i)=>(
            <g key={i}>
              <line x1={t.x} y1={0} x2={t.x} y2={12} stroke="#3d4450" strokeWidth={0.8}/>
              <text x={t.x} y={20} textAnchor="middle" fontSize={8}
                fill="#6e7681" fontFamily="IBM Plex Mono,monospace">{t.label}</text>
            </g>
          ))}
        </svg>
      </div>
      <div style={{width:20,flexShrink:0}}/>
    </div>
  );
}

// ── LANE LABEL ROW ───────────────────────────────────────────────────────────
function LaneHeader({isLog}){
  const vbW=isLog?LOG_W:LINEAR_W;
  return (
    <div style={{display:"flex",background:"#0a0c10",borderBottom:"1px solid #1c2128"}}>
      <div style={{width:168,flexShrink:0,position:"sticky",left:0,zIndex:3,background:"#0a0c10"}}/>
      <div style={{flex:1,minWidth:isLog?500:LINEAR_W,padding:"0 4px 0 0"}}>
        <svg viewBox={`0 0 ${vbW} ${VB_H}`} width={isLog?"100%":LINEAR_W} height={VB_H} style={{display:"block"}}>
          {LANES.map(ln=>(
            <text key={ln.id} x={4} y={ln.y+4} fontSize={8} fill={ln.color}
              opacity={0.5} fontFamily="IBM Plex Mono,monospace">{ln.label}</text>
          ))}
        </svg>
      </div>
      <div style={{width:20,flexShrink:0}}/>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function ToxicAirChart(){
  const [isLog, setIsLog]       = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch]     = useState("");
  const [catF, setCatF]         = useState("All");
  const [carcF, setCarcF]       = useState(false);

  const cats=["All","Combustion","Industrial","Ambient"];
  const filtered=useMemo(()=>CHEMS.filter(c=>{
    if(catF!=="All"&&!c.cat.includes(catF)) return false;
    if(carcF&&!c.carcinogen) return false;
    const q=search.toLowerCase();
    return !q||c.name.toLowerCase().includes(q)||c.abbr.toLowerCase().includes(q);
  }),[catF,carcF,search]);

  const tog=cas=>setExpanded(e=>e===cas?null:cas);

  return (
    <div style={{fontFamily:"'IBM Plex Mono',monospace",background:"#090c10",minHeight:"100vh",color:"#c9d1d9"}}>

      {/* Header */}
      <div style={{background:"#0d1117",borderBottom:"1px solid #21262d",padding:"16px 20px 12px"}}>
        <div style={{fontSize:10,color:"#f0883e",letterSpacing:"3px",fontWeight:700,marginBottom:3}}>AIR TOXICOLOGY REFERENCE</div>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <h1 style={{fontSize:17,fontWeight:700,color:"#e6edf3",margin:0,letterSpacing:"-0.3px"}}>
            Toxic Air Contaminant Exposure Thresholds
          </h1>
          <div style={{display:"flex",borderRadius:6,overflow:"hidden",border:"1px solid #30363d",flexShrink:0}}>
            <button onClick={()=>setIsLog(true)} style={{padding:"5px 14px",fontSize:11,fontFamily:"inherit",cursor:"pointer",
              border:"none",background:isLog?"#1f3a5f":"#161b22",color:isLog?"#58a6ff":"#8b949e",fontWeight:isLog?700:400}}>
              ⌇ LOG
            </button>
            <button onClick={()=>setIsLog(false)} style={{padding:"5px 14px",fontSize:11,fontFamily:"inherit",cursor:"pointer",
              border:"none",borderLeft:"1px solid #30363d",
              background:!isLog?"#3a2a10":"#161b22",color:!isLog?"#f0883e":"#8b949e",fontWeight:!isLog?700:400}}>
              ▬ LINEAR
            </button>
          </div>
        </div>
        <p style={{color:"#8b949e",fontSize:10,margin:"4px 0 0"}}>
          {isLog?"Log scale 0.000001 → 10,000 ppm · equal width per decade"
            :`Linear 0 → ${LIN_MAX} ppm · scroll right · → = value exceeds scale`}
          {" · "}Hover markers for values · Click row to expand notes
        </p>
      </div>

      {/* Legend */}
      <div style={{background:"#0d1117",borderBottom:"1px solid #21262d",padding:"8px 20px 6px"}}>
        <div style={{display:"flex",gap:0,flexWrap:"wrap",alignItems:"center",marginBottom:5}}>
          {LANES.map(ln=>(
            <div key={ln.id} style={{display:"flex",alignItems:"center",gap:4,marginRight:14,marginBottom:2}}>
              <svg width={12} height={12}><circle cx={6} cy={6} r={5} fill={ln.color} opacity={0.85}/></svg>
              <span style={{fontSize:9,color:ln.color}}>{ln.label}</span>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:0,flexWrap:"wrap",alignItems:"center"}}>
          {/* Marker types */}
          <div style={{display:"flex",alignItems:"center",gap:4,marginRight:14,marginBottom:2}}>
            <svg width={12} height={12}><circle cx={6} cy={6} r={5} fill="#8b949e" opacity={0.8}/></svg>
            <span style={{fontSize:9,color:"#8b949e"}}>● Primary TWA</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4,marginRight:14,marginBottom:2}}>
            <svg width={12} height={12}><circle cx={6} cy={6} r={4} fill="none" stroke="#8b949e" strokeWidth={1.5}/></svg>
            <span style={{fontSize:9,color:"#8b949e"}}>◦ STEL / Ceiling</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4,marginRight:14,marginBottom:2}}>
            <svg width={12} height={12}><polygon points="6,0 10,6 6,12 2,6" fill={C.epa} opacity={0.8}/></svg>
            <span style={{fontSize:9,color:C.epa}}>◆ ERPG-1  mild / transient effects (1-hr)</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4,marginRight:14,marginBottom:2}}>
            <svg width={14} height={14}><polygon points="7,0 12,7 7,14 2,7" fill={C.epa} opacity={0.8}/></svg>
            <span style={{fontSize:9,color:C.epa}}>◆ ERPG-2  irreversible / escape-impairing (1-hr)</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4,marginRight:14,marginBottom:2}}>
            <svg width={18} height={18}><polygon points="9,0 16,9 9,18 2,9" fill={C.epa} opacity={0.8}/></svg>
            <span style={{fontSize:9,color:C.epa}}>◆ ERPG-3  life-threatening (1-hr)</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4,marginRight:14,marginBottom:2}}>
            <span style={{color:"#f0883e",fontSize:10}}>★</span>
            <span style={{fontSize:9,color:"#8b949e"}}>Carcinogen (IARC/NTP)</span>
          </div>
        </div>
        {/* Zone key */}
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:4}}>
          {[["rgba(253,224,71,0.25)","#fde047","ERPG-1 → -2 zone (mild effects)"],
            ["rgba(251,146,60,0.25)","#fb923c","ERPG-2 → -3 zone (serious/irreversible)"],
            ["rgba(248,113,113,0.25)","#f87171","Beyond ERPG-3 / IDLH zone (life-threatening)"]].map(([bg,bc,label])=>(
            <div key={label} style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:20,height:8,background:bg,border:`1px solid ${bc}44`,borderRadius:2}}/>
              <span style={{fontSize:9,color:"#6e7681"}}>{label}</span>
            </div>
          ))}
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <svg width={20} height={8}>
              <line x1={10} y1={0} x2={10} y2={8} stroke="#f87171" strokeWidth={1.5} opacity={0.35}/>
            </svg>
            <span style={{fontSize:9,color:"#6e7681"}}>Solid vertical = IDLH boundary</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <svg width={20} height={8}>
              <line x1={10} y1={0} x2={10} y2={8} stroke="#fde047" strokeWidth={1} strokeDasharray="3,2" opacity={0.5}/>
            </svg>
            <span style={{fontSize:9,color:"#6e7681"}}>Dashed = ERPG boundary</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{background:"#0d1117",borderBottom:"1px solid #1c2128",padding:"7px 20px",
        display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter chemicals..."
          style={{background:"#161b22",border:"1px solid #30363d",color:"#c9d1d9",
            padding:"4px 10px",borderRadius:5,fontSize:10,width:170,outline:"none",fontFamily:"inherit"}}/>
        {cats.map(c=>(
          <button key={c} onClick={()=>setCatF(c)} style={{padding:"3px 9px",borderRadius:20,
            fontSize:10,fontFamily:"inherit",cursor:"pointer",
            border:catF===c?"1px solid #388bfd":"1px solid #30363d",
            background:catF===c?"#1f3a5f":"#161b22",color:catF===c?"#58a6ff":"#8b949e"}}>
            {c}
          </button>
        ))}
        <button onClick={()=>setCarcF(!carcF)} style={{padding:"3px 9px",borderRadius:20,
          fontSize:10,fontFamily:"inherit",cursor:"pointer",
          border:carcF?"1px solid #f0883e":"1px solid #30363d",
          background:carcF?"rgba(240,136,62,0.12)":"#161b22",color:carcF?"#f0883e":"#8b949e"}}>
          ★ Carcinogens
        </button>
        <span style={{fontSize:9,color:"#484f58",marginLeft:"auto"}}>{filtered.length} chemicals</span>
      </div>

      {/* ppm chart */}
      <div style={{overflowX:isLog?"hidden":"auto"}}>
        <ScaleHeader isLog={isLog} isMg={false}/>
        <LaneHeader isLog={isLog}/>
        {filtered.map(c=>(
          <ChemRow key={c.cas} chem={c} isLog={isLog} isMg={false}
            expanded={expanded===c.cas} onToggle={()=>tog(c.cas)}/>
        ))}
        {filtered.length===0&&(
          <div style={{padding:30,textAlign:"center",color:"#484f58",fontSize:11}}>No chemicals match filters.</div>
        )}
      </div>

      {/* mg/m³ section */}
      <div style={{borderTop:"2px solid #30363d",marginTop:8}}>
        <div style={{background:"#0d1117",padding:"10px 20px 6px",borderBottom:"1px solid #21262d"}}>
          <span style={{fontSize:10,color:"#f0883e",letterSpacing:"2px",fontWeight:700}}>PARTICULATE / METALS — mg/m³</span>
          <span style={{fontSize:10,color:"#8b949e",marginLeft:10}}>
            Same visual system · independent scale ·
            {isLog?` log ${Math.pow(10,MG_MIN_LOG)}–${Math.pow(10,MG_MAX_LOG)} mg/m³`
              :` linear 0–${LIN_MAX_MG} mg/m³`}
          </span>
        </div>
        <div style={{overflowX:isLog?"hidden":"auto"}}>
          <ScaleHeader isLog={isLog} isMg={true}/>
          <LaneHeader isLog={isLog}/>
          {MG_CHEMS.map(c=>(
            <ChemRow key={c.cas} chem={c} isLog={isLog} isMg={true}
              expanded={expanded===c.cas+"_mg"} onToggle={()=>tog(c.cas+"_mg")}/>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{borderTop:"1px solid #21262d",padding:"12px 20px",color:"#484f58",fontSize:9,lineHeight:1.8}}>
        <strong style={{color:"#6e7681"}}>Sources:</strong> OSHA 29 CFR 1910.1000 · NIOSH Pocket Guide (current) · ACGIH TLV/BEI (2024) ·
        EPA IRIS · ATSDR MRLs · WHO AQGs (2021) · AIHA Emergency Response Planning Guidelines — ERPGs (2023) · Cal/OSHA Title 8 · IARC Monographs · NTP RoC<br/>
        <strong style={{color:"#6e7681"}}>ERPG:</strong> Emergency Response Planning Guidelines (AIHA) — 1-hour exposure limits for community planning.
        ERPG-1: max concentration avoiding mild/transient effects.
        ERPG-2: max avoiding irreversible or escape-impairing effects.
        ERPG-3: max avoiding life-threatening effects. "No ERPG" = value not established by AIHA 2023.<br/>
        <strong style={{color:"#f0883e"}}>Note:</strong> OSHA PELs date to 1968–1971 and are widely inadequate by modern toxicology. NIOSH/ACGIH/WHO values reflect current science. Health-based limits are most protective.
      </div>
    </div>
  );
}
