"use client";

/**
 * Доска на первом экране.
 *
 * До 27.08.2026 человек, открывший шахматы, доски не видел вовсе: экран
 * начинался с панели настроек партии (скорость, время, цвет, уровень ИИ,
 * премувы), а доска появлялась только после нажатия «ИГРАТЬ». Замер на
 * телефоне 375 пикселей: ни на первом экране, ни на втором ни одной
 * шахматной клетки — треть занимала шапка, дальше цели и форма.
 *
 * Для человека, пришедшего с ролика, это решается за секунды: он пришёл
 * играть в шахматы, а видит панель управления.
 *
 * Компонент показывает начальную расстановку в той же теме и тем же набором
 * фигур, что и настоящая доска, и разворачивается по выбранному цвету. Он
 * НЕ интерактивный: нажатие на него начинает партию — то есть доска работает
 * ещё и как большая понятная кнопка.
 */
import React from "react";
import Piece from "./Pieces";

type PieceT = "p" | "n" | "b" | "r" | "q" | "k";
type Cell = { t: PieceT; c: "w" | "b" } | null;

/** Начальная расстановка, сверху вниз с точки зрения белых. */
const START: Cell[][] = (() => {
  const back: PieceT[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const pawns: PieceT[] = new Array(8).fill("p") as PieceT[];
  const row = (c: "w" | "b", types: PieceT[]): Cell[] => types.map((t) => ({ t, c }));
  const empty = (): Cell[] => new Array(8).fill(null) as Cell[];
  return [
    row("b", back),
    row("b", pawns),
    empty(),
    empty(),
    empty(),
    empty(),
    row("w", pawns),
    row("w", back),
  ];
})();

export type SetupBoardPreviewProps = {
  /** Цвет, которым человек собирается играть: снизу будет его сторона. */
  orientation: "w" | "b";
  light: string;
  dark: string;
  border: string;
  /** Нажатие по доске — начать партию. */
  onStart: () => void;
  /** Максимальная сторона доски в пикселях. */
  maxPx?: number;
  label?: string;
};

export default function SetupBoardPreview({
  orientation,
  light,
  dark,
  border,
  onStart,
  maxPx = 420,
  label = "Начать партию",
}: SetupBoardPreviewProps) {
  // Чёрными играем — разворачиваем и ряды, и столбцы: своя сторона снизу.
  const rows = orientation === "b" ? [...START].reverse().map((r) => [...r].reverse()) : START;

  return (
    <button
      type="button"
      onClick={onStart}
      aria-label={label}
      title={label}
      style={{
        display: "block",
        width: "100%",
        maxWidth: maxPx,
        // Родитель — flex-колонка с прокруткой, и без запрета на сжатие доска
        // схлопывается в полоску: замер на живой странице дал ВЫСОТУ 3 ПИКСЕЛЯ
        // при ширине 340. Все 64 клетки были на месте — просто раздавлены.
        // Тесты этого не видят: в jsdom вёрстка не считается, aspect-ratio там
        // ничего не делает, и проверки «64 клетки, 32 фигуры» проходят на
        // невидимой доске. Ловится только глазами на живой странице.
        flexShrink: 0,
        // Высота задаётся явно, а не только пропорцией: так доска остаётся
        // квадратной даже там, где родитель навязывает свою высоту.
        height: "auto",
        aspectRatio: "1",
        margin: "0 auto",
        padding: 0,
        border: `2px solid ${border}`,
        borderRadius: 10,
        overflow: "hidden",
        cursor: "pointer",
        background: "transparent",
        lineHeight: 0,
        boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(8,1fr)",
          aspectRatio: "1",
          width: "100%",
        }}
      >
        {rows.flatMap((row, r) =>
          row.map((cell, f) => (
            <div
              key={`${r}-${f}`}
              style={{
                background: (r + f) % 2 === 0 ? light : dark,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                aspectRatio: "1",
              }}
            >
              {cell ? <Piece type={cell.t} color={cell.c} size="86%" /> : null}
            </div>
          )),
        )}
      </div>
    </button>
  );
}
