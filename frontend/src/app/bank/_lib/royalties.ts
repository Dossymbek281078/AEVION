// Real-time royalty stream from QRight IP verifications.
// TODO backend (aevion-backend-modules / QRight module):
//   1. Emit webhook on /api/qright/objects/:id verification → qtrade transfer (0.01 AEC) to owner.
//   2. Expose GET /api/qright/royalties?accountId=... with { works, recentEvents, averages }.
//   3. Optional: Server-Sent Events /api/qright/royalties/stream for live feed.

import { QRIGHT_WORKS_BY_KIND } from "./mockCatalog";
import { pick, seeded } from "./random";

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

  return { works, recentEvents: events, ...est };
}

export async function fetchRoyaltyStream(accountId: string): Promise<RoyaltyStreamSummary> {
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
