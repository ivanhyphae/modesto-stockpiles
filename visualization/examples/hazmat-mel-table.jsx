import { useState } from "react";

const data = [
  // DETECTION & AIR MONITORING
  {
    category: "Air Monitoring",
    tier: "All",
    item: "4-Gas Monitor (LEL/O₂/CO/H₂S)",
    model: "MSA ALTAIR 4XR",
    price: "$1,200",
    vendor: "Work Life Workwear",
    url: "https://worklifeca.com/products/msa-altair%C2%AE-4xr-multigas-detector",
    notes: "4-yr warranty, MIL-STD-810G drop rated",
  },
  {
    category: "Air Monitoring",
    tier: "All",
    item: "4-Gas Monitor (LEL/O₂/CO/H₂S)",
    model: "Industrial Scientific MX6 iBrid",
    price: "$1,400–$1,800",
    vendor: "Industrial Safety Products",
    url: "https://www.industrialsafetyproducts.com/industrial-scientific-mx6-ibrid-multi-gas-monitor-w-pump-lel-co-h2s-o2/",
    notes: "6-gas capable, lifetime warranty",
  },
  {
    category: "Air Monitoring",
    tier: "Type 1 & 2",
    item: "PID / VOC Monitor",
    model: "RAE MiniRAE 3000+ (PGM-7320)",
    price: "$3,200–$3,600",
    vendor: "Amazon / RAE Systems",
    url: "https://www.amazon.com/RAE-Systems-MiniRAE-Accessories-Calibration/dp/B074GFFS4L",
    notes: "0–15,000 ppm range, ideal for MMA",
  },
  {
    category: "Air Monitoring",
    tier: "Type 1 & 2",
    item: "Colorimetric Tube Pump – Thick (Dräger)",
    model: "Dräger Accuro – Hardside Kit",
    price: "$715–$795",
    vendor: "Safety Supply America",
    url: "https://www.safetysupplyamerica.com/product/9686/drger-accuro-pump-hard-transport-case-kit-draeger-4056443",
    notes: "CA FIRESCOPE MEL compliant; 350+ tube compounds",
  },
  {
    category: "Air Monitoring",
    tier: "Type 1 & 2",
    item: "Colorimetric Tube Pump – Thin (Gastec/Sensidyne)",
    model: "Sensidyne AP-20S Kit",
    price: "~$500",
    vendor: "Pine Environmental",
    url: "https://www.pine-environmental.com/products/hand-pump-sensidyne-model-ap-20s-gas-detection-pump-kit",
    notes: "Cross-compatible with Gastec, Kitagawa, RAE tubes",
  },
  {
    category: "Air Monitoring",
    tier: "Type 1 & 2",
    item: "MMA-Specific Detector Tubes (Gastec #149)",
    model: "Gastec No. 149 – MMA 10–500 ppm",
    price: "~$50–70 / box of 10",
    vendor: "ERE Inc.",
    url: "https://www.ereinc.com/products/methyl-methacrylate-allyl-alcohol-sensidyne-colorimetric-gas-detection-tubes",
    notes: "Color: yellow → pale blue; 2 strokes",
  },
  {
    category: "Air Monitoring",
    tier: "Type 1 & 2",
    item: "Methyl Acrylate Tubes (Dräger)",
    model: "Dräger Tube Methyl Acrylate 5/a (#6728161)",
    price: "$169 / box of 10",
    vendor: "Fisher Scientific",
    url: "https://www.fishersci.com/shop/products/dr-ger-short-term-detector-tubes-de-tube-methyl-acrylate/17985257",
    notes: "5–200 ppm; ±10% accuracy",
  },
  {
    category: "Air Monitoring",
    tier: "Type 1",
    item: "CWA / Chemical Agent Detector",
    model: "Dräger CDS (Chemical Detection System)",
    price: "Quote only",
    vendor: "Dräger Direct",
    url: "https://www.draeger.com/en-us_us/Products/Chemical-Detection",
    notes: "Detects nerve agents, blister agents",
  },
  {
    category: "Air Monitoring",
    tier: "All",
    item: "Portable Weather Station (CAMEO/ALOHA input)",
    model: "Kestrel 5500 + LiNK + Vane Mount",
    price: "$379",
    vendor: "Kestrel Direct",
    url: "https://kestrelmeters.com/kestrel-5500-weather-meter",
    notes: "Measures all ALOHA/CAMEO required params; IP67",
  },
  // RADIATION
  {
    category: "Radiation",
    tier: "All",
    item: "Gamma/Beta Survey Meter",
    model: "Ludlum Model 14C",
    price: "$800–$1,100",
    vendor: "CHP Consultants / Ludlum Direct",
    url: "https://chpconsultants.com/collection/ludlum-model-14c-survey-meter/",
    notes: "0–2,000 mR/hr; aluminum housing; workhorse unit",
  },
  {
    category: "Radiation",
    tier: "Type 1",
    item: "Radionuclide Identification Device (RIID)",
    model: "Thermo Fisher RIIDEye / identiFINDER",
    price: "$8,000–$20,000",
    vendor: "Thermo Fisher Scientific",
    url: "https://www.thermofisher.com/us/en/home/industrial/radiation-detection-measurement/instruments.html",
    notes: "Alpha/beta/gamma + isotope ID; required for Type 1",
  },
  // PPE
  {
    category: "Protective Clothing",
    tier: "Type 1 & 2",
    item: "Level A Vapor-Protective Suit (NFPA 1991)",
    model: "DuPont Tychem 10000 Commander EX",
    price: "$2,500–$3,500",
    vendor: "PK Safety / WFR Fire & Rescue",
    url: "https://pksafety.com/products/dupont-tychem-10000-commander-ex-level-a-suit-tk555t",
    notes: "Tested against 322 chemicals incl. WMD agents; made-to-order",
  },
  {
    category: "Protective Clothing",
    tier: "All",
    item: "Level B Liquid-Splash Suit (NFPA 1992)",
    model: "DuPont Tychem 4000 / Lakeland ChemMax",
    price: "$150–$400",
    vendor: "Fisher Scientific / Grainger",
    url: "https://www.fishersci.com/shop/products/tychem-4000-chemical-protective-coveralls/50094788",
    notes: "Disposable; stock multiples",
  },
  {
    category: "Protective Clothing",
    tier: "Type 1 & 2",
    item: "Flash Fire / Proximity Suit (NFPA 1994)",
    model: "Lion Apparel Janesville Flash",
    price: "$500–$1,200",
    vendor: "FireService.com / Grainger",
    url: "https://www.grainger.com",
    notes: "Required for Type 1 & 2",
  },
  {
    category: "Protective Clothing",
    tier: "All",
    item: "Hi-Temp + Cryogenic Protective Gloves",
    model: "Ansell AlphaTec 58-535 + Cryo gloves",
    price: "$50–$200 / pair",
    vendor: "Grainger / Zoro",
    url: "https://www.grainger.com/search?searchQuery=cryogenic+chemical+gloves",
    notes: "Both hi-temp and cryo required at all tiers",
  },
  // RESPIRATORY
  {
    category: "Respiratory",
    tier: "All",
    item: "SCBA",
    model: "MSA G1 Industrial SCBA (30-min cylinder)",
    price: "Quote required",
    vendor: "Indian Springs / The Safety Equipment Store",
    url: "https://www.thesafetyequipmentstore.com/msa-g1-industrial-scba.html",
    notes: "NIOSH/MSHA approved; HazMat version (not firefighting)",
  },
  {
    category: "Respiratory",
    tier: "Type 1",
    item: "PAPR – CBRN / WMD Cartridges",
    model: "3M Breathe Easy / Dräger X-plore 8000",
    price: "$1,200–$2,000",
    vendor: "Dräger / 3M Safety",
    url: "https://www.draeger.com/en-us_us/Applications/Products/Respiratory-Protection/Powered-Air-Purifying-Respirators",
    notes: "CBRN cartridges required at Type 1",
  },
  // TECHNICAL REFERENCE
  {
    category: "Technical Reference",
    tier: "All",
    item: "Portable Weather + Plume Modeling (ALOHA)",
    model: "Laptop w/ CAMEO/ALOHA (free software) + Kestrel 5500",
    price: "$0 software + $379 Kestrel",
    vendor: "NOAA/EPA (free) + Kestrel",
    url: "https://www.cameochemicals.noaa.gov/aloha",
    notes: "ALOHA is free; requires weather station input",
  },
  {
    category: "Technical Reference",
    tier: "All",
    item: "ERG (Emergency Response Guidebook)",
    model: "2024 Edition – Print + Digital",
    price: "$5–$15 print",
    vendor: "Amazon / PHMSA",
    url: "https://www.phmsa.dot.gov/training/hazmat/erg/emergency-response-guidebook-erg",
    notes: "Current 2024 edition; also free PDF from DOT",
  },
  // SPECIAL CAPABILITIES
  {
    category: "Special Capabilities",
    tier: "Type 1 & 2",
    item: "Thermal Imaging Camera (TIC)",
    model: "FLIR K65 (Tactical) / MSA Evolution 6000",
    price: "$3,500–$8,000",
    vendor: "FLIR / The Fire Store",
    url: "https://thefirestore.com/msa",
    notes: "NFPA 1801 compliant; higher res for HazMat perimeter",
  },
  {
    category: "Special Capabilities",
    tier: "Type 1",
    item: "Portable GC/MS (Unknown Chem ID)",
    model: "Bruker RAID-M 100 / Smiths HOUND",
    price: "$30,000–$80,000",
    vendor: "Bruker / Smiths Detection",
    url: "https://www.bruker.com/en/products-and-solutions/detection-and-safety",
    notes: "Gold standard for unknown substance ID; Type 1 capability",
  },
  {
    category: "Special Capabilities",
    tier: "Type 1 & 2",
    item: "HazCat Chemical ID Kit",
    model: "HazCat Kit (Haztech Systems)",
    price: "$1,500–$2,500",
    vendor: "Hazmat Resource / Grainger",
    url: "https://hazmatresource.com",
    notes: "Field ID of unknowns; required for Type 1 & 2",
  },
  // SAMPLING
  {
    category: "Sampling",
    tier: "All",
    item: "Sample Collection Kit (Tedlar bags, vials, C.O.C.)",
    model: "SKC Air Sampling Kit",
    price: "$200–$500",
    vendor: "SKC Inc.",
    url: "https://www.skcinc.com/sampling-media",
    notes: "Chain of custody forms; glass & stainless vials",
  },
  // INTERVENTION
  {
    category: "Intervention",
    tier: "All",
    item: "Plug & Patch Kit",
    model: "Chemtex / Husky Portable Spill Kit",
    price: "$300–$800",
    vendor: "Grainger / Zoro",
    url: "https://www.grainger.com/search?searchQuery=hazmat+plug+patch+kit",
    notes: "Multiple pipe sizes; vapor/liquid containment",
  },
  {
    category: "Intervention",
    tier: "All",
    item: "85-Gallon Overpack Drum",
    model: "Skolnik / Eagle Overpack",
    price: "$200–$400 each",
    vendor: "Grainger / Uline",
    url: "https://www.grainger.com/search?searchQuery=overpack+drum+85+gallon",
    notes: "UN-rated; required for all tiers",
  },
  // DECON
  {
    category: "Decontamination",
    tier: "All",
    item: "Portable Decon Shower / Corridor System",
    model: "Radiation Detection Co. Portable Decon",
    price: "$2,000–$8,000",
    vendor: "Grainger / Zoro / specialty HazMat suppliers",
    url: "https://www.grainger.com",
    notes: "Type 3 = 250 persons; Type 2 = 500; Type 1 = 1,000",
  },
  // COMMUNICATIONS
  {
    category: "Communications",
    tier: "All",
    item: "In-Suit Comm System",
    model: "Dräger FPS-COM 5000 / Scott AV-3000",
    price: "$500–$1,500",
    vendor: "Dräger / Scott Safety",
    url: "https://www.draeger.com/en-us_us/Products/Communication",
    notes: "Required at all tiers; works with Level A suits",
  },
  {
    category: "Communications",
    tier: "Type 1 & 2",
    item: "Intrinsically Safe Portable Radio",
    model: "Motorola APX 900 IS",
    price: "$1,500–$3,000",
    vendor: "Motorola Solutions",
    url: "https://www.motorolasolutions.com",
    notes: "IS-rated per UL; required in explosive atmospheres",
  },
];

