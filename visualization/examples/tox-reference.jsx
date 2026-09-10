import { useState, useMemo } from "react";

// ═══ SCALE + HELPERS ════════════════════════════════════════════════════════
const PLT = { x0:58, y0:28, w:650, h:400 };
const TL=-1.08, TH=5.2, CL=-3.5, CH=4.2;
const tx = h => PLT.x0+((Math.log10(Math.max(h,1e-9))-TL)/(TH-TL))*PLT.w;
const cy = p => PLT.y0+PLT.h*(1-(Math.log10(Math.max(p,1e-9))-CL)/(CH-CL));
const MIN = m=>m/60;
function bandPath(top,bot){
  if(!top||!bot)return"";
  const f=top.map(([t,c])=>`${tx(t).toFixed(1)},${cy(c).toFixed(1)}`);
  const b=[...bot].reverse().map(([t,c])=>`${tx(t).toFixed(1)},${cy(c).toFixed(1)}`);
  return`M${f.join("L")}L${b.join("L")}Z`;
}
function abovePath(pts){
  if(!pts||pts.length<2)return"";
  const p=pts.map(([t,c])=>`${tx(t).toFixed(1)},${cy(c).toFixed(1)}`);
  const x1=tx(pts[0][0]),xN=tx(pts[pts.length-1][0]);
  return`M${p.join("L")}L${xN},${PLT.y0}L${x1},${PLT.y0}Z`;
}
function belowPath(pts){
  if(!pts||pts.length<2)return"";
  const p=pts.map(([t,c])=>`${tx(t).toFixed(1)},${cy(c).toFixed(1)}`);
  const x1=tx(pts[0][0]),xN=tx(pts[pts.length-1][0]),yB=PLT.y0+PLT.h;
  return`M${p.join("L")}L${xN},${yB}L${x1},${yB}Z`;
}

// ═══ AEGL DATA ══════════════════════════════════════════════════════════════
const T5=[MIN(10),MIN(30),1,4,8];
const AEGL=[
  { id:"Cl2",name:"Chlorine",abbr:"Cl₂",cas:"7782-50-5",cat:"Industrial / Emergency",
    status:"Final",ref:"NRC Vol.1, 2004",url:"https://www.epa.gov/aegl/chlorine-results-aegl-program",color:"#facc15",
    aegl1:[[MIN(10),0.5],[MIN(30),0.5],[1,0.5],[4,0.5],[8,0.5]],
    aegl2:[[MIN(10),2.8],[MIN(30),2.8],[1,2.0],[4,1.0],[8,0.71]],
    aegl3:[[MIN(10),50],[MIN(30),28],[1,20],[4,10],[8,7.1]],
    stel:{v:1,t:MIN(15),label:"OSHA Ceiling"},twa:{v:0.5,label:"ACGIH TLV-TWA"},
    chronic:{v:0.001,t:87600,label:"ATSDR MRL chronic"},idlh:10,
    odorThreshold:"~0.5 ppm",odorDesc:"Sharp, bleach-like. Good warning properties — detectable at AEGL-1 level. Olfactory fatigue can occur above 3 ppm.",
    sources:"Water treatment plants, chemical manufacturing (PVC, solvents), paper/pulp bleaching, pool maintenance, pool chemical spills, rail/truck transport incidents.",
    note1:"AEGL-1 flat at 0.5 ppm (concentration-driven irritant). AEGL-2 and -3 show Haber-rule slope. Pulmonary edema above 10 ppm.",
    note2:"OSHA ceiling (1 ppm) = ERPG-1 level. Workers at ceiling are at the mild community effect threshold."
  },
  { id:"NH3",name:"Ammonia",abbr:"NH₃",cas:"7664-41-7",cat:"Industrial / Emergency",
    status:"Final",ref:"NRC Vol.3, 2007",url:"https://www.epa.gov/aegl/ammonia-results-aegl-program",color:"#34d399",
    aegl1:[[MIN(10),30],[MIN(30),30],[1,30],[4,30],[8,30]],
    aegl2:[[MIN(10),220],[MIN(30),220],[1,160],[4,110],[8,110]],
    aegl3:[[MIN(10),2700],[MIN(30),1600],[1,1100],[4,550],[8,390]],
    stel:{v:35,t:MIN(15),label:"ACGIH STEL"},twa:{v:25,label:"ACGIH TLV-TWA"},
    chronic:{v:0.1,t:87600,label:"ATSDR MRL chronic"},idlh:300,
    odorThreshold:"~5 ppm",odorDesc:"Strong, pungent. Good warning at low concentrations. Olfactory fatigue develops with prolonged exposure above 50 ppm.",
    sources:"Refrigeration systems (industrial and cold storage), fertilizer manufacturing and application, livestock operations (manure pits), industrial cleaning, wastewater treatment.",
    note1:"AEGL-1 flat at 30 ppm (pungent odor threshold). ACGIH TLV (25 ppm) sits just below AEGL-1. Steep AEGL-3: 2,700 ppm at 10 min vs 390 ppm at 8 hr.",
    note2:"AEGL-2 relatively flat (220→110 ppm) — moderate Haber slope. Common refrigerant release scenario."
  },
  { id:"CO",name:"Carbon Monoxide",abbr:"CO",cas:"630-08-0",cat:"Combustion",
    status:"Final",ref:"NRC Vol.6, 2010",url:"https://www.epa.gov/aegl/carbon-monoxide-results-aegl-program",color:"#fb923c",
    aegl1:null,
    aegl2:[[MIN(10),420],[MIN(30),150],[1,83],[4,33],[8,27]],
    aegl3:[[MIN(10),1700],[MIN(30),600],[1,330],[4,150],[8,130]],
    stel:null,twa:{v:25,label:"ACGIH TLV-TWA"},
    chronic:{v:9,t:8760,label:"EPA NAAQS 8-hr"},idlh:1200,
    odorThreshold:"None — completely odorless",odorDesc:"No odor, no color, no taste. Impossible to detect without instrumentation. AEGL-1 = NR (not recommended): no safe threshold can be defined.",
    sources:"Combustion of any carbon-based fuel: vehicle exhaust, fires, generators, gas appliances, furnaces, charcoal grills, propane equipment, industrial furnaces. #1 cause of accidental poisoning deaths in the U.S.",
    note1:"AEGL-1 = NR. Classic Haber slope: AEGL-2 drops from 420 ppm (10-min) to 27 ppm (8-hr).",
    note2:"Odorless — zero sensory warning. CO binds hemoglobin 240× more strongly than O₂. Must use electrochemical sensor."
  },
  { id:"HCN",name:"Hydrogen Cyanide",abbr:"HCN",cas:"74-90-8",cat:"Combustion",
    status:"Final",ref:"NRC Vol.2, 2002",url:"https://www.epa.gov/aegl/hydrogen-cyanide-results-aegl-program",color:"#c084fc",
    aegl1:[[MIN(10),2.5],[MIN(30),2.5],[1,2.5],[4,2.5],[8,2.5]],
    aegl2:[[MIN(10),17],[MIN(30),10],[1,7.1],[4,3.5],[8,2.5]],
    aegl3:[[MIN(10),27],[MIN(30),21],[1,15],[4,8.6],[8,6.6]],
    stel:null,twa:{v:4.7,label:"ACGIH TLV-Ceiling"},
    chronic:{v:0.005,t:87600,label:"ATSDR MRL chronic"},idlh:50,
    odorThreshold:"~1–5 ppm (bitter almonds) — but ~40% of people cannot detect it genetically",odorDesc:"Bitter almond odor for those who can detect it. Olfactory fatigue occurs rapidly. NEVER rely on smell for HCN detection.",
    sources:"Burning nitrogen-containing materials: polyurethane foam, wool, silk, nylon, ABS plastic, upholstery. Electroplating facilities. Chemical synthesis. Structure fires are the primary exposure route.",
    note1:"AEGL-1 flat at 2.5 ppm. At 8-hr, AEGL-2 (2.5 ppm) meets AEGL-1 — essentially no margin at longer durations.",
    note2:"IDLH (50 ppm) between AEGL-2 and AEGL-3. Antidote: Hydroxocobalamin (Cyanokit). Key fire fatality contributor alongside CO."
  },
  { id:"COCl2",name:"Phosgene",abbr:"COCl₂",cas:"75-44-5",cat:"Combustion",
    status:"Final",ref:"NRC Vol.1, 2002",url:"https://www.epa.gov/aegl/phosgene-results-aegl-program",color:"#f87171",
    aegl1:[[MIN(10),0.030],[MIN(30),0.030],[1,0.030],[4,0.030],[8,0.030]],
    aegl2:[[MIN(10),0.60],[MIN(30),0.23],[1,0.12],[4,0.049],[8,0.025]],
    aegl3:[[MIN(10),1.5],[MIN(30),0.54],[1,0.27],[4,0.11],[8,0.055]],
    stel:null,twa:{v:0.1,label:"OSHA PEL / ACGIH TLV-C"},
    chronic:{v:null},idlh:2,
    odorThreshold:"~0.5 ppm",odorDesc:"Sweet 'new-mown hay' smell at low concentrations. Olfactory fatigue occurs rapidly. Poor warning — odor does not track hazard reliably.",
    sources:"Burning PVC or other chlorinated plastics, chlorinated solvents (CCl₄, CHCl₃), chlorinated refrigerants (Freon). Chemical manufacturing (polycarbonates, pharmaceuticals). Any fire involving chlorine-containing materials.",
    note1:"AEGL-1 flat at 0.030 ppm (= OSHA PEL). AEGL-2 steep: 0.60 ppm (10-min) to 0.025 ppm (8-hr).",
    note2:"CRITICAL: delayed pulmonary edema 4–24 hrs post-exposure. Mandatory 24-hr medical observation for any known exposure. Was responsible for ~80–85% of WWI chemical warfare deaths."
  },
  { id:"H2S",name:"Hydrogen Sulfide",abbr:"H₂S",cas:"7783-06-4",cat:"Industrial / Emergency",
    status:"Final",ref:"NRC Vol.8, 2011",url:"https://www.epa.gov/aegl/hydrogen-sulfide-results-aegl-program",color:"#fde047",
    aegl1:[[MIN(10),0.75],[MIN(30),0.75],[1,0.75],[4,0.36],[8,0.33]],
    aegl2:[[MIN(10),41],[MIN(30),32],[1,27],[4,20],[8,17]],
    aegl3:[[MIN(10),76],[MIN(30),59],[1,50],[4,37],[8,31]],
    stel:{v:5,t:MIN(15),label:"ACGIH STEL"},twa:{v:1,label:"ACGIH TLV-TWA"},
    chronic:{v:0.007,t:87600,label:"ATSDR MRL chronic"},idlh:50,
    odorThreshold:"~0.001–0.1 ppm",odorDesc:"Rotten egg odor — initially very detectable. FATAL WARNING FAILURE: olfactory paralysis occurs at 100–150 ppm. Workers lose all odor warning precisely when the gas becomes lethal.",
    sources:"Oil and gas drilling and production, sewers and confined spaces, paper/pulp mills, geothermal sites, manure pits and livestock operations, natural gas (odorant additive), volcanic emissions, tanneries.",
    note1:"AEGL-2 relatively flat (41→17 ppm). AEGL-1 drops slightly from 0.75 to 0.33 ppm at longer durations.",
    note2:"IDLH (50 ppm) between AEGL-2 and AEGL-3. ACGIH TLV (1 ppm) is 20× below OSHA ceiling (20 ppm). Never rely on odor."
  },
  { id:"acrolein",name:"Acrolein",abbr:"C₃H₄O",cas:"107-02-8",cat:"Combustion",
    status:"Final",ref:"NRC Vol.10, 2012",url:"https://www.epa.gov/aegl/acrolein-results-aegl-program",color:"#60a5fa",
    aegl1:[[MIN(10),0.10],[MIN(30),0.10],[1,0.10],[4,0.10],[8,0.10]],
    aegl2:[[MIN(10),0.44],[MIN(30),0.44],[1,0.44],[4,0.44],[8,0.44]],
    aegl3:[[MIN(10),2.5],[MIN(30),1.2],[1,0.60],[4,0.15],[8,0.076]],
    stel:{v:0.3,t:MIN(15),label:"NIOSH STEL"},twa:{v:0.02,label:"ACGIH TLV-TWA"},
    chronic:{v:0.0000087,t:87600,label:"EPA IRIS RfC"},idlh:2,
    odorThreshold:"~0.05 ppm",odorDesc:"Acrid, pungent, suffocating odor. Good warning at low concentrations, but olfactory fatigue develops rapidly above 1 ppm — masking continued exposure.",
    sources:"Any fire involving organic materials (acrylates, polyurethane foam, fats, wood, cooking oils). Major combustion product in structure fires. Diesel exhaust. Cigarette smoke. Garden Grove MMA incident.",
    note1:"AEGL-1 and AEGL-2 are completely FLAT — pure concentration-driven effect, not cumulative dose. AEGL-3 shows Haber slope.",
    note2:"Narrow AEGL-1→AEGL-2 gap (0.10→0.44 ppm). IDLH (2 ppm) ≈ AEGL-3 at 1-hr. One of the most dangerous fire combustion products."
  },
  { id:"HCHO",name:"Formaldehyde",abbr:"HCHO",cas:"50-00-0",cat:"Combustion / Industrial",
    status:"Interim",ref:"EPA AEGL Program, 2006 (Interim)",url:"https://www.epa.gov/aegl/formaldehyde-results-aegl-program",color:"#a78bfa",
    aegl1:[[MIN(10),1.0],[MIN(30),1.0],[1,1.0],[4,0.50],[8,0.27]],
    aegl2:[[MIN(10),14],[MIN(30),14],[1,14],[4,14],[8,14]],
    aegl3:[[MIN(10),43],[MIN(30),43],[1,43],[4,43],[8,43]],
    stel:{v:2,t:MIN(15),label:"OSHA STEL"},twa:{v:0.016,label:"NIOSH REL TWA"},
    chronic:{v:0.0098,t:87600,label:"EPA IRIS RfC"},idlh:20,
    odorThreshold:"~0.5–1 ppm",odorDesc:"Pungent, irritating. Good warning above 0.5 ppm. Olfactory fatigue limits reliability at occupational levels. Widely perceived as 'chemical' or 'disinfectant' smell.",
    sources:"Burning plastics, wood, and textiles. Indoor air: composite wood products, plywood, MDF, carpet, glues. Funeral homes (embalming). Medical/pathology labs (fixative). Pressed wood furniture. Smog component.",
    note1:"INTERIM AEGL. AEGL-2 and -3 flat (concentration-driven). OSHA PEL (0.75 ppm) falls between AEGL-1 at 8-hr (0.27 ppm) and at 10-min (1.0 ppm).",
    note2:"IARC Group 1 carcinogen. NIOSH REL (0.016 ppm) far below any AEGL — cancer risk drives the occupational limit."
  },
  { id:"toluene",name:"Toluene",abbr:"C₇H₈",cas:"108-88-3",cat:"Industrial",
    status:"Final",ref:"NRC Vol.9, 2012",url:"https://www.epa.gov/aegl/toluene-results-aegl-program",color:"#f472b6",
    aegl1:[[MIN(10),67],[MIN(30),67],[1,67],[4,67],[8,67]],
    aegl2:[[MIN(10),560],[MIN(30),480],[1,400],[4,250],[8,170]],
    aegl3:[[MIN(10),1500],[MIN(30),1300],[1,1100],[4,690],[8,460]],
    stel:{v:150,t:MIN(15),label:"NIOSH STEL"},twa:{v:20,label:"ACGIH TLV-TWA"},
    chronic:{v:5,t:87600,label:"EPA IRIS RfC"},idlh:500,
    odorThreshold:"~8 ppm",odorDesc:"Distinctive aromatic/gasoline-like odor. Good warning at typical workplace levels. Olfactory fatigue at higher concentrations reduces reliability.",
    sources:"Paints, coatings, and adhesives. Gasoline vapors. Nail salon products. Printing inks. Rubber manufacturing. Chemical synthesis. Leaded gasoline additive historically. Common solvent in laboratories.",
    note1:"AEGL-1 flat at 67 ppm. ACGIH TLV (20 ppm) is 3× below AEGL-1 — meaningful buffer. OSHA PEL (200 ppm) between AEGL-1 and AEGL-2.",
    note2:"Classic regulatory lag: ACGIH lowered TLV based on reproductive toxicity data that OSHA has not acted on."
  },
  { id:"SO2",name:"Sulfur Dioxide",abbr:"SO₂",cas:"7446-09-5",cat:"Industrial / Combustion",
    status:"Final",ref:"NRC Vol.5, 2008",url:"https://www.epa.gov/aegl/sulfur-dioxide-results-aegl-program",color:"#4ade80",
    aegl1:[[MIN(10),0.20],[MIN(30),0.20],[1,0.20],[4,0.20],[8,0.20]],
    aegl2:[[MIN(10),0.75],[MIN(30),0.75],[1,0.75],[4,0.75],[8,0.75]],
    aegl3:[[MIN(10),30],[MIN(30),30],[1,30],[4,30],[8,30]],
    stel:{v:5,t:MIN(15),label:"NIOSH STEL"},twa:{v:0.25,label:"ACGIH TLV-C"},
    chronic:{v:0.015,t:8760,label:"WHO AQG 24-hr"},idlh:100,
    odorThreshold:"~0.5 ppm",odorDesc:"Sharp, pungent, sulfur/matches smell. Good warning properties. Asthmatics may react below odor threshold during exercise.",
    sources:"Coal/fuel oil combustion, metal smelting, petroleum refining, volcanic emissions, pulp and paper mills, sulfuric acid production, wine preservative (SO₂ in winemaking). Major component of acid rain.",
    note1:"All three AEGL tiers completely flat — entirely concentration-driven, not dose-driven. AEGL-1 (0.20 ppm) < ACGIH TLV ceiling (0.25 ppm).",
    note2:"OSHA PEL (5 ppm) = AEGL-2 level. Workers at the legal limit are at the irreversible-effects threshold."
  },
  { id:"EtO",name:"Ethylene Oxide",abbr:"EtO",cas:"75-21-8",cat:"Industrial",
    status:"Final",ref:"NRC Vol.4, 2008",url:"https://www.epa.gov/aegl/ethylene-oxide-results-aegl-program",color:"#94a3b8",
    aegl1:[[MIN(10),260],[MIN(30),260],[1,260],[4,260],[8,260]],
    aegl2:[[MIN(10),1100],[MIN(30),580],[1,290],[4,130],[8,91]],
    aegl3:[[MIN(10),2900],[MIN(30),1700],[1,920],[4,470],[8,370]],
    stel:{v:5,t:MIN(15),label:"OSHA Excursion"},twa:{v:1,label:"OSHA PEL TWA"},
    chronic:{v:0.03,t:87600,label:"ATSDR MRL chronic"},idlh:800,
    odorThreshold:"~700 ppm",odorDesc:"Sweet, ethereal odor — but odor threshold is far above dangerous concentrations. Poor warning properties. At 700 ppm you can already smell it but are well above occupational limits.",
    sources:"Hospital and medical device sterilization (the dominant use), laboratory sterilization, chemical synthesis (ethylene glycol, antifreeze, surfactants). Community exposure near sterilization facilities is a documented concern.",
    note1:"AEGL-1 flat at 260 ppm — high because acute sensory effects require high concentrations. Primary hazard is carcinogenic, not acute.",
    note2:"IARC Group 1 carcinogen. Regulatory limits (OSHA PEL 1 ppm, ATSDR MRL 0.03 ppm) are 260–8,700× below any AEGL — cancer risk drives all occupational limits."
  },
];

