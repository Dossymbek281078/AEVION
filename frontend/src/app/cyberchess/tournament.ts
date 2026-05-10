// Tournament Mode — Knockout-bracket для 8 ИИ-соперников с разными персонами.
// Игрок проходит 3 раунда (QF → SF → Final). Параллельные матчи симулируются
// детерминированным расчётом по ELO (модель Elo P=1/(1+10^((b-a)/400))).
// Хранение в localStorage как один live-турнир + лента трофеев.
// Поддерживает variant: standard / fischer960 / asymmetric / atomic / etc.

import type { VariantId } from "./variants";

const TKEY = "aevion_tournament_v1";
const TROPHY_KEY = "aevion_tournament_trophies_v1";

export type Persona = {
  id: string;
  name: string;
  flag: string;
  elo: number;
  style: "Aggressive" | "Defensive" | "Tactical" | "Positional" | "Hyper" | "Universal" | "Wild" | "Solid";
  motto: string;
  // Mapped to ALS index in page.tsx (0..5) for actual play
  aiLevel: number;
  // Random factor multiplier for ai best() randomness
  randMul: number;
};

// 26 personas — pool to draw from. Each tournament samples 8.
// Mix of: current top GMs, women champions, juniors, legends, AI engines, fictional.
export const PERSONAS: Persona[] = [
  // Current top GMs
  { id: "magnus",   name: "Magnus C.",  flag: "🇳🇴", elo: 2847, style: "Universal",  motto: "Я никогда не проигрываю — либо побеждаю, либо учусь.", aiLevel: 5, randMul: 0.6 },
  { id: "hikaru",   name: "Hikaru N.",  flag: "🇺🇸", elo: 2795, style: "Tactical",   motto: "Bullet — это шахматы. Остальное — для медленных.",      aiLevel: 5, randMul: 0.8 },
  { id: "fabiano",  name: "Fabiano C.", flag: "🇺🇸", elo: 2758, style: "Positional", motto: "Theory matters. Каждый ход подготовлен.",                aiLevel: 5, randMul: 0.5 },
  { id: "ding",     name: "Ding L.",    flag: "🇨🇳", elo: 2720, style: "Defensive",  motto: "Терпение побеждает атаку.",                              aiLevel: 4, randMul: 0.6 },
  { id: "alireza",  name: "Alireza F.", flag: "🇫🇷", elo: 2692, style: "Aggressive", motto: "Я атакую первым.",                                       aiLevel: 4, randMul: 0.9 },
  { id: "anish",    name: "Anish G.",   flag: "🇳🇱", elo: 2668, style: "Solid",      motto: "Безопасность — главное преимущество.",                  aiLevel: 4, randMul: 0.4 },
  { id: "ian",      name: "Ian N.",     flag: "🇷🇺", elo: 2633, style: "Hyper",      motto: "Я играю на победу — всегда.",                            aiLevel: 4, randMul: 1.0 },
  { id: "wesley",   name: "Wesley So",  flag: "🇺🇸", elo: 2610, style: "Positional", motto: "Сила в стабильности.",                                   aiLevel: 4, randMul: 0.5 },
  { id: "jankrz",   name: "Jan-Krz. D.",flag: "🇵🇱", elo: 2582, style: "Tactical",   motto: "Каждая позиция — это ребус.",                            aiLevel: 4, randMul: 0.8 },
  { id: "leinier",  name: "Leinier D.", flag: "🇺🇸", elo: 2551, style: "Universal",  motto: "Адаптируюсь под любого.",                                aiLevel: 3, randMul: 0.7 },
  { id: "praggna",  name: "R Praggna.", flag: "🇮🇳", elo: 2745, style: "Aggressive", motto: "Возраст — это просто число.",                            aiLevel: 4, randMul: 0.85 },
  { id: "gukesh",   name: "Gukesh D.",  flag: "🇮🇳", elo: 2740, style: "Universal",  motto: "Чемпион мира — это начало.",                             aiLevel: 5, randMul: 0.55 },
  // Women champions
  { id: "judit",    name: "Judit P.",   flag: "🇭🇺", elo: 2735, style: "Aggressive", motto: "Шахматы не имеют пола.",                                 aiLevel: 5, randMul: 0.7 },
  { id: "hou",      name: "Hou Y.",     flag: "🇨🇳", elo: 2658, style: "Positional", motto: "Тишина перед бурей.",                                    aiLevel: 4, randMul: 0.5 },
  { id: "humpy",    name: "Humpy K.",   flag: "🇮🇳", elo: 2596, style: "Solid",      motto: "Терпение — моё оружие.",                                  aiLevel: 4, randMul: 0.4 },
  { id: "bibisara", name: "Bibisara A.",flag: "🇰🇿", elo: 2516, style: "Tactical",   motto: "Я играю быстро и глубоко.",                              aiLevel: 4, randMul: 0.85 },
  // Junior prodigies
  { id: "abhi",     name: "Abhimanyu M.",flag: "🇺🇸", elo: 2580, style: "Universal", motto: "Я нашёл шахматы в 4 года.",                              aiLevel: 4, randMul: 0.7 },
  { id: "yagiz",    name: "Yagiz K. K.",flag: "🇹🇷", elo: 2520, style: "Aggressive", motto: "Я моложе твоего рейтинга.",                              aiLevel: 4, randMul: 0.95 },
  // Legends from history
  { id: "tal",      name: "Mikhail T.", flag: "🇷🇺", elo: 2705, style: "Hyper",      motto: "Жертвую — потому что могу.",                             aiLevel: 4, randMul: 1.2 },
  { id: "fischer",  name: "Bobby F.",   flag: "🇺🇸", elo: 2785, style: "Universal",  motto: "Шахматы — война на доске.",                              aiLevel: 5, randMul: 0.4 },
  { id: "kasparov", name: "Garry K.",   flag: "🇷🇺", elo: 2851, style: "Aggressive", motto: "Атака — лучшая защита.",                                  aiLevel: 5, randMul: 0.7 },
  { id: "karpov",   name: "Anatoly K.", flag: "🇷🇺", elo: 2780, style: "Positional", motto: "Соперника удушает позиция, не я.",                       aiLevel: 5, randMul: 0.4 },
  { id: "capablanca",name: "Jose R. C.",flag: "🇨🇺", elo: 2725, style: "Universal",  motto: "Я просто вижу следующий ход.",                           aiLevel: 5, randMul: 0.45 },
  { id: "petrosian2",name: "Tigran P.", flag: "🇦🇲", elo: 2685, style: "Defensive",  motto: "Лучшая жертва — это та, которой не было.",              aiLevel: 4, randMul: 0.5 },
  // AI engines
  { id: "alphazero",name: "AlphaZero",  flag: "🤖", elo: 3300, style: "Wild",       motto: "Я играю позиции, которые люди боятся.",                  aiLevel: 5, randMul: 0.3 },
  { id: "stockfish",name: "Stockfish",  flag: "🐟", elo: 3650, style: "Universal",  motto: "У меня нет стиля. У меня есть глубина.",                  aiLevel: 5, randMul: 0.2 },
  { id: "leela",    name: "Leela Zero", flag: "🧠", elo: 3400, style: "Wild",       motto: "Я обучилась сама. Без книг.",                             aiLevel: 5, randMul: 0.35 },
];

