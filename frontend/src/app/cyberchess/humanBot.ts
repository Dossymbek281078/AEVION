/* AEVION CyberChess — human-like move choice for the weak bots (<1200).

   Why this exists
   ───────────────
   Levels Beginner/Casual/Club (aiI 0..2) run the bundled minimax, not
   Stockfish. Their only "weakening" used to be uniform noise added to every
   move's evaluation (`rand` = 200/80/30 cp). That produces a bot that is
   wrong in exactly the way a human never is:

     • it plays a *slightly* inferior move on almost every turn, and
     • it practically never blunders outright (±100 cp of noise can't
       out-vote a hanging queen at −900), and
     • it opens the game with whatever random legal move wins the noise
       lottery — 1.a4 / 1.Nh3 — so the opening never resembles chess.

   A real 400–1200 player is the mirror image: normal opening moves, mostly
   reasonable middlegame moves, and then a genuine piece-dropping blunder
   every so often. That is also the *useful* opponent — you only learn to
   punish a hanging piece if the opponent actually hangs one.

   The model here is a three-way mixture, per move:
     1. book        — follow real opening theory while still in book
     2. best        — play the top minimax move
     3. otherwise   — softmax over candidates, with a `blunderChance` branch
                      that picks a genuinely losing move, biased toward the
                      moves a human is tempted by (captures, checks, queen
                      sorties, promotions) rather than a uniformly random one.

   Pure functions + injectable rng so the distribution is testable. */

import { Chess, type Move } from "chess.js";

export type HumanProfile = {
  /** Half-moves the bot is willing to stay in the opening book. */
  bookPlies: number;
  /** Chance of taking a book move when the position is still in book. */
  bookChance: number;
  /** Bias toward popular book lines: 0 = uniform, higher = mainline-only. */
  bookSharpness: number;
  /** Chance of simply playing the engine's top move. */
  bestChance: number;
  /** Softmax temperature in centipawns for the "reasonable but not best" pick. */
  temperature: number;
  /** Chance of an outright blunder (only when a real blunder is available). */
  blunderChance: number;
};

/* Indexed by ALS level index — only the minimax levels (Stockfish runs 3+).

   Temperatures are measured, not guessed: swept over 56 positions taken from
   real self-play walks, picking the value that lands each level on the blunder
   rate its rating band implies (~22% / ~11% / ~4.5% of moves losing >=200cp).

   The first pass used much hotter values (260/160/95) on the theory that a
   weak player is "vague". Measurement said otherwise: at those temperatures
   Beginner hung material on 37% of moves and opened 1.h4 — the softmax tail,
   not the blunder branch, was producing the weakness, which is the same
   uniformly-mediocre bot this file exists to replace. Cooling the tail costs
   almost nothing in soundness (loss when not blundering only moves 30cp->18cp)
   and hands the level's character back to blunderChance, where it belongs. */
export const HUMAN_PROFILES: Record<number, HumanProfile> = {
  /* Beginner ~400: barely knows theory, hangs material often.
     Температура поднята 40 -> 95 (2026-07-27). Была САМОЙ ХОЛОДНОЙ из трёх уровней, то
     есть вне ветки зевка Beginner выбирал ходы ТОЧНЕЕ, чем Casual с его 75: зевает вдвое
     чаще, а в остальное время играет аккуратнее — эффекты гасят друг друга. Замер это и
     показал: 40 партий Casual vs Beginner дали разрыв 191 Эло при заявленных 400,
     интервал 88..340, вердикт «отличается сверх шума». Club/Casual при этом в цель (382),
     поэтому трогается ТОЛЬКО нижний уровень.
     95 выбрано как монотонное продолжение ряда (слабее -> горячее: 95 / 75 / 65) и много
     ниже прежних 260, на которых Beginner вешал материал на 37% ходов и играл 1.h4.

     blunderChance 0.30 -> 0.24 (тот же день, после замера зевков): на горячей температуре
     прежние 0.30 давали 27.7% зевков при цели полосы ~22%. Замеры по blunderChance:
     0.22 -> 20.4%, 0.23 -> 20.1%, 0.25 -> 24.2%. Между 0.22 и 0.23 порядок нарушается —
     это разброс от набора позиций (~±2 пункта), поэтому точное попадание в 22% было бы
     ложной точностью; взята середина работающего диапазона.

     ПЕРЕМЕРЕНО той же командой (40 партий, BENCH_PAIRS=1-0):
       было  75% -> разрыв 191 Эло, интервал 88..340, «отличается сверх шума»
       стало 91% -> разрыв 407 Эло, интервал 292..692, «согласуется с заявленным»
     Ожидаемый счёт для разрыва 400 — ровно 91%, попали в него.

     ИТОГОВЫЙ замер для temperature 95 + blunderChance 0.24 (40 партий):
       счёт 86% -> разрыв 319 Эло, интервал 210..532, «согласуется с заявленным»
     Снижение blunderChance часть разрыва отдало (407 -> 319), но 400 остаётся ВНУТРИ
     интервала, а зевки вернулись в полосу. То есть оба критерия выполнены одновременно.
     ⚠️ Честно: точечная оценка 319 ниже заявленных 400. На 40 партиях интервал широкий и
     этого не различить; чтобы узнать, осталась ли компрессия, нужен прогон на 200 партиях
     (`BENCH_GAMES=200`, часы). Если он покажет, что 400 всё-таки вне интервала —
     поднимать blunderChance к 0.25 (там зевки 24.2%, ещё в полосе) и мерять снова.
     Менять эти числа только вместе с замером: правка без перемера здесь уже приводила к
     обратному от задуманного. */
  0: { bookPlies: 6,  bookChance: 0.80, bookSharpness: 0.4, bestChance: 0.20, temperature: 95, blunderChance: 0.24 },
  // Casual ~800: plays the first few book moves, blunders a few times a game.
  1: { bookPlies: 10, bookChance: 0.85, bookSharpness: 0.8, bestChance: 0.38, temperature: 75, blunderChance: 0.15 },
  // Club ~1200: solid opening, occasional tactical oversight.
  2: { bookPlies: 14, bookChance: 0.93, bookSharpness: 1.4, bestChance: 0.58, temperature: 65, blunderChance: 0.07 },
};