// ═══ CHART PAGE DATA ════════════════════════════════════════════════════════
const LOG_W=700, LIN_W=9000, LIN_MAX=800, VBH=96, MN=-6, MX=4;
const logX=v=>((Math.log10(Math.max(v,1e-9))-MN)/(MX-MN))*LOG_W;
const linX=v=>Math.min((v/LIN_MAX)*LIN_W,LIN_W-2);
const getX=(v,isLog)=>isLog?logX(v):linX(v);
const isOff=(v,isLog)=>isLog?v<=0:v>LIN_MAX;

function getTicks2(isLog){
  const t=[];
  if(isLog){
    for(let l=MN;l<=MX;l++){
      const v=Math.pow(10,l);
      const lbl=l>=3?`${v/1000}k`:l===2?"100":l===1?"10":l===0?"1":l===-1?"0.1":l===-2?"0.01":l===-3?"0.001":`10⁻${Math.abs(l)}`;
      t.push({x:logX(v),label:lbl,minor:false});
      for(let m=2;m<=9;m++)t.push({x:logX(m*v),minor:true});
    }
  } else {
    for(let v=0;v<=LIN_MAX+1;v+=25){
      const maj=v%100===0;
      t.push({x:(v/LIN_MAX)*LIN_W,label:maj?String(v):null,minor:!maj});
    }
  }
  return t;
}
function getRanges(thresholds,isLog){
  const grp={};
  thresholds.forEach(th=>{
    if(!grp[th.lane])grp[th.lane]=[];
    const off=isOff(th.v,isLog);
    grp[th.lane].push({x:off?(isLog?LOG_W:LIN_W)-4:getX(th.v,isLog),off});
  });
  return Object.entries(grp).filter(([,p])=>p.length>1).map(([lid,pts])=>({
    lid,x1:Math.min(...pts.map(p=>p.x)),x2:Math.max(...pts.map(p=>p.x)),arrow:pts.some(p=>p.off)
  }));
}

const LANES=[
  {id:"health",color:"#c084fc",label:"Health-Based (WHO/ATSDR/IRIS)",y:9},
  {id:"epa",   color:"#fde047",label:"EPA NAAQS / Community ERPG",   y:24},
  {id:"acgih", color:"#60a5fa",label:"ACGIH TLV",                    y:39},
  {id:"niosh", color:"#34d399",label:"NIOSH REL",                    y:54},
  {id:"osha",  color:"#fb923c",label:"OSHA PEL",                     y:69},
  {id:"idlh",  color:"#f87171",label:"IDLH",                         y:84},
];
const LM=Object.fromEntries(LANES.map(l=>[l.id,l]));

