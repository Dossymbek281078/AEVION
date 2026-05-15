// Auto-Reels Generator — PGN → 15-сек вертикальное видео (1080x1920).
// Canvas с интро → ускоренная партия → highlight 3 ключевых хода с приставками.
// Захват через MediaRecorder в WebM (поддержка нативная во всех браузерах кроме Safari).

import { Chess, type Square } from "chess.js";

const W = 1080;
const H = 1920;
const BOARD_PAD = 60;
const BOARD_SIZE = W - BOARD_PAD * 2; // 960
const BOARD_TOP = (H - BOARD_SIZE) / 2; // ~480
const SQ = BOARD_SIZE / 8; // 120

const PIECE_GLYPH: Record<string, string> = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};

export type ReelOptions = {
  white?: string;
  black?: string;
  result?: string;
  highlightMoves?: number[]; // ply indices (0-based) to add 1.5s pause+badge for
  fps?: number;
  // Speed: ms per move during fast playback
  msPerMove?: number;
  // Outro card duration ms
  outroMs?: number;
  // Intro card duration ms
  introMs?: number;
  // Optional captions per ply (e.g. "BLUNDER!", "BRILLIANT!")
  captions?: Record<number, string>;
};

function drawBoardBg(ctx: CanvasRenderingContext2D, light: string, dark: string) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const isLight = (r + c) % 2 === 0;
      ctx.fillStyle = isLight ? light : dark;
      ctx.fillRect(BOARD_PAD + c * SQ, BOARD_TOP + r * SQ, SQ, SQ);
    }
  }
  // Border
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 8;
  ctx.strokeRect(BOARD_PAD, BOARD_TOP, BOARD_SIZE, BOARD_SIZE);
}

