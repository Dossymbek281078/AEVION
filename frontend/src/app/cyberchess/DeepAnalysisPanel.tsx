"use client";
import { useEffect, useRef, useState } from "react";
import { DeepEngine, type DeepEngineState } from "./deepEngine";
import { checkAppAccess, type AppAccess } from "@/lib/appAccess";

/**
 * Opt-in «Глубокий анализ» (Stockfish 17.1 + полный NNUE, сила уровня lichess).
 * Самодостаточный компонент: игровой/лёгкий движок НЕ трогает. По кнопке лениво
 * поднимает DeepEngine (движок из /public через worker-мост + сети из NET_BASE
 * с кэшем IndexedDB), показывает прогресс загрузки и оценку позиции.
 *
 * Провод в page.tsx: отрисовать во вкладке «Анализ», передав текущий FEN:
 *   {tab === "analysis" && <DeepAnalysisPanel fen={game.fen()} />}
 * Это единственная точка интеграции; сам компонент ничего в page.tsx не меняет.
 */

const STATE_LABEL: Record<DeepEngineState, string> = {
  idle: "",
  "loading-engine": "Поднимаю движок…",
  "loading-nets": "Загружаю нейросеть…",
  ready: "SF 17.1 · NNUE",
  error: "Не удалось запустить",
};

/** Оценка движка → строка для человека. Экспортирована для теста.
 *  ВХОД — БЕЛО-ОТНОСИТЕЛЬНЫЙ cp (+ = лучше у белых), как в основном eval-баре. */
export function scoreText(cp: number, mate: number): string {
  if (mate !== 0) return `#${Math.abs(mate)}${mate > 0 ? "" : " (−)"}`;
  const v = (cp / 100).toFixed(2);
  return cp > 0 ? `+${v}` : v;
}

/** UCI `score cp/mate` идёт ОТ СТОРОНЫ ХОДА. Основной eval-бар приводит его к
 *  бело-относительному (cp*sign, sign=turn==="w"?1:-1, page.tsx). Панель обязана
 *  делать то же, иначе на ходу чёрных её оценка и eval-бар показывают
 *  ПРОТИВОПОЛОЖНЫЙ знак (два наших ответа об одном спорят). Сторона хода — 2-е
 *  поле FEN. Экспортирована для теста. */
export function toWhiteRelative(cp: number, mate: number, fen: string): { cp: number; mate: number } {
  const sign = fen.split(" ")[1] === "b" ? -1 : 1;
  const flip = (x: number) => (x === 0 ? 0 : x * sign); // не плодить -0
  return { cp: flip(cp), mate: flip(mate) };
}

