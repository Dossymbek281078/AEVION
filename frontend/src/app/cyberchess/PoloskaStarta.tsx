"use client";
import type { CSSProperties } from "react";

/**
 * Полоска «С чего начать» над доской — вместо блокирующего окна.
 *
 * Решение оркестратора 13.10.2026 по замеру bd: гостя на /cyberchess без
 * ?puzzle= встречало модальное окно и перехватывало клики (по доске, по
 * «Задаче дня»), пока его не закроешь. Содержимое то же — четыре входа и
 * крестик, — но НЕ модально: доска и кнопки под полоской нажимаются сразу,
 * фокус не запирается, фона-затемнения нет. Показ один раз (ключ прежний,
 * ONBOARDING_KEY) — это решает страница, полоска только зовёт обработчики.
 *
 * Подписи — из словаря шахмат (ru/en/kk), новых ключей не заведено.
 */
export type NamerenieStarta = "play" | "learn" | "puzzles";

export type PoloskaStartaProps = {
  t: (key: string) => string;
  /** Есть только когда задача дня уже загружена — иначе кнопки нет (отказ не прячем за пустой доской). */
  onDaily?: () => void;
  onIntent: (intent: NamerenieStarta) => void;
  onClose: () => void;
  /** Ширина доски — полоска выравнивается по ней. */
  width?: number | string;
  mode?: "light" | "dark";
};

const КНОПКА: CSSProperties = {
  border: "1px solid rgba(99,102,241,0.35)",
  background: "#fff",
  color: "#1e1b4b",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.2,
  cursor: "pointer",
  minHeight: 36,
};

export default function PoloskaStarta({ t, onDaily, onIntent, onClose, width, mode = "light" }: PoloskaStartaProps) {
  const тёмная = mode === "dark";
  return (
    <div
      role="region"
      aria-label={t("start.title")}
      data-cc-poloska-starta="1"
      style={{
        width,
        maxWidth: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        // По центру колонки, как и превью доски под ней: на 1463×724 полоска стояла у левого
        // края колонки (x=134), а превью — по центру (x=567); замер 13.10.2026.
        marginLeft: "auto",
        marginRight: "auto",
        marginBottom: 8,
        borderRadius: 12,
        border: `1px solid ${тёмная ? "rgba(165,180,252,0.35)" : "#c7d2fe"}`,
        background: тёмная ? "rgba(30,27,75,0.85)" : "linear-gradient(135deg,#eef2ff,#f5f3ff)",
        color: тёмная ? "#e0e7ff" : "#1e1b4b",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 14, marginRight: 4 }}>{t("start.title")}</div>
      {onDaily && (
        <button type="button" className="cc-touch" style={КНОПКА} onClick={onDaily} data-cc-start="daily">
          ☀ {t("start.daily.title")}
        </button>
      )}
      <button type="button" className="cc-touch" style={КНОПКА} onClick={() => onIntent("play")} data-cc-start="play">
        ▶ {t("start.game.title")}
      </button>
      <button type="button" className="cc-touch" style={КНОПКА} onClick={() => onIntent("puzzles")} data-cc-start="puzzles">
        ♟ {t("start.puzzle.title")}
      </button>
      <button type="button" className="cc-touch" style={КНОПКА} onClick={() => onIntent("learn")} data-cc-start="learn">
        🎓 {t("start.coach.title")}
      </button>
      <button
        type="button"
        className="cc-touch"
        aria-label={t("common.close")}
        onClick={onClose}
        data-cc-start="close"
        style={{ ...КНОПКА, marginLeft: "auto", padding: "6px 10px", fontSize: 16, fontWeight: 900 }}
      >
        ×
      </button>
    </div>
  );
}