export type Match = {
  a: string;        // persona id (or "you" for player)
  b: string;
  winner?: string;  // id once played
  // Score 1-0, 0-1, 0.5-0.5 represented by winner=a/b/draw
  result?: "a" | "b" | "draw";
  // True if this match needs the player (they're a or b)
  needsPlayer: boolean;
};

export type Tournament = {
  v: 1;
  id: string;
  size: 8;
  startedTs: number;
  // Bracket as 3 rounds: 4 QF matches, 2 SF, 1 Final
  bracket: { qf: Match[]; sf: Match[]; final: Match };
  // The player's id is always "you"
  playerName: string;
  playerElo: number;
  currentRound: "qf" | "sf" | "final" | "done";
  // Cache: persona id → Persona for this tournament
  field: Persona[];
  // Variant for this tournament (default standard for backward compatibility)
  variant?: VariantId;
};

export type Trophy = {
  v: 1;
  ts: number;
  place: 1 | 2 | 3 | 4 | 8;  // 8 = quarterfinalist (out in QF)
  finalScore?: string;
  defeated: string[];        // persona names beaten by player
  reward: number;
  variant?: VariantId;
};

export function ldTournament(): Tournament | null {
  try { const s = localStorage.getItem(TKEY); if (!s) return null; const r = JSON.parse(s); return r?.v === 1 ? r : null } catch { return null }
}
export function svTournament(t: Tournament | null) {
  try { if (t) localStorage.setItem(TKEY, JSON.stringify(t)); else localStorage.removeItem(TKEY) } catch {}
}
export function ldTrophies(): Trophy[] {
  try { const s = localStorage.getItem(TROPHY_KEY); if (!s) return []; const r = JSON.parse(s); return Array.isArray(r) ? r : [] } catch { return [] }
}
export function svTrophies(list: Trophy[]) {
  try { localStorage.setItem(TROPHY_KEY, JSON.stringify(list.slice(0, 50))) } catch {}
}

