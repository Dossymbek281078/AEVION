/**
 * QVenture — Jurisdictional Legal Matrix
 * ──────────────────────────────────────
 * Turns the lawyer lens from generic boilerplate into named, jurisdiction-
 * specific regimes. Two layers:
 *
 *   (a) SECURITIES REGIME — how an investor legally deploys capital into the
 *       round in this jurisdiction (US Reg D / Reg S, EU Prospectus Regulation,
 *       UK FSMA financial-promotion + SEIS/EIS).
 *   (b) SECTOR LICENSING OVERLAY — the compliance surface the *company* must
 *       clear to operate, keyed by (sector × jurisdiction).
 *
 * This is directional legal analysis to frame diligence, NOT legal advice —
 * every output tells the investor to confirm with local counsel. Regimes are
 * cited to the instrument by name so they are auditable, not invented.
 */

import type { SectorProfile } from "./sectors";

export type JurisdictionId = "US" | "EU" | "UK" | "OTHER";

export interface JurisdictionProfile {
  id: JurisdictionId;
  label: string;
  /** How a private round is legally structured for the investor. */
  securitiesRegime: string;
  /** Named private-placement exemptions / instruments available. */
  privateExemptions: string[];
  /** Downside-protection / control terms that are standard-of-market here. */
  investorTerms: string[];
  /** Governing data-privacy regime. */
  dataPrivacy: string;
  /** Cross-cutting AI-governance regime an investor should weigh. */
  aiGovernance: string;
  note: string;
}

export const JURISDICTIONS: Record<JurisdictionId, JurisdictionProfile> = {
  US: {
    id: "US", label: "United States",
    securitiesRegime:
      "Private placement under Reg D of the Securities Act — 506(b) (no general solicitation, accredited + ≤35 sophisticated) or 506(c) (general solicitation permitted, all-accredited with verification); Form D filed within 15 days.",
    privateExemptions: ["Reg D 506(b)", "Reg D 506(c)", "Reg S (offshore)", "Reg CF (crowdfunding)"],
    investorTerms: [
      "priced equity or post-money SAFE; 1x non-participating liquidation preference is market",
      "pro-rata / information rights, board or observer seat, broad-based weighted-average anti-dilution",
    ],
    dataPrivacy: "No federal omnibus law — CCPA/CPRA (California) plus sectoral regimes (HIPAA, GLBA); state patchwork.",
    aiGovernance: "No federal AI statute — FTC Act §5 enforcement, NIST AI RMF (voluntary), emerging state laws (e.g. CO AI Act).",
    note: "Confirm each investor's accredited status (Rule 501) and that solicitation matched the chosen exemption.",
  },
  EU: {
    id: "EU", label: "European Union",
    securitiesRegime:
      "Offer structured under the Prospectus Regulation (EU) 2017/1129 exemptions — qualified investors and/or below the national prospectus threshold (typically €1M–€8M); fund side governed by AIFMD, distribution by MiFID II.",
    privateExemptions: ["Prospectus Regulation qualified-investor exemption", "sub-threshold national exemption", "AIFMD (fund side)"],
    investorTerms: [
      "terms track BVCA/Invest Europe norms, but company law is national (GmbH / SAS / B.V.) — notarial deeds common",
      "confirm cap-table mechanics under local corporate code; tag/drag and preference enforceability vary by member state",
    ],
    dataPrivacy: "GDPR (Regulation (EU) 2016/679) — fines up to 4% of global turnover; DPO and lawful-basis diligence required.",
    aiGovernance: "EU AI Act (Reg (EU) 2024/1689) — risk-tiered obligations, GPAI transparency; high-risk duties phasing in through 2026–2027.",
    note: "Member-state company law governs enforceability — verify in the specific country of incorporation, not 'the EU' generically.",
  },
  UK: {
    id: "UK", label: "United Kingdom",
    securitiesRegime:
      "Round made under the FSMA 2000 financial-promotion regime — relying on exemptions for high-net-worth and sophisticated investors (Financial Promotion Order); prospectus exemptions for the offer itself.",
    privateExemptions: ["FPO high-net-worth / sophisticated-investor exemption", "prospectus exemption", "SEIS", "EIS"],
    investorTerms: [
      "SEIS/EIS eligibility is often decisive for UK angels — confirm advance assurance and qualifying-trade status early",
      "BVCA-standard long-form docs; ordinary vs preferred share rights set in the articles",
    ],
    dataPrivacy: "UK GDPR + Data Protection Act 2018 — mirrors EU GDPR with UK-specific ICO oversight.",
    aiGovernance: "Principles-based, pro-innovation framework across existing regulators (no single UK AI statute yet).",
    note: "SEIS/EIS qualification can make or break UK investor demand — verify the trade qualifies before committing.",
  },
  OTHER: {
    id: "OTHER", label: "Other / Unspecified",
    securitiesRegime:
      "Jurisdiction not specified — structure the round under local private-placement rules and confirm exemption availability with local counsel before wiring funds.",
    privateExemptions: ["local private-placement exemption (verify)"],
    investorTerms: [
      "insist on a recognizable holding structure (Delaware C-corp / UK Ltd flip is common for cross-border rounds)",
      "confirm enforceability of preference, anti-dilution and information rights under local law",
    ],
    dataPrivacy: "Determine the applicable data-protection regime for the operating geography.",
    aiGovernance: "Determine whether any local AI/algorithmic-accountability rules apply.",
    note: "Cross-border deals commonly flip to a US or UK holding company to give investors familiar protections.",
  },
};

