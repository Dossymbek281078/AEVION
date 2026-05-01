// AI Rival — персонализированный соперник с памятью.
// Постоянный профиль в localStorage, обновляется после каждой партии.
// Адаптируется под стиль игрока: рейтинг растёт за твоим, предпочитает
// твой слабый дебют, помнит последние 5 встреч.

const RIVAL_KEY = "aevion_chess_rival_v1";

export type RivalResult = "W" | "L" | "D"; // перспектива игрока
export type RivalMemory = {
  ts: number;
  result: RivalResult;
  opening?: string;
  moves: number;
  userRating: number;
};

export type RivalProfile = {
  v: 1;
  name: string;
  rating: number;            // текущий рейтинг Rival
  birthTs: number;           // когда появился
  encounters: number;
  wins: number;              // wins от лица Rival
  losses: number;
  draws: number;
  preferredOpeningAgainstUser?: string; // дебют, где юзер теряет чаще
  history: RivalMemory[];    // последние 10 встреч
};

const RIVAL_NAMES = [
  "Алексей", "Виктор", "Елена", "Марина", "Дмитрий", "Иван",
  "Наталья", "Сергей", "Анна", "Рустам", "Светлана", "Олег",
];

export function ldRival(): RivalProfile | null {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(RIVAL_KEY) : null;
    if (!s) return null;
    const r = JSON.parse(s);
    if (!r || r.v !== 1) return null;
    return r as RivalProfile;
  } catch { return null }
}

export function svRival(r: RivalProfile) {
  try { localStorage.setItem(RIVAL_KEY, JSON.stringify(r)) } catch {}
}

export function resetRival() {
  try { localStorage.removeItem(RIVAL_KEY) } catch {}
}

export function createRival(userRating: number, seed?: number): RivalProfile {
  const idx = Math.abs((seed ?? Date.now()) % RIVAL_NAMES.length);
  return {
    v: 1,
    name: RIVAL_NAMES[idx],
    rating: Math.max(400, userRating + 30 + Math.floor(Math.random() * 50)),
    birthTs: Date.now(),
    encounters: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    history: [],
  };
}

// Called after each Rival encounter.
// `result` is from the Rival's perspective: W = Rival won, L = Rival lost, D = draw.
export function learnFromEncounter(
  prev: RivalProfile,
  result: RivalResult,
  opening: string | undefined,
  moves: number,
  userRating: number,
): RivalProfile {
  const updated: RivalProfile = {
    ...prev,
    encounters: prev.encounters + 1,
    wins: prev.wins + (result === "W" ? 1 : 0),
    losses: prev.losses + (result === "L" ? 1 : 0),
    draws: prev.draws + (result === "D" ? 1 : 0),
    history: [{
      ts: Date.now(),
      // Translate back to USER perspective for history entry
      result: (result === "W" ? "L" : result === "L" ? "W" : "D") as RivalResult,
      opening,
      moves,
      userRating,
    }, ...prev.history].slice(0, 10),
  };

  // Rating adjustment: Rival adapts slowly towards user level with small advantage
  // If Rival won → rating edges up; if lost → edges down; always aiming at user+40 ± 15
  const target = userRating + 40;
  const drift = result === "W" ? 8 : result === "L" ? -6 : 0;
  updated.rating = Math.max(400, Math.round(updated.rating * 0.85 + target * 0.15 + drift));

  // Detect user's weak opening: if user lost in an opening ≥ 2 times in last 10, prefer it
  const lossesByOpening = new Map<string, number>();
  for (const h of updated.history) {
    if (h.result === "L" && h.opening) {
      lossesByOpening.set(h.opening, (lossesByOpening.get(h.opening) || 0) + 1);
    }
  }
  let weakest: string | undefined;
  let weakestCount = 1;
  for (const [op, cnt] of lossesByOpening) {
    if (cnt > weakestCount) { weakestCount = cnt; weakest = op; }
  }
  updated.preferredOpeningAgainstUser = weakest;

  return updated;
}

// Returns a natural-language greeting for the Rival based on memory (ru-RU).
export function rivalGreeting(r: RivalProfile, userRating: number): string {
  if (r.encounters === 0) {
    return `Привет, я ${r.name}. Мой рейтинг ${r.rating}. Приятно познакомиться — давай сыграем.`;
  }
  const last = r.history[0];
  if (r.encounters === 1 && last) {
    return last.result === "W"
      ? `Рад снова сыграть. В прошлый раз ты выиграл — я готов к реваншу.`
      : last.result === "L"
      ? `Снова ты. В прошлый раз победа была моя. Посмотрим сегодня.`
      : `Вчерашняя ничья — отличная партия. Давай ещё раз.`;
  }
  const recent5 = r.history.slice(0, 5);
  const userWins = recent5.filter(h => h.result === "W").length;
  const rivalWins = recent5.filter(h => h.result === "L").length;
  const name = r.name;
  let greet: string;
  if (userWins > rivalWins + 1) {
    greet = `Ты серьёзно прокачался, ${name} тебе завидует. В ${recent5.length} последних встречах — ${userWins}:${rivalWins} в твою пользу. Сегодня играю серьёзно.`;
  } else if (rivalWins > userWins + 1) {
    greet = `Я веду ${rivalWins}:${userWins} в последних ${recent5.length}. Попробуй что-то новое сегодня — предсказуем становишься.`;
  } else {
    greet = `Мы на равных в последних встречах. Рейтинг: мой ${r.rating}, твой ${userRating}. Готов к бою?`;
  }
  if (r.preferredOpeningAgainstUser) {
    greet += ` Сегодня сыграю ${r.preferredOpeningAgainstUser} — у тебя там слабость.`;
  }
  return greet;
}

export function rivalSummary(r: RivalProfile): string {
  const t = r.encounters;
  if (t === 0) return "Новый соперник";
  const userW = r.history.filter(h => h.result === "W").length;
  const userL = r.history.filter(h => h.result === "L").length;
  return `${t} партий · счёт в твою пользу ${userW}:${userL}`;
}