const CHART_CHEMS=[
  {name:"Chlorine",abbr:"Cl₂",cat:"Industrial",thresholds:[
    {v:0.001,lane:"health",label:"ATSDR MRL chronic",dur:"chronic"},
    {v:1,lane:"epa",label:"ERPG-1",erpg:1,dur:"1hr"},{v:3,lane:"epa",label:"ERPG-2",erpg:2,dur:"1hr"},{v:20,lane:"epa",label:"ERPG-3",erpg:3,dur:"1hr"},
    {v:0.5,lane:"acgih",label:"ACGIH TLV-TWA",dur:"8hr"},{v:1,lane:"acgih",label:"ACGIH STEL",secondary:true,dur:"15min"},
    {v:0.5,lane:"niosh",label:"NIOSH Ceiling",dur:"ceil"},{v:1,lane:"osha",label:"OSHA Ceiling",dur:"ceil"},
    {v:10,lane:"idlh",label:"IDLH",dur:"30min"}]},
  {name:"Ammonia",abbr:"NH₃",cat:"Industrial",thresholds:[
    {v:0.1,lane:"health",label:"ATSDR MRL chronic",dur:"chronic"},
    {v:25,lane:"epa",label:"ERPG-1",erpg:1,dur:"1hr"},{v:150,lane:"epa",label:"ERPG-2",erpg:2,dur:"1hr"},{v:750,lane:"epa",label:"ERPG-3",erpg:3,dur:"1hr"},
    {v:25,lane:"acgih",label:"ACGIH TLV-TWA",dur:"8hr"},{v:35,lane:"acgih",label:"ACGIH STEL",secondary:true,dur:"15min"},
    {v:25,lane:"niosh",label:"NIOSH REL TWA",dur:"8hr"},{v:50,lane:"osha",label:"OSHA PEL TWA",dur:"8hr"},
    {v:300,lane:"idlh",label:"IDLH",dur:"30min"}]},
  {name:"Carbon Monoxide",abbr:"CO",cat:"Combustion",thresholds:[
    {v:9,lane:"epa",label:"EPA NAAQS 8-hr",dur:"8hr"},
    {v:200,lane:"epa",label:"ERPG-1",erpg:1,dur:"1hr"},{v:350,lane:"epa",label:"ERPG-2",erpg:2,dur:"1hr"},{v:500,lane:"epa",label:"ERPG-3",erpg:3,dur:"1hr"},
    {v:25,lane:"acgih",label:"ACGIH TLV-TWA",dur:"8hr"},
    {v:35,lane:"niosh",label:"NIOSH REL TWA",dur:"8hr"},{v:50,lane:"osha",label:"OSHA PEL TWA",dur:"8hr"},
    {v:1200,lane:"idlh",label:"IDLH",dur:"30min"}]},
  {name:"Hydrogen Cyanide",abbr:"HCN",cat:"Combustion",thresholds:[
    {v:0.005,lane:"health",label:"ATSDR MRL chronic",dur:"chronic"},
    {v:10,lane:"epa",label:"ERPG-2",erpg:2,dur:"1hr"},{v:25,lane:"epa",label:"ERPG-3",erpg:3,dur:"1hr"},
    {v:4.7,lane:"acgih",label:"ACGIH TLV-C",dur:"ceil"},
    {v:10,lane:"niosh",label:"NIOSH REL TWA",dur:"8hr"},{v:10,lane:"osha",label:"OSHA Ceiling",dur:"ceil"},
    {v:50,lane:"idlh",label:"IDLH",dur:"30min"}]},
  {name:"Phosgene",abbr:"COCl₂",cat:"Combustion",thresholds:[
    {v:0.1,lane:"epa",label:"ERPG-1",erpg:1,dur:"1hr"},{v:0.5,lane:"epa",label:"ERPG-2",erpg:2,dur:"1hr"},{v:1.5,lane:"epa",label:"ERPG-3",erpg:3,dur:"1hr"},
    {v:0.1,lane:"acgih",label:"ACGIH TLV-C",dur:"ceil"},
    {v:0.1,lane:"niosh",label:"NIOSH REL TWA",dur:"8hr"},{v:0.1,lane:"osha",label:"OSHA PEL TWA",dur:"8hr"},
    {v:2,lane:"idlh",label:"IDLH",dur:"30min"}]},
  {name:"Hydrogen Sulfide",abbr:"H₂S",cat:"Industrial",thresholds:[
    {v:0.007,lane:"health",label:"ATSDR MRL chronic",dur:"chronic"},
    {v:0.1,lane:"epa",label:"ERPG-1",erpg:1,dur:"1hr"},{v:30,lane:"epa",label:"ERPG-2",erpg:2,dur:"1hr"},{v:100,lane:"epa",label:"ERPG-3",erpg:3,dur:"1hr"},
    {v:1,lane:"acgih",label:"ACGIH TLV-TWA",dur:"8hr"},{v:5,lane:"acgih",label:"ACGIH STEL",secondary:true,dur:"15min"},
    {v:10,lane:"niosh",label:"NIOSH Ceiling",dur:"ceil"},{v:20,lane:"osha",label:"OSHA Ceiling",dur:"ceil"},
    {v:50,lane:"idlh",label:"IDLH",dur:"30min"}]},
  {name:"Acrolein",abbr:"C₃H₄O",cat:"Combustion",thresholds:[
    {v:0.0000087,lane:"health",label:"EPA IRIS RfC",dur:"chronic"},
    {v:0.05,lane:"epa",label:"ERPG-1",erpg:1,dur:"1hr"},{v:0.15,lane:"epa",label:"ERPG-2",erpg:2,dur:"1hr"},{v:1.5,lane:"epa",label:"ERPG-3",erpg:3,dur:"1hr"},
    {v:0.02,lane:"acgih",label:"ACGIH TLV-TWA",dur:"8hr"},{v:0.05,lane:"acgih",label:"ACGIH STEL",secondary:true,dur:"15min"},
    {v:0.1,lane:"niosh",label:"NIOSH REL",dur:"8hr"},{v:0.1,lane:"osha",label:"OSHA PEL",dur:"8hr"},
    {v:2,lane:"idlh",label:"IDLH",dur:"30min"}]},
  {name:"Formaldehyde",abbr:"HCHO",cat:"Combustion",thresholds:[
    {v:0.0098,lane:"health",label:"EPA IRIS RfC",dur:"chronic"},{v:0.08,lane:"health",label:"WHO 30-min",secondary:true,dur:"30min"},
    {v:1,lane:"epa",label:"ERPG-1",erpg:1,dur:"1hr"},{v:10,lane:"epa",label:"ERPG-2",erpg:2,dur:"1hr"},{v:25,lane:"epa",label:"ERPG-3",erpg:3,dur:"1hr"},
    {v:0.3,lane:"acgih",label:"ACGIH TLV-C",dur:"ceil"},
    {v:0.016,lane:"niosh",label:"NIOSH REL TWA",dur:"8hr"},{v:0.1,lane:"niosh",label:"NIOSH STEL",secondary:true,dur:"15min"},
    {v:0.75,lane:"osha",label:"OSHA PEL TWA",dur:"8hr"},{v:2,lane:"osha",label:"OSHA STEL",secondary:true,dur:"15min"},
    {v:20,lane:"idlh",label:"IDLH",dur:"30min"}]},
  {name:"Sulfur Dioxide",abbr:"SO₂",cat:"Industrial",thresholds:[
    {v:0.015,lane:"health",label:"WHO AQG 24-hr",dur:"24hr"},
    {v:0.075,lane:"epa",label:"EPA NAAQS 1-hr",dur:"1hr"},
    {v:0.3,lane:"epa",label:"ERPG-1",erpg:1,dur:"1hr"},{v:3,lane:"epa",label:"ERPG-2",erpg:2,dur:"1hr"},{v:15,lane:"epa",label:"ERPG-3",erpg:3,dur:"1hr"},
    {v:0.25,lane:"acgih",label:"ACGIH TLV-C",dur:"ceil"},
    {v:2,lane:"niosh",label:"NIOSH REL TWA",dur:"8hr"},{v:5,lane:"niosh",label:"NIOSH STEL",secondary:true,dur:"15min"},
    {v:5,lane:"osha",label:"OSHA PEL TWA",dur:"8hr"},
    {v:100,lane:"idlh",label:"IDLH",dur:"30min"}]},
  {name:"Toluene",abbr:"C₇H₈",cat:"Industrial",thresholds:[
    {v:5,lane:"health",label:"EPA IRIS RfC",dur:"chronic"},
    {v:50,lane:"epa",label:"ERPG-1",erpg:1,dur:"1hr"},{v:300,lane:"epa",label:"ERPG-2",erpg:2,dur:"1hr"},{v:700,lane:"epa",label:"ERPG-3",erpg:3,dur:"1hr"},
    {v:20,lane:"acgih",label:"ACGIH TLV-TWA",dur:"8hr"},
    {v:100,lane:"niosh",label:"NIOSH REL TWA",dur:"8hr"},{v:150,lane:"niosh",label:"NIOSH STEL",secondary:true,dur:"15min"},
    {v:200,lane:"osha",label:"OSHA PEL TWA",dur:"8hr"},{v:300,lane:"osha",label:"OSHA Ceiling",secondary:true,dur:"ceil"},
    {v:500,lane:"idlh",label:"IDLH",dur:"30min"}]},
  {name:"Methyl Methacrylate",abbr:"MMA",cat:"Industrial",thresholds:[
    {v:50,lane:"acgih",label:"ACGIH TLV-TWA",dur:"8hr"},{v:100,lane:"acgih",label:"ACGIH STEL",secondary:true,dur:"15min"},
    {v:100,lane:"niosh",label:"NIOSH REL TWA",dur:"8hr"},{v:100,lane:"osha",label:"OSHA PEL TWA",dur:"8hr"},
    {v:1000,lane:"idlh",label:"IDLH",dur:"30min"}]},
  {name:"Benzene",abbr:"C₆H₆",cat:"Industrial",thresholds:[
    {v:0.006,lane:"health",label:"ATSDR MRL chronic",dur:"chronic"},
    {v:50,lane:"epa",label:"ERPG-1",erpg:1,dur:"1hr"},{v:150,lane:"epa",label:"ERPG-2",erpg:2,dur:"1hr"},{v:1000,lane:"epa",label:"ERPG-3",erpg:3,dur:"1hr"},
    {v:0.5,lane:"acgih",label:"ACGIH TLV-TWA (A1)",dur:"8hr"},{v:2.5,lane:"acgih",label:"ACGIH STEL",secondary:true,dur:"15min"},
    {v:1,lane:"niosh",label:"NIOSH Ceiling (LF)",secondary:true,dur:"ceil"},
    {v:0.5,lane:"osha",label:"OSHA Action Level",secondary:true,dur:"8hr"},{v:1,lane:"osha",label:"OSHA PEL TWA",dur:"8hr"},{v:5,lane:"osha",label:"OSHA STEL",secondary:true,dur:"15min"},
    {v:500,lane:"idlh",label:"IDLH",dur:"30min"}]},
  {name:"Vinyl Chloride",abbr:"VCM",cat:"Industrial",thresholds:[
    {v:0.001,lane:"health",label:"ATSDR MRL chronic",dur:"chronic"},
    {v:1,lane:"acgih",label:"ACGIH TLV-TWA (A1)",dur:"8hr"},
    {v:1,lane:"niosh",label:"NIOSH Ceiling (LF)",secondary:true,dur:"ceil"},
    {v:0.5,lane:"osha",label:"OSHA Action Level",secondary:true,dur:"8hr"},{v:1,lane:"osha",label:"OSHA PEL TWA",dur:"8hr"},{v:5,lane:"osha",label:"OSHA Excursion",secondary:true,dur:"15min"},
    {v:100,lane:"idlh",label:"IDLH",dur:"30min"}]},
  {name:"Nitrogen Dioxide",abbr:"NO₂",cat:"Combustion",thresholds:[
    {v:0.010,lane:"health",label:"WHO AQG annual",dur:"chronic"},{v:0.025,lane:"health",label:"WHO AQG 24-hr",secondary:true,dur:"24hr"},
    {v:0.053,lane:"epa",label:"EPA NAAQS annual",dur:"chronic"},{v:0.1,lane:"epa",label:"EPA NAAQS 1-hr",secondary:true,dur:"1hr"},
    {v:0.2,lane:"acgih",label:"ACGIH TLV-C",dur:"ceil"},
    {v:1,lane:"niosh",label:"NIOSH REL TWA",dur:"8hr"},{v:3,lane:"niosh",label:"NIOSH STEL",secondary:true,dur:"15min"},
    {v:5,lane:"osha",label:"OSHA Ceiling",dur:"ceil"},
    {v:20,lane:"idlh",label:"IDLH",dur:"30min"}]},
  {name:"Ozone",abbr:"O₃",cat:"Ambient",thresholds:[
    {v:0.051,lane:"health",label:"WHO AQG 8-hr",dur:"8hr"},
    {v:0.07,lane:"epa",label:"EPA NAAQS 8-hr",dur:"8hr"},
    {v:0.05,lane:"acgih",label:"ACGIH TLV (light work)",dur:"8hr"},{v:0.1,lane:"acgih",label:"ACGIH TLV (mod.work)",secondary:true,dur:"8hr"},
    {v:0.1,lane:"niosh",label:"NIOSH REL TWA",dur:"8hr"},
    {v:0.1,lane:"osha",label:"OSHA PEL TWA",dur:"8hr"},
    {v:5,lane:"idlh",label:"IDLH",dur:"30min"}]},
  {name:"Ethylene Oxide",abbr:"EtO",cat:"Industrial",thresholds:[
    {v:0.03,lane:"health",label:"ATSDR MRL chronic",dur:"chronic"},
    {v:1,lane:"acgih",label:"ACGIH TLV-TWA (A1)",dur:"8hr"},
    {v:0.5,lane:"osha",label:"OSHA Action Level",secondary:true,dur:"8hr"},{v:1,lane:"osha",label:"OSHA PEL TWA",dur:"8hr"},{v:5,lane:"osha",label:"OSHA Excursion",secondary:true,dur:"15min"},
    {v:800,lane:"idlh",label:"IDLH",dur:"30min"}]},
];

