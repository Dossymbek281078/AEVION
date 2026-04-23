// Peer ranking — where the user stands in the AEVION network across the
// four core dimensions. Computed client-side from the same stats that
// drive Trust Score / royalties / chess / wallet.
//
// TODO backend: GET /api/ecosystem/leaderboard?accountId=... should
// return real percentiles (plus nearest-peer handles) once the ecosystem
// database has network-wide aggregates. Until then we project from a
// calibrated sigmoid so the numbers are at least plausible, deterministic
// per account, and move in the right direction as the user's stats grow.

import type { ChessSummary } from "./chess";
import type { EcosystemEarningsSummary } from "./ecosystem";
import type { RoyaltyStreamSummary } from "./royalties";
import { seeded } from "./random";
import type { Account, Operation } from "./types";

export type PeerDimension = "trust" | "creator" | "chess" | "wealth";

export type PeerRank = {
  dimension: PeerDimension;
  label: string;
  icon: string;
  color: string;
  // Percentile: 0.95 → top 5 %.
  percentile: number;
  rank: number;
  total: number;
  userValue: number;
  userValueLabel: string;
  peerMedian: number;
  peerMedianLabel: string;
};

// Seeded network size that looks plausible — drifts slowly with accountId
// so different users see marginally different cohorts.
function networkSize(accountId: string): number {
  const rand = seeded(`${accountId}:network`);
  return Math.round(8500 + rand() * 6000);
}

// Sigmoid maps (value − target) into 0..1 percentile. k controls steepness.
function percentileFromValue(value: number, target: number, k: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0.1;
  const x = value / target;
  const p = 1 / (1 + Math.exp(-k * (x - 1)));
  // Clamp into [0.02, 0.995] so we never claim top 0 %.
  return Math.max(0.02, Math.min(0.995, p));
}

function fmtAec(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k AEC`;
  return `${v.toFixed(0)} AEC`;
}

export function computePeerStanding(input: {
  account: Account;
  operations: Operation[];
  trustScore: number;
  royalty?: RoyaltyStreamSummary | null;
  chess?: ChessSummary | null;
  ecosystem?: EcosystemEarningsSummary | null;
}): PeerRank[] {
  const { account, operations, trustScore, royalty, chess, ecosystem } = input;
  const total = networkSize(account.id);

  // Banking volume — cumulative in/out AEC.
  let volume = 0;
  for (const op of operations) {
    if (op.to === account.id || op.from === account.id) volume += op.amount;
  }

  const ipVerifications = royalty?.works.reduce((s, w) => s + w.verifications, 0) ?? 0;
  const chessRating = chess?.currentRating ?? 0;
  const ecosystemTotal = ecosystem
    ? ecosystem.perSource.banking.total +
      ecosystem.perSource.qright.total +
      ecosystem.perSource.chess.total +
      ecosystem.perSource.planet.total
    : volume;

  const dims: Array<{
    dimension: PeerDimension;
    label: string;
    icon: string;
    color: string;
    value: number;
    valueLabel: string;
    target: number;
    k: number;
    median: number;
    medianLabel: string;
  }> = [
    {
      dimension: "trust",
      label: "Ecosystem Trust",
      icon: "★",
      color: "#0d9488",
      value: trustScore,
      valueLabel: `${trustScore} / 100`,
      target: 60,
      k: 3.5,
      median: 42,
      medianLabel: "42 / 100",
    },
    {
      dimension: "creator",
      label: "Creator Reach",
      icon: "✎",
      color: "#7c3aed",
      value: ipVerifications,
      valueLabel: `${ipVerifications} verifications`,
      target: 80,
      k: 2.4,
      median: 34,
      medianLabel: "34 verifications",
    },
    {
      dimension: "chess",
      label: "CyberChess Rating",
      icon: "♞",
      color: "#d97706",
      value: chessRating,
      valueLabel: chessRating ? String(chessRating) : "no games",
      target: 1450,
      k: 3.0,
      median: 1280,
      medianLabel: "1 280",
    },
    {
      dimension: "wealth",
      label: "Network Net Worth",
      icon: "₳",
      color: "#0369a1",
      value: account.balance + ecosystemTotal * 0.25,
      valueLabel: fmtAec(account.balance + ecosystemTotal * 0.25),
      target: 1200,
      k: 2.2,
      median: 520,
      medianLabel: fmtAec(520),
    },
  ];

  return dims.map((d) => {
    const percentile = percentileFromValue(d.value, d.target, d.k);
    const rank = Math.max(1, Math.round((1 - percentile) * total));
    return {
      dimension: d.dimension,
      label: d.label,
      icon: d.icon,
      color: d.color,
      percentile,
      rank,
      total,
      userValue: d.value,
      userValueLabel: d.valueLabel,
      peerMedian: d.median,
      peerMedianLabel: d.medianLabel,
    };
  });
}

export function topPercentLabel(percentile: number): string {
  const top = Math.round((1 - percentile) * 100);
  if (top <= 1) return "Top 1 %";
  if (top <= 5) return `Top ${top} %`;
  if (top <= 25) return `Top ${top} %`;
  if (top <= 50) return `Top ${top} %`;
  return `${top} % away from top`;
}
