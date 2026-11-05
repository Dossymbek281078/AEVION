"use client";
import { useEffect, useRef, useState } from "react";
import { DeepEngine, type DeepEngineState } from "./deepEngine";
import { checkAppAccess, type AppAccess } from "@/lib/appAccess";
import { CyberChessPaidList } from "./CyberChessPaidList";
import { keepChannel, PRICING_APP } from "@/lib/products";
import { channelNow } from "@/lib/channelNow";
import { useСсылкаВхода } from "../auth/loginHref";
import { useCcI18n } from "./i18n";

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

const STATE_KEY: Record<DeepEngineState, string> = {
  idle: "",
  "loading-engine": "cpn.deep.st.engine",
  "loading-nets": "cpn.deep.st.nets",
  ready: "cpn.deep.st.ready",
  error: "cpn.deep.st.error",
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
  const cc = useCcI18n();
  const loginHref = useСсылкаВхода("/cyberchess"); // с меткой канала, как /bureau
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
        {cc.t("cpn.deep.checking")}
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
        {/* 🔴 28.09.2026: раньше здесь стояло «в CyberChess Pro». С 15.09 «Pro» —
            это СТУПЕНЬ СРОКА (6 месяцев), а не состав: любая платная ступень,
            включая самую дешёвую месячную, открывает модуль целиком
            (isModuleEntitled на бэкенде). То есть надпись называла человеку
            ступень дороже нужной — потеря ровно в ту сторону, в которую её не
            видно: покупку не сделали, а отказ никуда не записался. */}
        {/* 07.10: «недоступен» — сетей /nnue не было (404). 4.11: сети на проде есть (200, 75 МБ),
            состав ниже — только подтверждённое гейтами page.tsx (сторож deepAnalysisLockNamesPaidFeatures). */}
        <div style={{ fontWeight: 800, color: "#5b7a00" }}>{cc.t("cpn.deep.lock")}</div>
        <div style={{ marginTop: 6, color: "#4a4a4a", lineHeight: 1.5 }}>
          {cc.t("cpn.deep.body")}
        </div>
        <div style={{ marginTop: 8 }}><CyberChessPaidList lang={cc.locale} /></div>
        <a
          // Метка канала переживает переход: человек пришёл с ролика или
          // рекламы, и если она теряется здесь, покупка Pro запишется в
          // direct — а именно этот переход мы и хотим считать (сторож
          // channelSurvivesInternalLinks поймал потерю сразу).
          href={keepChannel(PRICING_APP("cyberchess"), channelNow())}
          style={{
            display: "inline-block", marginTop: 10, padding: "8px 14px", borderRadius: 8,
            background: "#5b7a00", color: "#fff", fontWeight: 700, textDecoration: "none",
          }}
        >
          {cc.t("cpn.deep.open")}
        </a>
        {access === "unknown" && (
          <div style={{ marginTop: 8, color: "#7a7a7a", fontSize: 12 }}>
            {cc.t("cpn.deep.paid")} <a href={loginHref} style={{ color: "#5b7a00", fontWeight: 700 }}>{cc.t("cpn.deep.signin")}</a>
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
        title={cc.t("cpn.deep.btnTitle")}
      >
        {cc.t("cpn.deep.btn")}
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
        <span style={{ fontWeight: 700, color: "#5b7a00" }}>{cc.t("cpn.deep.head")}</span>
        <span style={{ color: "#7a7a7a", fontSize: 11 }}>{STATE_KEY[state] ? cc.t(STATE_KEY[state]) : ""}</span>
      </div>

      {state === "loading-nets" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 6, borderRadius: 3, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "#7a9a00", transition: "width .2s" }} />
          </div>
          <div style={{ marginTop: 4, color: "#7a7a7a", fontSize: 11 }}>
            {cc.t("cpn.deep.netPct").replace("{n}", String(pct))}
          </div>
        </div>
      )}

      {state === "error" && (
        <div style={{ marginTop: 6, color: "#b23", fontSize: 12 }}>
          {(cc.locale === "ru" && engRef.current?.error) || cc.t("cpn.deep.err")}
        </div>
      )}

      {state === "ready" && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "#16161a" }}>
            {scoreText(cp, mate)}
          </span>
          <span style={{ color: "#7a7a7a", fontSize: 11 }}>{cc.t("cpn.deep.depth").replace("{n}", String(depth))}</span>
        </div>
      )}
    </div>
  );
}
