"use client";

// AEVION CyberChess — Chessy Economy Hub (F7)
// Auction + Coach Rental + Streamer Subscriptions
// Зона: aevion-core/main owns frontend/src/app/cyberchess/**

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const C = {
  bg: "#0f172a",
  panel: "#1e293b",
  border: "#334155",
  text: "#f1f5f9",
  dim: "#94a3b8",
  faint: "#64748b",
  purple: "#a78bfa",
  green: "#34d399",
  red: "#ef4444",
  yellow: "#fbbf24",
  cyan: "#22d3ee",
  gold: "#facc15",
};

// localStorage keys
const LS_BALANCE = "aevion_cyberchess_chessy_v1";
const LS_BIDS = "aevion_cyberchess_auction_bids_v1";
const LS_COACH = "aevion_cyberchess_rented_coach_v1";
const LS_STREAMS = "aevion_cyberchess_streamer_subs_v1";

type Auction = {
  id: string;
  player: string;
  elo: number;
  title: string;
  desc: string;
  startPrice: number;
  bids: number;
  featured?: boolean;
};

const MOCK_AUCTIONS: Auction[] = [
  {
    id: "a-001",
    player: "ShadowKnight_2400",
    elo: 2410,
    title: "Сицилианская защита, Найдорф — победа над IM",
    desc: "Annotated PGN 47 ходов + Stockfish 18 анализ + 3 brilliancies",
    startPrice: 350,
    bids: 12,
    featured: true,
  },
  {
    id: "a-002",
    player: "EndgameKnight",
    elo: 2180,
    title: "Эндшпиль ладья+пешка против ладьи — позиция Лусены",
    desc: "Mini-разбор 18 ходов с альтернативами и теорией Лусены/Филидора",
    startPrice: 120,
    bids: 7,
  },
  {
    id: "a-003",
    player: "TacticalRose",
    elo: 1980,
    title: "Жертва качества в Каро-Канне — атака на короля",
    desc: "Полная партия с комментарием выбора пожертвования (32 хода)",
    startPrice: 200,
    bids: 5,
  },
  {
    id: "a-004",
    player: "PositionalGuru",
    elo: 2250,
    title: "Староиндийская защита — позиционный план чёрных",
    desc: "Длинная партия 64 хода + видео-разбор плана через минор-обмен",
    startPrice: 280,
    bids: 9,
  },
  {
    id: "a-005",
    player: "BulletDemon",
    elo: 2310,
    title: "1+0 буллет — 12 ходов до мата против 2400+",
    desc: "Молниеносная партия с разбором подготовки в дебюте",
    startPrice: 90,
    bids: 18,
  },
];

type Coach = {
  id: string;
  name: string;
  emoji: string;
  style: string;
  bio: string;
  elo: number;
};

const COACHES: Coach[] = [
  { id: "c-karpov",  name: "GM Karpov-bot",   emoji: "🧊", style: "Позиционный",   bio: "Долгие планы, минимальные риски, эндшпильная техника",   elo: 2780 },
  { id: "c-anand",   name: "IM Anand-bot",    emoji: "⚡", style: "Универсальный", bio: "Дебютная теория + тактика + классическое чувство",       elo: 2740 },
  { id: "c-tal",     name: "GM Tal-bot",      emoji: "🔥", style: "Агрессивный",   bio: "Жертвы, атаки на короля, тактические взрывы",            elo: 2700 },
  { id: "c-capa",    name: "GM Capa-bot",     emoji: "♟", style: "Эндшпильный",   bio: "Простота, чёткая техника, упрощение в выигранный эндшпиль", elo: 2720 },
  { id: "c-petros",  name: "GM Petros-bot",   emoji: "🛡", style: "Контр-атак.",   bio: "Профилактика, ловушки, ответный удар",                    elo: 2690 },
  { id: "c-mvl",     name: "IM MVL-bot",      emoji: "🏛", style: "Классический",  bio: "Открытая игра, развитие, центр, лёгкие фигуры",          elo: 2660 },
];

const COACH_RATES = [
  { code: "hour",  label: "1 час",    cost: 100,  ms: 60 * 60 * 1000 },
  { code: "week",  label: "1 неделя", cost: 500,  ms: 7 * 24 * 60 * 60 * 1000 },
  { code: "month", label: "1 месяц",  cost: 2000, ms: 30 * 24 * 60 * 60 * 1000 },
];

type Streamer = {
  id: string;
  emoji: string;
  nick: string;
  desc: string;
  viewers: number;
};

