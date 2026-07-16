/**
 * QVenture — Bottom-Up TAM Triangulation (deterministic)
 * ──────────────────────────────────────────────────────
 * A founder's headline TAM is almost always top-down ("1% of a $50B market").
 * A real analyst triangulates it bottom-up: derive ACV from the company's own
 * revenue/customers, then cross-check the claimed TAM against the number of
 * accounts it implies, current penetration, and a defensible SOM.
 *
 * Pure & deterministic (no LLM). Everything is arithmetic on numbers the plan
 * actually disclosed (revenue, customers, claimed TAM) plus the sector TAM from
 * the knowledge base — so it is auditable, not invented.
 *
 *   ACV               = revenue / customers
 *   implied accounts  = claimed TAM / ACV        (how many customers the TAM assumes)
 *   penetration       = revenue / claimed TAM    (share of the claimed TAM captured)
 *   SOM @ 1%          = 1% × (claimed or sector TAM)
 */

import type { PlanSignals } from "./signals";
import type { SectorProfile } from "./sectors";

export type TamMode = "full" | "partial" | "insufficient";

export interface TamAnalysis {
  mode: TamMode;
  acvUsd: number | null;
  claimedTamUsd: number | null;
  sectorTamUsd: number;
  /** claimed TAM as a % of the whole sector TAM. */
  claimedVsSectorPct: number | null;
  impliedAccounts: number | null;
  currentPenetrationPct: number | null;
  somAt1PctUsd: number | null;
  triangulation: string[];
  flags: string[];
}

function fmt(n: number): string {
  if (n >= 1e9) return `$${Math.round((n / 1e9) * 10) / 10}B`;
  if (n >= 1e6) return `$${Math.round((n / 1e6) * 10) / 10}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}k`;
  return `$${Math.round(n)}`;
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function triangulateTam(s: PlanSignals, sector: SectorProfile): TamAnalysis {
  const sectorTamUsd = sector.tamUsdBn * 1e9;
  const claimedTamUsd = s.bottomUpTamUsd;
  const acvUsd =
    s.revenueUsd !== null && s.customers !== null && s.customers > 0
      ? Math.round(s.revenueUsd / s.customers)
      : null;

  const triangulation: string[] = [];
  const flags: string[] = [];

  const claimedVsSectorPct =
    claimedTamUsd !== null ? Math.round((claimedTamUsd / sectorTamUsd) * 1000) / 10 : null;

  const impliedAccounts =
    claimedTamUsd !== null && acvUsd !== null && acvUsd > 0 ? claimedTamUsd / acvUsd : null;

  const currentPenetrationPct =
    s.revenueUsd !== null && claimedTamUsd !== null && claimedTamUsd > 0
      ? Math.round((s.revenueUsd / claimedTamUsd) * 1e6) / 1e4 // % with 4 dp
      : null;

  const somBase = claimedTamUsd ?? sectorTamUsd;
  const somAt1PctUsd = Math.round(somBase * 0.01);

  // ── Build the triangulation narrative ──
  if (acvUsd !== null) triangulation.push(`Derived ACV ≈ ${fmt(acvUsd)} (revenue ÷ ${fmtInt(s.customers as number)} customers).`);
  if (claimedTamUsd !== null) {
    triangulation.push(
      `Plan's TAM ${fmt(claimedTamUsd)} is ${claimedVsSectorPct}% of the ~$${sector.tamUsdBn}B ${sector.label} sector.`
    );
  }
  if (impliedAccounts !== null) {
    triangulation.push(`That TAM ÷ ACV implies ~${fmtInt(impliedAccounts)} target accounts at current pricing.`);
  }
  if (currentPenetrationPct !== null) {
    triangulation.push(`Current penetration ≈ ${currentPenetrationPct}% of the claimed TAM — ${currentPenetrationPct < 1 ? "very early" : "established"}.`);
  }
  triangulation.push(`At 1% penetration, SOM ≈ ${fmt(somAt1PctUsd)} of revenue${claimedTamUsd === null ? " (using sector TAM — no bottom-up TAM disclosed)" : ""}.`);

  // ── Flags ──
  if (claimedTamUsd !== null && claimedTamUsd > sectorTamUsd) {
    flags.push(`Claimed TAM ${fmt(claimedTamUsd)} exceeds the entire ${sector.label} sector (~$${sector.tamUsdBn}B) — top-down inflation.`);
  }
  if (impliedAccounts !== null && acvUsd !== null) {
    if (acvUsd >= 50_000 && impliedAccounts > 5_000_000) {
      flags.push(`Enterprise-level ACV (${fmt(acvUsd)}) with ~${fmtInt(impliedAccounts)} implied accounts is implausible — few markets have that many enterprise buyers.`);
    }
    if (acvUsd < 100 && impliedAccounts < 50_000) {
      flags.push(`Low ACV (${fmt(acvUsd)}) yet only ~${fmtInt(impliedAccounts)} implied accounts — the TAM looks understated for a consumer-priced product.`);
    }
  }

  const has = (x: unknown) => x !== null;
  const mode: TamMode =
    has(claimedTamUsd) && has(acvUsd) ? "full" : has(claimedTamUsd) || has(acvUsd) ? "partial" : "insufficient";

  return {
    mode,
    acvUsd,
    claimedTamUsd,
    sectorTamUsd,
    claimedVsSectorPct,
    impliedAccounts: impliedAccounts !== null ? Math.round(impliedAccounts) : null,
    currentPenetrationPct,
    somAt1PctUsd,
    triangulation,
    flags,
  };
}
