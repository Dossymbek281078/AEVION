// Real-time royalty stream from QRight IP verifications.
//
// Backend status:
//   1. done — POST /api/qright/royalties/verify-webhook credits a real QTrade
//      account (see aevion-globus-backend/src/routes/qrightRoyalties.ts).
//   2. done — GET /api/qright/royalties/summary returns { works, recentEvents,
//      avgPerDay7d/30d, estimated30d, hasRealData }, fetched below.
//   3. still TODO — SSE /api/qright/royalties/stream for a push-based feed;
//      for now the widget polls + locally simulates ticks between fetches.
//
// fetchRoyaltyStream tries the real summary first. It falls back to the
// deterministic per-account demo generator when the caller has no real
// royalty events yet (fresh accounts, or logged-out/dev contexts without a
// token) so the widget still has something worth looking at.

import { apiUrl } from "@/lib/apiBase";
import { QRIGHT_WORKS_BY_KIND } from "./mockCatalog";
import { pick, seeded } from "./random";

const TOKEN_KEY = "aevion_auth_token_v1";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

export type IPKind = "music" | "photo" | "code" | "design" | "writing" | "video";

export type IPWork = {
  id: string;
  title: string;
  kind: IPKind;
  registeredAt: string;
  totalRoyalties: number;
  verifications: number;
};

export type RoyaltyEvent = {
  id: string;
  workId: string;
  workTitle: string;
  workKind: IPKind;
  amount: number;
  verifier: string;
  timestamp: string;
};

export type RoyaltyStreamSummary = {
  works: IPWork[];
  recentEvents: RoyaltyEvent[];
  avgPerDay7d: number;
  avgPerDay30d: number;
  estimated30d: number;
  /** True when this came from real royalty events, not the demo generator. */
  isLive: boolean;
};

const IP_KINDS: IPKind[] = ["music", "photo", "code", "design", "writing", "video"];

export const KIND_ICON: Record<IPKind, string> = {
  music: "♪",
  photo: "◧",
  code: "⟨⟩",
  design: "◆",
  writing: "✎",
  video: "▶",
};

export const KIND_COLOR: Record<IPKind, string> = {
  music: "#7c3aed",
  photo: "#0ea5e9",
  code: "#059669",
  design: "#db2777",
  writing: "#d97706",
  video: "#dc2626",
};

export const KIND_LABEL: Record<IPKind, string> = {
  music: "Music",
  photo: "Photo",
  code: "Code",
  design: "Design",
  writing: "Writing",
  video: "Video",
};

// i18n keys parallel to KIND_LABEL. UI should use these with the global `t()` helper;
// the raw English map above remains for snapshot/export paths that want stable strings.
export const KIND_LABEL_KEY: Record<IPKind, string> = {
  music: "royalty.kind.music.label",
  photo: "royalty.kind.photo.label",
  code: "royalty.kind.code.label",
  design: "royalty.kind.design.label",
  writing: "royalty.kind.writing.label",
  video: "royalty.kind.video.label",
};

const COUNTRIES = ["JP", "DE", "KZ", "US", "FR", "BR", "IN", "GB", "CA", "AU", "SG", "NL"];

function computeEstimated(events: RoyaltyEvent[]): {
  avgPerDay7d: number;
  avgPerDay30d: number;
  estimated30d: number;
} {
  const now = Date.now();
  let sum7 = 0;
  let sum30 = 0;
  for (const e of events) {
    const diff = now - new Date(e.timestamp).getTime();
    if (diff < 7 * 86_400_000) sum7 += e.amount;
    if (diff < 30 * 86_400_000) sum30 += e.amount;
  }
  const avg7 = sum7 / 7;
  const avg30 = sum30 / 30;
  const growth = avg30 > 0 ? Math.max(-0.3, Math.min(0.5, (avg7 - avg30) / avg30)) : 0;
  return {
    avgPerDay7d: avg7,
    avgPerDay30d: avg30,
    estimated30d: Math.max(0, avg7 * 30 * (1 + growth)),
  };
}

