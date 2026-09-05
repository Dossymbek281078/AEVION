"use client";

// AEVION CPI Leaderboard — ranking by Chess Performance Index (composite),
// with per-factor filters (top tactician / best time-mgmt / cleanest play).
// Zone: aevion-core/main owns frontend/src/app/cyberchess/**

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";

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
  silver: "#cbd5e1",
  bronze: "#f59e0b",
};

type FactorKey = "overall" | "E" | "T" | "O" | "B1" | "M1" | "M2" | "M3" | "H" | "Br";

const FACTOR_META: Record<FactorKey, { label: string; emoji: string; desc: string }> = {
  overall: { label: "Общий CPI",        emoji: "🏆", desc: "Составной рейтинг — сводит все факторы ниже" },
  E:       { label: "Точность",         emoji: "🎯", desc: "Насколько ходы близки к лучшим" },
  T:       { label: "Время",             emoji: "⏱",  desc: "Равномерное распределение времени" },
  O:       { label: "Дебюты",            emoji: "📖", desc: "Доля ходов из первой десятки книги" },
  B1:      { label: "Лучший ход",       emoji: "①",   desc: "Доля ходов, совпавших с выбором движка" },
  M1:      { label: "Мат-1 зрение",      emoji: "💀", desc: "% найденных матов в 1 ход" },
  M2:      { label: "Мат-2 зрение",      emoji: "💀💀", desc: "% найденных матов в 2 хода" },
  M3:      { label: "Мат-3 зрение",      emoji: "💀💀💀", desc: "% найденных матов в 3 хода" },
  H:       { label: "Чистая игра",       emoji: "🛡",  desc: "Меньше всего зевков" },
  Br:      { label: "Бриллианты",        emoji: "💎", desc: "Самые яркие ходы" },
};

/**
 * Сколько факторов ЭТА страница даёт сортировать. Число считается, а не
 * набирается руками: 27.08.2026 на одной странице стояли два разных — текст
 * обещал «9 факторов», а описание сводного рейтинга говорило «все 11». Одиннадцать
 * — это набор СЕРВЕРА (`CPI_FACTORS` в бэкенде), и он другой: там accuracy,
 * tactics, endgame, timing и так далее, а здесь E/T/O/B1/M1/M2/M3/H/Br. Страница
 * занимала чужое число, и из-за этого её собственные цифры перестали сходиться.
 *
 * `overall` из счёта исключён намеренно: это сводка по остальным, а не фактор
 * наравне с ними.
 */
// НЕ экспортируется: Next разрешает странице экспортировать только свой набор
// имён (default, metadata, viewport, generateStaticParams…), а лишний экспорт
// роняет проверку типов маршрутов. Поймано настоящей сборкой 28.08.2026 —
// `tsc --noEmit` на этом ЗЕЛЁНЫЙ, потому что правило принадлежит Next, а не
// системе типов. Сторожу экспорт и не нужен: он читает исходник текстом.
const SORTABLE_FACTOR_COUNT = (Object.keys(FACTOR_META) as FactorKey[]).filter((k) => k !== "overall").length;

// Mock leaderboard data. In production, this would be /api/cyberchess/cpi/leaderboard.
type Entry = {
  rank: number;
  username: string;
  emoji: string;
  cpi: number;
  // per-factor avg scores 0-1 (or 0-100 for hangs/brilliancies)
  factors: { E: number; T: number; O: number; B1: number; M1: number; M2: number; M3: number; H: number; Br: number };
  games: number;
  trend: "up" | "down" | "flat";
};

