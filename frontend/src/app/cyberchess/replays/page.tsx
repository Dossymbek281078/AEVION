"use client";
// Replay hub — force Vercel rebuild 2026-05-19 (stale CDN cache от пред-fix эпохи)

/**
 * CyberChess — Replay hub
 *
 * Lists finished games stored in the spectator backend's LRU archive.
 * Filter by outcome (all / wins / losses / draws) and sort by
 * latest / longest / shortest. Click "Watch" to open the replay viewer.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCcI18n } from "../i18n";

// ----- Types -----

type ReplayItem = {
  gameId: string;
  hostName?: string;
  aiLevel?: string;
  rating?: number;
  result: string; // "1-0" | "0-1" | "1/2-1/2" | "*"
  duration: number; // ms
  plyCount: number;
  endedAt: number; // ms epoch
  startedAt: number;
};

type Filter = "all" | "wins" | "losses" | "draws";
type Sort = "latest" | "longest" | "shortest";

// ----- Helpers -----

function classifyResult(r: string): "win" | "loss" | "draw" | "other" {
  // Host viewpoint: assume host plays White (typical for CyberChess vs AI).
  // Backend doesn't record orientation explicitly yet — TODO: pass color.
  if (r === "1-0") return "win";
  if (r === "0-1") return "loss";
  if (r === "1/2-1/2" || r === "draw" || r === "0.5-0.5") return "draw";
  return "other";
}

function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 1) return `${sec}s`;
  if (m < 60) return `${m}m ${sec.toString().padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${(m % 60).toString().padStart(2, "0")}m`;
}

function fmtRelative(ts: number): string {
  if (!Number.isFinite(ts)) return "—";
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 30) return "только что";
  if (s < 60) return `${s} сек назад`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} дн назад`;
}

function resultLabel(r: string): string {
  const cls = classifyResult(r);
  if (cls === "win") return "Победа";
  if (cls === "loss") return "Поражение";
  if (cls === "draw") return "Ничья";
  return r || "—";
}

function resultBadgeClass(r: string): string {
  const cls = classifyResult(r);
  if (cls === "win") return "planet-badge live";
  if (cls === "loss") return "planet-badge danger";
  if (cls === "draw") return "planet-badge gold";
  return "planet-badge muted";
}

// ----- API -----

const API_BASE = "/api-backend/api/cyberchess-spectator";

async function fetchReplays(limit = 50): Promise<ReplayItem[]> {
  const res = await fetch(`${API_BASE}/replays?limit=${limit}`, {
    cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { ok: boolean; replays: ReplayItem[] };
  if (!data.ok) throw new Error("API returned ok=false");
  return data.replays;
}

// ----- Page -----

export default function ReplayHubPage() {
  const { t } = useCcI18n();
  const [items, setItems] = useState<ReplayItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("latest");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetchReplays(50)
      .then((rs) => {
        if (alive) setItems(rs);
      })
      .catch((e: unknown) => {
        // Человеку — человеческое. Прежде сюда попадали «HTTP 500» и
        // «API returned ok=false»: это язык разработчика, и ворота запуска
        // требуют обратного («тексты ошибок человеческие, без кодов»).
        // Технический текст не теряем — он уходит в консоль, где и нужен.
        if (!alive) return;
        console.warn("[replays] не удалось загрузить список:", e);
        setError("Не удалось загрузить партии. Попробуйте обновить страницу.");
      });
    return () => {
      alive = false;
    };
  }, [refreshTick]);

  // Auto-refresh every 30s — replays appear when games end.
  useEffect(() => {
    const t = setInterval(() => setRefreshTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const f = items.filter((r) => {
      if (filter === "all") return true;
      const cls = classifyResult(r.result);
      if (filter === "wins") return cls === "win";
      if (filter === "losses") return cls === "loss";
      if (filter === "draws") return cls === "draw";
      return true;
    });
    const sorted = f.slice();
    if (sort === "latest") sorted.sort((a, b) => b.endedAt - a.endedAt);
    else if (sort === "longest") sorted.sort((a, b) => b.duration - a.duration);
    else if (sort === "shortest") sorted.sort((a, b) => a.duration - b.duration);
    return sorted;
  }, [items, filter, sort]);

  const counts = useMemo(() => {
    if (!items) return { all: 0, wins: 0, losses: 0, draws: 0 };
    let wins = 0;
    let losses = 0;
    let draws = 0;
    for (const r of items) {
      const c = classifyResult(r.result);
      if (c === "win") wins += 1;
      else if (c === "loss") losses += 1;
      else if (c === "draw") draws += 1;
    }
    return { all: items.length, wins, losses, draws };
  }, [items]);

  return (
    <main className="planet-root">
      <div className="planet-wrap" style={{ paddingTop: 36, paddingBottom: 48 }}>
        <header style={{ marginBottom: 28, display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div className="planet-eyebrow">CyberChess</div>
            <h1 className="planet-h1" style={{ marginTop: 4 }}>{t("replay.hub.title")}</h1>
            <p className="planet-muted" style={{ marginTop: 8, maxWidth: "60ch", fontSize: 13.5 }}>
              Завершённые партии, доступные для пересмотра с покадровой
              навигацией и графиком оценки. Хранится до 50 последних трансляций.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/cyberchess/spectator" className="planet-btn">Идут сейчас</Link>
            <Link href="/cyberchess" className="planet-btn">На главную</Link>
          </div>
        </header>

        {/* Filter + sort controls */}
        <section className="planet-card" style={{ marginBottom: 20, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(
              [
                { key: "all", label: t("replay.hub.filter.all"), n: counts.all },
                { key: "wins", label: t("replay.hub.filter.wins"), n: counts.wins },
                { key: "losses", label: t("replay.hub.filter.losses"), n: counts.losses },
                { key: "draws", label: t("replay.hub.filter.draws"), n: counts.draws },
              ] as { key: Filter; label: string; n: number }[]
            ).map((chip) => {
              const active = filter === chip.key;
              return (
                <button
                  key={chip.key}
                  onClick={() => setFilter(chip.key)}
                  className={`planet-btn${active ? " active" : ""}`}
                  style={{ borderRadius: 999, padding: "6px 12px" }}
                >
                  {chip.label}
                  <span className="planet-muted" style={{ marginLeft: 4, fontSize: 10 }}>{chip.n}</span>
                </button>
              );
            })}
          </div>

          {/* flexWrap — чтобы ряд переносился на узком телефоне. Замер
              28.08.2026 на ширине 320: подпись, выпадающий список и кнопка
              «Обновить» вместе шире экрана, и страница уезжала вбок на 20
              пикселей. На 375 ряд помещается, поэтому дефекта не видно. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <label htmlFor="rp-sort" className="planet-muted" style={{ fontSize: 11.5 }}>Сортировка:</label>
            <select id="rp-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="planet-input"
              style={{ width: "auto", padding: "6px 10px", fontSize: 12 }}
            >
              <option value="latest">Сначала новые</option>
              <option value="longest">Самые длинные</option>
              <option value="shortest">Самые короткие</option>
            </select>
            <button onClick={() => setRefreshTick((x) => x + 1)} className="planet-btn" title="Обновить">
              Обновить
            </button>
          </div>
        </section>

        {/* List */}
        {error && (
          <div className="planet-card" style={{ padding: 16, fontSize: 13.5, color: "var(--pl-danger)" }}>
            Не удалось загрузить архив трансляций. Проверьте связь и обновите
            страницу — записи никуда не делись.
          </div>
        )}

        {!error && items === null && (
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="planet-card" style={{ height: 144, opacity: 0.5 }} />
            ))}
          </div>
        )}

        {!error && items !== null && filtered.length === 0 && (
          <div className="planet-card planet-empty">
            {items.length === 0
              ? "Пока нет завершённых трансляций. Заверши партию — она появится здесь автоматически."
              : "Под текущий фильтр ничего не подходит."}
          </div>
        )}

        {!error && filtered.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
            {filtered.map((r) => (
              <li key={r.gameId} className="planet-card" style={{ display: "flex", flexDirection: "column", padding: 16 }}>
                <div style={{ marginBottom: 10, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.hostName || "Аноним"}
                    </div>
                    <div className="planet-muted" style={{ marginTop: 2, fontSize: 11 }}>{fmtRelative(r.endedAt)}</div>
                  </div>
                  <span className={resultBadgeClass(r.result)} style={{ flexShrink: 0 }}>{resultLabel(r.result)}</span>
                </div>

                <div style={{ marginBottom: 14, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, fontSize: 11 }}>
                  <div style={{ borderRadius: 8, background: "var(--pl-surface-2)", padding: "6px 8px" }}>
                    <div className="planet-muted">Длительность</div>
                    <div style={{ marginTop: 2, fontWeight: 600 }}>{fmtDuration(r.duration)}</div>
                  </div>
                  <div style={{ borderRadius: 8, background: "var(--pl-surface-2)", padding: "6px 8px" }}>
                    <div className="planet-muted">Ходы</div>
                    <div style={{ marginTop: 2, fontWeight: 600 }}>{r.plyCount}</div>
                  </div>
                  <div style={{ borderRadius: 8, background: "var(--pl-surface-2)", padding: "6px 8px" }}>
                    <div className="planet-muted">AI</div>
                    <div style={{ marginTop: 2, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.aiLevel || (r.rating ? String(r.rating) : "—")}
                    </div>
                  </div>
                </div>

                <Link href={`/cyberchess/replays/${encodeURIComponent(r.gameId)}`} className="planet-btn active" style={{ marginTop: "auto", justifyContent: "center" }}>
                  <span aria-hidden>▶</span> Смотреть
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
