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

type TimeControl = "60+0" | "180+0" | "300+5" | "600+10" | "1800+0";

const TIME_CONTROLS: { value: TimeControl; label: string; sub: string }[] = [
  { value: "60+0", label: "1+0", sub: "Bullet · 1 мин" },
  { value: "180+0", label: "3+0", sub: "Blitz · 3 мин" },
  { value: "300+5", label: "5+5", sub: "Blitz · 5 мин + 5 сек" },
  { value: "600+10", label: "10+10", sub: "Rapid · 10 мин + 10 сек" },
  { value: "1800+0", label: "30+0", sub: "Classic · 30 мин" },
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

function getOrCreateUserId(): string {
  if (typeof window === "undefined") return "anon_ssr";
  const k = "cyberchess.userId";
  let id = window.localStorage.getItem(k);
  if (!id) {
    id = `u_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    window.localStorage.setItem(k, id);
  }
  return id;
}

function getDisplayName(): string {
  if (typeof window === "undefined") return "Игрок";
  return window.localStorage.getItem("cyberchess.displayName") || "Игрок";
}

function getStoredRating(): number {
  if (typeof window === "undefined") return 1500;
  const v = Number(window.localStorage.getItem("cyberchess.rating") || 1500);
  if (!Number.isFinite(v)) return 1500;
  return Math.max(100, Math.min(3000, Math.round(v)));
}

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function CyberChessMatchmakingPage() {
  const router = useRouter();
  const [timeControl, setTimeControl] = useState<TimeControl>("180+0");
  const [rating, setRating] = useState<number>(1500);
  const [displayName, setDisplayName] = useState<string>("Игрок");
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
    setRating(getStoredRating());
  }, []);

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
        `/api/cyberchess/matchmaking/queue/status?userId=${encodeURIComponent(userId)}`,
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
          `/api/cyberchess/matchmaking/queue/stream?userId=${encodeURIComponent(userIdRef.current)}`,
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
      const r = await fetch("/api/cyberchess/matchmaking/queue/join", {
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
        setState({
          phase: "error",
          message:
            data?.error === "rate_limited"
              ? "Слишком много попыток. Подожди минуту."
              : `Не удалось встать в очередь: ${data?.error || "unknown"}`,
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
      await fetch("/api/cyberchess/matchmaking/queue/leave", {
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
    <main className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => router.push("/cyberchess")}
            className="self-start text-sm text-slate-400 hover:text-slate-200"
          >
            ← Назад в CyberChess
          </button>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Поиск соперника
          </h1>
          <p className="text-slate-400">
            Подберём живого игрока с похожим рейтингом ({rating - 150}–{rating + 150}) и тем же контролем времени.
          </p>
        </header>

        {/* Settings card */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold">Параметры партии</h2>

          {/* Display name */}
          <div className="mb-5">
            <label className="mb-1 block text-sm text-slate-400">Ник</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 32))}
              disabled={state.phase === "waiting" || state.phase === "joining"}
              className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:opacity-50"
              placeholder="Игрок"
            />
          </div>

          {/* Time control */}
          <div className="mb-5">
            <label className="mb-2 block text-sm text-slate-400">Контроль времени</label>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {TIME_CONTROLS.map((tc) => {
                const active = timeControl === tc.value;
                return (
                  <button
                    key={tc.value}
                    type="button"
                    onClick={() => setTimeControl(tc.value)}
                    disabled={state.phase === "waiting" || state.phase === "joining"}
                    className={`rounded-xl border px-3 py-3 text-left transition disabled:opacity-50 ${
                      active
                        ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500"
                        : "border-slate-700 bg-slate-950 hover:border-slate-500"
                    }`}
                  >
                    <div className="text-base font-semibold">{tc.label}</div>
                    <div className="text-xs text-slate-400">{tc.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rating slider */}
          <div className="mb-2">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm text-slate-400">Твой рейтинг</label>
              <span className="text-sm font-medium">
                {rating} <span className="text-slate-500">(диапазон {rating - 150}–{rating + 150})</span>
              </span>
            </div>
            <input
              type="range"
              min={100}
              max={3000}
              step={10}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              disabled={state.phase === "waiting" || state.phase === "joining"}
              className="w-full accent-indigo-500 disabled:opacity-50"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-500">
              <span>100</span>
              <span>1000</span>
              <span>1500</span>
              <span>2000</span>
              <span>3000</span>
            </div>
          </div>
        </section>

        {/* Action / status card */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur">
          {state.phase === "idle" && (
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={onJoin}
                className="w-full max-w-md rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 px-8 py-6 text-2xl font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-400 hover:to-purple-400 active:scale-[0.98]"
              >
                Найти соперника
              </button>
              <p className="text-center text-sm text-slate-400">
                Кликни — встанешь в живую очередь. Найдём пару за 5–60 секунд.
              </p>
            </div>
          )}

          {state.phase === "joining" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-indigo-500" />
              <p className="text-slate-300">Встаём в очередь…</p>
            </div>
          )}

          {state.phase === "waiting" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col items-center gap-2">
                <div className="h-14 w-14 animate-pulse rounded-full bg-indigo-500/20 ring-4 ring-indigo-500/40" />
                <p className="text-lg font-semibold">Ищем соперника…</p>
                <p className="text-sm text-slate-400">
                  Прошло: {formatDuration(state.elapsedMs)} · Ожидание ≈ {formatDuration(state.estimatedWaitMs)}
                </p>
              </div>

              {/* Queue visualization */}
              <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-slate-400">Позиция в очереди</span>
                  <span className="font-mono font-semibold text-indigo-300">
                    {state.position} / {state.waiting}
                  </span>
                </div>
                <div className="flex h-3 w-full gap-1 overflow-hidden rounded-full bg-slate-800">
                  {Array.from({ length: Math.max(state.waiting, 1) }).map((_, i) => {
                    const isMe = i === state.position - 1;
                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-sm ${
                          isMe
                            ? "bg-indigo-400 ring-2 ring-indigo-200"
                            : i < state.position - 1
                              ? "bg-purple-700"
                              : "bg-slate-700"
                        }`}
                      />
                    );
                  })}
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Прогресс ожидания</span>
                    <span>{waitingProgressPct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-[width] duration-500"
                      style={{ width: `${waitingProgressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onLeave}
                className="self-center rounded-xl border border-slate-700 bg-slate-950 px-6 py-3 text-sm font-medium text-slate-300 hover:border-rose-500 hover:text-rose-300"
              >
                Покинуть очередь
              </button>
            </div>
          )}

          {state.phase === "matched" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="rounded-full bg-emerald-500/20 px-4 py-1 text-sm font-semibold text-emerald-300">
                Соперник найден
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{state.opponent.displayName}</div>
                <div className="text-sm text-slate-400">
                  Рейтинг {state.opponent.ratingInternal} · ты играешь {state.color === "white" ? "белыми" : "чёрными"}
                </div>
              </div>
              <p className="text-sm text-slate-400">Переходим к доске…</p>
            </div>
          )}

          {state.phase === "error" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="rounded-full bg-rose-500/20 px-4 py-1 text-sm font-semibold text-rose-300">
                Ошибка
              </div>
              <p className="max-w-md text-center text-sm text-slate-300">{state.message}</p>
              <button
                type="button"
                onClick={() => setState({ phase: "idle" })}
                className="rounded-xl border border-slate-700 bg-slate-950 px-6 py-2 text-sm hover:border-indigo-500"
              >
                Попробовать снова
              </button>
            </div>
          )}
        </section>

        <footer className="text-center text-xs text-slate-500">
          Очередь и матчи живут в памяти бэкенда. Без активности 5 минут — выкинет из очереди.
        </footer>
      </div>
    </main>
  );
}
