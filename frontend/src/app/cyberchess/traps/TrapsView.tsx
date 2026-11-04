"use client";
// Доска ловушек: ходы листаются кнопками, текст — на языке страницы целиком.
// Один компонент на /cyberchess/traps, /en/cyberchess/traps и /kk/cyberchess/traps.
import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import Piece from "../Pieces";
import { GUIDE_PATHS as guidePaths } from "../guide/guide";
import { LOVUSHKI, type Lovushka, type Yazyk } from "./traps";
import { BuyCyberChessButton } from "../BuyCyberChessButton";

const UI: Record<Yazyk, Record<string, string>> = {
  ru: {
    h1: "10 шахматных ловушек в дебюте",
    lead: "Короткие ловушки, на которых попадаются в первых ходах. Листайте ходы на доске и читайте, где ошибка и как её избежать.",
    start: "В начало",
    prev: "Назад",
    next: "Вперёд",
    end: "В конец",
    move: "Ход",
    of: "из",
    mistake: "Здесь ошибка",
    play: "Сыграть с тренером",
    guide: "Как тренер разбирает ход",
  },
  en: {
    h1: "10 chess opening traps",
    lead: "Short traps that catch players in the first moves. Step through the moves on the board and read where the mistake is and how to avoid it.",
    start: "Start",
    prev: "Back",
    next: "Next",
    end: "End",
    move: "Move",
    of: "of",
    mistake: "The mistake",
    play: "Play with the coach",
    guide: "How the coach reviews a move",
  },
  kk: {
    h1: "Дебюттегі 10 шахмат тұзағы",
    lead: "Алғашқы жүрістерде түсетін қысқа тұзақтар. Тақтадағы жүрістерді парақтап, қате қайда екенін және одан қалай сақтануды оқыңыз.",
    start: "Басына",
    prev: "Артқа",
    next: "Алға",
    end: "Соңына",
    move: "Жүріс",
    of: "/",
    mistake: "Қате осында",
    play: "Жаттықтырушымен ойнау",
    guide: "Жаттықтырушы жүрісті қалай талдайды",
  },
};

const FILES = "abcdefgh";

/** Ссылка на игру: свой языковой адрес шахмат и метка канала. */
export function playHref(lang: Yazyk): string {
  const base = lang === "ru" ? "/cyberchess" : `/${lang}/cyberchess`;
  return `${base}?c=seo-traps`;
}

function Board({ fen, last }: { fen: string; last: { from: string; to: string } | null }) {
  const rows = useMemo(() => new Chess(fen).board(), [fen]);
  return (
    <div
      role="img"
      aria-label={fen}
      style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gridTemplateRows: "repeat(8, 1fr)", width: "100%", maxWidth: 360, aspectRatio: "1 / 1", border: "2px solid #3a3a40" }}
    >
      {rows.flatMap((row, r) =>
        row.map((sq, c) => {
          const name = FILES[c] + (8 - r);
          const light = (r + c) % 2 === 0;
          const hl = last && (last.from === name || last.to === name);
          return (
            <div
              key={name}
              style={{
                background: hl ? (light ? "#f3e27a" : "#c9b23f") : light ? "#efe6d2" : "#8b6f4e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {sq ? <Piece type={sq.type} color={sq.color} setOverride="cburnett" /> : null}
            </div>
          );
        }),
      )}
    </div>
  );
}