// Pick 7 random personas + player → 8-player field. Bracket pairing standard:
// 1v8, 4v5, 3v6, 2v7 by seed order; player seeded by their elo.
export function createTournament(playerElo: number, variant: VariantId = "standard"): Tournament {
  const pool = [...PERSONAS].sort(() => Math.random() - 0.5).slice(0, 7);
  const player: Persona = {
    id: "you", name: "Ты", flag: "🇰🇿", elo: playerElo, style: "Universal",
    motto: "", aiLevel: 0, randMul: 0,
  };
  const field = [...pool, player].sort((a, b) => b.elo - a.elo);
  // Standard 8-player seed pairing
  const seedPairs: [number, number][] = [[0, 7], [3, 4], [2, 5], [1, 6]];
  const qf: Match[] = seedPairs.map(([i, j]) => ({
    a: field[i].id,
    b: field[j].id,
    needsPlayer: field[i].id === "you" || field[j].id === "you",
  }));
  const empty: Match = { a: "?", b: "?", needsPlayer: false };
  return {
    v: 1,
    id: Date.now().toString(36),
    size: 8,
    startedTs: Date.now(),
    playerName: "Ты",
    playerElo,
    field,
    bracket: { qf, sf: [{ ...empty }, { ...empty }], final: { ...empty } },
    currentRound: "qf",
    variant,
  };
}