export default function DeepAnalysisPanel({ fen }: { fen: string }) {
  const [on, setOn] = useState(false);
  const [state, setState] = useState<DeepEngineState>("idle");
  const [netFrac, setNetFrac] = useState(0);
  const [cp, setCp] = useState(0);
  const [mate, setMate] = useState(0);
  const [depth, setDepth] = useState(0);
  const [access, setAccess] = useState<AppAccess | null>(null); // null = ещё проверяю
  const engRef = useRef<DeepEngine | null>(null);

  // Глубокий анализ (NNUE) — в CyberChess Pro. Остальное (игра, задачи, коуч,
  // ЛЁГКИЙ анализ, задача дня) остаётся бесплатным. Проверяем оплату при
  // монтировании. «unknown» — это НЕ «не куплено» (аноним мог купить в другом
  // браузере, см. appAccess.ts): ему предлагаем вход ИЛИ Pro, не обвиняем.
  useEffect(() => {
    let alive = true;
    checkAppAccess("cyberchess").then((a) => { if (alive) setAccess(a); });
    return () => { alive = false; };
  }, []);

  // Поднять движок при первом включении.
  useEffect(() => {
    if (!on || engRef.current) return;
    const eng = new DeepEngine();
    engRef.current = eng;
    eng.onState = (s, frac) => {
      setState(s);
      if (typeof frac === "number") setNetFrac(frac);
    };
    eng.init().catch(() => {/* состояние 'error' уже выставлено */});
  }, [on]);

  // Переоценивать позицию, когда движок готов и меняется FEN.
  useEffect(() => {
    const eng = engRef.current;
    if (!on || !eng || state !== "ready") return;
    let cancelled = false;
    eng.evaluate(
      fen,
      18,
      (c, m, d) => {
        if (cancelled) return;
        // Привести к бело-относительной оценке (fen из этого же замыкания —
        // сторона хода совпадает с оцениваемой позицией, без гонки знака).
        const w = toWhiteRelative(c, m, fen);
        setCp(w.cp);
        setMate(w.mate);
        setDepth(d);
      },
      () => {},
    );
    return () => {
      cancelled = true;
      eng.stop();
    };
  }, [fen, on, state]);

  // ── Гейт CyberChess Pro. Глубокий анализ (NNUE) — платный; лёгкий анализ,
  //    игра, задачи, коуч и задача дня остаются бесплатными (гейта на них нет). ──
  if (access === null) {
    return (
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.12)",
          background: "rgba(0,0,0,0.03)", color: "#7a7a7a", fontWeight: 700, fontSize: 13,
        }}
      >
        🧠 Глубокий анализ · проверяю доступ…
      </div>
    );
  }
  if (access !== "owned") {
    return (
      <div
        style={{
          padding: "12px", borderRadius: 8, border: "1px solid rgba(117,153,0,0.35)",
          background: "rgba(117,153,0,0.06)", fontSize: 13,
        }}
      >
        <div style={{ fontWeight: 800, color: "#5b7a00" }}>🔒 Глубокий анализ — в CyberChess Pro</div>
        <div style={{ marginTop: 6, color: "#4a4a4a", lineHeight: 1.5 }}>
          Stockfish 17.1 с полной нейросетью — глубина анализа уровня lichess.
          Игра, 500&nbsp;000 задач, ИИ-коуч и лёгкий анализ остаются бесплатными.
        </div>
        <a
          href="/pricing"
          style={{
            display: "inline-block", marginTop: 10, padding: "8px 14px", borderRadius: 8,
            background: "#5b7a00", color: "#fff", fontWeight: 700, textDecoration: "none",
          }}
        >
          Открыть Pro
        </a>
        {access === "unknown" && (
          <div style={{ marginTop: 8, color: "#7a7a7a", fontSize: 12 }}>
            Уже оформляли Pro? <a href="/auth?next=/cyberchess" style={{ color: "#5b7a00", fontWeight: 700 }}>Войти</a>
          </div>
        )}
      </div>
    );
  }

  if (!on) {
    return (
      <button
        onClick={() => setOn(true)}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(117,153,0,0.4)",
          background: "rgba(117,153,0,0.10)", color: "#5b7a00", fontWeight: 700,
          fontSize: 13, cursor: "pointer",
        }}
        title="Stockfish 17.1 с полной нейросетью — сила анализа уровня lichess. Загрузит ~75 МБ один раз."
      >
        🧠 Глубокий анализ (Stockfish 17.1 · NNUE)
      </button>
    );
  }

  const pct = Math.round(netFrac * 100);
  return (
    <div
      style={{
        padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(117,153,0,0.35)",
        background: "rgba(117,153,0,0.06)", fontSize: 13,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, color: "#5b7a00" }}>🧠 Глубокий анализ</span>
        <span style={{ color: "#7a7a7a", fontSize: 11 }}>{STATE_LABEL[state]}</span>
      </div>

      {state === "loading-nets" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 6, borderRadius: 3, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "#7a9a00", transition: "width .2s" }} />
          </div>
          <div style={{ marginTop: 4, color: "#7a7a7a", fontSize: 11 }}>
            Нейросеть {pct}% · грузится один раз, дальше из кэша
          </div>
        </div>
      )}

      {state === "error" && (
        <div style={{ marginTop: 6, color: "#b23", fontSize: 12 }}>
          {engRef.current?.error || "Не удалось запустить глубокий анализ."}
        </div>
      )}

      {state === "ready" && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "#16161a" }}>
            {scoreText(cp, mate)}
          </span>
          <span style={{ color: "#7a7a7a", fontSize: 11 }}>глубина {depth}</span>
        </div>
      )}
    </div>
  );
}
