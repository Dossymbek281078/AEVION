// Wallet snapshot export — single-file SVG with balance, trust tier,
// peer standings and achievement count. Designed for social share
// (Twitter card size), looks intentional when downloaded or dropped
// into a deck.

import type { AchievementCategory } from "./achievements";
import type { PeerRank } from "./peerRanks";
import type { TrustTier } from "./trust";

export type SnapshotData = {
  accountIdShort: string;
  generatedAt: string;
  balanceLabel: string;
  currencyCode: string;
  trustScore: number;
  trustTier: TrustTier;
  earnings30dLabel: string;
  achievementsEarned: number;
  achievementsTotal: number;
  perCategory: Record<AchievementCategory, { earned: number; total: number }>;
  peerBestLabel: string;
  peerBestValue: string;
  peerRanks: PeerRank[];
};

const TIER_ACCENT: Record<TrustTier, string> = {
  new: "#64748b",
  growing: "#0d9488",
  trusted: "#7c3aed",
  elite: "#d97706",
};

const TIER_LABEL: Record<TrustTier, string> = {
  new: "NEW",
  growing: "GROWING",
  trusted: "TRUSTED",
  elite: "ELITE",
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSnapshotSVG(data: SnapshotData): string {
  const accent = TIER_ACCENT[data.trustTier];
  const tierLabel = TIER_LABEL[data.trustTier];
  const width = 1200;
  const height = 630;

  // Mini peer rows: label + horizontal bar.
  const peerRows = data.peerRanks
    .slice(0, 4)
    .map((r, i) => {
      const y = 420 + i * 40;
      const pct = Math.max(2, Math.min(99, r.percentile * 100));
      return `
  <text x="60" y="${y}" fill="#475569" font-size="15" font-weight="700">${escapeXml(r.label)}</text>
  <text x="520" y="${y}" fill="${r.color}" font-size="15" font-weight="800" text-anchor="end">Top ${Math.round(100 - pct)} %</text>
  <rect x="60" y="${y + 8}" width="460" height="6" rx="3" fill="rgba(15,23,42,0.08)"/>
  <rect x="60" y="${y + 8}" width="${(pct / 100) * 460}" height="6" rx="3" fill="${r.color}"/>`;
    })
    .join("");

  const categoryChips = (Object.keys(data.perCategory) as AchievementCategory[])
    .map((cat, i) => {
      const s = data.perCategory[cat];
      const x = 700 + (i % 2) * 220;
      const y = 470 + Math.floor(i / 2) * 38;
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      return `
  <rect x="${x}" y="${y - 20}" width="200" height="28" rx="14" fill="rgba(15,23,42,0.05)"/>
  <text x="${x + 14}" y="${y - 2}" fill="#0f172a" font-size="13" font-weight="700">${escapeXml(label)}</text>
  <text x="${x + 186}" y="${y - 2}" fill="#0f172a" font-size="13" font-weight="900" text-anchor="end">${s.earned}/${s.total}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="-apple-system, 'Inter', 'Segoe UI', sans-serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8fafc"/>
      <stop offset="1" stop-color="#e2e8f0"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#0d9488"/>
      <stop offset="1" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="40" y="40" width="${width - 80}" height="${height - 80}" rx="24" fill="#ffffff" stroke="rgba(15,23,42,0.08)"/>

  <g>
    <rect x="60" y="64" width="280" height="34" rx="17" fill="url(#accent)"/>
    <text x="200" y="86" fill="#ffffff" font-size="14" font-weight="800" text-anchor="middle" letter-spacing="1">AEVION BANK · SNAPSHOT</text>
  </g>
  <text x="${width - 60}" y="88" fill="#64748b" font-size="14" font-weight="600" text-anchor="end">${escapeXml(data.generatedAt)}</text>

  <text x="60" y="160" fill="#64748b" font-size="14" font-weight="700" letter-spacing="2">WALLET · ${escapeXml(data.accountIdShort)}</text>
  <text x="60" y="230" fill="#0f172a" font-size="78" font-weight="900" letter-spacing="-2">${escapeXml(data.balanceLabel)}</text>
  <text x="60" y="270" fill="#64748b" font-size="18" font-weight="700">Display currency: ${escapeXml(data.currencyCode)} · 30d earnings: ${escapeXml(data.earnings30dLabel)}</text>

  <g transform="translate(720, 150)">
    <circle cx="120" cy="60" r="58" fill="none" stroke="rgba(15,23,42,0.08)" stroke-width="10"/>
    <circle cx="120" cy="60" r="58" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(data.trustScore / 100) * 364} 364" transform="rotate(-90 120 60)"/>
    <text x="120" y="55" fill="#0f172a" font-size="32" font-weight="900" text-anchor="middle">${data.trustScore}</text>
    <text x="120" y="78" fill="#64748b" font-size="12" font-weight="700" text-anchor="middle">/ 100 TRUST</text>
    <rect x="60" y="138" width="120" height="28" rx="14" fill="${accent}"/>
    <text x="120" y="158" fill="#ffffff" font-size="13" font-weight="800" text-anchor="middle" letter-spacing="1">${tierLabel}</text>
  </g>

  <line x1="60" y1="330" x2="${width - 60}" y2="330" stroke="rgba(15,23,42,0.08)"/>
  <text x="60" y="370" fill="#0f172a" font-size="20" font-weight="900">Network standing</text>
  <text x="60" y="395" fill="${accent}" font-size="14" font-weight="700">Best: ${escapeXml(data.peerBestLabel)} · ${escapeXml(data.peerBestValue)}</text>
  ${peerRows}

  <text x="700" y="370" fill="#0f172a" font-size="20" font-weight="900">Achievements</text>
  <text x="700" y="395" fill="#475569" font-size="15" font-weight="700">${data.achievementsEarned} of ${data.achievementsTotal} unlocked</text>
  ${categoryChips}

  <text x="60" y="${height - 50}" fill="#94a3b8" font-size="13" font-weight="600">Unique balance · Trust · Network-rank snapshot across AEVION's creator / banking / chess / planet stack</text>
  <text x="${width - 60}" y="${height - 50}" fill="#94a3b8" font-size="13" font-weight="700" text-anchor="end">aevion.bank</text>
</svg>`;
}

export function downloadSnapshot(svg: string, filename: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildSnapshotText(data: SnapshotData): string {
  return [
    `AEVION Bank snapshot · ${data.generatedAt}`,
    ``,
    `Balance: ${data.balanceLabel} (${data.currencyCode})`,
    `Trust Score: ${data.trustScore}/100 · ${TIER_LABEL[data.trustTier]}`,
    `Earnings 30d: ${data.earnings30dLabel}`,
    `Achievements: ${data.achievementsEarned} / ${data.achievementsTotal}`,
    `Best peer dimension: ${data.peerBestLabel} · ${data.peerBestValue}`,
    ``,
    `aevion.bank`,
  ].join("\n");
}