function drawPieces(ctx: CanvasRenderingContext2D, ch: Chess) {
  ctx.font = `${SQ * 0.85}px "Segoe UI Symbol", "Apple Symbols", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const board = ch.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const x = BOARD_PAD + c * SQ + SQ / 2;
      const y = BOARD_TOP + r * SQ + SQ / 2 + 4;
      ctx.fillStyle = p.color === "w" ? "#ffffff" : "#0f172a";
      ctx.strokeStyle = p.color === "w" ? "#0f172a" : "#ffffff";
      ctx.lineWidth = 4;
      const glyph = PIECE_GLYPH[`${p.color}${p.type}`] || "?";
      ctx.strokeText(glyph, x, y);
      ctx.fillText(glyph, x, y);
    }
  }
}

function highlightSquares(ctx: CanvasRenderingContext2D, from: Square | null, to: Square | null, color: string) {
  if (!from || !to) return;
  const sqXY = (sq: Square) => {
    const f = sq.charCodeAt(0) - 97;
    const r = 8 - parseInt(sq[1]);
    return { x: BOARD_PAD + f * SQ, y: BOARD_TOP + r * SQ };
  };
  ctx.fillStyle = color;
  for (const sq of [from, to]) {
    const { x, y } = sqXY(sq);
    ctx.fillRect(x, y, SQ, SQ);
  }
}

function drawHeader(ctx: CanvasRenderingContext2D, white: string, black: string, plyIdx: number, totalPly: number) {
  // Top header band
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, W, BOARD_TOP);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 56px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("⚫ " + (black || "Black").slice(0, 24), 60, 80);
  ctx.fillStyle = "#fbbf24";
  ctx.font = "32px system-ui, -apple-system, sans-serif";
  ctx.fillText("AEVION CyberChess", 60, 160);
  // Move counter at right
  ctx.fillStyle = "#fff";
  ctx.font = "bold 48px system-ui";
  ctx.textAlign = "right";
  ctx.fillText(`${plyIdx}/${totalPly}`, W - 60, 80);
  // Bottom band
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, BOARD_TOP + BOARD_SIZE, W, H - (BOARD_TOP + BOARD_SIZE));
  ctx.fillStyle = "#fff";
  ctx.font = "bold 56px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText("⚪ " + (white || "White").slice(0, 24), 60, H - 60);
}

function drawCaption(ctx: CanvasRenderingContext2D, text: string, color: string) {
  if (!text) return;
  ctx.font = "bold 96px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(text).width;
  const padX = 40;
  const boxW = tw + padX * 2;
  const boxH = 140;
  const x = W / 2 - boxW / 2;
  const y = H / 2 - boxH / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  // Rounded rect (manual since roundRect not always available)
  const r = 24;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + boxW, y, x + boxW, y + boxH, r);
  ctx.arcTo(x + boxW, y + boxH, x, y + boxH, r);
  ctx.arcTo(x, y + boxH, x, y, r);
  ctx.arcTo(x, y, x + boxW, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(text, W / 2, H / 2);
}

function drawIntro(ctx: CanvasRenderingContext2D, white: string, black: string, t: number /* 0..1 */) {
  // Black bg
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, W, H);
  // Logo
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 84px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fadeIn = Math.min(1, t * 2);
  ctx.globalAlpha = fadeIn;
  ctx.fillText("AEVION", W / 2, H / 2 - 200);
  ctx.fillStyle = "#fff";
  ctx.font = "48px system-ui";
  ctx.fillText("CyberChess", W / 2, H / 2 - 120);
  ctx.font = "bold 60px system-ui";
  ctx.fillText(`⚪ ${white.slice(0, 20)}`, W / 2, H / 2);
  ctx.fillText("vs", W / 2, H / 2 + 80);
  ctx.fillText(`⚫ ${black.slice(0, 20)}`, W / 2, H / 2 + 160);
  ctx.globalAlpha = 1;
}

function drawOutro(ctx: CanvasRenderingContext2D, ch: Chess, white: string, black: string, result: string) {
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 84px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(result, W / 2, H / 2 - 280);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 60px system-ui";
  ctx.fillText(`⚪ ${white.slice(0, 20)}`, W / 2, H / 2 - 160);
  ctx.fillText(`⚫ ${black.slice(0, 20)}`, W / 2, H / 2 - 80);
  // Mini final position
  const miniSize = 600;
  const miniSq = miniSize / 8;
  const miniX = (W - miniSize) / 2;
  const miniY = H / 2 - 20;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? "#f0d9b5" : "#b58863";
      ctx.fillRect(miniX + c * miniSq, miniY + r * miniSq, miniSq, miniSq);
    }
  }
  ctx.font = `${miniSq * 0.8}px "Segoe UI Symbol", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const board = ch.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      ctx.fillStyle = p.color === "w" ? "#fff" : "#000";
      ctx.fillText(PIECE_GLYPH[`${p.color}${p.type}`] || "?", miniX + c * miniSq + miniSq / 2, miniY + r * miniSq + miniSq / 2);
    }
  }
  ctx.fillStyle = "#fbbf24";
  ctx.font = "32px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("aevion.app/cyberchess", W / 2, H - 100);
}

