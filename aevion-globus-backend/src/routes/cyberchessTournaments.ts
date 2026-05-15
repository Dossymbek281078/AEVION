// AEVION CyberChess — Tournaments router (mock MVP)
// Mount expected at: /api/cyberchess/tournaments
// NOTE: parent agent will mount this in src/index.ts.

import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";

const router = Router();

type TimeControl = "blitz" | "rapid" | "classic";
type Status = "upcoming" | "live" | "finished";
type MatchStatus = "scheduled" | "live" | "done";

interface Tournament {
  id: string;
  title: string;
  timeControl: TimeControl;
  eloMin: number;
  eloMax: number;
  players: number;
  maxPlayers: number;
  prizeChessy: number;
  status: Status;
  startsAt: string;
  description?: string;
}

interface BracketMatch {
  id: string;
  white: string | null;
  black: string | null;
  whiteScore: number | null;
  blackScore: number | null;
  status: MatchStatus;
  winner?: "white" | "black";
}

interface BracketRound {
  name: string;
  matches: BracketMatch[];
}

// ── mock data ──────────────────────────────────────────────────────

const TOURNAMENTS: Tournament[] = [
  {
    id: "spring-blitz-01",
    title: "Spring Blitz Open",
    timeControl: "blitz",
    eloMin: 1800,
    eloMax: 2400,
    players: 87,
    maxPlayers: 128,
    prizeChessy: 50_000,
    status: "upcoming",
    startsAt: "2026-05-18T19:00:00Z",
    description: "Открытый блиц-турнир с накопительным призовым фондом в Chessy.",
  },
  {
    id: "weekly-rapid-22",
    title: "Weekly Rapid #22",
    timeControl: "rapid",
    eloMin: 1500,
    eloMax: 2200,
    players: 64,
    maxPlayers: 64,
    prizeChessy: 25_000,
    status: "live",
    startsAt: "2026-05-15T18:30:00Z",
    description: "Еженедельный рапид-турнир. Идёт прямо сейчас.",
  },
  {
    id: "classic-arena-may",
    title: "Classical Arena — May",
    timeControl: "classic",
    eloMin: 2000,
    eloMax: 2800,
    players: 32,
    maxPlayers: 32,
    prizeChessy: 120_000,
    status: "live",
    startsAt: "2026-05-14T12:00:00Z",
  },
  {
    id: "bullet-storm-7",
    title: "Bullet Storm #7",
    timeControl: "blitz",
    eloMin: 1200,
    eloMax: 2600,
    players: 211,
    maxPlayers: 256,
    prizeChessy: 15_000,
    status: "upcoming",
    startsAt: "2026-05-16T21:00:00Z",
  },
  {
    id: "veterans-cup",
    title: "Veterans Cup (40+)",
    timeControl: "rapid",
    eloMin: 1600,
    eloMax: 2400,
    players: 48,
    maxPlayers: 64,
    prizeChessy: 35_000,
    status: "upcoming",
    startsAt: "2026-05-20T17:00:00Z",
  },
  {
    id: "winter-arena-12",
    title: "Winter Arena #12",
    timeControl: "classic",
    eloMin: 1900,
    eloMax: 2700,
    players: 16,
    maxPlayers: 16,
    prizeChessy: 80_000,
    status: "finished",
    startsAt: "2026-04-30T15:00:00Z",
  },
  {
    id: "newbies-rapid",
    title: "Newbies Rapid Friendly",
    timeControl: "rapid",
    eloMin: 800,
    eloMax: 1500,
    players: 22,
    maxPlayers: 64,
    prizeChessy: 5_000,
    status: "upcoming",
    startsAt: "2026-05-17T14:00:00Z",
  },
];