const DUR_TABS=[
  {id:"all",label:"All"},{id:"ceil",label:"Ceiling"},{id:"15min",label:"15-min STEL"},
  {id:"1hr",label:"1-hour ERPG"},{id:"8hr",label:"8-hour TWA"},
  {id:"24hr",label:"24-hour"},{id:"chronic",label:"Chronic"},
];

// ═══ CHART ROW ═══════════════════════════════════════════════════════════════
function ChartRow({chem,isLog,durFilter}){
  const [hov,setHov]=useState(null);
  const vbW=isLog?LOG_W:LIN_W;
  const ticks=useMemo(()=>getTicks2(isLog),[isLog]);
  const rl=useMemo(()=>getRanges(chem.thresholds,isLog),[chem,isLog]);
  const e1=useMemo(()=>{const t=chem.thresholds.find(t=>t.erpg===1);return t&&!isOff(t.v,isLog)?getX(t.v,isLog):null;},[chem,isLog]);
  const e2=useMemo(()=>{const t=chem.thresholds.find(t=>t.erpg===2);return t&&!isOff(t.v,isLog)?getX(t.v,isLog):null;},[chem,isLog]);
  const e3=useMemo(()=>{const t=chem.thresholds.find(t=>t.erpg===3);return t&&!isOff(t.v,isLog)?getX(t.v,isLog):null;},[chem,isLog]);
  const idx=useMemo(()=>{const t=chem.thresholds.find(t=>t.lane==="idlh");return t&&!isOff(t.v,isLog)?getX(t.v,isLog):null;},[chem,isLog]);

  return (
    <div style={{borderBottom:"1px solid #1c2128"}}>
      <div style={{display:"flex",alignItems:"center"}}>
        <div style={{width:150,flexShrink:0,position:"sticky",left:0,zIndex:3,
          background:"#090c10",padding:"5px 8px 5px 12px",borderLeft:"2px solid #30363d"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#e6edf3"}}>{chem.name}</div>
          <div style={{fontSize:8,color:"#484f58"}}>{chem.abbr}</div>
        </div>
        <div style={{flex:1,minWidth:isLog?500:LIN_W,padding:"2px 4px 2px 0"}}>
          <svg viewBox={`0 0 ${vbW} ${VBH}`} width={isLog?"100%":LIN_W} height={VBH} style={{display:"block",overflow:"visible"}}>
            {LANES.map((ln,i)=>(
              <rect key={ln.id} x={0} y={ln.y-7} width={vbW} height={14} fill={i%2===0?"rgba(255,255,255,0.015)":"transparent"}/>
            ))}
            {ticks.map((t,i)=>(
              <line key={i} x1={t.x} y1={0} x2={t.x} y2={VBH} stroke={t.minor?"#191e25":"#2a3040"} strokeWidth={t.minor?0.4:0.7}/>
            ))}
            {e1&&e2&&<rect x={e1} y={0} width={Math.max(0,e2-e1)} height={VBH} fill="rgba(253,224,71,0.04)"/>}
            {e2&&e3&&<rect x={e2} y={0} width={Math.max(0,e3-e2)} height={VBH} fill="rgba(251,146,60,0.05)"/>}
            {(e3||idx)&&<rect x={e3||(idx||0)} y={0} width={vbW-(e3||(idx||0))} height={VBH} fill="rgba(248,113,113,0.04)"/>}
            {e1&&<line x1={e1} y1={0} x2={e1} y2={VBH} stroke="#fde047" strokeWidth={0.9} strokeDasharray="4,3" opacity={0.45}/>}
            {e2&&<line x1={e2} y1={0} x2={e2} y2={VBH} stroke="#fb923c" strokeWidth={0.9} strokeDasharray="4,3" opacity={0.45}/>}
            {e3&&<line x1={e3} y1={0} x2={e3} y2={VBH} stroke="#f87171" strokeWidth={1.1} strokeDasharray="4,2" opacity={0.55}/>}
            {idx&&<line x1={idx} y1={0} x2={idx} y2={VBH} stroke="#f87171" strokeWidth={1.5} opacity={0.3}/>}
            {rl.map((r,i)=>{
              const ln=LM[r.lid];if(!ln)return null;
              const dim=durFilter!=="all"&&!chem.thresholds.some(t=>t.lane===r.lid&&(t.dur===durFilter||(durFilter==="30min"&&t.dur==="15min")));
              return <line key={i} x1={r.x1} y1={ln.y} x2={r.x2} y2={ln.y}
                stroke={ln.color} strokeWidth={2.5} opacity={dim?0.07:0.32} strokeLinecap="round"/>;
            })}
            {chem.thresholds.map((th,i)=>{
              const ln=LM[th.lane];if(!ln)return null;
              const off=isOff(th.v,isLog);
              const cx=off?(isLog?LOG_W:LIN_W)-10:getX(th.v,isLog);
              if(cx<-8)return null;
              const dim=durFilter!=="all"&&th.dur!==durFilter;
              const op=dim?0.08:0.88;
              const isH=hov===i;
              if(th.erpg){
                const dr=[0,6,8,10][th.erpg];
                return <polygon key={i} points={`${cx},${ln.y-dr} ${cx+dr},${ln.y} ${cx},${ln.y+dr} ${cx-dr},${ln.y}`}
                  fill={isH?ln.color:ln.color+"cc"} opacity={op}
                  onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)} style={{cursor:"crosshair"}}/>;
              }
              if(th.secondary)
                return <circle key={i} cx={cx} cy={ln.y} r={5.5} fill="transparent"
                  stroke={ln.color} strokeWidth={1.8} opacity={op}
                  onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)} style={{cursor:"crosshair"}}/>;
              return <circle key={i} cx={cx} cy={ln.y} r={8} fill={isH?ln.color:ln.color+"cc"} opacity={op}
                onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)} style={{cursor:"crosshair"}}/>;
            })}
            {hov!==null&&(()=>{
              const th=chem.thresholds[hov];if(!th)return null;
              const ln=LM[th.lane];if(!ln)return null;
              const off=isOff(th.v,isLog);
              const cx=off?(isLog?LOG_W:LIN_W)-10:getX(th.v,isLog);
              const str=`${th.label}: ${th.v} ppm`;
              const tw=Math.min(str.length*5.5+16,vbW*0.42);
              const tx2=Math.max(2,Math.min(cx-tw/2,vbW-tw-2));
              const ty=ln.y<42?ln.y+13:ln.y-27;
              return <g>
                <line x1={cx} y1={0} x2={cx} y2={VBH} stroke={ln.color} strokeWidth={0.9} strokeDasharray="3,2" opacity={0.45}/>
                <rect x={tx2} y={ty} width={tw} height={17} rx={3} fill="#161b22" stroke={ln.color} strokeWidth={0.9}/>
                <text x={tx2+tw/2} y={ty+12} textAnchor="middle" fill={ln.color} fontSize={9} fontFamily="IBM Plex Mono,monospace">{str}</text>
              </g>;
            })()}
          </svg>
        </div>
        <div style={{width:16,flexShrink:0}}/>
      </div>
    </div>
  );
}