// Render moves into a hidden canvas, capture via MediaRecorder, return Blob
export async function generateReel(moves: string[], opts: ReelOptions = {}): Promise<Blob> {
  const fps = opts.fps ?? 30;
  const msPerMove = opts.msPerMove ?? 350;
  const introMs = opts.introMs ?? 1500;
  const outroMs = opts.outroMs ?? 2500;
  const highlights = new Set(opts.highlightMoves ?? []);
  const captions = opts.captions ?? {};
  const white = opts.white || "White";
  const black = opts.black || "Black";
  const result = opts.result || "*";

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not available");

  // Pre-validate all moves and pre-build positions
  const positions: { fen: string; from: Square | null; to: Square | null; san: string }[] = [];
  const ch = new Chess();
  positions.push({ fen: ch.fen(), from: null, to: null, san: "" });
  for (const san of moves) {
    let mv;
    try { mv = ch.move(san) } catch { break }
    if (!mv) break;
    positions.push({ fen: ch.fen(), from: mv.from as Square, to: mv.to as Square, san: mv.san });
  }
  const finalCh = new Chess(positions[positions.length - 1].fen);

  // Stream from canvas
  const stream = (canvas as any).captureStream(fps) as MediaStream;
  // Pick supported mime
  const mimes = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  let mime = "";
  for (const m of mimes) { if ((window as any).MediaRecorder?.isTypeSupported?.(m)) { mime = m; break } }
  if (!mime) throw new Error("MediaRecorder WebM not supported in this browser");

  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) };
  const stopped = new Promise<void>(res => { recorder.onstop = () => res() });
  recorder.start(200); // request data every 200ms

  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
  const totalPly = positions.length - 1;

  // Intro
  const introFrames = Math.round((introMs / 1000) * fps);
  for (let f = 0; f < introFrames; f++) {
    drawIntro(ctx, white, black, f / introFrames);
    await sleep(1000 / fps);
  }

  // Playback frames
  for (let i = 1; i < positions.length; i++) {
    const pos = positions[i];
    const isHighlight = highlights.has(i - 1);
    const dur = isHighlight ? msPerMove * 4 : msPerMove;
    const frames = Math.max(1, Math.round((dur / 1000) * fps));
    const tmp = new Chess(pos.fen);
    const caption = captions[i - 1] || "";
    for (let f = 0; f < frames; f++) {
      // Fill bg
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, W, H);
      drawHeader(ctx, white, black, i, totalPly);
      drawBoardBg(ctx, "#f0d9b5", "#b58863");
      // Highlight last move
      const flashAlpha = isHighlight ? (0.5 + 0.3 * Math.sin(f / frames * Math.PI * 4)) : 0.45;
      highlightSquares(ctx, pos.from, pos.to, `rgba(245, 158, 11, ${flashAlpha})`);
      drawPieces(ctx, tmp);
      // SAN badge
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(60, BOARD_TOP + BOARD_SIZE + 80, W - 120, 90);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 56px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${Math.floor((i + 1) / 2)}${i % 2 ? "." : "..."} ${pos.san}`, W / 2, BOARD_TOP + BOARD_SIZE + 125);
      if (isHighlight && caption) {
        const captionColor = caption.toLowerCase().includes("blunder") ? "#dc2626"
                          : caption.toLowerCase().includes("brilliant") ? "#9333ea"
                          : caption.toLowerCase().includes("best") ? "#059669"
                          : "#0ea5e9";
        drawCaption(ctx, caption, captionColor);
      }
      await sleep(1000 / fps);
    }
  }

  // Outro
  const outroFrames = Math.round((outroMs / 1000) * fps);
  for (let f = 0; f < outroFrames; f++) {
    drawOutro(ctx, finalCh, white, black, result);
    await sleep(1000 / fps);
  }

  recorder.stop();
  await stopped;
  return new Blob(chunks, { type: "video/webm" });
}

// Estimate reel duration in seconds for given options (used to show user before render)
export function estimateReelSeconds(moveCount: number, opts: ReelOptions = {}): number {
  const intro = (opts.introMs ?? 1500) / 1000;
  const outro = (opts.outroMs ?? 2500) / 1000;
  const msPerMove = opts.msPerMove ?? 350;
  const highlights = (opts.highlightMoves ?? []).length;
  const playback = (moveCount * msPerMove + highlights * msPerMove * 3) / 1000;
  return intro + playback + outro;
}

// Pick 3 most "interesting" moves: captures of high-value pieces, checkmate, stalemate.
// Falls back to sample at 25%/50%/75% of game.
export function pickHighlights(moves: string[]): { highlights: number[]; captions: Record<number, string> } {
  const ch = new Chess();
  const cands: { idx: number; score: number; cap: string }[] = [];
  for (let i = 0; i < moves.length; i++) {
    let mv;
    try { mv = ch.move(moves[i]) } catch { break }
    if (!mv) break;
    let score = 0;
    let cap = "";
    if (mv.captured) {
      const v = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }[mv.captured] || 0;
      score += v * 4;
      if (v >= 5) cap = `${mv.san} 💥`;
    }
    if (mv.san.includes("#")) { score += 100; cap = "CHECKMATE!" }
    else if (mv.san.includes("+")) score += 2;
    if (mv.flags.includes("k") || mv.flags.includes("q")) { score += 1 }
    if (mv.flags.includes("p")) { score += 5; cap = `${mv.san} = PROMOTION!` }
    cands.push({ idx: i, score, cap });
  }
  cands.sort((a, b) => b.score - a.score);
  const highlights = cands.slice(0, 3).map(c => c.idx).sort((a, b) => a - b);
  const captions: Record<number, string> = {};
  for (const c of cands.slice(0, 3)) {
    if (c.cap) captions[c.idx] = c.cap;
  }
  return { highlights, captions };
}