function buildMockBracket(_tournamentId: string): BracketRound[] {
  return [
    {
      name: "1/8 финала",
      matches: [
        { id: "r1-1", white: "ShadowKnight_2400", black: "PawnStorm_1900", whiteScore: 2, blackScore: 0, status: "done", winner: "white" },
        { id: "r1-2", white: "EndgameKnight", black: "Rookie_2050", whiteScore: 2, blackScore: 1, status: "done", winner: "white" },
        { id: "r1-3", white: "TacticalRose", black: "BishopPair", whiteScore: 2, blackScore: 0, status: "done", winner: "white" },
        { id: "r1-4", white: "PositionalGuru", black: "QueenSac_99", whiteScore: 1, blackScore: 2, status: "done", winner: "black" },
        { id: "r1-5", white: "BulletDemon", black: "ZugzwangFan", whiteScore: 2, blackScore: 1, status: "done", winner: "white" },
        { id: "r1-6", white: "Capablanca-bot", black: "NimzoIndian", whiteScore: 0, blackScore: 2, status: "done", winner: "black" },
        { id: "r1-7", white: "TalLegacy", black: "Petroff_King", whiteScore: 2, blackScore: 1, status: "done", winner: "white" },
        { id: "r1-8", white: "GMPrep_22", black: "Sicilian_Dragon", whiteScore: 2, blackScore: 0, status: "done", winner: "white" },
      ],
    },
    {
      name: "1/4 финала",
      matches: [
        { id: "r2-1", white: "ShadowKnight_2400", black: "EndgameKnight", whiteScore: 2, blackScore: 1, status: "done", winner: "white" },
        { id: "r2-2", white: "TacticalRose", black: "QueenSac_99", whiteScore: 2, blackScore: 0, status: "done", winner: "white" },
        { id: "r2-3", white: "BulletDemon", black: "NimzoIndian", whiteScore: 1, blackScore: 1, status: "live" },
        { id: "r2-4", white: "TalLegacy", black: "GMPrep_22", whiteScore: null, blackScore: null, status: "scheduled" },
      ],
    },
    {
      name: "1/2 финала",
      matches: [
        { id: "r3-1", white: "ShadowKnight_2400", black: "TacticalRose", whiteScore: null, blackScore: null, status: "scheduled" },
        { id: "r3-2", white: null, black: null, whiteScore: null, blackScore: null, status: "scheduled" },
      ],
    },
    {
      name: "Финал",
      matches: [
        { id: "r4-1", white: null, black: null, whiteScore: null, blackScore: null, status: "scheduled" },
      ],
    },
  ];
}

// ── routes ─────────────────────────────────────────────────────────

// GET /list — list of all tournaments
router.get("/list", (_req: Request, res: Response): void => {
  res.json({
    ok: true,
    count: TOURNAMENTS.length,
    tournaments: TOURNAMENTS,
  });
});

// GET /:id — single tournament details
router.get("/:id", (req: Request, res: Response): void => {
  const { id } = req.params;
  const t = TOURNAMENTS.find((x) => x.id === id);
  if (!t) {
    res.status(404).json({ ok: false, error: "tournament_not_found", id });
    return;
  }
  res.json({ ok: true, tournament: t });
});

// POST /:id/register — mock registration
router.post("/:id/register", (req: Request, res: Response): void => {
  const { id } = req.params;
  const t = TOURNAMENTS.find((x) => x.id === id);
  if (!t) {
    res.status(404).json({ ok: false, error: "tournament_not_found", id });
    return;
  }
  if (t.status !== "upcoming") {
    res.status(409).json({
      ok: false,
      error: "registration_closed",
      status: t.status,
    });
    return;
  }
  if (t.players >= t.maxPlayers) {
    res.status(409).json({ ok: false, error: "tournament_full" });
    return;
  }
  const ticketId = `tkt_${randomUUID()}`;
  res.json({
    ok: true,
    ticketId,
    tournamentId: id,
    title: t.title,
    registeredAt: new Date().toISOString(),
  });
});

// GET /:id/bracket — bracket data
router.get("/:id/bracket", (req: Request, res: Response): void => {
  const id = String(req.params.id);
  const t = TOURNAMENTS.find((x) => x.id === id);
  if (!t) {
    res.status(404).json({ ok: false, error: "tournament_not_found", id });
    return;
  }
  res.json({
    ok: true,
    tournamentId: id,
    format: "single_elimination",
    size: 16,
    rounds: buildMockBracket(String(id)),
  });
});

export default router;