// Probability A beats B: classic Elo formula
export function eloP(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

// Roll a deterministic-ish result for a bot vs bot match using Elo.
// 5% draws built in. Returns "a" or "b" or "draw".
export function rollBotMatch(eloA: number, eloB: number): "a" | "b" | "draw" {
  const p = eloP(eloA, eloB);
  const drawZone = 0.05;
  const r = Math.random();
  // Carve out a draw band centered on the equilibrium
  if (Math.abs(p - 0.5) < 0.15 && r < drawZone) return "draw";
  return r < p ? "a" : "b";
}

// Resolve all bot-vs-bot matches in current round.
// Player matches are left untouched (they need actual play).
export function resolveBotMatches(t: Tournament): Tournament {
  const round = t.bracket[t.currentRound === "done" ? "final" : t.currentRound];
  const matches = Array.isArray(round) ? round : [round];
  const fieldById = new Map(t.field.map(p => [p.id, p]));
  for (const m of matches) {
    if (m.needsPlayer || m.winner) continue;
    if (m.a === "?" || m.b === "?") continue;
    const a = fieldById.get(m.a); const b = fieldById.get(m.b);
    if (!a || !b) continue;
    const r = rollBotMatch(a.elo, b.elo);
    m.result = r;
    m.winner = r === "a" ? m.a : r === "b" ? m.b : (Math.random() < 0.5 ? m.a : m.b);
  }
  return { ...t };
}

// Apply a player match result. result: "win" | "lose" | "draw". Returns updated tournament.
// On draw, player advances (fan-favorite tiebreak — simpler UX than tiebreak rounds).
export function applyPlayerResult(t: Tournament, result: "win" | "lose" | "draw"): Tournament {
  const round = t.currentRound;
  if (round === "done") return t;
  const matches = round === "final" ? [t.bracket.final] : t.bracket[round];
  for (const m of matches) {
    if (!m.needsPlayer || m.winner) continue;
    if (result === "win") { m.winner = "you"; m.result = m.a === "you" ? "a" : "b" }
    else if (result === "lose") { m.winner = m.a === "you" ? m.b : m.a; m.result = m.a === "you" ? "b" : "a" }
    else { m.winner = "you"; m.result = "draw" } // player advances on draw
    break;
  }
  return { ...t };
}

// After all matches in current round have winners, build next round.
// Pairing: winners of qf[0] vs qf[1], qf[2] vs qf[3] → sf; sf[0] vs sf[1] → final.
export function advanceBracket(t: Tournament): Tournament {
  if (t.currentRound === "qf") {
    const allDone = t.bracket.qf.every(m => !!m.winner);
    if (!allDone) return t;
    const sf0Winners = [t.bracket.qf[0].winner!, t.bracket.qf[1].winner!];
    const sf1Winners = [t.bracket.qf[2].winner!, t.bracket.qf[3].winner!];
    t.bracket.sf[0] = {
      a: sf0Winners[0], b: sf0Winners[1],
      needsPlayer: sf0Winners.includes("you"),
    };
    t.bracket.sf[1] = {
      a: sf1Winners[0], b: sf1Winners[1],
      needsPlayer: sf1Winners.includes("you"),
    };
    t.currentRound = "sf";
  } else if (t.currentRound === "sf") {
    const allDone = t.bracket.sf.every(m => !!m.winner);
    if (!allDone) return t;
    t.bracket.final = {
      a: t.bracket.sf[0].winner!, b: t.bracket.sf[1].winner!,
      needsPlayer: t.bracket.sf[0].winner === "you" || t.bracket.sf[1].winner === "you",
    };
    t.currentRound = "final";
  } else if (t.currentRound === "final") {
    if (t.bracket.final.winner) t.currentRound = "done";
  }
  return { ...t };
}

// Find the next match needing the player in the current round, or null.
export function nextPlayerMatch(t: Tournament): Match | null {
  if (t.currentRound === "done") return null;
  const round = t.currentRound === "final" ? [t.bracket.final] : t.bracket[t.currentRound];
  return round.find(m => m.needsPlayer && !m.winner) || null;
}

// Compute the player's final placement (1..8). Returns null if tournament not done.
export function finalPlace(t: Tournament): 1 | 2 | 3 | 4 | 8 | null {
  if (t.currentRound !== "done") return null;
  const f = t.bracket.final;
  if (f.winner === "you") return 1;
  if (f.a === "you" || f.b === "you") return 2;
  // Lost in semifinal? (you played in sf but not in final)
  const inSF = t.bracket.sf.some(m => m.a === "you" || m.b === "you");
  if (inSF && f.a !== "you" && f.b !== "you") return 4;
  return 8;
}

// Reward by placement
export function placeReward(place: 1 | 2 | 3 | 4 | 8): number {
  switch (place) {
    case 1: return 200;
    case 2: return 100;
    case 3: return 60;
    case 4: return 50;
    default: return 20; // QF exit consolation
  }
}

// All bot personas the player actually beat (head-to-head).
export function defeatedByPlayer(t: Tournament): string[] {
  const all: string[] = [];
  const fieldById = new Map(t.field.map(p => [p.id, p]));
  const visit = (m: Match) => {
    if (!m.winner || m.winner !== "you") return;
    const opp = m.a === "you" ? m.b : m.a;
    if (opp === "?") return;
    const p = fieldById.get(opp); if (p) all.push(p.name);
  };
  t.bracket.qf.forEach(visit); t.bracket.sf.forEach(visit); visit(t.bracket.final);
  return all;
}

// Render a small ASCII representation of bracket state for debug/log.
export function bracketSummary(t: Tournament): string {
  const fieldById = new Map(t.field.map(p => [p.id, p]));
  const nm = (id: string) => id === "?" ? "?" : id === "you" ? "You" : (fieldById.get(id)?.name || id);
  const m = (mt: Match) => `${nm(mt.a)} vs ${nm(mt.b)}${mt.winner ? ` → ${nm(mt.winner)}` : ""}`;
  return `QF: ${t.bracket.qf.map(m).join(" | ")}\nSF: ${t.bracket.sf.map(m).join(" | ")}\nF:  ${m(t.bracket.final)}`;
}