function Trap({ t, lang, n }: { t: Lovushka; lang: Yazyk; n: number }) {
  const ui = UI[lang];
  const [ply, setPly] = useState(t.moves.length);
  const { fen, last } = useMemo(() => {
    const c = new Chess();
    let lm: { from: string; to: string } | null = null;
    for (const s of t.moves.slice(0, ply)) {
      const m = c.move(s);
      lm = { from: m.from, to: m.to };
    }
    return { fen: c.fen(), last: lm };
  }, [t, ply]);
  const btn = { padding: "8px 12px", border: "1px solid #3a3a40", background: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 14 } as const;
  return (
    <section id={t.id} style={{ borderTop: "1px solid #ddd", padding: "28px 0" }}>
      <h2 style={{ fontSize: 22, margin: "0 0 12px" }}>
        {n}. {t.name[lang]}
      </h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 280px", maxWidth: 360 }}>
          <Board fen={fen} last={last} />
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" style={btn} onClick={() => setPly(0)} disabled={ply === 0}>⏮ {ui.start}</button>
            <button type="button" style={btn} onClick={() => setPly((p) => Math.max(0, p - 1))} disabled={ply === 0}>◀ {ui.prev}</button>
            <button type="button" style={btn} onClick={() => setPly((p) => Math.min(t.moves.length, p + 1))} disabled={ply === t.moves.length}>{ui.next} ▶</button>
            <button type="button" style={btn} onClick={() => setPly(t.moves.length)} disabled={ply === t.moves.length}>{ui.end} ⏭</button>
          </div>
          <div style={{ fontSize: 13, color: "#5d5f66", marginTop: 6 }} data-ply={ply}>
            {ui.move} {ply} {ui.of} {t.moves.length}
          </div>
        </div>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, lineHeight: 1.7, margin: "0 0 12px", wordBreak: "break-word" }}>
            {t.moves.map((s, i) => (
              <span key={i}>
                {i % 2 === 0 ? `${i / 2 + 1}.` : ""}
                <button
                  type="button"
                  onClick={() => setPly(i + 1)}
                  title={i === t.oshibka ? ui.mistake : undefined}
                  style={{
                    border: "none",
                    background: i + 1 === ply ? "#16161a" : "transparent",
                    color: i + 1 === ply ? "#fff" : i === t.oshibka ? "#b3261e" : "inherit",
                    fontWeight: i === t.oshibka ? 700 : 400,
                    padding: "0 3px",
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  {s}
                  {i === t.oshibka ? "??" : ""}
                </button>{" "}
              </span>
            ))}
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.55, margin: "0 0 16px" }}>{t.about[lang]}</p>
          <a
            href={playHref(lang)}
            style={{ display: "inline-block", padding: "10px 16px", background: "#a9781a", color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}
          >
            {ui.play} →
          </a>
        </div>
      </div>
    </section>
  );
}

/** Ссылка на страницу о тренере того же языка (31.10.2026). */
const guidePath = (lang: Yazyk): string => guidePaths[lang];

export default function TrapsView({ yazyk: lang }: { yazyk: Yazyk }) {
  const ui = UI[lang];
  return (
    <main lang={lang} style={{ background: "#f7f6f2", color: "#16161a", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px 64px", boxSizing: "border-box" }}>
        <h1 style={{ fontSize: "clamp(26px, 6vw, 38px)", margin: "0 0 12px" }}>{ui.h1}</h1>
        <p style={{ fontSize: 17, lineHeight: 1.55, color: "#3d3f46", margin: "0 0 16px" }}>{ui.lead}</p>
        {/* 4.11: касса в одно нажатие прямо на первом экране (задача Оркестратора). */}
        <p style={{ margin: "0 0 20px" }}>
          <BuyCyberChessButton lang={lang} source="traps" fallbackChannel="seo-traps" />
        </p>
        <ol style={{ columns: "2 200px", margin: "0 0 12px", paddingLeft: 20, lineHeight: 1.8 }}>
          {LOVUSHKI.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} style={{ color: "#16161a" }}>{t.name[lang]}</a>
            </li>
          ))}
        </ol>
        <p style={{ margin: "0 0 12px" }}>
          <a href={guidePath(lang)} data-testid="traps-guide" style={{ color: "#7a5410", fontWeight: 700 }}>{ui.guide} →</a>
        </p>
        {LOVUSHKI.map((t, i) => (
          <Trap key={t.id} t={t} lang={lang} n={i + 1} />
        ))}
      </div>
    </main>
  );
}
