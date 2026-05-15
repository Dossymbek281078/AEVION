// CyberChess tournament results + upcoming events.
// TODO backend (aevion-backend-modules / CyberChess session):
//   1. GET /api/cyberchess/results?accountId=... → TournamentResult[]
//   2. GET /api/cyberchess/upcoming → UpcomingTournament[]
//   3. Webhook: tournament.finalized event → qtrade transfer (prize) to winner's account.
// Until those ship, we synthesise deterministic mock per accountId.

import { pick, seeded } from "./random";

export type ChessFormat = "bullet" | "blitz" | "rapid" | "classical" | "swiss";

export type TournamentResult = {
  id: string;
  name: string;
  format: ChessFormat;
  finishedAt: string;
  place: number;
  totalPlayers: number;
  prize: number;
  ratingDelta: number;
  ratingAfter: number;
};

export type UpcomingTournament = {
  id: string;
  name: string;
  format: ChessFormat;
  startsAt: string;
  prizePool: number;
  players: number;
};

export type ChessSummary = {
  results: TournamentResult[];
  upcoming: UpcomingTournament[];
  totalWon: number;
  tournamentsPlayed: number;
  wins: number;
  topThreeFinishes: number;
  currentRating: number;
  peakRating: number;
  ratingSeries: number[];
};

export const FORMAT_LABEL: Record<ChessFormat, string> = {
  bullet: "Bullet",
  blitz: "Blitz",
  rapid: "Rapid",
  classical: "Classical",
  swiss: "Swiss",
};

/** i18n keys parallel to {@link FORMAT_LABEL}. */
export const FORMAT_LABEL_KEY: Record<ChessFormat, string> = {
  bullet: "chess.format.bullet",
  blitz: "chess.format.blitz",
  rapid: "chess.format.rapid",
  classical: "chess.format.classical",
  swiss: "chess.format.swiss",
};

export const FORMAT_TIME: Record<ChessFormat, string> = {
  bullet: "1+0",
  blitz: "3+2",
  rapid: "10+5",
  classical: "30+30",
  swiss: "Swiss",
};

/**
 * i18n keys for time-control labels. "Swiss" reuses the format label key
 * because the time control is itself the format name.
 */
export const FORMAT_TIME_KEY: Record<ChessFormat, string> = {
  bullet: "chess.time.bullet",
  blitz: "chess.time.blitz",
  rapid: "chess.time.rapid",
  classical: "chess.time.classical",
  swiss: "chess.format.swiss",
};

const TOURNAMENT_NAMES: readonly string[] = [
  "AEVION Arena",
  "Grand Swiss Open",
  "Rapid Classic Weekly",
  "Endgame Masters Cup",
  "Opening Theory Invitational",
  "Sunday Bullet Championship",
  "Blitz Marathon",
  "Classical Challenge",
  "Puzzle Rush Derby",
  "Knight's Gambit",
];

const FORMATS: ChessFormat[] = ["bullet", "blitz", "rapid", "classical", "swiss"];

function prizeFor(place: number, pool: number): number {
  if (place === 1) return +(pool * 0.5).toFixed(2);
  if (place === 2) return +(pool * 0.25).toFixed(2);
  if (place === 3) return +(pool * 0.12).toFixed(2);
  if (place <= 10) return +(pool * 0.04).toFixed(2);
  return 0;
}

function generateChess(accountId: string): ChessSummary {
  const rand = seeded(`${accountId}:chess`);
  const now = Date.now();

  let rating = 1100 + Math.floor(rand() * 400);
  const results: TournamentResult[] = [];
  const ratingSeries: number[] = [];
  const count = 8 + Math.floor(rand() * 13);

  for (let i = 0; i < count; i++) {
    const format = pick(FORMATS, rand);
    const baseName = pick(TOURNAMENT_NAMES, rand);
    const seq = 40 + Math.floor(rand() * 60);
    const totalPlayers = 40 + Math.floor(rand() * 180);
    const skill = Math.min(1, (rating - 1000) / 1400);
    const placePercentile = Math.pow(rand(), 1.6 + skill * 1.2);
    const place = Math.max(1, Math.floor(placePercentile * totalPlayers));
    const pool = (place <= 3 ? 300 + rand() * 900 : 60 + rand() * 340);
    const prize = prizeFor(place, pool);
    const win = place === 1 ? 18 + rand() * 12 : place <= 3 ? 8 + rand() * 10 : place <= 10 ? -2 + rand() * 8 : -(6 + rand() * 14);
    const ratingDelta = Math.round(win);
    rating = Math.max(600, rating + ratingDelta);
    const agoDays = Math.floor((count - i) * (150 / count) + rand() * 2);

    results.push({
      id: `tn_${accountId.slice(-6)}_${i}`,
      name: `${baseName} #${seq}`,
      format,
      finishedAt: new Date(now - agoDays * 86_400_000).toISOString(),
      place,
      totalPlayers,
      prize,
      ratingDelta,
      ratingAfter: rating,
    });
    ratingSeries.push(rating);
  }

  results.sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime());

  const upcoming: UpcomingTournament[] = [];
  for (let i = 0; i < 3; i++) {
    const format = pick(FORMATS, rand);
    const baseName = pick(TOURNAMENT_NAMES, rand);
    const seq = 40 + Math.floor(rand() * 60);
    const hoursAhead = 6 + Math.floor(rand() * 14 * 24);
    upcoming.push({
      id: `up_${accountId.slice(-6)}_${i}`,
      name: `${baseName} #${seq}`,
      format,
      startsAt: new Date(now + hoursAhead * 3600_000).toISOString(),
      prizePool: Math.round(200 + rand() * 1800),
      players: 20 + Math.floor(rand() * 120),
    });
  }
  upcoming.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const totalWon = results.reduce((s, r) => s + r.prize, 0);
  const wins = results.filter((r) => r.place === 1).length;
  const topThree = results.filter((r) => r.place <= 3).length;
  const currentRating = results[0]?.ratingAfter ?? rating;
  const peakRating = ratingSeries.reduce((m, v) => (v > m ? v : m), currentRating);

  return {
    results,
    upcoming,
    totalWon: +totalWon.toFixed(2),
    tournamentsPlayed: results.length,
    wins,
    topThreeFinishes: topThree,
    currentRating,
    peakRating,
    ratingSeries,
  };
}

export async function fetchChessSummary(accountId: string): Promise<ChessSummary> {
  return generateChess(accountId);
}

type Translator = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Returns a short countdown string like `"in 2d 3h"` or `"in 5m"`. Pass an
 * optional `t` translator to localize; without it the original English copy
 * is returned (so server / snapshot code can call this safely).
 */
export function formatCountdown(targetIso: string, t?: Translator): string {
  const ts = new Date(targetIso).getTime();
  if (!Number.isFinite(ts)) return "—";
  const diff = ts - Date.now();
  if (diff < 0) return t ? t("chess.countdown.live") : "live";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) {
    return t ? t("chess.countdown.dh", { days, hours }) : `in ${days}d ${hours}h`;
  }
  if (hours > 0) {
    return t ? t("chess.countdown.hm", { hours, minutes }) : `in ${hours}h ${minutes}m`;
  }
  const m = Math.max(1, minutes);
  return t ? t("chess.countdown.m", { minutes: m }) : `in ${m}m`;
}
