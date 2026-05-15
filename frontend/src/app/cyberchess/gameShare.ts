/* Game Share — генерирует SVG с финальной позицией + статистикой партии.
   Используется при game-over для шеринга в соцсетях / сохранения. */

import { Chess } from "chess.js";

const PIECE_UNICODE: Record<string, string> = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};

export type ShareOpts = {
  fen: string;
  result: string;          // "Checkmate! You win!" etc
  isWin: boolean;
  isDraw: boolean;
  white: { name: string; rating: number };
  black: { name: string; rating: number };
  accuracy?: { white: number; black: number };
  ratingDelta?: number;
  opening?: string;
  moves: number;
  flip: boolean;           // is the board flipped (player is black)
};

const W = 1200;
const H = 1500;
const BOARD = 920;

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function generateShareSVG(opts: ShareOpts): string {
  const { fen, result, isWin, isDraw, white, black, accuracy, ratingDelta, opening, moves, flip } = opts;

  // Parse position from FEN
  let board: ({ color: "w" | "b"; type: string } | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  try {
    const g = new Chess(fen);
    const b = g.board(); // [rank=8 down to 1][file=a..h]
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = b[r][c]; if (p) board[r][c] = { color: p.color, type: p.type };
    }
  } catch {}

  const sq = BOARD / 8;
  const boardX = (W - BOARD) / 2;
  const boardY = 320;

  // Hero color & label
  const heroColor = isWin ? "#10b981" : isDraw ? "#d97706" : "#dc2626";
  const heroEmoji = isWin ? "🏆" : isDraw ? "🤝" : "⚔";
  const resultLabel = isWin ? "ПОБЕДА" : isDraw ? "НИЧЬЯ" : "ПОРАЖЕНИЕ";

  // Build squares
  const squareRects: string[] = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const dispR = flip ? 7 - r : r;
    const dispC = flip ? 7 - c : c;
    const isLight = (dispR + dispC) % 2 === 0;
    squareRects.push(
      `<rect x="${boardX + dispC * sq}" y="${boardY + dispR * sq}" width="${sq}" height="${sq}" fill="${isLight ? "#f0d9b5" : "#b58863"}"/>`
    );
  }

  // Build pieces
  const piecesEls: string[] = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c]; if (!p) continue;
    const ch = PIECE_UNICODE[p.color + p.type];
    if (!ch) continue;
    const dispR = flip ? 7 - r : r;
    const dispC = flip ? 7 - c : c;
    const cx = boardX + dispC * sq + sq / 2;
    const cy = boardY + dispR * sq + sq * 0.82;
    const fill = p.color === "w" ? "#ffffff" : "#1a1a1a";
    const stroke = p.color === "w" ? "#1a1a1a" : "#ffffff";
    piecesEls.push(
      `<text x="${cx}" y="${cy}" font-size="${sq * 0.86}" text-anchor="middle" font-family="'Segoe UI Symbol', 'Apple Color Emoji', serif" fill="${fill}" stroke="${stroke}" stroke-width="1.5" paint-order="stroke">${ch}</text>`
    );
  }

  // Coordinates a..h and 1..8
  const coords: string[] = [];
  const files = "abcdefgh";
  for (let i = 0; i < 8; i++) {
    const f = flip ? files[7 - i] : files[i];
    coords.push(`<text x="${boardX + i * sq + sq / 2}" y="${boardY + BOARD + 30}" font-size="22" text-anchor="middle" fill="#94a3b8" font-family="ui-monospace, monospace">${f}</text>`);
    const rk = flip ? i + 1 : 8 - i;
    coords.push(`<text x="${boardX - 15}" y="${boardY + i * sq + sq / 2 + 8}" font-size="22" text-anchor="end" fill="#94a3b8" font-family="ui-monospace, monospace">${rk}</text>`);
  }

  // Footer stats
  const accLine = accuracy
    ? `Accuracy ⚪ ${accuracy.white}% · ⚫ ${accuracy.black}%`
    : `${moves} ходов`;

  const ratingDeltaLine = ratingDelta && ratingDelta !== 0
    ? `<text x="${W / 2}" y="${H - 50}" text-anchor="middle" font-size="28" fill="${ratingDelta > 0 ? "#10b981" : "#dc2626"}" font-weight="900">Rating ${ratingDelta > 0 ? "+" : ""}${ratingDelta}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <!-- background -->
  <defs>
    <linearGradient id="bgG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0e1014"/>
      <stop offset="100%" stop-color="#1a1d24"/>
    </linearGradient>
    <linearGradient id="brandG" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#059669"/>
      <stop offset="55%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bgG)"/>

  <!-- header brand -->
  <text x="${W / 2}" y="80" text-anchor="middle" font-size="46" fill="url(#brandG)" font-weight="900" font-family="system-ui, -apple-system, sans-serif" letter-spacing="3">AEVION CYBERCHESS</text>
  <text x="${W / 2}" y="115" text-anchor="middle" font-size="20" fill="#94a3b8" font-family="system-ui, sans-serif" letter-spacing="2">aevion.app · AI-powered chess</text>

  <!-- result hero -->
  <text x="${W / 2}" y="220" text-anchor="middle" font-size="100" font-family="serif">${heroEmoji}</text>
  <text x="${W / 2}" y="290" text-anchor="middle" font-size="50" fill="${heroColor}" font-weight="900" font-family="system-ui, sans-serif" letter-spacing="6">${resultLabel}</text>

  <!-- top player (Black if we're white) -->
  <text x="${W / 2}" y="${boardY - 18}" text-anchor="middle" font-size="22" fill="#e5e7eb" font-weight="700">⚫ ${escapeXml(black.name)} (${black.rating})</text>

  <!-- board -->
  ${squareRects.join("\n  ")}
  <rect x="${boardX - 2}" y="${boardY - 2}" width="${BOARD + 4}" height="${BOARD + 4}" fill="none" stroke="#334155" stroke-width="3"/>
  ${piecesEls.join("\n  ")}
  ${coords.join("\n  ")}

  <!-- bottom player -->
  <text x="${W / 2}" y="${boardY + BOARD + 75}" text-anchor="middle" font-size="22" fill="#e5e7eb" font-weight="700">⚪ ${escapeXml(white.name)} (${white.rating})</text>

  <!-- result text + opening -->
  <text x="${W / 2}" y="${boardY + BOARD + 130}" text-anchor="middle" font-size="20" fill="#cbd5e1" font-style="italic">${escapeXml(result)}</text>
  ${opening ? `<text x="${W / 2}" y="${boardY + BOARD + 165}" text-anchor="middle" font-size="18" fill="#94a3b8">${escapeXml(opening)}</text>` : ""}

  <!-- stats line -->
  <text x="${W / 2}" y="${H - 90}" text-anchor="middle" font-size="22" fill="#a78bfa" font-weight="800">${escapeXml(accLine)}</text>
  ${ratingDeltaLine}
</svg>`;
}

/** Convert SVG string to PNG blob via canvas (browser-only). */
export async function svgToPngBlob(svg: string, scale = 1): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("no ctx")); return; }
      ctx.drawImage(img, 0, 0, W * scale, H * scale);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => { if (b) resolve(b); else reject(new Error("toBlob failed")); }, "image/png");
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