const MOCK_ENTRIES: Entry[] = [
  { rank: 1, username: "ShadowKnight_2400",  emoji: "♞", cpi: 2987, factors: { E: 0.92, T: 0.78, O: 0.85, B1: 0.71, M1: 0.95, M2: 0.88, M3: 0.81, H: 0.93, Br: 0.42 }, games: 287, trend: "up" },
  { rank: 2, username: "EndgameKnight",      emoji: "🏰", cpi: 2843, factors: { E: 0.89, T: 0.82, O: 0.79, B1: 0.68, M1: 0.91, M2: 0.85, M3: 0.74, H: 0.90, Br: 0.38 }, games: 412, trend: "up" },
  { rank: 3, username: "TacticalRose",       emoji: "🌹", cpi: 2756, factors: { E: 0.85, T: 0.71, O: 0.70, B1: 0.65, M1: 0.93, M2: 0.91, M3: 0.78, H: 0.84, Br: 0.55 }, games: 198, trend: "flat" },
  { rank: 4, username: "PositionalGuru",     emoji: "🧙", cpi: 2698, factors: { E: 0.91, T: 0.88, O: 0.94, B1: 0.74, M1: 0.78, M2: 0.65, M3: 0.52, H: 0.95, Br: 0.28 }, games: 523, trend: "up" },
  { rank: 5, username: "BulletDemon",        emoji: "⚡", cpi: 2645, factors: { E: 0.74, T: 0.51, O: 0.62, B1: 0.58, M1: 0.94, M2: 0.86, M3: 0.69, H: 0.71, Br: 0.65 }, games: 1247, trend: "down" },
  { rank: 6, username: "Capablanca-bot",     emoji: "🤖", cpi: 2589, factors: { E: 0.94, T: 0.89, O: 0.81, B1: 0.78, M1: 0.81, M2: 0.74, M3: 0.61, H: 0.97, Br: 0.21 }, games: 891, trend: "flat" },
  { rank: 7, username: "KarpovStudent",      emoji: "👨‍🎓", cpi: 2512, factors: { E: 0.87, T: 0.84, O: 0.88, B1: 0.71, M1: 0.76, M2: 0.62, M3: 0.48, H: 0.89, Br: 0.31 }, games: 156, trend: "up" },
  { rank: 8, username: "AnandFan",           emoji: "🐅", cpi: 2487, factors: { E: 0.82, T: 0.79, O: 0.72, B1: 0.69, M1: 0.85, M2: 0.78, M3: 0.65, H: 0.82, Br: 0.48 }, games: 234, trend: "up" },
  { rank: 9, username: "TalLegacy",          emoji: "🔥", cpi: 2421, factors: { E: 0.71, T: 0.62, O: 0.65, B1: 0.58, M1: 0.92, M2: 0.89, M3: 0.84, H: 0.65, Br: 0.78 }, games: 312, trend: "up" },
  { rank: 10, username: "QuietQueen",        emoji: "👑", cpi: 2389, factors: { E: 0.86, T: 0.81, O: 0.74, B1: 0.67, M1: 0.79, M2: 0.71, M3: 0.55, H: 0.91, Br: 0.34 }, games: 178, trend: "flat" },
  { rank: 11, username: "PawnStorm99",       emoji: "♟", cpi: 2298, factors: { E: 0.79, T: 0.74, O: 0.68, B1: 0.61, M1: 0.74, M2: 0.65, M3: 0.51, H: 0.83, Br: 0.41 }, games: 445, trend: "up" },
  { rank: 12, username: "NimzoIndian",       emoji: "🇮🇳", cpi: 2245, factors: { E: 0.84, T: 0.69, O: 0.91, B1: 0.65, M1: 0.71, M2: 0.58, M3: 0.42, H: 0.86, Br: 0.29 }, games: 267, trend: "flat" },
  { rank: 13, username: "BlitzMaster",       emoji: "💨", cpi: 2198, factors: { E: 0.69, T: 0.48, O: 0.58, B1: 0.54, M1: 0.88, M2: 0.79, M3: 0.62, H: 0.68, Br: 0.51 }, games: 1893, trend: "down" },
  { rank: 14, username: "EndgameExpert",     emoji: "♔", cpi: 2167, factors: { E: 0.93, T: 0.91, O: 0.55, B1: 0.78, M1: 0.65, M2: 0.52, M3: 0.38, H: 0.94, Br: 0.22 }, games: 567, trend: "up" },
  { rank: 15, username: "ChessRookie",       emoji: "🌱", cpi: 1456, factors: { E: 0.62, T: 0.55, O: 0.45, B1: 0.41, M1: 0.61, M2: 0.42, M3: 0.28, H: 0.59, Br: 0.18 }, games: 87, trend: "up" },
];

