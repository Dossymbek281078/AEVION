"use client";

import { useState } from "react";
import { COLOR as CC, RADIUS, MOTION, SPACE } from "./theme";
import { Spinner } from "./ui";

/* "What if?" Move Explorer — killer #2C
   Per-line button in Analysis multipv. Click → Coach explains in 1-2
   sentences why this candidate move is good/bad, using FEN + eval as
   ground truth. Cached per fen|san to avoid duplicate API calls. */

const BACKEND =
  process.env.NEXT_PUBLIC_COACH_BACKEND?.trim() ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4001"
    : "https://aevion-production-a70c.up.railway.app");

const cache = new Map<string, string>();

type Props = {
  fen: string;
  san: string;
  evalStr: string;
  rank: number;
  isBest: boolean;
};

export default function WhatIfButton({ fen, san, evalStr, rank, isBest }: Props) {
  const key = `${fen}|${san}`;
  const [text, setText] = useState<string | null>(cache.get(key) || null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(!!cache.get(key));

  const fetchExplanation = async () => {
    if (text) { setOpen(o => !o); return; }
    setOpen(true);
    setLoading(true);
    try {
      const sysPrompt = `Ты — шахматный тренер Алексей. Объясни ОДНИМ-ДВУМЯ короткими предложениями (макс 200 символов) почему ход хорош или плох. Конкретно: какая идея, какая угроза, что выигрывается/теряется. Без воды, без "интересно/любопытно". Цвет фигур учитывай по FEN.`;
      const userPrompt = `Позиция (FEN): ${fen}\nХод: ${san}\nОценка движка: ${evalStr}\nРанг по силе: ${rank} (${isBest ? "лучший" : "не лучший"})\n\nОбъясни кратко в чём идея этого хода (если лучший) или что в нём не так (если не лучший).`;
      const r = await fetch(`${BACKEND}/api/coach/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: sysPrompt,
          messages: [{ role: "user", content: userPrompt }],
          maxTokens: 150,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const reply: string = data.content?.filter((c: any) => c.type === "text" || c.text).map((c: any) => c.text || "").join("").trim() || "";
      const final = reply || "Нет объяснения";
      cache.set(key, final);
      setText(final);
    } catch (e: any) {
      setText(`⚠️ Ошибка: ${e?.message || "не удалось получить объяснение"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4, minWidth: 0, alignItems: "stretch" }}>
      <button
        onClick={fetchExplanation}
        title="Что если бы я сыграл этот ход? (Coach объяснит)"
        className="cc-focus-ring"
        style={{
          padding: "2px 7px", borderRadius: RADIUS.sm, fontSize: 10, fontWeight: 800,
          border: `1px solid ${CC.accent}`, background: open ? CC.accentSoft : "transparent",
          color: CC.accent, cursor: loading ? "wait" : "pointer", lineHeight: 1.4,
          display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0,
          transition: `all ${MOTION.fast} ${MOTION.ease}`,
        }}
        disabled={loading}
      >
        {loading ? <Spinner size={9} /> : <span style={{ fontSize: 10 }}>💬</span>}
        <span>{open && text ? "скрыть" : "что если?"}</span>
      </button>
      {open && text && (
        <div style={{
          fontSize: 11, lineHeight: 1.45, color: CC.text,
          padding: `${SPACE[1] + 2}px ${SPACE[2]}px`,
          background: "rgba(124,58,237,0.06)",
          border: `1px solid ${CC.accent}33`,
          borderRadius: RADIUS.sm,
          maxWidth: 360,
          animation: `cc-fade-in ${MOTION.fast} ${MOTION.ease}`,
        }}>{text}</div>
      )}
    </div>
  );
}