function generateStream(accountId: string): RoyaltyStreamSummary {
  const rand = seeded(`${accountId}:royalties`);
  const now = Date.now();

  const workCount = 5 + Math.floor(rand() * 7);
  const workMeta = Array.from({ length: workCount }, (_, i) => {
    const kind = pick(IP_KINDS, rand);
    const title = pick(QRIGHT_WORKS_BY_KIND[kind], rand);
    const daysAgo = Math.floor(30 + rand() * 335);
    const popularity = rand() * rand();
    return {
      id: `work_${accountId.slice(-6)}_${i}`,
      title,
      kind,
      registeredAt: new Date(now - daysAgo * 86_400_000).toISOString(),
      popularity,
    };
  });

  const totalEvents = 150;
  const events: RoyaltyEvent[] = [];
  for (let i = 0; i < totalEvents; i++) {
    const totalPop = workMeta.reduce((s, w) => s + w.popularity, 0) || 1;
    let r = rand() * totalPop;
    let work = workMeta[0];
    for (const w of workMeta) {
      r -= w.popularity;
      if (r <= 0) {
        work = w;
        break;
      }
    }
    const amt = +(0.01 + rand() * 0.14).toFixed(2);
    const agoMs = Math.floor(rand() * 90 * 86_400_000);
    events.push({
      id: `re_${i}_${agoMs}`,
      workId: work.id,
      workTitle: work.title,
      workKind: work.kind,
      amount: amt,
      verifier: pick(COUNTRIES, rand),
      timestamp: new Date(now - agoMs).toISOString(),
    });
  }
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const works: IPWork[] = workMeta.map((m) => {
    let total = 0;
    let count = 0;
    for (const e of events) {
      if (e.workId === m.id) {
        total += e.amount;
        count++;
      }
    }
    return {
      id: m.id,
      title: m.title,
      kind: m.kind,
      registeredAt: m.registeredAt,
      totalRoyalties: +total.toFixed(2),
      verifications: count,
    };
  });

  const est = computeEstimated(events);

  return { works, recentEvents: events, ...est, isLive: false };
}

type SummaryResponse = {
  hasRealData: boolean;
  works: IPWork[];
  recentEvents: RoyaltyEvent[];
  avgPerDay7d: number;
  avgPerDay30d: number;
  estimated30d: number;
};

async function fetchRealSummary(): Promise<SummaryResponse | null> {
  const headers = authHeaders();
  if (!headers.Authorization) return null;
  try {
    const r = await fetch(apiUrl("/api/qright/royalties/summary"), { headers, cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as SummaryResponse;
  } catch {
    return null;
  }
}

export async function fetchRoyaltyStream(accountId: string): Promise<RoyaltyStreamSummary> {
  const real = await fetchRealSummary();
  if (real && real.hasRealData) {
    const { hasRealData: _hasRealData, ...summary } = real;
    return { ...summary, isLive: true };
  }
  return generateStream(accountId);
}

// Used by RoyaltyStream to simulate incoming verification events in demo mode.
export function simulateRoyaltyEvent(works: IPWork[]): RoyaltyEvent {
  if (!works.length) {
    return {
      id: `re_live_${Date.now()}`,
      workId: "work_none",
      workTitle: "Unknown work",
      workKind: "code",
      amount: 0.01,
      verifier: "—",
      timestamp: new Date().toISOString(),
    };
  }
  const totalPop = works.reduce((s, w) => s + Math.max(1, w.verifications), 0);
  let r = Math.random() * totalPop;
  let chosen = works[0];
  for (const w of works) {
    r -= Math.max(1, w.verifications);
    if (r <= 0) {
      chosen = w;
      break;
    }
  }
  return {
    id: `re_live_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    workId: chosen.id,
    workTitle: chosen.title,
    workKind: chosen.kind,
    amount: +(0.01 + Math.random() * 0.14).toFixed(2),
    verifier: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)],
    timestamp: new Date().toISOString(),
  };
}
