// AEVION CyberChess — Tournaments router (extended MVP)
// Mount expected at: /api/cyberchess/tournaments (or /api/cyberchess-tournaments)
//
// Adds: Swiss + Round-robin formats, file-based persistence, duplicate
// registration check, result reporting, standings, next-round pairings.
//
// Persistence: data/cyberchess-tournaments.json (sync, lazy-loaded). If
// the directory is missing and can't be created, falls back to in-memory
// with graceful no-op writes.
//
// Real-player extension: tournaments may set `realPlayers: true` to opt
// into turn-by-turn pairing driven by the matchmaking module. The
// POST /:id/queue-match endpoint produces pairings for the next round
// based on previous round results. When `realPlayers: true`, each
// pairing is immediately materialised in the matchmaking layer via
// createPreMatchedMatch(), giving both players a live matchId + SSE
// notification + redirect URL.

import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  createPreMatchedMatch,
  ALLOWED_TIME_CONTROLS,
  type TimeControl as MmTimeControl,
} from "./cyberchessMatchmaking";

const router = Router();

// ── public types ───────────────────────────────────────────────────

export type TimeControl = "blitz" | "rapid" | "classic";
export type Status = "upcoming" | "live" | "finished";
export type MatchStatus = "scheduled" | "live" | "done";
export type Format = "single_elimination" | "swiss" | "round_robin";
export type Color = "white" | "black";
export type MatchResult = "white" | "black" | "draw";

export interface Player {
  id: string;
  name: string;
  rating: number;
  score: number; // running score (1 win / 0.5 draw / 0 loss)
  buchholz: number; // computed on demand for swiss tiebreak
  whiteCount: number;
  blackCount: number;
  opponentIds: string[];
  userId?: string; // when a real registered user is mapped onto this roster slot
}

export interface BracketMatch {
  id: string;
  round: number; // 1-based
  white: string | null;
  black: string | null;
  whiteScore: number | null;
  blackScore: number | null;
  status: MatchStatus;
  winner?: Color | "draw";
  // for swiss/RR — references player ids; for single-elim — display names
  whitePlayerId?: string | null;
  blackPlayerId?: string | null;
  // real-player extension: when tournament.realPlayers === true the
  // scheduler attaches the live matchmaking match id here.
  liveMatchId?: string | null;
  // viewer URLs published when a live match is created for this pairing
  viewerUrlWhite?: string | null;
  viewerUrlBlack?: string | null;
  // userIds of the participants when known (real-player mode)
  whiteUserId?: string | null;
  blackUserId?: string | null;
}

export interface BracketRound {
  name: string;
  round: number;
  matches: BracketMatch[];
}

export interface Tournament {
  id: string;
  title: string;
  format: Format;
  timeControl: TimeControl;
  eloMin: number;
  eloMax: number;
  players: number;
  maxPlayers: number;
  prizeChessy: number;
  status: Status;
  startsAt: string;
  description?: string;
  // format-specific
  swissRounds?: number; // total rounds for swiss
  currentRound?: number; // 1-based, points to round currently in play / next
  registeredUserIds: string[]; // duplicate-check
  roster: Player[]; // active player roster (for swiss/RR)
  rounds: BracketRound[]; // all generated rounds so far
  // real-player extension (default false → legacy behaviour preserved)
  realPlayers?: boolean;
}

// ── persistence layer ──────────────────────────────────────────────

const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "cyberchess-tournaments.json");

let PERSIST_OK = true;
let TOURNAMENTS: Tournament[] = [];

function tryLoadFromDisk(): Tournament[] | null {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.tournaments)) return null;
    return parsed.tournaments as Tournament[];
  } catch (e) {
    console.warn("[cyberchess-tournaments] load failed:", (e as Error).message);
    return null;
  }
}

function tryWriteToDisk(): void {
  if (!PERSIST_OK) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ tournaments: TOURNAMENTS }, null, 2),
      "utf-8",
    );
  } catch (e) {
    console.warn(
      "[cyberchess-tournaments] persistence disabled (write failed):",
      (e as Error).message,
    );
    PERSIST_OK = false; // graceful no-op for subsequent writes
  }
}

function initStore(): void {
  // try filesystem first; if unavailable, fall back to seed fixtures in memory
  const loaded = tryLoadFromDisk();
  if (loaded && loaded.length > 0) {
    TOURNAMENTS = loaded;
    // backfill new fields on legacy persisted data
    for (const t of TOURNAMENTS) {
      if (typeof t.realPlayers === "undefined") t.realPlayers = false;
    }
    return;
  }
  TOURNAMENTS = buildSeedFixtures();
  tryWriteToDisk();
}

// ── seed fixtures (2 per format) ───────────────────────────────────