const GEO_ALIASES: Record<string, JurisdictionId> = {
  us: "US", usa: "US", "united states": "US", america: "US", "u.s.": "US", "u.s.a.": "US",
  eu: "EU", europe: "EU", "european union": "EU", germany: "EU", france: "EU", spain: "EU",
  italy: "EU", netherlands: "EU", ireland: "EU", sweden: "EU", poland: "EU", portugal: "EU",
  uk: "UK", "united kingdom": "UK", britain: "UK", england: "UK", "great britain": "UK", gb: "UK",
};

export function resolveJurisdiction(geography: string | undefined): JurisdictionProfile {
  if (!geography) return JURISDICTIONS.US; // English-market default
  const g = geography.trim().toLowerCase();
  if (GEO_ALIASES[g]) return JURISDICTIONS[GEO_ALIASES[g]];
  for (const [alias, id] of Object.entries(GEO_ALIASES)) {
    if (g.includes(alias)) return JURISDICTIONS[id];
  }
  return JURISDICTIONS.OTHER;
}

/**
 * Sector-specific licensing / compliance overlay, keyed by (sector × jurisdiction).
 * Only genuinely regulated sectors carry named regimes; the rest fall back to a
 * general commercial note. One concise line per cell — the diligence headline.
 */
const SECTOR_LICENSING: Record<string, Partial<Record<JurisdictionId, string>>> = {
  fintech: {
    US: "State money-transmitter licenses + FinCEN MSB registration & BSA/AML program; OCC/CFPB oversight; card issuance via a sponsor bank BIN.",
    EU: "EMI or Payment Institution authorization under PSD2 / EMD2; MiCA for any crypto-asset activity.",
    UK: "FCA authorization (EMI / payment institution); FCA cryptoasset registration for AML.",
  },
  healthtech: {
    US: "FDA clearance for Software-as-a-Medical-Device (510(k) / De Novo), HIPAA for PHI, and state telehealth licensure.",
    EU: "MDR (EU 2017/745) CE marking for medical-device software; GDPR special-category health-data safeguards.",
    UK: "MHRA registration + UKCA marking; NHS Data Security & Protection Toolkit for NHS deployment.",
  },
  biotech: {
    US: "FDA pathway (IND → NDA/BLA) with phased clinical trials; GxP compliance; binary approval risk.",
    EU: "EMA centralized authorization under the Clinical Trials Regulation (EU 536/2014); GMP inspection.",
    UK: "MHRA authorization and clinical-trial approval (post-Brexit standalone regime).",
  },
  cybersecurity: {
    US: "FedRAMP for federal sales; SEC cyber-incident disclosure rules; SOC 2 as commercial table stakes.",
    EU: "NIS2 Directive obligations and the Cyber Resilience Act for products with digital elements.",
    UK: "NCSC guidance and UK NIS Regulations; Cyber Essentials for public-sector procurement.",
  },
  climate: {
    US: "IRA tax-credit dependence (IRS/DOE), FERC for grid/energy, and state PUC approvals.",
    EU: "EU Taxonomy alignment, ETS exposure, and state-aid/subsidy conditionality.",
    UK: "Ofgem regulation and UK ETS; contracts-for-difference / subsidy dependence.",
  },
  proptech: {
    US: "State real-estate & mortgage-broker licensing; RESPA/TILA if touching transactions; fair-housing compliance.",
    EU: "National property, tenancy and land-registry law — highly member-state specific.",
    UK: "Estate-agency and, if lending, FCA mortgage rules; leasehold/land-registry specifics.",
  },
  agtech: {
    US: "EPA (pesticides/biologicals) and USDA oversight; FDA if food-facing.",
    EU: "EFSA authorization, novel-food regulation, and CAP/subsidy interaction.",
    UK: "Food Standards Agency and post-Brexit product authorization regimes.",
  },
  space: {
    US: "FAA launch/reentry licensing, FCC spectrum, NOAA remote-sensing, and ITAR/EAR export controls.",
    EU: "National launch/operator authorization coordinated with ESA; export-control regimes.",
    UK: "CAA licensing under the Space Industry Act 2018; spectrum via Ofcom.",
  },
  ai_infra: {
    US: "Sectoral-only today — FTC oversight, export controls on advanced compute; watch state AI laws.",
    EU: "EU AI Act GPAI/high-risk obligations; systemic-model compute-threshold duties.",
    UK: "Principles-based regulator guidance; no bespoke AI licensing yet.",
  },
  ai_app: {
    US: "FTC deception/unfairness exposure for AI claims; sector rules apply by use-case (health, finance, hiring).",
    EU: "EU AI Act risk tier depends on use-case; high-risk uses (hiring, credit, biometrics) carry heavy duties.",
    UK: "Existing-regulator remit by domain; transparency expectations rising.",
  },
};

