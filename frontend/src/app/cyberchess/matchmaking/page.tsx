"use client";

// AEVION CyberChess — Real-player matchmaking page
// Route: /cyberchess/matchmaking
//
// Flow:
//   1. User picks time control + rating range, clicks "Найти соперника".
//   2. We POST /api/cyberchess/matchmaking/queue/join. If matched
//      synchronously → straight to /cyberchess?matchId=...&color=....
//   3. Otherwise we poll /queue/status every 2s and also subscribe to
//      /queue/stream (SSE) for instant matched event. Whichever fires
//      first wins.
//   4. "Покинуть очередь" → POST /queue/leave + reset UI.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCcI18n } from "../i18n";
import { loadEstimateFromStorage } from "../ratingCalibration";
import { tournamentUserId } from "../tournaments/playerIdentity";

type TimeControl = "60+0" | "180+0" | "300+5" | "600+10" | "1800+0";

const TIME_CONTROLS: { value: TimeControl; label: string; sub: string }[] = [
  { value: "60+0", label: "1+0", sub: "Пуля · 1 мин" },
  { value: "180+0", label: "3+0", sub: "Блиц · 3 мин" },
  { value: "300+5", label: "5+5", sub: "Блиц · 5 мин + 5 сек" },
  { value: "600+10", label: "10+10", sub: "Рапид · 10 мин + 10 сек" },
  { value: "1800+0", label: "30+0", sub: "Классика · 30 мин" },
];

type QueueState =
  | { phase: "idle" }
  | { phase: "joining" }
  | {
      phase: "waiting";
      queueId: string;
      position: number;
      waiting: number;
      estimatedWaitMs: number;
      elapsedMs: number;
    }
  | {
      phase: "matched";
      matchId: string;
      color: "white" | "black";
      opponent: { userId: string; displayName: string; ratingInternal: number };
    }
  | { phase: "error"; message: string };

// Четвёртая по счёту собственная реализация одного и того же была здесь.
// Ключ тот же, формат id почти тот же — и именно «почти» опасно: расхождение
// таких копий не падает, оно тихо делает одного человека несколькими.
const getOrCreateUserId = tournamentUserId;

function getDisplayName(): string {
  if (typeof window === "undefined") return "Игрок";
  return window.localStorage.getItem("cyberchess.displayName") || "Игрок";
}

function getStoredRating(): number {
  if (typeof window === "undefined") return 1500;
  // Prefer FIDE-calibrated estimate when available (set by main chess page after 3+ games)
  const fide = loadEstimateFromStorage();
  if (fide !== null) return fide;
  const v = Number(window.localStorage.getItem("cyberchess.rating") || 1500);
  if (!Number.isFinite(v)) return 1500;
  return Math.max(100, Math.min(3000, Math.round(v)));
}