function mkPlayer(name: string, rating: number, idx: number): Player {
  return {
    id: `pl_${idx.toString().padStart(3, "0")}_${name.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
    name,
    rating,
    score: 0,
    buchholz: 0,
    whiteCount: 0,
    blackCount: 0,
    opponentIds: [],
  };
}

function buildSeedFixtures(): Tournament[] {
  // --- single elimination #1 (legacy) ---
  const elim1: Tournament = {
    id: "spring-blitz-01",
    title: "Spring Blitz Open",
    format: "single_elimination",
    timeControl: "blitz",
    eloMin: 1800,
    eloMax: 2400,
    players: 87,
    maxPlayers: 128,
    prizeChessy: 50_000,
    status: "upcoming",
    startsAt: "2026-05-18T19:00:00Z",
    description: "Открытый блиц-турнир с накопительным призовым фондом в Chessy.",
    registeredUserIds: [],
    roster: [],
    rounds: buildLegacyElimRounds(),
    realPlayers: false,
  };

  const elim2: Tournament = {
    id: "weekly-rapid-22",
    title: "Weekly Rapid #22",
    format: "single_elimination",
    timeControl: "rapid",
    eloMin: 1500,
    eloMax: 2200,
    players: 64,
    maxPlayers: 64,
    prizeChessy: 25_000,
    status: "live",
    startsAt: "2026-05-15T18:30:00Z",
    description: "Еженедельный рапид-турнир. Идёт прямо сейчас.",
    registeredUserIds: [],
    roster: [],
    rounds: buildLegacyElimRounds(),
    realPlayers: false,
  };

  // --- swiss #1 (8-player, 5 rounds) ---
  const swissRoster1 = [
    mkPlayer("Capablanca_bot", 2410, 1),
    mkPlayer("TalLegacy", 2350, 2),
    mkPlayer("NimzoIndian", 2280, 3),
    mkPlayer("ZugzwangFan", 2220, 4),
    mkPlayer("BulletDemon", 2180, 5),
    mkPlayer("EndgameKnight", 2120, 6),
    mkPlayer("Petroff_King", 2050, 7),
    mkPlayer("Sicilian_Dragon", 1980, 8),
  ];
  const swiss1: Tournament = {
    id: "swiss-arena-may",
    title: "Swiss Arena — Май",
    format: "swiss",
    timeControl: "rapid",
    eloMin: 1900,
    eloMax: 2500,
    players: swissRoster1.length,
    maxPlayers: 16,
    prizeChessy: 40_000,
    status: "live",
    startsAt: "2026-05-16T18:00:00Z",
    description: "Швейцарка на 5 туров с buchholz-тайбрейком.",
    swissRounds: 5,
    currentRound: 1,
    registeredUserIds: [],
    roster: swissRoster1,
    rounds: [],
    realPlayers: false,
  };
  // generate first round so /next-round and /standings have data
  swiss1.rounds = [
    {
      name: "Тур 1",
      round: 1,
      matches: pairSwissRound(swiss1.roster, 1, []).map((m, i) => ({
        ...m,
        id: `${swiss1.id}-r1-${i + 1}`,
      })),
    },
  ];

  // --- swiss #2 (10-player blitz) ---
  const swissRoster2 = [
    mkPlayer("ShadowKnight_2400", 2400, 11),
    mkPlayer("TacticalRose", 2330, 12),
    mkPlayer("QueenSac_99", 2270, 13),
    mkPlayer("GMPrep_22", 2210, 14),
    mkPlayer("PositionalGuru", 2150, 15),
    mkPlayer("BishopPair", 2090, 16),
    mkPlayer("PawnStorm_1900", 1950, 17),
    mkPlayer("Rookie_2050", 2050, 18),
    mkPlayer("OpeningTheory", 1880, 19),
    mkPlayer("Blunderpunk", 1820, 20),
  ];
  const swiss2: Tournament = {
    id: "swiss-blitz-friday",
    title: "Swiss Blitz Friday",
    format: "swiss",
    timeControl: "blitz",
    eloMin: 1600,
    eloMax: 2500,
    players: swissRoster2.length,
    maxPlayers: 32,
    prizeChessy: 18_000,
    status: "upcoming",
    startsAt: "2026-05-22T20:00:00Z",
    description: "7 туров швейцарки, блиц 3+2.",
    swissRounds: 7,
    currentRound: 0,
    registeredUserIds: [],
    roster: swissRoster2,
    rounds: [],
    realPlayers: false,
  };

  // --- round-robin #1 (8-player) ---
  const rrRoster1 = [
    mkPlayer("Capablanca_bot", 2410, 31),
    mkPlayer("TalLegacy", 2350, 32),
    mkPlayer("NimzoIndian", 2280, 33),
    mkPlayer("ZugzwangFan", 2220, 34),
    mkPlayer("BulletDemon", 2180, 35),
    mkPlayer("EndgameKnight", 2120, 36),
    mkPlayer("Petroff_King", 2050, 37),
    mkPlayer("Sicilian_Dragon", 1980, 38),
  ];
  const rr1: Tournament = {
    id: "classic-rr-may",
    title: "Classical Round-robin — May",
    format: "round_robin",
    timeControl: "classic",
    eloMin: 2000,
    eloMax: 2800,
    players: rrRoster1.length,
    maxPlayers: 8,
    prizeChessy: 120_000,
    status: "live",
    startsAt: "2026-05-14T12:00:00Z",
    description: "Полный круг 8 игроков, классический контроль.",
    currentRound: 1,
    registeredUserIds: [],
    roster: rrRoster1,
    rounds: buildRoundRobinSchedule(rr1RosterToIds(rrRoster1), "classic-rr-may"),
    realPlayers: false,
  };

  // --- round-robin #2 (6-player rapid) ---
  const rrRoster2 = [
    mkPlayer("TacticalRose", 2330, 41),
    mkPlayer("QueenSac_99", 2270, 42),
    mkPlayer("GMPrep_22", 2210, 43),
    mkPlayer("PositionalGuru", 2150, 44),
    mkPlayer("BishopPair", 2090, 45),
    mkPlayer("Rookie_2050", 2050, 46),
  ];
  const rr2: Tournament = {
    id: "rapid-rr-mini",
    title: "Mini Rapid Round-robin",
    format: "round_robin",
    timeControl: "rapid",
    eloMin: 1900,
    eloMax: 2400,
    players: rrRoster2.length,
    maxPlayers: 6,
    prizeChessy: 22_000,
    status: "upcoming",
    startsAt: "2026-05-19T16:00:00Z",
    description: "6 игроков, круговая система, рапид 10+5.",
    currentRound: 0,
    registeredUserIds: [],
    roster: rrRoster2,
    rounds: buildRoundRobinSchedule(rr1RosterToIds(rrRoster2), "rapid-rr-mini"),
    realPlayers: false,
  };

  // --- extras kept from legacy mock list (single elim) ---
  const elimLegacy3: Tournament = {
    id: "classic-arena-may",
    title: "Classical Arena — May",
    format: "single_elimination",
    timeControl: "classic",
    eloMin: 2000,
    eloMax: 2800,
    players: 32,
    maxPlayers: 32,
    prizeChessy: 120_000,
    status: "live",
    startsAt: "2026-05-14T12:00:00Z",
    registeredUserIds: [],
    roster: [],
    rounds: buildLegacyElimRounds(),
    realPlayers: false,
  };
  const elimLegacy4: Tournament = {
    id: "bullet-storm-7",
    title: "Bullet Storm #7",
    format: "single_elimination",
    timeControl: "blitz",
    eloMin: 1200,
    eloMax: 2600,
    players: 211,
    maxPlayers: 256,
    prizeChessy: 15_000,
    status: "upcoming",
    startsAt: "2026-05-16T21:00:00Z",
    registeredUserIds: [],
    roster: [],
    rounds: [],
    realPlayers: false,
  };
  const elimLegacy5: Tournament = {
    id: "veterans-cup",
    title: "Veterans Cup (40+)",
    format: "single_elimination",
    timeControl: "rapid",
    eloMin: 1600,
    eloMax: 2400,
    players: 48,
    maxPlayers: 64,
    prizeChessy: 35_000,
    status: "upcoming",
    startsAt: "2026-05-20T17:00:00Z",
    registeredUserIds: [],
    roster: [],
    rounds: [],
    realPlayers: false,
  };
  const elimLegacy6: Tournament = {
    id: "winter-arena-12",
    title: "Winter Arena #12",
    format: "single_elimination",
    timeControl: "classic",
    eloMin: 1900,
    eloMax: 2700,
    players: 16,
    maxPlayers: 16,
    prizeChessy: 80_000,
    status: "finished",
    startsAt: "2026-04-30T15:00:00Z",
    registeredUserIds: [],
    roster: [],
    rounds: buildLegacyElimRounds(),
    realPlayers: false,
  };
  const elimLegacy7: Tournament = {
    id: "newbies-rapid",
    title: "Newbies Rapid Friendly",
    format: "single_elimination",
    timeControl: "rapid",
    eloMin: 800,
    eloMax: 1500,
    players: 22,
    maxPlayers: 64,
    prizeChessy: 5_000,
    status: "upcoming",
    startsAt: "2026-05-17T14:00:00Z",
    registeredUserIds: [],
    roster: [],
    rounds: [],
    realPlayers: false,
  };

  // --- real-player demo tournament (small swiss, realPlayers=true) ---
  const realDemoRoster = [
    mkPlayer("Демо-Алиса", 1700, 91),
    mkPlayer("Демо-Боб", 1720, 92),
    mkPlayer("Демо-Карл", 1680, 93),
    mkPlayer("Демо-Дина", 1740, 94),
  ];
  const realDemo: Tournament = {
    id: "real-swiss-demo",
    title: "Real Players Swiss (демо)",
    format: "swiss",
    timeControl: "rapid",
    eloMin: 1500,
    eloMax: 2000,
    players: 0,
    maxPlayers: 8,
    prizeChessy: 1_000,
    status: "upcoming",
    startsAt: "2026-05-19T18:00:00Z",
    description: "Демо-турнир с реальными игроками. Регистрация открыта.",
    swissRounds: 3,
    currentRound: 0,
    registeredUserIds: [],
    roster: realDemoRoster,
    rounds: [],
    realPlayers: true,
  };

  return [
    elim1,
    elim2,
    swiss1,
    swiss2,
    rr1,
    rr2,
    elimLegacy3,
    elimLegacy4,
    elimLegacy5,
    elimLegacy6,
    elimLegacy7,
    realDemo,
  ];
}

function rr1RosterToIds(roster: Player[]): string[] {
  return roster.map((p) => p.id);
}

// ── legacy elim rounds (kept for backwards-compat sample data) ─────

function buildLegacyElimRounds(): BracketRound[] {
  return [
    {
      name: "1/8 финала",
      round: 1,
      matches: [
        { id: "r1-1", round: 1, white: "ShadowKnight_2400", black: "PawnStorm_1900", whiteScore: 2, blackScore: 0, status: "done", winner: "white" },
        { id: "r1-2", round: 1, white: "EndgameKnight", black: "Rookie_2050", whiteScore: 2, blackScore: 1, status: "done", winner: "white" },
        { id: "r1-3", round: 1, white: "TacticalRose", black: "BishopPair", whiteScore: 2, blackScore: 0, status: "done", winner: "white" },
        { id: "r1-4", round: 1, white: "PositionalGuru", black: "QueenSac_99", whiteScore: 1, blackScore: 2, status: "done", winner: "black" },
        { id: "r1-5", round: 1, white: "BulletDemon", black: "ZugzwangFan", whiteScore: 2, blackScore: 1, status: "done", winner: "white" },
        { id: "r1-6", round: 1, white: "Capablanca-bot", black: "NimzoIndian", whiteScore: 0, blackScore: 2, status: "done", winner: "black" },
        { id: "r1-7", round: 1, white: "TalLegacy", black: "Petroff_King", whiteScore: 2, blackScore: 1, status: "done", winner: "white" },
        { id: "r1-8", round: 1, white: "GMPrep_22", black: "Sicilian_Dragon", whiteScore: 2, blackScore: 0, status: "done", winner: "white" },
      ],
    },
    {
      name: "1/4 финала",
      round: 2,
      matches: [
        { id: "r2-1", round: 2, white: "ShadowKnight_2400", black: "EndgameKnight", whiteScore: 2, blackScore: 1, status: "done", winner: "white" },
        { id: "r2-2", round: 2, white: "TacticalRose", black: "QueenSac_99", whiteScore: 2, blackScore: 0, status: "done", winner: "white" },
        { id: "r2-3", round: 2, white: "BulletDemon", black: "NimzoIndian", whiteScore: 1, blackScore: 1, status: "live" },
        { id: "r2-4", round: 2, white: "TalLegacy", black: "GMPrep_22", whiteScore: null, blackScore: null, status: "scheduled" },
      ],
    },
    {
      name: "1/2 финала",
      round: 3,
      matches: [
        { id: "r3-1", round: 3, white: "ShadowKnight_2400", black: "TacticalRose", whiteScore: null, blackScore: null, status: "scheduled" },
        { id: "r3-2", round: 3, white: null, black: null, whiteScore: null, blackScore: null, status: "scheduled" },
      ],
    },
    {
      name: "Финал",
      round: 4,
      matches: [
        { id: "r4-1", round: 4, white: null, black: null, whiteScore: null, blackScore: null, status: "scheduled" },
      ],
    },
  ];
}

// ── swiss pairing (buchholz-tiebreak, no rematches, color-balance) ─

/**
 * Pair the next swiss round.
 *
 * @param players  current roster with running scores
 * @param round    round number to pair (1-based)
 * @param history  prior bracket rounds (used to detect rematches/colour balance)
 * @returns        array of BracketMatch entries for the new round (id placeholder, caller assigns)
 */
export function pairSwissRound(
  players: Player[],
  round: number,
  history: BracketRound[],
): BracketMatch[] {
  if (players.length < 2) return [];

  // 1. sort by score desc, then rating desc (round 1 just uses rating)
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    return b.rating - a.rating;
  });

  // 2. precompute prior opponent set + colour balance per player
  const playedAgainst = new Map<string, Set<string>>();
  const colourBalance = new Map<string, number>(); // white=+1, black=-1
  for (const p of players) {
    playedAgainst.set(p.id, new Set(p.opponentIds));
    colourBalance.set(p.id, (p.whiteCount ?? 0) - (p.blackCount ?? 0));
  }
  // history fallback in case roster wasn't updated
  for (const r of history) {
    for (const m of r.matches) {
      if (m.whitePlayerId && m.blackPlayerId) {
        playedAgainst.get(m.whitePlayerId)?.add(m.blackPlayerId);
        playedAgainst.get(m.blackPlayerId)?.add(m.whitePlayerId);
      }
    }
  }

  // 3. greedy pairing with backtracking
  const used = new Set<string>();
  const matches: BracketMatch[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (used.has(a.id)) continue;

    // candidate = next un-paired who hasn't played `a`; fallback: just next un-paired
    let opponent: Player | null = null;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (used.has(b.id)) continue;
      if (playedAgainst.get(a.id)?.has(b.id)) continue;
      opponent = b;
      break;
    }
    if (!opponent) {
      // accept rematch as last resort
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j];
        if (!used.has(b.id)) {
          opponent = b;
          break;
        }
      }
    }
    if (!opponent) {
      // bye (odd count)
      matches.push({
        id: "pending",
        round,
        white: a.name,
        black: null,
        whitePlayerId: a.id,
        blackPlayerId: null,
        whiteScore: 1,
        blackScore: null,
        status: "done",
        winner: "white",
      });
      used.add(a.id);
      continue;
    }

    // colour balance: prefer giving white to the one with more blacks
    const aBalance = colourBalance.get(a.id) ?? 0;
    const bBalance = colourBalance.get(opponent.id) ?? 0;
    let whitePlayer = a;
    let blackPlayer = opponent;
    if (aBalance > bBalance) {
      whitePlayer = opponent;
      blackPlayer = a;
    }
    matches.push({
      id: "pending",
      round,
      white: whitePlayer.name,
      black: blackPlayer.name,
      whitePlayerId: whitePlayer.id,
      blackPlayerId: blackPlayer.id,
      whiteScore: null,
      blackScore: null,
      status: "scheduled",
    });
    used.add(a.id);
    used.add(opponent.id);
  }

  return matches;
}

// ── round-robin (Berger tables for 4 / 6 / 8 / 16) ────────────────

/**
 * Build a full round-robin schedule using Berger tables. Supports
 * 4, 6, 8 and 16 players. For odd counts a "bye" slot is inserted.
 */
export function buildRoundRobinSchedule(
  playerIds: string[],
  tournamentId: string,
): BracketRound[] {
  const n0 = playerIds.length;
  const ids = [...playerIds];
  let bye = false;
  if (n0 % 2 === 1) {
    ids.push("__BYE__");
    bye = true;
  }
  const n = ids.length;
  const totalRounds = n - 1;
  const rounds: BracketRound[] = [];

  // circle method (canonical Berger): fix player 0, rotate the rest
  const fixed = ids[0];
  const rotating = ids.slice(1);

  for (let r = 0; r < totalRounds; r++) {
    const half = n / 2;
    const left: string[] = [fixed, ...rotating.slice(0, half - 1)];
    const right: string[] = [...rotating.slice(half - 1).reverse()];
    const matches: BracketMatch[] = [];
    for (let i = 0; i < half; i++) {
      const a = left[i];
      const b = right[i];
      if (a === "__BYE__" || b === "__BYE__") continue;
      // alternate colours per round for fairness
      const whiteId = (r + i) % 2 === 0 ? a : b;
      const blackId = whiteId === a ? b : a;
      matches.push({
        id: `${tournamentId}-r${r + 1}-${i + 1}`,
        round: r + 1,
        white: whiteId,
        black: blackId,
        whitePlayerId: whiteId,
        blackPlayerId: blackId,
        whiteScore: null,
        blackScore: null,
        status: "scheduled",
      });
    }
    rounds.push({
      name: `Тур ${r + 1}`,
      round: r + 1,
      matches,
    });

    // rotate (last → first of rotating)
    rotating.unshift(rotating.pop() as string);
  }

  if (bye) {
    // mark for clarity (no behaviour change)
  }
  return rounds;
}

// ── helpers: standings & result application ────────────────────────

function recomputeBuchholz(t: Tournament): void {
  // Buchholz = sum of opponents' final scores. Skipped if no roster.
  const byId = new Map(t.roster.map((p) => [p.id, p]));
  for (const p of t.roster) {
    let bh = 0;
    for (const oppId of p.opponentIds) {
      const o = byId.get(oppId);
      if (o) bh += o.score;
    }
    p.buchholz = bh;
  }
}

function sortStandings(t: Tournament): Player[] {
  recomputeBuchholz(t);
  return [...t.roster].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    return b.rating - a.rating;
  });
}

function applyResultToMatch(
  t: Tournament,
  match: BracketMatch,
  winner: MatchResult,
): void {
  match.status = "done";
  match.winner = winner;
  if (winner === "white") {
    match.whiteScore = 1;
    match.blackScore = 0;
  } else if (winner === "black") {
    match.whiteScore = 0;
    match.blackScore = 1;
  } else {
    match.whiteScore = 0.5;
    match.blackScore = 0.5;
  }

  // update roster (swiss/RR)
  if (match.whitePlayerId && match.blackPlayerId) {
    const w = t.roster.find((p) => p.id === match.whitePlayerId);
    const b = t.roster.find((p) => p.id === match.blackPlayerId);
    if (w && b) {
      if (winner === "white") {
        w.score += 1;
      } else if (winner === "black") {
        b.score += 1;
      } else {
        w.score += 0.5;
        b.score += 0.5;
      }
      w.whiteCount += 1;
      b.blackCount += 1;
      if (!w.opponentIds.includes(b.id)) w.opponentIds.push(b.id);
      if (!b.opponentIds.includes(w.id)) b.opponentIds.push(w.id);
    }
  }
}

function maybeAdvanceSwiss(t: Tournament): void {
  if (t.format !== "swiss") return;
  const totalRounds = t.swissRounds ?? 5;
  const lastRound = t.rounds[t.rounds.length - 1];
  if (!lastRound) return;
  const allDone = lastRound.matches.every((m) => m.status === "done");
  if (!allDone) return;
  if (lastRound.round >= totalRounds) {
    t.status = "finished";
    return;
  }
  // pair the next round
  const next = pairSwissRound(t.roster, lastRound.round + 1, t.rounds).map(
    (m, i) => ({
      ...m,
      id: `${t.id}-r${lastRound.round + 1}-${i + 1}`,
    }),
  );
  t.rounds.push({
    name: `Тур ${lastRound.round + 1}`,
    round: lastRound.round + 1,
    matches: next,
  });
  t.currentRound = lastRound.round + 1;
}

function maybeAdvanceRR(t: Tournament): void {
  if (t.format !== "round_robin") return;
  const last = t.rounds[t.rounds.length - 1];
  if (!last) return;
  const allDone = t.rounds.every((r) => r.matches.every((m) => m.status === "done"));
  if (allDone) {
    t.status = "finished";
  }
}

// ── tournament → matchmaking bridge ────────────────────────────────

/**
 * Map our coarse TimeControl ("blitz"/"rapid"/"classic") to one of the
 * matchmaking module's concrete clocks. Stable mapping; can be replaced
 * by a per-tournament override later.
 */
function mapTimeControl(tc: TimeControl): MmTimeControl {
  switch (tc) {
    case "blitz":
      return "180+0";
    case "rapid":
      return "300+5";
    case "classic":
      return "1800+0";
    default:
      // fallback compile-time safety
      return "300+5";
  }
}

/**
 * Resolve a Player roster entry into a real userId, if one is mapped.
 * Today we use Player.userId (set during /register on realPlayers tournaments).
 * If absent, falls back to the synthetic player.id so the matchmaking
 * layer still gets a usable token (bot/anon slot).
 */
function resolveUserId(t: Tournament, playerId: string | null | undefined): string | null {
  if (!playerId) return null;
  const p = t.roster.find((x) => x.id === playerId);
  if (!p) return null;
  return p.userId || p.id;
}

function resolveDisplayName(t: Tournament, playerId: string | null | undefined): string | null {
  if (!playerId) return null;
  const p = t.roster.find((x) => x.id === playerId);
  return p?.name ?? null;
}

function resolveRating(t: Tournament, playerId: string | null | undefined): number {
  if (!playerId) return 1500;
  const p = t.roster.find((x) => x.id === playerId);
  return p?.rating ?? 1500;
}

/**
 * For every pairing in a freshly-built round, if both sides have
 * resolvable userIds, materialise a live match in matchmaking and
 * decorate the bracket match with liveMatchId + viewer URLs.
 *
 * Errors are isolated per-pairing — one failure must not abort the
 * whole round.
 */
function publishRoundToMatchmaking(t: Tournament, matches: BracketMatch[]): void {
  if (!t.realPlayers) return;
  const mmTc = mapTimeControl(t.timeControl);
  for (const m of matches) {
    if (m.status === "done") continue; // byes
    const whiteUserId = resolveUserId(t, m.whitePlayerId);
    const blackUserId = resolveUserId(t, m.blackPlayerId);
    if (!whiteUserId || !blackUserId) {
      m.liveMatchId = m.liveMatchId ?? null;
      continue;
    }
    try {
      const result = createPreMatchedMatch({
        whiteUserId,
        blackUserId,
        whiteName: resolveDisplayName(t, m.whitePlayerId) || undefined,
        blackName: resolveDisplayName(t, m.blackPlayerId) || undefined,
        whiteRating: resolveRating(t, m.whitePlayerId),
        blackRating: resolveRating(t, m.blackPlayerId),
        timeControl: mmTc,
        tournamentId: t.id,
        round: m.round,
      });
      m.liveMatchId = result.matchId;
      m.viewerUrlWhite = result.viewerUrlWhite;
      m.viewerUrlBlack = result.viewerUrlBlack;
      m.whiteUserId = whiteUserId;
      m.blackUserId = blackUserId;
      m.status = "live";
    } catch (e) {
      console.warn(
        `[cyberchess-tournaments] publishRoundToMatchmaking failed for ${m.id}:`,
        (e as Error).message,
      );
      m.liveMatchId = null;
    }
  }
}

// ── routes ─────────────────────────────────────────────────────────

initStore();

// GET /list
router.get("/list", (req: Request, res: Response): void => {
  const format = String(req.query.format || "").toLowerCase();
  let list = TOURNAMENTS;
  if (format && format !== "all") {
    list = list.filter((t) => t.format === format);
  }
  // strip heavy nested fields for list view
  const slim = list.map((t) => ({
    id: t.id,
    title: t.title,
    format: t.format,
    timeControl: t.timeControl,
    eloMin: t.eloMin,
    eloMax: t.eloMax,
    players: t.players,
    maxPlayers: t.maxPlayers,
    prizeChessy: t.prizeChessy,
    status: t.status,
    startsAt: t.startsAt,
    description: t.description,
    swissRounds: t.swissRounds,
    currentRound: t.currentRound,
    realPlayers: !!t.realPlayers,
  }));
  res.json({ ok: true, count: slim.length, tournaments: slim });
});

// GET /:id
router.get("/:id", (req: Request, res: Response): void => {
  const t = TOURNAMENTS.find((x) => x.id === req.params.id);
  if (!t) {
    res.status(404).json({ ok: false, error: "tournament_not_found", id: req.params.id });
    return;
  }
  res.json({ ok: true, tournament: t });
});

// POST /:id/register
router.post("/:id/register", (req: Request, res: Response): void => {
  const t = TOURNAMENTS.find((x) => x.id === req.params.id);
  if (!t) {
    res.status(404).json({ ok: false, error: "tournament_not_found", id: req.params.id });
    return;
  }
  if (t.status !== "upcoming") {
    res.status(409).json({ ok: false, error: "registration_closed", status: t.status });
    return;
  }
  if (t.players >= t.maxPlayers) {
    res.status(409).json({ ok: false, error: "tournament_full" });
    return;
  }
  const userId: string =
    (typeof req.body?.userId === "string" && req.body.userId) ||
    `anon_${randomUUID().slice(0, 8)}`;
  const displayName: string =
    (typeof req.body?.displayName === "string" && req.body.displayName.trim()) ||
    `Player_${userId.slice(-4)}`;
  if (t.registeredUserIds.includes(userId)) {
    res.status(409).json({ ok: false, error: "already_registered", userId });
    return;
  }
  t.registeredUserIds.push(userId);
  t.players += 1;

  // For real-player tournaments, attach the userId onto a roster slot so
  // that publishRoundToMatchmaking() can later resolve real userIds.
  if (t.realPlayers) {
    const freeSlot = t.roster.find((p) => !p.userId);
    if (freeSlot) {
      freeSlot.userId = userId;
      freeSlot.name = displayName;
    } else {
      // grow roster on demand if no fixture slot available
      const newPlayer: Player = {
        id: `pl_dyn_${t.registeredUserIds.length.toString().padStart(3, "0")}_${userId.slice(-6)}`,
        name: displayName,
        rating: 1500,
        score: 0,
        buchholz: 0,
        whiteCount: 0,
        blackCount: 0,
        opponentIds: [],
        userId,
      };
      t.roster.push(newPlayer);
    }
  }

  tryWriteToDisk();
  const ticketId = `tkt_${randomUUID()}`;
  res.json({
    ok: true,
    ticketId,
    tournamentId: t.id,
    title: t.title,
    userId,
    realPlayers: !!t.realPlayers,
    queueStreamUrl: t.realPlayers
      ? `/api/cyberchess/matchmaking/queue/stream?userId=${encodeURIComponent(userId)}`
      : null,
    registeredAt: new Date().toISOString(),
  });
});

// GET /:id/bracket
router.get("/:id/bracket", (req: Request, res: Response): void => {
  const t = TOURNAMENTS.find((x) => x.id === req.params.id);
  if (!t) {
    res.status(404).json({ ok: false, error: "tournament_not_found", id: req.params.id });
    return;
  }
  res.json({
    ok: true,
    tournamentId: t.id,
    format: t.format,
    size: t.format === "single_elimination" ? 16 : t.roster.length,
    rounds: t.rounds,
  });
});

// GET /:id/standings
router.get("/:id/standings", (req: Request, res: Response): void => {
  const t = TOURNAMENTS.find((x) => x.id === req.params.id);
  if (!t) {
    res.status(404).json({ ok: false, error: "tournament_not_found", id: req.params.id });
    return;
  }
  const sorted = sortStandings(t);
  res.json({
    ok: true,
    tournamentId: t.id,
    format: t.format,
    standings: sorted.map((p, idx) => ({
      rank: idx + 1,
      id: p.id,
      name: p.name,
      rating: p.rating,
      score: p.score,
      buchholz: p.buchholz,
      whiteCount: p.whiteCount,
      blackCount: p.blackCount,
      gamesPlayed: p.opponentIds.length,
    })),
  });
});

// GET /:id/next-round
router.get("/:id/next-round", (req: Request, res: Response): void => {
  const t = TOURNAMENTS.find((x) => x.id === req.params.id);
  if (!t) {
    res.status(404).json({ ok: false, error: "tournament_not_found", id: req.params.id });
    return;
  }
  // Find first round with any scheduled match
  const next = t.rounds.find((r) => r.matches.some((m) => m.status === "scheduled" || m.status === "live"));
  if (!next) {
    res.json({ ok: true, tournamentId: t.id, finished: true, round: null });
    return;
  }
  res.json({
    ok: true,
    tournamentId: t.id,
    finished: false,
    round: next.round,
    name: next.name,
    matches: next.matches,
  });
});

// POST /:id/result   { matchId, winner: "white"|"black"|"draw" }
router.post("/:id/result", (req: Request, res: Response): void => {
  const t = TOURNAMENTS.find((x) => x.id === req.params.id);
  if (!t) {
    res.status(404).json({ ok: false, error: "tournament_not_found", id: req.params.id });
    return;
  }
  const matchId = String(req.body?.matchId || "");
  const winner = String(req.body?.winner || "") as MatchResult;
  if (!matchId || !["white", "black", "draw"].includes(winner)) {
    res.status(400).json({ ok: false, error: "invalid_payload" });
    return;
  }
  let match: BracketMatch | undefined;
  for (const r of t.rounds) {
    match = r.matches.find((m) => m.id === matchId);
    if (match) break;
  }
  if (!match) {
    res.status(404).json({ ok: false, error: "match_not_found", matchId });
    return;
  }
  if (match.status === "done") {
    res.status(409).json({ ok: false, error: "match_already_done", matchId });
    return;
  }

  applyResultToMatch(t, match, winner);
  maybeAdvanceSwiss(t);
  maybeAdvanceRR(t);
  tryWriteToDisk();

  res.json({
    ok: true,
    tournamentId: t.id,
    matchId,
    winner,
    updatedStatus: t.status,
    currentRound: t.currentRound,
  });
});

// POST /:id/queue-match — turn-by-turn pairing for real-player tournaments.
//
// Behaviour:
//  - If tournament.realPlayers !== true → 409, no-op (legacy preserved).
//  - Looks at the most recently completed round's results (or the empty
//    roster for round 1) and produces pairings for the next round:
//      * swiss → pairSwissRound on roster
//      * round_robin → next scheduled round already exists in t.rounds
//      * single_elimination → winners of previous round are paired in order
//  - For each pairing where both players have resolvable userIds, a live
//    matchmaking match is created via createPreMatchedMatch(); matchId
//    and viewer URLs are attached to the bracket match.
router.post("/:id/queue-match", (req: Request, res: Response): void => {
  const t = TOURNAMENTS.find((x) => x.id === req.params.id);
  if (!t) {
    res.status(404).json({ ok: false, error: "tournament_not_found", id: req.params.id });
    return;
  }
  if (!t.realPlayers) {
    res
      .status(409)
      .json({ ok: false, error: "not_a_real_player_tournament", hint: "set realPlayers: true to enable" });
    return;
  }

  const lastRound = t.rounds[t.rounds.length - 1];
  const allLastDone = lastRound ? lastRound.matches.every((m) => m.status === "done") : true;

  // Swiss: pair next round from current roster scores
  if (t.format === "swiss") {
    if (lastRound && !allLastDone) {
      res.status(409).json({ ok: false, error: "previous_round_in_progress", round: lastRound.round });
      return;
    }
    const totalRounds = t.swissRounds ?? 5;
    const nextRoundNo = (lastRound?.round ?? 0) + 1;
    if (nextRoundNo > totalRounds) {
      t.status = "finished";
      tryWriteToDisk();
      res.json({ ok: true, finished: true, tournamentId: t.id });
      return;
    }
    const next = pairSwissRound(t.roster, nextRoundNo, t.rounds).map((m, i) => ({
      ...m,
      id: `${t.id}-r${nextRoundNo}-${i + 1}`,
      liveMatchId: null as string | null,
    }));
    publishRoundToMatchmaking(t, next);
    t.rounds.push({ name: `Тур ${nextRoundNo}`, round: nextRoundNo, matches: next });
    t.currentRound = nextRoundNo;
    tryWriteToDisk();
    res.json({
      ok: true,
      tournamentId: t.id,
      round: nextRoundNo,
      matches: next,
      live: next
        .filter((m) => !!m.liveMatchId)
        .map((m) => ({
          bracketMatchId: m.id,
          matchId: m.liveMatchId,
          viewerUrlWhite: m.viewerUrlWhite,
          viewerUrlBlack: m.viewerUrlBlack,
          whiteUserId: m.whiteUserId,
          blackUserId: m.blackUserId,
        })),
    });
    return;
  }

  // Round-robin: full schedule already exists — surface the next pending round
  if (t.format === "round_robin") {
    const pending = t.rounds.find((r) => r.matches.some((m) => m.status === "scheduled"));
    if (!pending) {
      t.status = "finished";
      tryWriteToDisk();
      res.json({ ok: true, finished: true, tournamentId: t.id });
      return;
    }
    // mark liveMatchId field as null placeholder for clients
    for (const m of pending.matches) {
      if (typeof m.liveMatchId === "undefined") m.liveMatchId = null;
    }
    publishRoundToMatchmaking(t, pending.matches);
    t.currentRound = pending.round;
    tryWriteToDisk();
    res.json({
      ok: true,
      tournamentId: t.id,
      round: pending.round,
      matches: pending.matches,
      live: pending.matches
        .filter((m) => !!m.liveMatchId)
        .map((m) => ({
          bracketMatchId: m.id,
          matchId: m.liveMatchId,
          viewerUrlWhite: m.viewerUrlWhite,
          viewerUrlBlack: m.viewerUrlBlack,
          whiteUserId: m.whiteUserId,
          blackUserId: m.blackUserId,
        })),
    });
    return;
  }

  // Single elimination: pair winners of last round
  if (t.format === "single_elimination") {
    if (!lastRound) {
      res.status(409).json({ ok: false, error: "no_rounds_yet" });
      return;
    }
    if (!allLastDone) {
      res.status(409).json({ ok: false, error: "previous_round_in_progress", round: lastRound.round });
      return;
    }
    const winners: string[] = [];
    for (const m of lastRound.matches) {
      if (m.winner === "white" && m.white) winners.push(m.white);
      else if (m.winner === "black" && m.black) winners.push(m.black);
    }
    if (winners.length < 2) {
      t.status = "finished";
      tryWriteToDisk();
      res.json({ ok: true, finished: true, tournamentId: t.id, champion: winners[0] ?? null });
      return;
    }
    const nextRoundNo = lastRound.round + 1;
    const matches: BracketMatch[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      matches.push({
        id: `${t.id}-r${nextRoundNo}-${i / 2 + 1}`,
        round: nextRoundNo,
        white: winners[i],
        black: winners[i + 1] ?? null,
        whiteScore: null,
        blackScore: null,
        status: "scheduled",
        liveMatchId: null,
      });
    }
    publishRoundToMatchmaking(t, matches);
    t.rounds.push({ name: `Тур ${nextRoundNo}`, round: nextRoundNo, matches });
    t.currentRound = nextRoundNo;
    tryWriteToDisk();
    res.json({
      ok: true,
      tournamentId: t.id,
      round: nextRoundNo,
      matches,
      live: matches
        .filter((m) => !!m.liveMatchId)
        .map((m) => ({
          bracketMatchId: m.id,
          matchId: m.liveMatchId,
          viewerUrlWhite: m.viewerUrlWhite,
          viewerUrlBlack: m.viewerUrlBlack,
          whiteUserId: m.whiteUserId,
          blackUserId: m.blackUserId,
        })),
    });
    return;
  }

  res.status(400).json({ ok: false, error: "unsupported_format", format: t.format });
});

// expose the allowed matchmaking time-controls so the frontend can show
// the mapping if needed (purely informational)
router.get("/__meta/time-controls", (_req: Request, res: Response): void => {
  res.json({ ok: true, matchmaking: ALLOWED_TIME_CONTROLS });
});

export default router;