const GENERAL_LICENSING: Record<JurisdictionId, string> = {
  US: "No sector licence expected — focus on consumer-protection (FTC), IP freedom-to-operate, and CCPA/CPRA data handling.",
  EU: "No sector licence expected — GDPR data handling, consumer-rights directives, and IP freedom-to-operate are the surface.",
  UK: "No sector licence expected — UK GDPR, consumer-protection rules, and IP freedom-to-operate are the surface.",
  OTHER: "No sector licence expected — confirm local consumer-protection, data-privacy and IP posture.",
};

export interface LegalSurface {
  jurisdiction: JurisdictionProfile;
  /** The sector-licensing headline for this (sector × jurisdiction). */
  sectorLicensing: string;
  /** True when the sector carries a named regulatory licence in this jurisdiction. */
  regulated: boolean;
}

/** Resolve the full legal surface for a deal: securities regime + sector licensing. */
export function legalSurface(sector: SectorProfile, geography: string | undefined): LegalSurface {
  const jurisdiction = resolveJurisdiction(geography);
  const overlay = SECTOR_LICENSING[sector.id]?.[jurisdiction.id];
  return {
    jurisdiction,
    sectorLicensing: overlay || GENERAL_LICENSING[jurisdiction.id],
    regulated: Boolean(overlay),
  };
}