export type ScoredMove = {
  move: Move;
  /** Centipawn score from the side-to-move's perspective (higher = better). */
  score: number;
};

export type Rng = () => number;

/** Mate scores from the bundled minimax are ±1e5; treat anything huge as mate. */
const MATE_CP = 5e4;

/** Weighted pick; `weights` must be non-negative and sum > 0. */
function weightedPick<T>(items: T[], weights: number[], rng: Rng): T {
  let total = 0;
  for (const w of weights) total += w;
  if (!(total > 0)) return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/* ── Book ───────────────────────────────────────────────────────────────── */

export type BookOption = { uci: string; freq: number };

/** Pick a book continuation, weighted by popularity^sharpness. Null = play on. */
export function pickBookMove(
  options: BookOption[],
  ply: number,
  profile: HumanProfile,
  rng: Rng = Math.random,
): string | null {
  if (!options.length) return null;
  if (ply >= profile.bookPlies) return null;
  if (rng() >= profile.bookChance) return null;
  const weights = options.map((o) => Math.pow(Math.max(1, o.freq), profile.bookSharpness));
  return weightedPick(options, weights, rng).uci;
}

/* ── Human blunder attractiveness ───────────────────────────────────────── */

const PIECE_CP: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

/** How tempting a move looks to a weak player who hasn't checked the reply.
    Captures and checks dominate — that is what tunnel vision looks like. */
export function temptation(move: Move): number {
  let t = 1;
  if (move.captured) t += 2 + PIECE_CP[move.captured] / 300;
  if (move.san.includes("+")) t += 2;
  if (move.promotion) t += 3;
  // Beginners push the queen out early and chase things with it.
  if (move.piece === "q") t += 1;
  // Advancing into the opponent's half feels like "doing something".
  const rank = Number(move.to[1]);
  if (move.color === "w" ? rank >= 5 : rank <= 4) t += 0.5;
  return t;
}

/* ── Move choice ────────────────────────────────────────────────────────── */

/** Loss (in cp) that counts as "a real blunder" rather than an inaccuracy. */
const BLUNDER_CP = 200;

/**
 * Choose a move the way a sub-1200 human would: usually sound, occasionally
 * catastrophic — instead of uniformly mediocre on every single turn.
 */
export function pickHumanMove(
  scored: ScoredMove[],
  profile: HumanProfile,
  rng: Rng = Math.random,
): Move | null {
  if (!scored.length) return null;
  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (ranked.length === 1) return top.move;

  // A forced mate for us is loud enough that even a weak player usually sees
  // it; and being mated slowly by a bot that keeps missing M1 is just tedious.
  const mateInHand = top.score >= MATE_CP;
  if (mateInHand && rng() < 0.85) return top.move;

  if (rng() < profile.bestChance) return top.move;

  // Blunder branch: only fires when a genuinely losing move is on the board.
  // Walking into mate is excluded — that reads as broken, not as human.
  const blunders = ranked
    .slice(1)
    .filter((s) => top.score - s.score >= BLUNDER_CP && s.score > -MATE_CP);
  if (blunders.length && rng() < profile.blunderChance) {
    return weightedPick(blunders, blunders.map((s) => temptation(s.move)), rng).move;
  }

  // Otherwise: softmax over candidates. Near-equal moves are near-equally
  // likely; the worse a move is, the exponentially less likely it becomes.
  const weights = ranked.map((s) => Math.exp(-(top.score - s.score) / Math.max(1, profile.temperature)));
  return weightedPick(ranked, weights, rng).move;
}

/**
 * Score every legal move with the caller-supplied search, normalised so that
 * higher is always better for the side to move.
 */
export function scoreMoves(
  game: Chess,
  searchAfter: (position: Chess) => number,
): ScoredMove[] {
  const moves = game.moves({ verbose: true }) as Move[];
  const sign = game.turn() === "w" ? 1 : -1;
  return moves.map((move) => {
    game.move(move);
    const white = searchAfter(game);
    game.undo();
    return { move, score: sign * white };
  });
}