// ═══ CHART PAGE ═══════════════════════════════════════════════════════════════
function ChartPage(){
  const [isLog,setIsLog]=useState(true);
  const [durFilter,setDurFilter]=useState("all");
  const cats=["All","Combustion","Industrial","Ambient"];
  const [catF,setCatF]=useState("All");
  const [search,setSearch]=useState("");
  const filtered=useMemo(()=>CHART_CHEMS.filter(c=>{
    if(catF!=="All"&&!c.cat.includes(catF))return false;
    const q=search.toLowerCase();
    return !q||c.name.toLowerCase().includes(q)||c.abbr.toLowerCase().includes(q);
  }),[catF,search]);

  const vbW=isLog?LOG_W:LIN_W;

  return (
    <div style={{height:"calc(100vh - 56px)",display:"flex",flexDirection:"column",background:"#090c10"}}>
      {/* Controls */}
      <div style={{background:"#0d1117",borderBottom:"1px solid #21262d",padding:"8px 14px 6px",flexShrink:0}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:6}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter..."
            style={{background:"#161b22",border:"1px solid #30363d",color:"#c9d1d9",
              padding:"4px 9px",borderRadius:5,fontSize:10,width:130,outline:"none",fontFamily:"inherit"}}/>
          {cats.map(c=>(
            <button key={c} onClick={()=>setCatF(c)} style={{padding:"3px 9px",borderRadius:20,fontSize:10,
              fontFamily:"inherit",cursor:"pointer",
              border:catF===c?"1px solid #388bfd":"1px solid #30363d",
              background:catF===c?"#1f3a5f":"#161b22",color:catF===c?"#58a6ff":"#8b949e"}}>
              {c}
            </button>
          ))}
          <div style={{marginLeft:"auto",display:"flex",borderRadius:5,overflow:"hidden",border:"1px solid #30363d"}}>
            <button onClick={()=>setIsLog(true)} style={{padding:"4px 11px",fontSize:10,fontFamily:"inherit",
              cursor:"pointer",border:"none",background:isLog?"#1f3a5f":"#161b22",
              color:isLog?"#58a6ff":"#8b949e",fontWeight:isLog?700:400}}>⌇ LOG</button>
            <button onClick={()=>setIsLog(false)} style={{padding:"4px 11px",fontSize:10,fontFamily:"inherit",
              cursor:"pointer",border:"none",borderLeft:"1px solid #30363d",
              background:!isLog?"#3a2a10":"#161b22",color:!isLog?"#f0883e":"#8b949e",fontWeight:!isLog?700:400}}>▬ LINEAR</button>
          </div>
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:8,color:"#484f58",marginRight:4}}>DURATION:</span>
          {DUR_TABS.map(t=>(
            <button key={t.id} onClick={()=>setDurFilter(t.id)} style={{padding:"3px 9px",borderRadius:20,
              fontSize:9,fontFamily:"inherit",cursor:"pointer",
              border:durFilter===t.id?"1px solid #388bfd":"1px solid #30363d",
              background:durFilter===t.id?"#1f3a5f":"#161b22",
              color:durFilter===t.id?"#58a6ff":"#8b949e"}}>
              {t.label}
            </button>
          ))}
          {durFilter!=="all"&&<span style={{fontSize:8,color:"#484f58"}}>non-matching dimmed</span>}
        </div>
      </div>

      {/* Scale header */}
      <div style={{display:"flex",background:"#0d1117",borderBottom:"1px solid #30363d",flexShrink:0}}>
        <div style={{width:150,flexShrink:0,position:"sticky",left:0,background:"#0d1117",
          padding:"3px 8px 2px 12px",fontSize:8,color:"#484f58",zIndex:3}}>ppm →</div>
        <div style={{flex:1,minWidth:isLog?500:LIN_W,overflowX:"hidden"}}>
          <svg viewBox={`0 0 ${vbW} 20`} width={isLog?"100%":LIN_W} height={20} style={{display:"block"}}>
            {getTicks2(isLog).filter(t=>!t.minor&&t.label).map((t,i)=>(
              <g key={i}>
                <line x1={t.x} y1={0} x2={t.x} y2={12} stroke="#3d4450" strokeWidth={0.8}/>
                <text x={t.x} y={19} textAnchor="middle" fontSize={8} fill="#6e7681" fontFamily="IBM Plex Mono,monospace">{t.label}</text>
              </g>
            ))}
          </svg>
        </div>
        <div style={{width:16,flexShrink:0}}/>
      </div>

      {/* Chemical rows */}
      <div style={{flex:1,overflowY:"auto",overflowX:isLog?"hidden":"auto"}}>
        {filtered.map(c=>(
          <ChartRow key={c.name} chem={c} isLog={isLog} durFilter={durFilter}/>
        ))}
        {filtered.length===0&&(
          <div style={{padding:30,textAlign:"center",color:"#484f58",fontSize:11}}>No chemicals match.</div>
        )}
      </div>

      {/* Legend */}
      <div style={{background:"#0d1117",borderTop:"1px solid #21262d",padding:"5px 14px",
        display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",flexShrink:0}}>
        {LANES.map(ln=>(
          <span key={ln.id} style={{display:"flex",alignItems:"center",gap:3,fontSize:9}}>
            <svg width={12} height={12}><circle cx={6} cy={6} r={4.5} fill={ln.color} opacity={0.85}/></svg>
            <span style={{color:ln.color}}>{ln.label}</span>
          </span>
        ))}
        <span style={{fontSize:8,color:"#484f58",marginLeft:4}}>◆ ERPG · ○ STEL/Ceil · ● Primary · hover for values</span>
      </div>
    </div>
  );
}

// ═══ C-T CURVE PAGE ═══════════════════════════════════════════════════════════
const TIME_TICKS=[
  {h:MIN(10),label:"10 min",major:true},{h:MIN(30),label:"30 min",major:true},
  {h:1,label:"1 hr",major:true},{h:4,label:"4 hr",major:true},{h:8,label:"8 hr",major:true},
  {h:24,label:"24 hr",major:true},{h:168,label:"1 wk",major:false},
  {h:8760,label:"1 yr",major:true},{h:87600,label:"10 yr",major:false},{h:613200,label:"Lifetime",major:true},
];
const CONC_TICKS=[-3,-2,-1,0,1,2,3,4].map(l=>({
  log:l,label:l<0?`10⁻${Math.abs(l)}`:l===0?"1":l===1?"10":l===2?"100":l===3?"1k":"10k"
}));
const ZONES=[
  {h1:MIN(5),h2:MIN(30),label:"Acute/Escape",color:"#f87171"},
  {h1:MIN(30),h2:8,label:"Emergency",color:"#fb923c"},
  {h1:8,h2:24,label:"Occupational",color:"#facc15"},
  {h1:24,h2:87600,label:"Chronic",color:"#34d399"},
];