const categories = ["All", ...Array.from(new Set(data.map((d) => d.category)))];
const tiers = ["All", "All", "Type 1", "Type 1 & 2", "Type 2"];
const uniqueTiers = ["All Tiers", "Type 1 Only", "Type 1 & 2", "All Tiers (Type 3+)"];

const tierColors = {
  "All": "bg-emerald-900/50 text-emerald-300 border border-emerald-700",
  "Type 1 & 2": "bg-amber-900/50 text-amber-300 border border-amber-700",
  "Type 1": "bg-red-900/50 text-red-300 border border-red-700",
};

export default function HazMatMEL() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  const filtered = data.filter((d) => {
    const matchCat = activeCategory === "All" || d.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      d.item.toLowerCase().includes(q) ||
      d.model.toLowerCase().includes(q) ||
      d.notes.toLowerCase().includes(q) ||
      d.vendor.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const grouped = filtered.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div
      style={{
        fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
        background: "#0a0c0f",
        minHeight: "100vh",
        color: "#c9d1d9",
        padding: "0",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0d1117 0%, #161b22 100%)",
          borderBottom: "1px solid #21262d",
          padding: "24px 28px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "4px" }}>
          <span style={{ color: "#f0883e", fontSize: "11px", letterSpacing: "3px", fontWeight: 700 }}>
            CAL OES / FIRESCOPE
          </span>
          <span style={{ color: "#30363d", fontSize: "11px" }}>ICS-1120</span>
        </div>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "#e6edf3",
            margin: "0 0 4px",
            letterSpacing: "-0.5px",
          }}
        >
          HazMat MEL — Equipment & Pricing Reference
        </h1>
        <p style={{ color: "#8b949e", fontSize: "12px", margin: 0 }}>
          {data.length} items across {categories.length - 1} categories · Prices as of 2025–2026
        </p>
      </div>

      {/* Controls */}
      <div
        style={{
          background: "#161b22",
          borderBottom: "1px solid #21262d",
          padding: "14px 28px",
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search equipment, model, vendor..."
          style={{
            background: "#0d1117",
            border: "1px solid #30363d",
            color: "#c9d1d9",
            padding: "7px 12px",
            borderRadius: "6px",
            fontSize: "12px",
            width: "260px",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: "5px 11px",
                borderRadius: "20px",
                fontSize: "11px",
                fontFamily: "inherit",
                cursor: "pointer",
                fontWeight: activeCategory === cat ? 700 : 400,
                border: activeCategory === cat ? "1px solid #388bfd" : "1px solid #30363d",
                background: activeCategory === cat ? "#1f3a5f" : "#0d1117",
                color: activeCategory === cat ? "#58a6ff" : "#8b949e",
                transition: "all 0.15s",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tier Legend */}
      <div style={{ padding: "10px 28px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {Object.entries(tierColors).map(([tier, cls]) => (
          <span
            key={tier}
            style={{
              fontSize: "10px",
              padding: "2px 8px",
              borderRadius: "4px",
              letterSpacing: "0.5px",
            }}
            className={cls}
          >
            {tier === "All" ? "ALL TIERS" : tier.toUpperCase()}
          </span>
        ))}
        <span style={{ color: "#8b949e", fontSize: "10px", alignSelf: "center" }}>
          = FIRESCOPE SEL certification tier requirement
        </span>
      </div>

      {/* Table */}
      <div style={{ padding: "0 28px 40px" }}>
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: "28px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                margin: "20px 0 8px",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  letterSpacing: "2px",
                  fontWeight: 700,
                  color: "#f0883e",
                  textTransform: "uppercase",
                }}
              >
                {cat}
              </span>
              <div style={{ flex: 1, height: "1px", background: "#21262d" }} />
              <span style={{ color: "#484f58", fontSize: "10px" }}>{items.length} items</span>
            </div>

            <div
              style={{
                border: "1px solid #21262d",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: "#161b22" }}>
                    {["Tier", "Equipment", "Model / Part", "Price", "Vendor", "Notes"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: "8px 12px",
                            textAlign: "left",
                            color: "#8b949e",
                            fontWeight: 600,
                            fontSize: "10px",
                            letterSpacing: "1px",
                            borderBottom: "1px solid #21262d",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h.toUpperCase()}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const isExp = expanded === `${cat}-${i}`;
                    return (
                      <tr
                        key={i}
                        onClick={() => setExpanded(isExp ? null : `${cat}-${i}`)}
                        style={{
                          background: isExp ? "#161b22" : i % 2 === 0 ? "#0d1117" : "#0a0c0f",
                          borderBottom: "1px solid #21262d",
                          cursor: "pointer",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) =>
                          !isExp && (e.currentTarget.style.background = "#161b22")
                        }
                        onMouseLeave={(e) =>
                          !isExp &&
                          (e.currentTarget.style.background =
                            i % 2 === 0 ? "#0d1117" : "#0a0c0f")
                        }
                      >
                        <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              fontSize: "9px",
                              padding: "2px 6px",
                              borderRadius: "3px",
                              fontWeight: 700,
                              letterSpacing: "0.5px",
                              ...(item.tier === "All"
                                ? {
                                    background: "rgba(56,139,253,0.1)",
                                    color: "#58a6ff",
                                    border: "1px solid rgba(56,139,253,0.3)",
                                  }
                                : item.tier === "Type 1"
                                ? {
                                    background: "rgba(248,81,73,0.1)",
                                    color: "#ff7b72",
                                    border: "1px solid rgba(248,81,73,0.3)",
                                  }
                                : {
                                    background: "rgba(210,153,34,0.1)",
                                    color: "#d29922",
                                    border: "1px solid rgba(210,153,34,0.3)",
                                  }),
                            }}
                          >
                            {item.tier}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "9px 12px",
                            color: "#e6edf3",
                            fontWeight: 500,
                            maxWidth: "200px",
                          }}
                        >
                          {item.item}
                        </td>
                        <td
                          style={{
                            padding: "9px 12px",
                            color: "#a5d6ff",
                            maxWidth: "200px",
                          }}
                        >
                          {item.model}
                        </td>
                        <td
                          style={{
                            padding: "9px 12px",
                            color: "#3fb950",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.price}
                        </td>
                        <td style={{ padding: "9px 12px" }}>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              color: "#58a6ff",
                              textDecoration: "none",
                              fontSize: "11px",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.textDecoration = "underline")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.textDecoration = "none")
                            }
                          >
                            {item.vendor} ↗
                          </a>
                        </td>
                        <td
                          style={{
                            padding: "9px 12px",
                            color: "#8b949e",
                            fontSize: "11px",
                            maxWidth: "220px",
                          }}
                        >
                          {item.notes}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "#484f58",
              padding: "60px",
              fontSize: "13px",
            }}
          >
            No equipment matches your search.
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid #21262d",
          padding: "16px 28px",
          color: "#484f58",
          fontSize: "10px",
          letterSpacing: "0.5px",
        }}
      >
        SOURCE: FIRESCOPE SEL 2016 Edition · Cal OES Appendix G · MEL ICS-1120 · Prices are
        current market estimates and may vary. Quote-only items require direct vendor contact.
        FIRESCOPE does not endorse specific vendors.
      </div>
    </div>
  );
}