const STREAMERS: Streamer[] = [
  { id: "s-hikaru",   emoji: "🎩", nick: "HikaruSensei",  desc: "Speedrun blitz + reactions",       viewers: 12_840 },
  { id: "s-botez",    emoji: "👑", nick: "QueenBotez",    desc: "Pogchamps + community matches",    viewers: 8_210 },
  { id: "s-eric",     emoji: "🎬", nick: "RosenStream",   desc: "Educational + speedruns",          viewers: 6_420 },
  { id: "s-anna",     emoji: "🌹", nick: "AnnaCramling",  desc: "IRL + chess + chess.com tourneys", viewers: 4_900 },
  { id: "s-gotham",   emoji: "🎙", nick: "GothamChess",   desc: "Recap + theory + meme reviews",    viewers: 18_300 },
];

const STREAMER_COST = 200; // AEV / month
const STREAMER_MS = 30 * 24 * 60 * 60 * 1000;

type Bids = Record<string, number>; // auctionId -> latest bid amount
type CoachRented = { coachId: string; expiresAt: number } | null;
type StreamerSubs = Record<string, number>; // streamerId -> expiresAt

function readBalance(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LS_BALANCE);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function writeBalance(v: number) {
  window.localStorage.setItem(LS_BALANCE, String(v));
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, val: unknown) {
  window.localStorage.setItem(key, JSON.stringify(val));
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "истекло";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (d > 0) return `${d}д ${h}ч`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

export default function EconomyHubPage() {
  const [mounted, setMounted] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [bids, setBids] = useState<Bids>({});
  const [coachRented, setCoachRented] = useState<CoachRented>(null);
  const [streamSubs, setStreamSubs] = useState<StreamerSubs>({});
  const [now, setNow] = useState<number>(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);

  // hydrate from localStorage
  useEffect(() => {
    setMounted(true);
    setBalance(readBalance());
    setBids(readJson<Bids>(LS_BIDS, {}));
    setCoachRented(readJson<CoachRented>(LS_COACH, null));
    setStreamSubs(readJson<StreamerSubs>(LS_STREAMS, {}));
  }, []);

  // tick for timers
  useEffect(() => {
    if (!mounted) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [mounted]);

  // toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const effectiveBalance = balance ?? 0;

  function spend(cost: number, label: string): boolean {
    if (balance == null) {
      setToast("Сначала заработай Chessy в CyberChess");
      return false;
    }
    if (balance < cost) {
      setToast("Не хватает Chessy");
      return false;
    }
    const next = balance - cost;
    setBalance(next);
    writeBalance(next);
    setToast(`${label} · −${cost} AEV`);
    return true;
  }

  function placeBid(a: Auction) {
    const current = bids[a.id] ?? a.startPrice;
    const next = current + 50;
    if (!spend(50, "Ставка")) return;
    const updated = { ...bids, [a.id]: next };
    setBids(updated);
    writeJson(LS_BIDS, updated);
  }

  function rentCoach(coach: Coach, rate: typeof COACH_RATES[number]) {
    if (!spend(rate.cost, `Аренда ${coach.name}`)) return;
    const base = coachRented && coachRented.coachId === coach.id && coachRented.expiresAt > now ? coachRented.expiresAt : now;
    const next: CoachRented = { coachId: coach.id, expiresAt: base + rate.ms };
    setCoachRented(next);
    writeJson(LS_COACH, next);
  }

  function subscribeStreamer(s: Streamer) {
    if (!spend(STREAMER_COST, `Подписка ${s.nick}`)) return;
    const baseExp = streamSubs[s.id] && streamSubs[s.id] > now ? streamSubs[s.id] : now;
    const next = { ...streamSubs, [s.id]: baseExp + STREAMER_MS };
    setStreamSubs(next);
    writeJson(LS_STREAMS, next);
  }

  const activeCoach = useMemo(() => {
    if (!coachRented) return null;
    if (coachRented.expiresAt <= now) return null;
    return COACHES.find((c) => c.id === coachRented.coachId) ?? null;
  }, [coachRented, now]);

  return (
    <main style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui, sans-serif", padding: "32px 16px" }}>
      <article style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>
          <Link href="/cyberchess" style={{ color: C.dim, textDecoration: "none" }}>← CyberChess</Link>
          {" / "}<span style={{ color: C.text }}>Economy</span>
        </div>

        {/* Hero */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
          <div style={{ flex: "1 1 460px", minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.gold, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
              F7 · CHESSY ECONOMY HUB
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 12px", lineHeight: 1.15 }}>
              Chessy <span style={{ color: C.gold }}>Economy</span>
            </h1>
            <p style={{ fontSize: 15, color: C.dim, lineHeight: 1.65, margin: 0, maxWidth: 620 }}>
              Аукцион уроков, аренда виртуальных тренеров и подписка на стримеров. Платформа активных взаимодействий за Chessy (AEV).
            </p>
          </div>

          {/* Balance card */}
          <div style={{
            background: "linear-gradient(135deg, rgba(250,204,21,0.10), rgba(167,139,250,0.06))",
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: "14px 18px",
            minWidth: 180,
          }}>
            <div style={{ fontSize: 10, color: C.faint, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>Баланс</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.gold, fontFamily: "ui-monospace, monospace", lineHeight: 1.1 }}>
              {mounted ? (balance == null ? "—" : balance.toLocaleString("ru-RU")) : "…"}
            </div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>🪙 AEV (Chessy)</div>
          </div>
        </div>

        {/* Active rental banner */}
        {mounted && activeCoach && coachRented && (
          <div style={{
            background: "rgba(52,211,153,0.08)",
            border: `1px solid ${C.green}`,
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}>
            <div style={{ fontSize: 13, color: C.text }}>
              <span style={{ fontSize: 18, marginRight: 8 }}>{activeCoach.emoji}</span>
              Активная аренда: <strong>{activeCoach.name}</strong>
              <span style={{ color: C.dim, marginLeft: 8 }}>· Coach Chat без ограничений</span>
            </div>
            <code style={{ fontSize: 12, color: C.green, fontFamily: "ui-monospace, monospace" }}>
              осталось {formatRemaining(coachRented.expiresAt - now)}
            </code>
          </div>
        )}

        {/* SECTION 1: Auction */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span>🪙</span> Аукцион уроков
            <span style={{ fontSize: 11, fontWeight: 600, color: C.faint, marginLeft: 6 }}>
              · annotated PGN + анализ за Chessy
            </span>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {MOCK_AUCTIONS.map((a) => {
              const currentPrice = bids[a.id] ?? a.startPrice;
              const totalBids = a.bids + (bids[a.id] != null ? 1 : 0);
              const canBid = (balance ?? 0) >= 50;
              return (
                <div key={a.id} style={{
                  background: a.featured ? "linear-gradient(135deg, rgba(250,204,21,0.06), rgba(30,41,59,1))" : C.panel,
                  border: `1px solid ${a.featured ? C.gold : C.border}`,
                  borderLeft: `3px solid ${a.featured ? C.gold : C.purple}`,
                  borderRadius: 10,
                  padding: "14px 18px",
                  position: "relative",
                }}>
                  {a.featured && (
                    <div style={{
                      position: "absolute", top: -10, right: 14,
                      background: C.gold, color: "#000",
                      fontSize: 10, fontWeight: 900, letterSpacing: 0.5,
                      padding: "2px 8px", borderRadius: 4, textTransform: "uppercase",
                    }}>★ Featured</div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{a.player}</span>
                        <code style={{ fontSize: 11, color: C.cyan, fontFamily: "ui-monospace, monospace" }}>ELO {a.elo}</code>
                      </div>
                      <div style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 4 }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5 }}>{a.desc}</div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 160 }}>
                      <div style={{ fontSize: 10, color: C.faint, textTransform: "uppercase", letterSpacing: 0.6 }}>Текущая цена</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: C.gold, fontFamily: "ui-monospace, monospace", lineHeight: 1.1 }}>
                        {currentPrice} AEV
                      </div>
                      <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>🔥 {totalBids} {totalBids === 1 ? "бид" : "бидов"}</div>
                      <button
                        onClick={() => placeBid(a)}
                        disabled={!mounted || !canBid}
                        title={!canBid ? "Не хватает Chessy" : ""}
                        style={{
                          marginTop: 8,
                          background: canBid ? C.purple : "#475569",
                          color: canBid ? "#0f172a" : C.faint,
                          border: "none",
                          borderRadius: 8,
                          padding: "8px 14px",
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: canBid ? "pointer" : "not-allowed",
                          width: "100%",
                        }}
                      >
                        Сделать ставку (+50 AEV)
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: Coach rental */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span>🎓</span> Аренда тренера
            <span style={{ fontSize: 11, fontWeight: 600, color: C.faint, marginLeft: 6 }}>
              · виртуальные GM/IM-боты в Coach Chat
            </span>
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {COACHES.map((coach) => {
              const isActive = activeCoach?.id === coach.id;
              return (
                <div key={coach.id} style={{
                  background: C.panel,
                  border: `1px solid ${isActive ? C.green : C.border}`,
                  borderLeft: `3px solid ${isActive ? C.green : C.cyan}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 26 }}>{coach.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{coach.name}</div>
                      <div style={{ fontSize: 11, color: C.cyan, fontFamily: "ui-monospace, monospace" }}>{coach.style} · ELO {coach.elo}</div>
                    </div>
                    {isActive && (
                      <span style={{ fontSize: 9, fontWeight: 900, color: "#0f172a", background: C.green, padding: "2px 6px", borderRadius: 4 }}>АКТИВЕН</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5, marginBottom: 10, minHeight: 36 }}>{coach.bio}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {COACH_RATES.map((rate) => {
                      const enough = (balance ?? 0) >= rate.cost;
                      return (
                        <button
                          key={rate.code}
                          onClick={() => rentCoach(coach, rate)}
                          disabled={!mounted || !enough}
                          title={!enough ? "Не хватает Chessy" : ""}
                          style={{
                            background: enough ? "rgba(34,211,238,0.10)" : "#1e293b",
                            border: `1px solid ${enough ? C.cyan : C.border}`,
                            color: enough ? C.text : C.faint,
                            borderRadius: 6,
                            padding: "6px 10px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: enough ? "pointer" : "not-allowed",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span>Арендовать ({rate.label})</span>
                          <code style={{ fontFamily: "ui-monospace, monospace", color: C.gold }}>{rate.cost} AEV</code>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 3: Streamers */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span>📺</span> Подписка на стримеров
            <span style={{ fontSize: 11, fontWeight: 600, color: C.faint, marginLeft: 6 }}>
              · 200 AEV / месяц · уведомления + private chat
            </span>
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {STREAMERS.map((s) => {
              const expiresAt = streamSubs[s.id];
              const subscribed = mounted && expiresAt && expiresAt > now;
              const enough = (balance ?? 0) >= STREAMER_COST;
              return (
                <div key={s.id} style={{
                  background: C.panel,
                  border: `1px solid ${subscribed ? C.purple : C.border}`,
                  borderLeft: `3px solid ${subscribed ? C.purple : C.red}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 30 }}>{s.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{s.nick}</div>
                      <div style={{ fontSize: 11, color: C.dim }}>{s.desc}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: C.faint, marginBottom: 10 }}>
                    <span><span style={{ color: C.red }}>●</span> LIVE · {s.viewers.toLocaleString("ru-RU")} зрителей</span>
                    {subscribed && (
                      <code style={{ color: C.purple, fontFamily: "ui-monospace, monospace" }}>
                        {formatRemaining(expiresAt - now)}
                      </code>
                    )}
                  </div>
                  <button
                    onClick={() => subscribeStreamer(s)}
                    disabled={!mounted || !enough}
                    title={!enough ? "Не хватает Chessy" : ""}
                    style={{
                      width: "100%",
                      background: subscribed ? "rgba(167,139,250,0.15)" : (enough ? C.purple : "#475569"),
                      color: subscribed ? C.purple : (enough ? "#0f172a" : C.faint),
                      border: subscribed ? `1px solid ${C.purple}` : "none",
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: enough ? "pointer" : "not-allowed",
                    }}
                  >
                    {subscribed ? "Продлить +1 мес" : "Подписаться 200 AEV/мес"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer note */}
        <div style={{ marginTop: 32, padding: "12px 16px", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.faint, lineHeight: 1.6 }}>
          F7 · Mock-режим: все операции сохраняются в localStorage браузера. Backend-интеграция (реальные аукционы, верификация PGN, push-уведомления стримов) — следующая фаза.
        </div>

        <div style={{ marginTop: 24, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
          <Link href="/cyberchess" style={{ color: C.purple, textDecoration: "none" }}>← CyberChess</Link>
          <span style={{ color: C.faint }}>·</span>
          <Link href="/cyberchess/cpi" style={{ color: C.purple, textDecoration: "none" }}>📊 CPI rating</Link>
          <span style={{ color: C.faint }}>·</span>
          <Link href="/bank" style={{ color: C.purple, textDecoration: "none" }}>🏦 AEVION Bank — тиры Pro/Ultimate</Link>
        </div>

        <div style={{ marginTop: 32, fontSize: 11, color: C.faint, textAlign: "center" }}>
          F7 · 2026-05-12 · Chessy Economy v0.1
        </div>
      </article>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: C.panel,
          border: `1px solid ${C.gold}`,
          color: C.text,
          padding: "10px 18px",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          zIndex: 100,
        }}>
          {toast}
        </div>
      )}
    </main>
  );
}