function CTPage(){
  const [chemId,setChemId]=useState("Cl2");
  const [hovPt,setHovPt]=useState(null);
  const chem=AEGL.find(c=>c.id===chemId);
  const vbW=760,vbH=480;

  return (
    <div style={{height:"calc(100vh - 56px)",overflowY:"auto",background:"#090c10"}}>
      {/* Dropdown + controls bar */}
      <div style={{background:"#0d1117",borderBottom:"1px solid #21262d",padding:"10px 14px",
        display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <label style={{fontSize:10,color:"#8b949e",flexShrink:0}}>Chemical:</label>
        <select value={chemId} onChange={e=>setChemId(e.target.value)}
          style={{background:"#161b22",border:"1px solid #388bfd",color:"#e6edf3",
            padding:"5px 10px",borderRadius:5,fontSize:11,fontFamily:"IBM Plex Mono,monospace",
            cursor:"pointer",outline:"none",flex:"0 0 auto",minWidth:200}}>
          {AEGL.map(c=>(
            <option key={c.id} value={c.id}>{c.name} ({c.abbr}) — {c.status}</option>
          ))}
        </select>
        <span style={{fontSize:9,color:"#484f58",padding:"2px 7px",background:"#161b22",
          border:"1px solid #30363d",borderRadius:12}}>{chem.cas}</span>
        {chem.status==="Interim"&&(
          <span style={{fontSize:9,color:"#f0883e",padding:"2px 7px",
            background:"rgba(240,136,62,0.1)",border:"1px solid #f0883e44",borderRadius:12}}>⚠ Interim</span>
        )}
        <a href={chem.url} target="_blank" rel="noopener noreferrer"
          style={{fontSize:9,color:"#58a6ff",marginLeft:"auto"}}>EPA AEGL Source ↗</a>
      </div>

      {/* Chart fills the page */}
      <div style={{padding:"0 4px",background:"#0d1117",borderBottom:"1px solid #21262d"}}>
        <svg viewBox={`0 0 ${vbW} ${vbH}`} width="100%" style={{display:"block"}}>
          <defs><clipPath id="pc"><rect x={PLT.x0} y={PLT.y0} width={PLT.w} height={PLT.h}/></clipPath></defs>

          {/* Time zone backgrounds */}
          {ZONES.map(z=>(
            <rect key={z.label} x={tx(z.h1)} y={PLT.y0} width={tx(z.h2)-tx(z.h1)} height={PLT.h}
              fill={z.color} opacity={0.04} clipPath="url(#pc)"/>
          ))}
          {ZONES.map(z=>{
            const mx=(tx(z.h1)+tx(z.h2))/2;
            return <text key={z.label} x={mx} y={PLT.y0+PLT.h+20} textAnchor="middle"
              fontSize={8.5} fill={z.color} opacity={0.55} fontFamily="IBM Plex Mono,monospace">{z.label}</text>;
          })}

          {/* Concentration grid */}
          {CONC_TICKS.map(({log,label})=>{
            const y=cy(Math.pow(10,log));
            return <g key={log}>
              <line x1={PLT.x0} y1={y} x2={PLT.x0+PLT.w} y2={y} stroke="#1c2128" strokeWidth={0.7}/>
              <text x={PLT.x0-5} y={y+3.5} textAnchor="end" fontSize={9} fill="#484f58" fontFamily="IBM Plex Mono,monospace">{label}</text>
            </g>;
          })}

          {/* Time grid */}
          {TIME_TICKS.filter(t=>t.major).map(t=>(
            <g key={t.label}>
              <line x1={tx(t.h)} y1={PLT.y0} x2={tx(t.h)} y2={PLT.y0+PLT.h} stroke="#1c2128" strokeWidth={0.8}/>
              <text x={tx(t.h)} y={PLT.y0+PLT.h+11} textAnchor="middle" fontSize={8.5} fill="#6e7681" fontFamily="IBM Plex Mono,monospace">{t.label}</text>
            </g>
          ))}

          {/* Haber reference lines */}
          {[0.001,0.01,0.1,1,10,100,1000,10000].map(k=>{
            const t1=MIN(10),t2=8*24,c1=k/t1,c2=k/t2;
            if(c1>Math.pow(10,CH)||c2<Math.pow(10,CL))return null;
            return <line key={k} x1={tx(t1)} y1={cy(c1)} x2={tx(t2)} y2={cy(c2)}
              stroke="#fff" strokeWidth={0.3} opacity={0.04} clipPath="url(#pc)"/>;
          })}

          {/* Zone fills */}
          <g clipPath="url(#pc)">
            {chem.aegl1&&<path d={belowPath(chem.aegl1)} fill="#34d399" opacity={0.06}/>}
            {chem.aegl1&&<path d={bandPath(chem.aegl1,chem.aegl2)} fill="#fde047" opacity={0.10}/>}
            <path d={bandPath(chem.aegl2,chem.aegl3)} fill="#fb923c" opacity={0.10}/>
            <path d={abovePath(chem.aegl3)} fill="#f87171" opacity={0.10}/>
          </g>

          {/* AEGL lines */}
          <g clipPath="url(#pc)">
            {chem.aegl1&&<polyline points={chem.aegl1.map(([t,c])=>`${tx(t)},${cy(c)}`).join(" ")} fill="none" stroke="#4ade80" strokeWidth={2.5} strokeLinejoin="round"/>}
            <polyline points={chem.aegl2.map(([t,c])=>`${tx(t)},${cy(c)}`).join(" ")} fill="none" stroke="#fbbf24" strokeWidth={2.5} strokeLinejoin="round"/>
            <polyline points={chem.aegl3.map(([t,c])=>`${tx(t)},${cy(c)}`).join(" ")} fill="none" stroke="#f87171" strokeWidth={2.5} strokeLinejoin="round"/>
          </g>

          {/* Markers */}
          {chem.aegl1&&chem.aegl1.map(([t,c],i)=>(
            <circle key={i} cx={tx(t)} cy={cy(c)} r={5.5} fill="#4ade80"
              onMouseEnter={()=>setHovPt({t,c,label:`AEGL-1: ${c} ppm`,color:"#4ade80"})}
              onMouseLeave={()=>setHovPt(null)} style={{cursor:"crosshair"}}/>
          ))}
          {chem.aegl2.map(([t,c],i)=>(
            <circle key={i} cx={tx(t)} cy={cy(c)} r={5.5} fill="#fbbf24"
              onMouseEnter={()=>setHovPt({t,c,label:`AEGL-2: ${c} ppm`,color:"#fbbf24"})}
              onMouseLeave={()=>setHovPt(null)} style={{cursor:"crosshair"}}/>
          ))}
          {chem.aegl3.map(([t,c],i)=>(
            <circle key={i} cx={tx(t)} cy={cy(c)} r={5.5} fill="#f87171"
              onMouseEnter={()=>setHovPt({t,c,label:`AEGL-3: ${c} ppm`,color:"#f87171"})}
              onMouseLeave={()=>setHovPt(null)} style={{cursor:"crosshair"}}/>
          ))}

          {/* IDLH line */}
          {chem.idlh&&cy(chem.idlh)>PLT.y0&&cy(chem.idlh)<PLT.y0+PLT.h&&(
            <g>
              <line x1={PLT.x0} y1={cy(chem.idlh)} x2={PLT.x0+PLT.w} y2={cy(chem.idlh)}
                stroke="#f87171" strokeWidth={1.2} strokeDasharray="5,3" opacity={0.5} clipPath="url(#pc)"/>
              <text x={PLT.x0+PLT.w+4} y={cy(chem.idlh)+3.5} fontSize={8} fill="#f87171" opacity={0.7} fontFamily="IBM Plex Mono,monospace">IDLH</text>
            </g>
          )}
          {/* TWA square */}
          {chem.twa&&cy(chem.twa.v)>PLT.y0&&cy(chem.twa.v)<PLT.y0+PLT.h&&(
            <g>
              <rect x={tx(8)-7} y={cy(chem.twa.v)-7} width={14} height={14} fill="#60a5fa" opacity={0.85}
                onMouseEnter={()=>setHovPt({t:8,c:chem.twa.v,label:`${chem.twa.label}: ${chem.twa.v} ppm`,color:"#60a5fa"})}
                onMouseLeave={()=>setHovPt(null)} style={{cursor:"crosshair"}}/>
              <line x1={PLT.x0} y1={cy(chem.twa.v)} x2={PLT.x0+PLT.w} y2={cy(chem.twa.v)}
                stroke="#60a5fa" strokeWidth={0.6} strokeDasharray="3,4" opacity={0.3} clipPath="url(#pc)"/>
            </g>
          )}
          {/* STEL diamond */}
          {chem.stel&&cy(chem.stel.v)>PLT.y0&&cy(chem.stel.v)<PLT.y0+PLT.h&&(()=>{
            const x=tx(chem.stel.t||MIN(15)),y=cy(chem.stel.v),r=7;
            return <polygon points={`${x},${y-r} ${x+r},${y} ${x},${y+r} ${x-r},${y}`}
              fill="#c084fc" opacity={0.85}
              onMouseEnter={()=>setHovPt({t:chem.stel.t,c:chem.stel.v,label:`${chem.stel.label}: ${chem.stel.v} ppm`,color:"#c084fc"})}
              onMouseLeave={()=>setHovPt(null)} style={{cursor:"crosshair"}}/>;
          })()}
          {/* Chronic cross */}
          {chem.chronic?.v&&chem.chronic.t&&(()=>{
            const x=tx(chem.chronic.t),y=cy(chem.chronic.v),r=7;
            if(y<PLT.y0||y>PLT.y0+PLT.h)return null;
            return <g onMouseEnter={()=>setHovPt({t:chem.chronic.t,c:chem.chronic.v,label:`${chem.chronic.label}: ${chem.chronic.v} ppm`,color:"#34d399"})}
              onMouseLeave={()=>setHovPt(null)} style={{cursor:"crosshair"}}>
              <line x1={x-r} y1={y} x2={x+r} y2={y} stroke="#34d399" strokeWidth={2.5}/>
              <line x1={x} y1={y-r} x2={x} y2={y+r} stroke="#34d399" strokeWidth={2.5}/>
              <circle cx={x} cy={y} r={3} fill="#34d399"/>
            </g>;
          })()}

          {/* Hover tooltip */}
          {hovPt&&(()=>{
            const x=tx(hovPt.t),y=cy(hovPt.c);
            const durStr=hovPt.t>=1?`${hovPt.t}hr`:`${Math.round(hovPt.t*60)}min`;
            const str=`${hovPt.label} @ ${durStr}`;
            const tw=str.length*5.2+16;
            const tx2=Math.min(Math.max(x-tw/2,PLT.x0+2),PLT.x0+PLT.w-tw-2);
            const ty=y>PLT.y0+50?y-28:y+14;
            return <g>
              <line x1={x} y1={PLT.y0} x2={x} y2={PLT.y0+PLT.h} stroke={hovPt.color} strokeWidth={0.8} strokeDasharray="3,2" opacity={0.4} clipPath="url(#pc)"/>
              <rect x={tx2} y={ty} width={tw} height={17} rx={3} fill="#161b22" stroke={hovPt.color} strokeWidth={0.8}/>
              <text x={tx2+tw/2} y={ty+11.5} textAnchor="middle" fill={hovPt.color} fontSize={9} fontFamily="IBM Plex Mono,monospace">{str}</text>
            </g>;
          })()}

          {/* Axis labels */}
          <text x={PLT.x0+PLT.w/2} y={vbH-4} textAnchor="middle" fontSize={10} fill="#6e7681" fontFamily="IBM Plex Mono,monospace">Exposure Duration →</text>
          <text x={14} y={PLT.y0+PLT.h/2} textAnchor="middle" fontSize={10} fill="#6e7681" fontFamily="IBM Plex Mono,monospace" transform={`rotate(-90,14,${PLT.y0+PLT.h/2})`}>Concentration (ppm)</text>
          <rect x={PLT.x0} y={PLT.y0} width={PLT.w} height={PLT.h} fill="none" stroke="#30363d" strokeWidth={0.8}/>
        </svg>
      </div>

      {/* Compact legend */}
      <div style={{padding:"6px 14px",background:"#0d1117",borderBottom:"1px solid #1c2128",
        display:"flex",gap:12,flexWrap:"wrap",fontSize:9,alignItems:"center"}}>
        {[["#4ade80","AEGL-1 (notable discomfort)"],["#fbbf24","AEGL-2 (irreversible/escape)"],
          ["#f87171","AEGL-3 (life-threatening)"],["#60a5fa","■ TWA (8-hr)"],
          ["#c084fc","◆ STEL (15-min)"],["#34d399","✛ Chronic"],["#f87171","--- IDLH"]
        ].map(([c,l])=>(
          <span key={l} style={{display:"flex",alignItems:"center",gap:3}}>
            <span style={{width:9,height:9,background:c,display:"inline-block",borderRadius:1}}/>
            <span style={{color:c}}>{l}</span>
          </span>
        ))}
        <span style={{fontSize:8,color:"#484f58",marginLeft:"auto"}}>Diagonal faint lines = Haber C×t=k reference · hover markers for values</span>
      </div>

      {/* AEGL data table + notes */}
      <div style={{padding:"12px 14px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={{background:"#0d1117",border:"1px solid #21262d",borderRadius:6,padding:"10px 12px"}}>
          <div style={{fontSize:9,color:"#f0883e",letterSpacing:"1.5px",marginBottom:6}}>AEGL DATA — {chem.ref}</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
            <thead>
              <tr>{["Duration","AEGL-1","AEGL-2","AEGL-3"].map(h=>(
                <th key={h} style={{textAlign:"right",color:"#6e7681",padding:"2px 5px",borderBottom:"1px solid #21262d",fontSize:9}}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {T5.map((t,i)=>{
                const dur=t<1?`${Math.round(t*60)} min`:`${t} hr`;
                return <tr key={i} style={{borderBottom:"1px solid #1c2128"}}>
                  <td style={{color:"#8b949e",padding:"3px 5px",fontSize:9}}>{dur}</td>
                  <td style={{color:"#4ade80",textAlign:"right",padding:"3px 5px"}}>{chem.aegl1?chem.aegl1[i][1]:"NR"}</td>
                  <td style={{color:"#fbbf24",textAlign:"right",padding:"3px 5px"}}>{chem.aegl2[i][1]}</td>
                  <td style={{color:"#f87171",textAlign:"right",padding:"3px 5px"}}>{chem.aegl3[i][1]}</td>
                </tr>;
              })}
            </tbody>
          </table>
          <div style={{marginTop:6,fontSize:8,color:"#484f58"}}>
            ppm · <a href={chem.url} target="_blank" rel="noopener noreferrer" style={{color:"#58a6ff"}}>EPA AEGL Program ↗</a>
          </div>
        </div>
        <div style={{background:"#0d1117",border:"1px solid #21262d",borderRadius:6,padding:"10px 12px"}}>
          <div style={{fontSize:9,color:"#f0883e",letterSpacing:"1.5px",marginBottom:6}}>CHART NOTES</div>
          <p style={{fontSize:11,color:"#c9d1d9",margin:"0 0 5px",lineHeight:1.7}}>{chem.note1}</p>
          <p style={{fontSize:11,color:"#8b949e",margin:0,lineHeight:1.7}}>{chem.note2}</p>
        </div>
      </div>

      {/* Odor + Sources */}
      <div style={{padding:"0 14px 12px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={{background:"#0d1117",border:"1px solid #21262d",borderRadius:6,padding:"10px 12px"}}>
          <div style={{fontSize:9,color:"#fde047",letterSpacing:"1.5px",marginBottom:6}}>👃 ODOR PROPERTIES</div>
          <div style={{fontSize:10,fontWeight:700,color:"#e6edf3",marginBottom:4}}>
            Threshold: {chem.odorThreshold}
          </div>
          <p style={{fontSize:11,color:"#c9d1d9",margin:0,lineHeight:1.7}}>{chem.odorDesc}</p>
        </div>
        <div style={{background:"#0d1117",border:"1px solid #21262d",borderRadius:6,padding:"10px 12px"}}>
          <div style={{fontSize:9,color:"#60a5fa",letterSpacing:"1.5px",marginBottom:6}}>📍 WHERE EXPOSURES OCCUR</div>
          <p style={{fontSize:11,color:"#c9d1d9",margin:0,lineHeight:1.7}}>{chem.sources}</p>
        </div>
      </div>

      {/* How to read */}
      <div style={{padding:"0 14px 16px"}}>
        <div style={{background:"#0d1117",border:"1px solid #21262d",borderRadius:6,padding:"8px 12px",fontSize:9,color:"#6e7681",lineHeight:1.8}}>
          <strong style={{color:"#8b949e"}}>Reading the chart:</strong> X = exposure duration (log scale, left=short, right=long). Y = concentration in ppm (log scale, top=high, bottom=low).
          <span style={{color:"#4ade80"}}> Green band = safe zone (below AEGL-1)</span>.
          <span style={{color:"#fde047"}}> Yellow = mild discomfort</span>.
          <span style={{color:"#fb923c"}}> Orange = serious/irreversible</span>.
          <span style={{color:"#f87171"}}> Red = life-threatening</span>.
          Steep slopes = cumulative dose (Haber's rule). Flat curves = concentration-driven (duration doesn't matter). Faint diagonal lines = Haber's rule C×t=constant.
        </div>
      </div>
    </div>
  );
}

// ═══ REFERENCE PAGE ═══════════════════════════════════════════════════════════
const REFS=[
  {id:"osha",label:"OSHA PEL",color:"#fb923c",badge:"Regulatory · Legally binding",who:"U.S. Occupational Safety and Health Administration",timeBasis:"8-hour TWA; some STEL (15-min) or ceiling",protects:"Workers in occupational settings",binding:true,
   body:`OSHA Permissible Exposure Limits are legally enforceable maximum concentrations for worker exposure. Most PELs were adopted from the 1968 ACGIH TLV list under the OSH Act of 1970 and have not been substantially updated since 1971. OSHA's 1989 attempt to update 428 PELs was vacated by the 11th Circuit Court. As a result, PELs lag decades behind toxicological science for many substances.`,
   limits:`Not updated for most chemicals since 1971. Do not protect against all health effects. Do not account for sensitive populations. They are enforced minimums, not health-protective targets. Many current occupational hygiene practitioners use ACGIH TLVs as working targets instead.`,
   cite:"29 CFR §1910.1000 (1971, amended). U.S. Dept. of Labor. https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1000"},
  {id:"niosh",label:"NIOSH REL",color:"#34d399",badge:"Recommended · Not legally binding",who:"National Institute for Occupational Safety and Health (CDC)",timeBasis:"10-hour TWA for most; some STEL (15-min) or ceiling",protects:"Workers; updated regularly based on current toxicology",binding:false,
   body:`NIOSH Recommended Exposure Limits represent the maximum concentrations to which workers should be exposed over a working lifetime. Updated more frequently than OSHA PELs and based on current science. For carcinogens, NIOSH designates RELs as "lowest feasible" (LF) — no safe threshold. Used by occupational hygienists as de facto targets where OSHA PELs are outdated.`,
   limits:`Not legally enforceable. Not all chemicals have established RELs. The 10-hour basis differs from OSHA's 8-hour TWA.`,
   cite:"NIOSH (2023). NIOSH Pocket Guide to Chemical Hazards. DHHS Pub. 2005-149 (updated). CDC. https://www.cdc.gov/niosh/npg/"},
  {id:"acgih",label:"ACGIH TLV",color:"#60a5fa",badge:"Best practice · Annually updated · Not legally binding",who:"American Conference of Governmental Industrial Hygienists (private nonprofit)",timeBasis:"8-hour TWA (TLV-TWA); 15-min STEL (TLV-STEL); ceiling (TLV-C)",protects:"Nearly all workers; updated annually with new toxicological data",binding:false,
   body:`ACGIH TLVs represent current scientific consensus on safe occupational exposure levels. Published annually since 1946, incorporating the most recent peer-reviewed toxicology. TLVs often lead OSHA and NIOSH by years or decades. Carry A-category carcinogen classifications: A1 (confirmed), A2 (suspected), A3 (animal), A4 (not classifiable), A5 (not suspected).`,
   limits:`Not legally enforceable. ACGIH is private; TLVs are copyrighted (annual TLV/BEI book required for official use). Some critics note possible industry influence on certain TLVs.`,
   cite:"ACGIH (2024). TLVs® and BEIs® Handbook. ACGIH, Cincinnati. Annual. https://www.acgih.org/tlv-bei-guidelines/"},
  {id:"idlh",label:"IDLH",color:"#f87171",badge:"Emergency threshold · 30-minute basis",who:"NIOSH",timeBasis:"30-minute basis for emergency escape; not a chronic standard",protects:"Workers needing to self-rescue from emergency atmosphere",binding:false,
   body:`The Immediately Dangerous to Life or Health value represents the maximum concentration from which a worker could escape within 30 minutes without escape-impairing symptoms or irreversible effects. Above IDLH, positive-pressure SCBA is required. IDLH is the primary threshold for Level A/B PPE selection in HazMat response.`,
   limits:`Based on 30-minute escape only. Not a community standard. Not for chronic assessment. Some older IDLHs were based on limited data and may be set too high.`,
   cite:"NIOSH (1994). Documentation for IDLH Concentrations. DHHS Pub. 94-116. https://www.cdc.gov/niosh/idlh/"},
  {id:"aegl",label:"AEGL",color:"#fde047",badge:"Community emergency · 5 durations · Most rigorous acute standard",who:"U.S. EPA / National Research Council / National Academies of Sciences",timeBasis:"Five durations: 10-min, 30-min, 1-hr, 4-hr, 8-hr. Three tiers: AEGL-1 (discomfort), AEGL-2 (irreversible), AEGL-3 (life-threatening)",protects:"General public including susceptible individuals",binding:false,
   body:`Acute Exposure Guideline Levels are the most scientifically rigorous acute community standards available. Developed at five exposure durations — enabling planners to choose the appropriate duration for their scenario. Final AEGLs undergo full NAS peer review. Plotting AEGL-1/2/3 values at five timepoints on a log-log C vs t chart reveals whether a chemical follows Haber's rule (cumulative dose) or is concentration-driven (flat curves).`,
   limits:`~175 final AEGLs (2024); many important chemicals lack AEGLs. Development is slow (5+ years per chemical). Not applicable for chronic exposures.`,
   cite:"NRC (2002–2018). Acute Exposure Guideline Levels, Vols. 1–22. National Academies Press. https://www.nap.edu/ | EPA AEGL: https://www.epa.gov/aegl"},
  {id:"erpg",label:"ERPG",color:"#fde047",badge:"Community emergency · 1-hour only",who:"American Industrial Hygiene Association (AIHA)",timeBasis:"1-hour exposure only. ERPG-1: mild/transient; ERPG-2: irreversible/escape-impairing; ERPG-3: life-threatening",protects:"General public; not specifically designed for sensitive individuals",binding:false,
   body:`Emergency Response Planning Guidelines are the standard for community emergency planning when AEGLs are unavailable. Published annually (~150 chemicals). ERPG-2 drives most evacuation/shelter-in-place decisions. Used by ALOHA/CAMEO as default Levels of Concern. Superseded by AEGLs where both exist.`,
   limits:`1-hour only. Cannot be used for shorter (10-min) or longer (4-8 hr) scenarios without extrapolation. Less rigorous peer review than AEGLs. Not designed for sensitive individuals.`,
   cite:"AIHA (2023). ERPG/WEEL Handbook. American Industrial Hygiene Association. https://www.aiha.org/"},
  {id:"teel",label:"TEEL / PAC",color:"#fde047",badge:"DOE · ~3,500 chemicals · Backup system",who:"U.S. Department of Energy / Oak Ridge National Laboratory",timeBasis:"AEGL durations where available; 1-hour otherwise",protects:"General public; DOE facility emergency planning",binding:false,
   body:`Protective Action Criteria fill the gap for thousands of chemicals without AEGLs or ERPGs. Hierarchy: AEGLs → ERPGs → TEELs. TEELs derived from occupational limits using mathematical correlations — less reliable. DOE publishes ~3,500 chemical PAC values, the most comprehensive emergency planning dataset available.`,
   limits:`TEELs are derived estimates, not toxicologically derived values. Database mixes high-quality AEGLs with lower-quality estimates — check source tier for each chemical.`,
   cite:"DOE/EFCOG (2023). PAC with AEGLs, ERPGs, and TEELs. https://www.energy.gov/ehss/protective-action-criteria-pac-aegls-erpgs-teels"},
  {id:"naaqs",label:"EPA NAAQS",color:"#4ade80",badge:"Regulatory · Community ambient · Legally binding",who:"U.S. Environmental Protection Agency",timeBasis:"Varies by pollutant: 1-hr, 8-hr, 24-hr, and annual. Primary (health) and secondary (welfare) standards.",protects:"General public including sensitive groups (Clean Air Act §109 requirement)",binding:true,
   body:`National Ambient Air Quality Standards cover six criteria pollutants: PM2.5, PM10, ozone, CO, NO₂, SO₂, and lead. Set under the Clean Air Act with a margin of safety. Designed for continuous chronic exposure, not emergency releases (use AEGLs/ERPGs for those). EPA must review NAAQS at least every 5 years.`,
   limits:`Only 6 pollutants. Not for indoor air. Not designed for acute emergency scenarios. Influenced by feasibility and economic considerations in implementation.`,
   cite:"40 CFR Part 50 (2024). U.S. EPA. https://www.epa.gov/criteria-air-pollutants/naaqs-table | Clean Air Act §109."},
  {id:"iris",label:"EPA IRIS RfC",color:"#c084fc",badge:"Chronic inhalation · Health risk assessment",who:"U.S. EPA Integrated Risk Information System",timeBasis:"Lifetime continuous inhalation exposure",protects:"General population including sensitive subgroups; chronic community exposure",binding:false,
   body:`The IRIS Reference Concentration (RfC) is an estimate of the daily inhalation concentration to which the population may be continuously exposed throughout a lifetime without appreciable noncancer risk. Derived from human or animal data using uncertainty factors (typically 10× each for intraspecies variability, interspecies, and database limitations). For carcinogens, IRIS provides Inhalation Unit Risk (IUR) — cancer risk per unit concentration. Foundation for Superfund risk assessments.`,
   limits:`Not all chemicals assessed (several hundred in IRIS). Can take 10+ years per chemical. Some outdated. RfCs carry substantial uncertainty — screening values, not precise thresholds.`,
   cite:"U.S. EPA IRIS (2024). https://www.epa.gov/iris | EPA/600/8-90/066F (methodology)."},
  {id:"atsdr",label:"ATSDR MRL",color:"#c084fc",badge:"Multi-duration · Community site assessment",who:"Agency for Toxic Substances and Disease Registry (DHHS/CDC)",timeBasis:"Acute (1–14 days), intermediate (15–364 days), chronic (≥365 days) inhalation",protects:"General public near contaminated sites; community health assessments",binding:false,
   body:`ATSDR Minimal Risk Levels estimate daily exposure at or below which noncancer adverse health effects are unlikely. Unlike EPA IRIS (lifetime only), ATSDR MRLs cover three durations, making them useful for communities with variable exposure scenarios. Used in ATSDR toxicological profiles and public health assessments.`,
   limits:`Not legally enforceable. Some health effects may still occur below the MRL. Database updated periodically; check current toxicological profiles.`,
   cite:"ATSDR (2024). MRLs. https://www.atsdr.cdc.gov/mrls/ | Toxicological Profiles: https://www.atsdr.cdc.gov/toxprofiledocs/"},
  {id:"who",label:"WHO AQG",color:"#c084fc",badge:"Global guidelines · 2021 update · Most protective",who:"World Health Organization",timeBasis:"Annual mean and 24-hour; some short-term guidelines",protects:"General population globally; most stringent available for ambient air",binding:false,
   body:`WHO Air Quality Guidelines are the most health-protective ambient standards available, based solely on epidemiology without feasibility or economic considerations. The 2021 update significantly tightened most guidelines (PM2.5 annual halved to 5 µg/m³; NO₂ annual cut from 40 to 10 µg/m³). WHO AQGs are the global reference for what concentrations would be truly health-protective — most national standards including U.S. NAAQS are less stringent.`,
   limits:`Not legally enforceable. Designed for chronic ambient exposure only, not acute releases. Most cities worldwide cannot currently attain WHO AQGs.`,
   cite:"WHO (2021). WHO Global Air Quality Guidelines. ISBN 978-92-4-003422-8. https://www.who.int/publications/i/item/9789240034228"},
  {id:"calosha",label:"Cal/OSHA + OEHHA REL",color:"#fb923c",badge:"California regulatory · More protective than federal OSHA",who:"Cal DOSH (workplace) + OEHHA (community air toxics)",timeBasis:"8-hour TWA (Cal/OSHA workplace); acute and chronic RELs (OEHHA for community)",protects:"California workers (Cal/OSHA) and California residents (OEHHA)",binding:true,
   body:`California maintains its own OSHA plan and publishes both workplace PELs (Title 8, §5155) and community air toxic RELs via OEHHA. Cal/OSHA PELs are often more protective than federal OSHA and are updated more frequently. OEHHA publishes separate acute (1-hr and 8-hr) and chronic RELs for AB 2588 air toxics hot spots assessment — these are among the most health-protective occupational and community standards in the U.S.`,
   limits:`Applies only in California. OEHHA RELs are not occupational limits — they are community risk assessment values. Federal OSHA preemption applies in some circumstances.`,
   cite:"Cal/OSHA (2023). CCR Title 8, §5155. https://www.dir.ca.gov/title8/5155.html | OEHHA (2024). Acute/8-hr/Chronic RELs: https://oehha.ca.gov/air/general-info/"},
];

function RefPage(){
  const [open,setOpen]=useState(null);
  return (
    <div style={{height:"calc(100vh - 56px)",overflowY:"auto",background:"#090c10",padding:"16px 16px 40px"}}>
      <div style={{maxWidth:860,margin:"0 auto"}}>
        <h2 style={{fontSize:16,fontWeight:700,color:"#e6edf3",margin:"0 0 4px"}}>Standards & Reference Guide</h2>
        <p style={{fontSize:11,color:"#8b949e",margin:"0 0 14px",lineHeight:1.7}}>
          Every standard used in this tool — purpose, authority, time basis, limitations, and citations. Click to expand.
        </p>

        {/* Quick comparison */}
        <div style={{background:"#0d1117",border:"1px solid #21262d",borderRadius:6,padding:"10px",marginBottom:14,overflowX:"auto"}}>
          <div style={{fontSize:9,color:"#f0883e",letterSpacing:"2px",marginBottom:6}}>QUICK COMPARISON</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:9,minWidth:560}}>
            <thead>
              <tr style={{borderBottom:"1px solid #30363d"}}>
                {["Standard","Set by","Binding","Protects","Time Basis","Updated"].map(h=>(
                  <th key={h} style={{textAlign:"left",padding:"3px 7px",color:"#6e7681",fontWeight:600}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["OSHA PEL","OSHA (DOL)","Yes","Workers","8-hr TWA","1971 (rarely)"],
                ["NIOSH REL","NIOSH (CDC)","No","Workers","10-hr TWA","Ongoing"],
                ["ACGIH TLV","ACGIH","No","Workers","8-hr TWA","Annually"],
                ["IDLH","NIOSH","No","Workers (escape)","30-min","Periodically"],
                ["AEGL","EPA / NRC","No","General public","5 durations","Per chemical"],
                ["ERPG","AIHA","No","General public","1-hr only","Annually"],
                ["TEEL/PAC","DOE / ORNL","No","General public","1-hr primary","Annually"],
                ["EPA NAAQS","EPA","Yes","General public","1-hr to annual","Every 5 years"],
                ["EPA IRIS RfC","EPA","No","General public","Lifetime","Per chemical"],
                ["ATSDR MRL","ATSDR/CDC","No","Community","3 durations","Per chemical"],
                ["WHO AQG","WHO","No","Global public","24-hr / annual","2021"],
                ["Cal/OSHA","Cal DOSH","Yes (CA)","CA workers","8-hr TWA","Ongoing"],
              ].map(row=>(
                <tr key={row[0]} style={{borderBottom:"1px solid #1c2128"}}>
                  {row.map((cell,i)=>(
                    <td key={i} style={{padding:"3px 7px",color:i===0?"#e6edf3":i===2?cell==="Yes"||cell==="Yes (CA)"?"#f87171":"#34d399":"#8b949e"}}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Accordion */}
        {REFS.map(ref=>(
          <div key={ref.id} style={{marginBottom:5}}>
            <button onClick={()=>setOpen(open===ref.id?null:ref.id)}
              style={{width:"100%",textAlign:"left",background:"#0d1117",
                border:"1px solid #21262d",borderLeft:`3px solid ${ref.color}`,
                borderRadius:open===ref.id?"6px 6px 0 0":"6px",
                padding:"9px 12px",cursor:"pointer",fontFamily:"IBM Plex Mono,monospace"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontSize:13,fontWeight:700,color:"#e6edf3"}}>{ref.label}</span>
                <span style={{fontSize:9,padding:"2px 7px",borderRadius:12,
                  background:`${ref.color}18`,border:`1px solid ${ref.color}40`,color:ref.color}}>{ref.badge}</span>
                <span style={{marginLeft:"auto",color:"#484f58",fontSize:10}}>{open===ref.id?"▲":"▼"}</span>
              </div>
              <div style={{fontSize:10,color:"#6e7681",marginTop:2}}>{ref.who}</div>
            </button>
            {open===ref.id&&(
              <div style={{background:"#0d1117",border:"1px solid #21262d",borderTop:"none",
                borderLeft:`3px solid ${ref.color}`,borderRadius:"0 0 6px 6px",padding:"12px 14px"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
                  {[["Time Basis",ref.timeBasis],["Protects",ref.protects],
                    ["Legally Binding",ref.binding?"Yes":"No (advisory)"]].map(([k,v])=>(
                    <div key={k}>
                      <div style={{fontSize:8,color:"#6e7681",letterSpacing:"1px",marginBottom:2}}>{k.toUpperCase()}</div>
                      <div style={{fontSize:10,color:k==="Legally Binding"?ref.binding?"#f87171":"#34d399":"#c9d1d9"}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:9,color:"#8b949e",letterSpacing:"1px",marginBottom:3}}>OVERVIEW</div>
                <p style={{fontSize:11,color:"#c9d1d9",margin:"0 0 10px",lineHeight:1.8}}>{ref.body}</p>
                <div style={{fontSize:9,color:"#8b949e",letterSpacing:"1px",marginBottom:3}}>LIMITATIONS</div>
                <p style={{fontSize:11,color:"#8b949e",margin:"0 0 10px",lineHeight:1.8}}>{ref.limits}</p>
                <div style={{background:"#161b22",border:"1px solid #30363d",borderRadius:4,padding:"8px 10px"}}>
                  <div style={{fontSize:8,color:"#6e7681",letterSpacing:"1px",marginBottom:2}}>CITATION</div>
                  <p style={{fontSize:10,color:"#8b949e",margin:0,lineHeight:1.7,fontStyle:"italic"}}>{ref.cite}</p>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Bibliography */}
        <div style={{marginTop:20,background:"#0d1117",border:"1px solid #21262d",borderRadius:6,padding:"12px 14px"}}>
          <div style={{fontSize:10,color:"#f0883e",letterSpacing:"2px",marginBottom:10}}>BIBLIOGRAPHY</div>
          {[
            ["[1]","OSHA (1971). 29 CFR §1910.1000.","https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1000"],
            ["[2]","NIOSH (2023). NIOSH Pocket Guide to Chemical Hazards. DHHS Pub. 2005-149.","https://www.cdc.gov/niosh/npg/"],
            ["[3]","ACGIH (2024). TLVs® and BEIs® Handbook. Annual publication.","https://www.acgih.org/tlv-bei-guidelines/"],
            ["[4]","NIOSH (1994). Documentation for IDLH Concentrations. DHHS Pub. 94-116.","https://www.cdc.gov/niosh/idlh/"],
            ["[5]","National Research Council (2002–2018). AEGLs for Selected Airborne Chemicals, Vols. 1–22. NAS Press.","https://www.nap.edu/topic/493/"],
            ["[6]","U.S. EPA. AEGL Program.","https://www.epa.gov/aegl"],
            ["[7]","AIHA (2023). ERPG/WEEL Handbook.","https://www.aiha.org/"],
            ["[8]","DOE/EFCOG (2023). Protective Action Criteria (PAC).","https://www.energy.gov/ehss/protective-action-criteria-pac-aegls-erpgs-teels"],
            ["[9]","40 CFR Part 50 (2024). National Ambient Air Quality Standards.","https://www.epa.gov/criteria-air-pollutants/naaqs-table"],
            ["[10]","U.S. EPA IRIS (2024). Integrated Risk Information System.","https://www.epa.gov/iris"],
            ["[11]","ATSDR (2024). Minimal Risk Levels (MRLs).","https://www.atsdr.cdc.gov/mrls/"],
            ["[12]","WHO (2021). WHO Global Air Quality Guidelines. ISBN 978-92-4-003422-8.","https://www.who.int/publications/i/item/9789240034228"],
            ["[13]","Cal/OSHA (2023). CCR Title 8, §5155 Table AC-1.","https://www.dir.ca.gov/title8/5155.html"],
            ["[14]","OEHHA (2024). Acute/8-hr/Chronic RELs.","https://oehha.ca.gov/air/general-info/oehha-acute-8-hour-and-chronic-reference-exposure-level-rel-summary"],
            ["[15]","Haber, F. (1924). Zur Geschichte des Gaskrieges. Springer, Berlin.",""],
            ["[16]","Miller et al. (2000). Haber's rule: a special case. Toxicology 149(1):21–34.","https://doi.org/10.1016/S0300-483X(00)00229-8"],
            ["[17]","EPA USCG Air Monitoring Guidance Tables (2009 Ed. 2). Coast Guard NSF.","https://www.dco.uscg.mil/"],
          ].map(([n,c,u])=>(
            <div key={n} style={{display:"flex",gap:7,marginBottom:6,fontSize:10,lineHeight:1.6}}>
              <span style={{color:"#484f58",flexShrink:0,fontWeight:700,width:28}}>{n}</span>
              <span style={{color:"#8b949e"}}>{c}{" "}{u&&<a href={u} target="_blank" rel="noopener noreferrer" style={{color:"#388bfd",fontSize:9}}>↗</a>}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══ MAIN APP ═══════════════════════════════════════════════════════════════
const PAGES=[
  {id:1,label:"Threshold Chart"},
  {id:2,label:"C-t Curves"},
  {id:3,label:"Reference Guide"},
];

export default function ToxApp(){
  const [page,setPage]=useState(1);
  return (
    <div style={{fontFamily:"'IBM Plex Mono',monospace",background:"#090c10",minHeight:"100vh",color:"#c9d1d9"}}>
      <div style={{background:"#0d1117",borderBottom:"1px solid #21262d",padding:"0 14px",
        display:"flex",alignItems:"center",gap:0,height:56,flexShrink:0}}>
        <div style={{fontSize:10,color:"#f0883e",letterSpacing:"2px",fontWeight:700,marginRight:20,whiteSpace:"nowrap"}}>
          AIR TOX
        </div>
        {PAGES.map(p=>(
          <button key={p.id} onClick={()=>setPage(p.id)} style={{
            height:"100%",padding:"0 14px",border:"none",
            borderBottom:page===p.id?"2px solid #388bfd":"2px solid transparent",
            background:"transparent",cursor:"pointer",fontFamily:"IBM Plex Mono,monospace",
            color:page===p.id?"#e6edf3":"#8b949e",fontSize:11,fontWeight:page===p.id?700:400}}>
            {p.label}
          </button>
        ))}
        <div style={{marginLeft:"auto",fontSize:9,color:"#484f58"}}>AEGL · ERPG · OSHA · NIOSH · ACGIH · EPA</div>
      </div>
      {page===1&&<ChartPage/>}
      {page===2&&<CTPage/>}
      {page===3&&<RefPage/>}
    </div>
  );
}