function tierFor(cpi: number): { tier: string; color: string } {
  if (cpi >= 2700) return { tier: "Гроссмейстер", color: C.gold };
  if (cpi >= 2400) return { tier: "Мастер", color: C.purple };
  if (cpi >= 2000) return { tier: "Эксперт", color: C.cyan };
  if (cpi >= 1600) return { tier: "Клубный игрок", color: C.green };
  if (cpi >= 1200) return { tier: "Растущий", color: C.yellow };
  return { tier: "Начинающий", color: C.silver };
}

function rankBadge(rank: number): { bg: string; fg: string } {
  if (rank === 1) return { bg: "rgba(250,204,21,0.18)", fg: C.gold };
  if (rank === 2) return { bg: "rgba(203,213,225,0.18)", fg: C.silver };
  if (rank === 3) return { bg: "rgba(245,158,11,0.18)", fg: C.bronze };
  return { bg: "rgba(148,163,184,0.08)", fg: C.dim };
}

export default function CPILeaderboardPage() {
  const [filter, setFilter] = useState<FactorKey>("overall");
  const [myCpi, setMyCpi] = useState<number | null>(null);
  const [myGames, setMyGames] = useState(0);
  const [myFactors, setMyFactors] = useState<Entry["factors"] | null>(null);
  const [myAvatar, setMyAvatar] = useState("👤");

  // Читаем реальный CPI игрока + вычисляем средние per-factor из истории партий
  useEffect(() => {
    try {
      const raw = localStorage.getItem("aevion_cyberchess_cpi_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.v === 1 && typeof parsed.cpi === "number") {
          setMyCpi(parsed.cpi);
          const hist = Array.isArray(parsed.history) ? parsed.history : [];
          setMyGames(hist.length);
          if (hist.length > 0) {
            const avg = (key: keyof Entry["factors"]) => {
              const vals = hist.map((h: any) => h.breakdown?.[key] ?? 0);
              const s = vals.reduce((a: number, b: number) => a + b, 0);
              return s / vals.length;
            };
            setMyFactors({ E: avg("E"), T: avg("T"), O: avg("O"), B1: avg("B1"), M1: avg("M1"), M2: avg("M2"), M3: avg("M3"), H: avg("H"), Br: avg("Br") });
          }
        }
      }
      const av = localStorage.getItem("cc_avatar_emoji_v1");
      if (av) setMyAvatar(av);
    } catch {}
  }, []);

  // Вставляем локального игрока в таблицу чтобы он видел себя в контексте
  const allEntries = useMemo<Entry[]>(() => {
    if (myCpi === null) return MOCK_ENTRIES;
    const me: Entry = {
      rank: 0,
      username: "Ты",
      emoji: myAvatar,
      cpi: myCpi,
      factors: myFactors ?? { E: 0, T: 0, O: 0, B1: 0, M1: 0, M2: 0, M3: 0, H: 0, Br: 0 },
      games: myGames,
      trend: "flat",
    };
    return [...MOCK_ENTRIES, me];
  }, [myCpi, myGames, myFactors, myAvatar]);

  const sortedEntries = useMemo(() => {
    if (filter === "overall") return allEntries.slice().sort((a, b) => b.cpi - a.cpi).map((e, i) => ({ ...e, rank: i + 1 }));
    const f = filter as keyof Entry["factors"];
    return allEntries.slice().sort((a, b) => b.factors[f] - a.factors[f]).map((e, i) => ({ ...e, rank: i + 1 }));
  }, [filter, allEntries]);

  const myProjectedRank = useMemo(() => {
    if (myCpi === null) return null;
    return sortedEntries.find(e => e.username === "Ты")?.rank ?? null;
  }, [myCpi, sortedEntries]);

  return (
    <main style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui, sans-serif", padding: "32px 16px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": "https://aevion.app/cyberchess/cpi/leaderboard",
        name: "AEVION CyberChess CPI Leaderboard",
        description: "Public ranking by Chess Performance Index. Sort by any of 9 quality factors — precision, time, openings, mate-vision, brilliancies.",
        isPartOf: { "@type": "WebSite", url: "https://aevion.app", name: "AEVION" },
        about: { "@type": "Thing", name: "Chess leaderboard ranked by composite quality metrics" },
      }) }} />
      <style>{`
        @media (max-width: 640px) {
          h1 { font-size: 22px !important; }
          h2 { font-size: 16px !important; }
          button, a[role="button"] { min-height: 44px; }
          table { font-size: 11px; }
          pre { font-size: 11px !important; }
        }
      `}</style>
      <article style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>
          <Link href="/cyberchess" style={{ color: C.dim, textDecoration: "none" }}>CyberChess</Link>
          {" / "}
          <Link href="/cyberchess/cpi" style={{ color: C.dim, textDecoration: "none" }}>CPI</Link>
          {" / "}<span style={{ color: C.text }}>Таблица лидеров</span>
        </div>

        {/* Hero */}
        {/* Страница показывает ОБРАЗЕЦ, а не игроков. Ниже пятнадцать выдуманных
            имён с выдуманными рейтингами и числом партий — так задумывалось как
            макет, но выглядит как настоящий лидерборд, лежит по публичному
            адресу и размечено для поисковиков как список. Пока сюда не подключён
            настоящий источник, страница обязана говорить это сама. */}
        <div
          data-testid="cpi-demo-notice"
          style={{
            marginBottom: 20, padding: "10px 14px", borderRadius: 8,
            border: `1px solid ${C.faint}`, background: "rgba(234,179,8,0.10)",
            fontSize: 13, lineHeight: 1.5,
          }}
        >
          <b>Это образец оформления, а не рейтинг игроков.</b> Имена, значения CPI
          и число партий ниже — выдуманные. Настоящий лидерборд появится, когда
          страницу подключат к серверным данным: сейчас сервер считает другие
          факторы, чем показывает эта страница, поэтому подключение — отдельная
          продуктовая задача, а не правка вёрстки.
        </div>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 8px", lineHeight: 1.15 }}>
            Таблица лидеров <span style={{ color: C.purple }}>CPI</span>
          </h1>
          <p style={{ fontSize: 14, color: C.dim, lineHeight: 1.65, margin: 0, maxWidth: 640 }}>
            Топ игроков по AEVION Chess Performance Index — составному рейтингу качества игры.
            Можешь сортировать по любому из {SORTABLE_FACTOR_COUNT} факторов, чтобы найти лидера в нужной области.
          </p>
        </div>

        {/* My rank callout */}
        {myCpi !== null && (
          <div style={{
            background: `linear-gradient(135deg, rgba(167,139,250,0.12), rgba(52,211,153,0.05))`,
            border: `1px solid ${C.purple}40`,
            borderLeft: `4px solid ${C.purple}`,
            borderRadius: 10,
            padding: "12px 18px",
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.purple, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Твой результат</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 26, fontWeight: 900, color: C.text, fontFamily: "ui-monospace, monospace" }}>{myCpi}</span>
                <span style={{ fontSize: 13, color: tierFor(myCpi).color, fontWeight: 700 }}>{tierFor(myCpi).tier}</span>
                {myProjectedRank && (
                  <span style={{ fontSize: 13, color: C.dim }}>· #{myProjectedRank} в таблице · {myGames} {myGames === 1 ? "партия" : myGames < 5 ? "партии" : "партий"}</span>
                )}
              </div>
            </div>
            <Link href="/cyberchess/cpi/dashboard" style={{
              background: C.purple, color: "#fff", padding: "8px 14px", borderRadius: 8,
              fontSize: 12, fontWeight: 800, textDecoration: "none",
            }}>
              📊 Открыть мой дашборд →
            </Link>
          </div>
        )}

        {/* Filter chips */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            Сортировать по фактору
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(Object.keys(FACTOR_META) as FactorKey[]).map(k => {
              const m = FACTOR_META[k];
              const active = filter === k;
              return (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  title={m.desc}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: `1px solid ${active ? C.purple : C.border}`,
                    background: active ? "rgba(167,139,250,0.15)" : "transparent",
                    color: active ? C.purple : C.dim,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span>{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: C.faint, marginTop: 8, fontStyle: "italic" }}>
            {FACTOR_META[filter].desc}
          </div>
        </div>

        {/* Leaderboard table */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 520 }}>
          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "50px 1fr 100px 80px 60px",
            padding: "10px 16px",
            background: "rgba(167,139,250,0.06)",
            borderBottom: `1px solid ${C.border}`,
            fontSize: 10,
            fontWeight: 800,
            color: C.purple,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}>
            <div>#</div>
            <div>Игрок</div>
            <div style={{ textAlign: "right" }}>{filter === "overall" ? "CPI" : FACTOR_META[filter].label}</div>
            <div style={{ textAlign: "right" }}>Партии</div>
            <div style={{ textAlign: "right" }}>Тренд</div>
          </div>

          {/* Rows */}
          {sortedEntries.map((e) => {
            const rb = rankBadge(e.rank);
            const tierInfo = tierFor(e.cpi);
            const displayValue = filter === "overall"
              ? String(e.cpi)
              : (e.factors[filter as keyof Entry["factors"]] * 100).toFixed(1) + "%";
            return (
              <div key={e.username} style={{
                display: "grid",
                gridTemplateColumns: "50px 1fr 100px 80px 60px",
                padding: "12px 16px",
                borderTop: e.rank === 1 ? "none" : `1px solid ${C.border}`,
                alignItems: "center",
                background: e.username === "Ты" ? "rgba(167,139,250,0.08)" : "transparent",
                borderLeft: e.username === "Ты" ? `3px solid ${C.purple}` : "3px solid transparent",
              }}>
                <div>
                  <span style={{
                    display: "inline-block",
                    minWidth: 28,
                    textAlign: "center",
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: rb.bg,
                    color: rb.fg,
                    fontSize: 12,
                    fontWeight: 900,
                  }}>{e.rank}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{e.emoji}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{e.username}</div>
                    <div style={{ fontSize: 10, color: tierInfo.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
                      {tierInfo.tier}
                    </div>
                  </div>
                </div>
                <div style={{
                  textAlign: "right",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 14,
                  fontWeight: 900,
                  color: filter === "overall" ? tierInfo.color : C.cyan,
                }}>
                  {displayValue}
                </div>
                <div style={{
                  textAlign: "right",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 12,
                  color: C.dim,
                }}>
                  {e.games}
                </div>
                <div style={{
                  textAlign: "right",
                  fontSize: 14,
                  color: e.trend === "up" ? C.green : e.trend === "down" ? C.red : C.faint,
                }}>
                  {e.trend === "up" ? "▲" : e.trend === "down" ? "▼" : "—"}
                </div>
              </div>
            );
          })}
        </div>
        </div>
        </div>

        {/* Per-factor stats note */}
        <div style={{ marginTop: 24, padding: "14px 18px", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.cyan, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
            Чем CPI Leaderboard лучше Elo-таблиц
          </div>
          <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.7 }}>
            Lichess и chess.com ранжируют по числу побед против сильных соперников. В CPI ты можешь занять{" "}
            <strong style={{ color: C.text }}>1-е место по Мат-3 зрению</strong> или{" "}
            <strong style={{ color: C.text }}>лучшему дебютному репертуару</strong>, даже если ещё не входишь в топ-10 общего рейтинга.
            Это позволяет найти свою сильную сторону и публично её показать.
          </div>
        </div>

        {/* Related */}
        <div style={{ marginTop: 32, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
          <Link href="/cyberchess/cpi" style={{ color: C.purple, textDecoration: "none" }}>← Описание CPI</Link>
          <span style={{ color: C.faint }}>·</span>
          <Link href="/cyberchess/cpi/dashboard" style={{ color: C.purple, textDecoration: "none" }}>📊 Мой дашборд</Link>
          <span style={{ color: C.faint }}>·</span>
          <Link href="/cyberchess" style={{ color: C.purple, textDecoration: "none" }}>♞ Играть</Link>
        </div>

        <div style={{ marginTop: 32, fontSize: 11, color: C.faint, textAlign: "center" }}>
          Разбери партию в <Link href="/cyberchess" style={{ color: C.purple, textDecoration: "none" }}>CyberChess</Link> — твой CPI обновится автоматически и попадёт в таблицу
        </div>
      </article>
    </main>
  );
}