// Speed class from time control — mirrors backend cyberchessMatchStore.speedOf
// (lichess-style: estimate = base + 40*inc). Rating is tracked per speed.
function speedOf(tc: string): string {
  const m = /^(\d+)\+(\d+)$/.exec(tc);
  if (!m) return "blitz";
  const est = parseInt(m[1], 10) + 40 * parseInt(m[2], 10);
  if (est < 180) return "bullet";
  if (est < 480) return "blitz";
  if (est < 1500) return "rapid";
  return "classical";
}

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function CyberChessMatchmakingPage() {
  const { t } = useCcI18n();
  const router = useRouter();
  const [timeControl, setTimeControl] = useState<TimeControl>("180+0");
  const [rating, setRating] = useState<number>(1500);
  const [fideEstimate, setFideEstimate] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState<string>("Игрок");
  // Persisted server rating for the current speed (survives redeploy). null =
  // not loaded / no ranked games yet → fall back to local estimate.
  const [serverRating, setServerRating] = useState<
    { rating: number; rd: number; games: number; provisional: boolean } | null
  >(null);
  const [state, setState] = useState<QueueState>({ phase: "idle" });
  const userIdRef = useRef<string>("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  // hydrate userId/displayName/rating on mount
  useEffect(() => {
    userIdRef.current = getOrCreateUserId();
    setDisplayName(getDisplayName());
    const fide = loadEstimateFromStorage();
    setFideEstimate(fide);
    setRating(getStoredRating());
    // Rematch deep-link: /cyberchess/matchmaking?tc=180+0 preselects time control.
    try {
      const tc = new URLSearchParams(window.location.search).get("tc");
      const allowed = ["60+0", "180+0", "300+5", "600+10", "1800+0"];
      if (tc && allowed.includes(tc)) setTimeControl(tc as TimeControl);
    } catch {
      /* ignore */
    }
  }, []);

  // Fetch persisted Glicko rating for the current speed; prefer it (authoritative,
  // survives redeploy) once the player has ranked games. Silent fallback otherwise.
  useEffect(() => {
    const userId = userIdRef.current || getOrCreateUserId();
    const speed = speedOf(timeControl);
    let alive = true;
    (async () => {
      try {
        const r = await fetch(
          `/api-backend/api/cyberchess/matchmaking/rating?userId=${encodeURIComponent(userId)}&speed=${speed}`,
          { cache: "no-store" },
        );
        const data = await r.json();
        if (!alive || !data?.ok) return;
        const row = Array.isArray(data.ratings) ? data.ratings[0] : null;
        if (row && Number(row.games) > 0) {
          const rr = Math.round(Number(row.rating));
          setServerRating({
            rating: rr,
            rd: Math.round(Number(row.rd)),
            games: Number(row.games),
            provisional: Number(row.rd) > 110,
          });
          setRating(Math.max(100, Math.min(3000, rr)));
        } else {
          setServerRating(null); // no ranked games in this speed yet
        }
      } catch {
        if (alive) setServerRating(null); // offline → keep local estimate
      }
    })();
    return () => {
      alive = false;
    };
  }, [timeControl]);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const goToMatch = useCallback(
    (matchId: string, color: "white" | "black") => {
      cleanup();
      router.push(`/cyberchess?matchId=${encodeURIComponent(matchId)}&color=${color}`);
    },
    [cleanup, router],
  );

  const handleMatched = useCallback(
    (data: {
      matchId: string;
      color: "white" | "black";
      opponent: { userId: string; displayName: string; ratingInternal: number };
    }) => {
      setState({
        phase: "matched",
        matchId: data.matchId,
        color: data.color,
        opponent: data.opponent,
      });
      // brief moment so the user sees who they got, then redirect
      setTimeout(() => goToMatch(data.matchId, data.color), 1200);
    },
    [goToMatch],
  );

  const pollStatus = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId) return;
    try {
      const r = await fetch(
        `/api-backend/api/cyberchess/matchmaking/queue/status?userId=${encodeURIComponent(userId)}`,
        { cache: "no-store" },
      );
      const data = await r.json();
      if (!data?.ok) return;
      if (data.status === "matched" && data.matchId) {
        handleMatched({
          matchId: data.matchId,
          color: data.color,
          opponent: data.opponent,
        });
        return;
      }
      if (data.status === "waiting") {
        setState((prev) => {
          if (prev.phase !== "waiting") return prev;
          return {
            ...prev,
            position: data.position ?? prev.position,
            waiting: data.waiting ?? prev.waiting,
            estimatedWaitMs: data.estimatedWaitMs ?? prev.estimatedWaitMs,
          };
        });
      }
    } catch {
      // network blip — keep polling
    }
  }, [handleMatched]);

  const startWaiting = useCallback(
    (queueId: string, position: number, waiting: number, estimatedWaitMs: number) => {
      startedAtRef.current = Date.now();
      setState({
        phase: "waiting",
        queueId,
        position,
        waiting,
        estimatedWaitMs,
        elapsedMs: 0,
      });
      // poll + sse
      pollRef.current = setInterval(pollStatus, 2000);
      tickRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.phase !== "waiting") return prev;
          return { ...prev, elapsedMs: Date.now() - startedAtRef.current };
        });
      }, 250);
      try {
        const es = new EventSource(
          `/api-backend/api/cyberchess/matchmaking/queue/stream?userId=${encodeURIComponent(userIdRef.current)}`,
        );
        es.addEventListener("matched", (ev) => {
          try {
            const data = JSON.parse((ev as MessageEvent).data);
            handleMatched({
              matchId: data.matchId,
              color: data.color,
              opponent: data.opponent,
            });
          } catch {
            // ignore parse error, polling will catch up
          }
        });
        es.addEventListener("timeout", () => {
          setState({
            phase: "error",
            message: "Время ожидания истекло. Попробуй ещё раз — возможно, нет соперников с похожим рейтингом.",
          });
          cleanup();
        });
        es.addEventListener("cancelled", () => {
          // user pressed leave on another tab — sync UI
          cleanup();
          setState({ phase: "idle" });
        });
        es.onerror = () => {
          // SSE may drop on idle infra; polling is the safety net
        };
        sseRef.current = es;
      } catch {
        // SSE unsupported — polling alone is fine
      }
    },
    [pollStatus, handleMatched, cleanup],
  );

  const onJoin = useCallback(async () => {
    setState({ phase: "joining" });
    const userId = userIdRef.current;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("cyberchess.rating", String(rating));
      window.localStorage.setItem("cyberchess.displayName", displayName);
    }
    try {
      const r = await fetch("/api-backend/api/cyberchess/matchmaking/queue/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          displayName,
          rating,
          timeControl,
        }),
      });
      const data = await r.json();
      if (!data?.ok) {
        // Код ошибки человеку не показываем: «Не удалось встать в очередь:
        // unknown» не говорит ему ничего и выглядит поломкой. Код уходит в
        // консоль, где он и нужен.
        console.warn("[matchmaking] очередь отказала:", data?.error);
        setState({
          phase: "error",
          message:
            data?.error === "rate_limited"
              ? "Слишком много попыток. Подожди минуту."
              : "Не удалось встать в очередь. Попробуй ещё раз через минуту.",
        });
        return;
      }
      if (data.matched) {
        handleMatched({
          matchId: data.matchId,
          color: data.color,
          opponent: data.opponent,
        });
        return;
      }
      startWaiting(data.queueId, data.position ?? 1, data.waiting ?? 1, data.estimatedWaitMs ?? 30000);
    } catch (e) {
      setState({
        phase: "error",
        message: `Сеть недоступна: ${(e as Error).message}`,
      });
    }
  }, [rating, displayName, timeControl, handleMatched, startWaiting]);

  const onLeave = useCallback(async () => {
    cleanup();
    try {
      await fetch("/api-backend/api/cyberchess/matchmaking/queue/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userIdRef.current }),
      });
    } catch {
      // best-effort
    }
    setState({ phase: "idle" });
  }, [cleanup]);

  const waitingProgressPct = useMemo(() => {
    if (state.phase !== "waiting") return 0;
    const ratio = state.elapsedMs / Math.max(1, state.estimatedWaitMs);
    return Math.min(100, Math.round(ratio * 100));
  }, [state]);

  return (
    <main className="planet-root">
      <div className="planet-wrap" style={{ display: "flex", flexDirection: "column", gap: 28, paddingTop: 32, paddingBottom: 40 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            onClick={() => router.push("/cyberchess")}
            className="planet-muted"
            style={{ alignSelf: "flex-start", fontSize: 13, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            ← Назад в CyberChess
          </button>
          <h1 className="planet-h1">Поиск соперника</h1>
          <p className="planet-muted" style={{ fontSize: 14.5 }}>
            Подберём живого игрока с похожим рейтингом ({rating - 150}–{rating + 150}) и тем же контролем времени.
          </p>
          <nav style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
            <a href="/cyberchess/leaderboard" className="planet-btn">Таблица лидеров</a>
            <a href="/cyberchess/history" className="planet-btn">История матчей</a>
          </nav>
        </header>

        {/* Settings card */}
        <section className="planet-card" style={{ padding: 24 }}>
          <h2 style={{ marginBottom: 16, fontSize: 17, fontWeight: 700 }}>Параметры партии</h2>

          {/* Display name */}
          <div style={{ marginBottom: 20 }}>
            {/* htmlFor + id связывают подпись с полем. Без этого диктор читает
                «поле ввода» и не называет, чего от человека хотят: подпись рядом
                видна глазами, но программно с полем не связана. */}
            <label htmlFor="mm-nick" className="planet-eyebrow" style={{ display: "block", marginBottom: 6, fontSize: 11 }}>Ник</label>
            <input
              id="mm-nick"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 32))}
              disabled={state.phase === "waiting" || state.phase === "joining"}
              className="planet-input"
              style={{ maxWidth: 320 }}
              placeholder="Игрок"
            />
          </div>

          {/* Time control */}
          <div style={{ marginBottom: 20 }}>
            <label className="planet-eyebrow" style={{ display: "block", marginBottom: 8, fontSize: 11 }}>Контроль времени</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }} className="planet-tc-grid">
              {TIME_CONTROLS.map((tc) => {
                const active = timeControl === tc.value;
                return (
                  <button
                    key={tc.value}
                    type="button"
                    onClick={() => setTimeControl(tc.value)}
                    disabled={state.phase === "waiting" || state.phase === "joining"}
                    className={`planet-tile${active ? " active" : ""}`}
                  >
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{tc.label}</div>
                    <div className="planet-muted" style={{ fontSize: 11.5 }}>{tc.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rating slider */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <label htmlFor="mm-rating" className="planet-eyebrow" style={{ fontSize: 11 }}>Твой рейтинг</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {serverRating && (
                  <span
                    title={`Рейтинг ${speedOf(timeControl)} · ${serverRating.games} партий${serverRating.provisional ? " · неточный (мало партий)" : ""}`}
                    className="planet-badge cyan"
                  >
                    {speedOf(timeControl)} {serverRating.rating}
                    {serverRating.provisional ? "?" : ""} · {serverRating.games} партий
                  </span>
                )}
                {fideEstimate !== null && (
                  <span className="planet-badge live">FIDE ~{fideEstimate}</span>
                )}
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                  {rating} <span className="planet-muted">(диапазон {rating - 150}–{rating + 150})</span>
                </span>
              </div>
            </div>
            <input
              id="mm-rating"
              type="range"
              min={100}
              max={3000}
              step={10}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              disabled={state.phase === "waiting" || state.phase === "joining"}
              style={{ width: "100%", accentColor: "var(--pl-gold)" }}
            />
            <div className="planet-muted" style={{ marginTop: 4, display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span>100</span>
              <span>1000</span>
              <span>1500</span>
              <span>2000</span>
              <span>3000</span>
            </div>
            {fideEstimate !== null && (
              <p className="planet-muted" style={{ marginTop: 6, fontSize: 11.5 }}>
                Рейтинг автоматически определён по твоим партиям (FIDE ~{fideEstimate}). Можно скорректировать вручную.
              </p>
            )}
          </div>
        </section>

        {/* Action / status card */}
        <section className="planet-card" style={{ padding: 24 }}>
          {state.phase === "idle" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <button
                type="button"
                onClick={onJoin}
                className="planet-btn active"
                style={{ width: "100%", maxWidth: 400, padding: "22px 32px", fontSize: 18, borderRadius: 14, justifyContent: "center" }}
              >
                {t("match.search")}
              </button>
              <p className="planet-muted" style={{ textAlign: "center", fontSize: 13.5 }}>
                Кликни — встанешь в живую очередь. Найдём пару за 5–60 секунд.
              </p>
            </div>
          )}

          {state.phase === "joining" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 0" }}>
              <div className="planet-spin" />
              <p style={{ fontSize: 14 }}>Встаём в очередь…</p>
            </div>
          )}

          {state.phase === "waiting" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div className="planet-pulse" />
                <p style={{ fontSize: 17, fontWeight: 700 }}>{t("match.searching")}</p>
                <p className="planet-muted" style={{ fontSize: 13 }}>
                  Прошло: {formatDuration(state.elapsedMs)} · Ожидание ≈ {formatDuration(state.estimatedWaitMs)}
                </p>
              </div>

              {/* Queue visualization */}
              <div style={{ borderRadius: 12, border: "1px solid var(--pl-line)", background: "var(--pl-surface-2)", padding: 16 }}>
                <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                  <span className="planet-muted">{t("match.position")}</span>
                  <span className="planet-num" style={{ fontFamily: "var(--pl-mono)", fontWeight: 700, color: "var(--pl-gold)" }}>
                    {state.position} / {state.waiting}
                  </span>
                </div>
                <div className="planet-track">
                  {Array.from({ length: Math.max(state.waiting, 1) }).map((_, i) => {
                    const isMe = i === state.position - 1;
                    const past = i < state.position - 1;
                    return <div key={i} className={`planet-track-seg${isMe ? " me" : past ? " past" : ""}`} />;
                  })}
                </div>
                <div style={{ marginTop: 12 }}>
                  <div className="planet-muted" style={{ marginBottom: 4, display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span>Прогресс ожидания</span>
                    <span>{waitingProgressPct}%</span>
                  </div>
                  <div className="planet-bar">
                    <div className="planet-bar-fill" style={{ width: `${waitingProgressPct}%` }} />
                  </div>
                </div>
              </div>

              <button type="button" onClick={onLeave} className="planet-btn" style={{ alignSelf: "center" }}>
                {t("match.cancel")}
              </button>
            </div>
          )}

          {state.phase === "matched" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "20px 0" }}>
              <div className="planet-badge live">{t("match.found")}</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{state.opponent.displayName}</div>
                <div className="planet-muted" style={{ fontSize: 13 }}>
                  Рейтинг {state.opponent.ratingInternal} · ты играешь {state.color === "white" ? "белыми" : "чёрными"}
                </div>
              </div>
              <p className="planet-muted" style={{ fontSize: 13 }}>Переходим к доске…</p>
            </div>
          )}

          {state.phase === "error" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "20px 0" }}>
              <div className="planet-badge danger">Ошибка</div>
              <p style={{ maxWidth: 400, textAlign: "center", fontSize: 13.5 }}>{state.message}</p>
              <button type="button" onClick={() => setState({ phase: "idle" })} className="planet-btn">
                Попробовать снова
              </button>
              {/* Выход к движку. 30 августа игроков в очереди почти не будет, и
                  «попробуй ещё раз» ведёт в ту же пустоту: человек, пришедший
                  играть, уходит ни с чем. Партия против движка доступна сразу и
                  работает — проверено на проде. */}
              <a href="/cyberchess" className="planet-muted" style={{ fontSize: 12.5, textDecoration: "underline" }}>
                Соперника нет? Сыграть с движком прямо сейчас →
              </a>
            </div>
          )}
        </section>

        {/* Сказано последствием для человека, а не устройством системы.
            Было: «Очередь и матчи живут в памяти бэкенда. Без активности
            5 минут — выкинет из очереди.» Посетитель не знает, что такое
            «память бэкенда», и не может по этой фразе ничего решить.
            Найдено 27.08.2026 чтением того, что реально написано на экране:
            вёрстка цела, ошибок нет, тесты зелёные — заметно только глазом. */}
        <footer className="planet-muted" style={{ textAlign: "center", fontSize: 11.5 }}>
          Очередь не сохраняется: если перезагрузить страницу, поиск начнётся заново.
          Через 5 минут без действий мы выведем вас из очереди.
        </footer>
      </div>
    </main>
  );
}
