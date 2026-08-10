/* Откуда страница «задача дня» берёт задачу, личность игрока и адреса ручек.
 *
 * Живёт отдельно от `page.tsx` по двум причинам. Первая — файл страницы Next вправе
 * экспортировать только default и служебные поля, а всё остальное валит `next build`
 * на сгенерированном валидаторе (см. `__tests__/pageExports.test.ts`). Вторая — эту
 * логику надо покрывать тестами, а страницу с доской и таймером для этого поднимать
 * не требуется.
 */

import { Chess } from 'chess.js';

export type Puzzle = {
  fen: string;
  sol: string[];
  theme: string;
  rating: number;
};

export const API_DAILY = '/api-backend/api/cyberchess-daily';
export const API_BANK = '/api-backend/api/cyberchess-puzzles';

/* Резервные позиции — показываются, только если банк недоступен. Держим их немного и
   честно: это не «пул задач», а страховка от пустого экрана.

   До 2026-08-10 из этих десяти позиций выбиралась САМА задача дня, по формуле
   `POOL[номер_суток % длина_пула]`. Формула совпадала с серверной, а длина пула нет
   (10 против 365), поэтому 355 дней из 365 игрок решал не ту задачу, которую сервер
   считал задачей дня и против которой записывал результат. Совпадение формул выглядело
   как согласованность и ею не было. */
export const FALLBACK_POOL: Puzzle[] = [
  { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1', sol: ['f3e5', 'c6e5', 'c4f7'], theme: 'Fork', rating: 1200 },
  { fen: 'r3k2r/ppp2ppp/2n1bn2/2bqp3/2B1P3/2NP1N2/PPPQ1PPP/R1B1K2R w KQkq - 0 1', sol: ['c3d5', 'f6d5', 'e4d5'], theme: 'Pin', rating: 1450 },
  { fen: 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1', sol: ['c4f7', 'g8f7', 'f3g5'], theme: 'Sacrifice', rating: 1600 },
  { fen: '2kr3r/ppp2ppp/2n1b3/3qp3/3PnB2/2N1PN2/PPP2PPP/R2QKB1R w KQ - 0 1', sol: ['d4e5', 'c6e5', 'f3e5'], theme: 'Double attack', rating: 1500 },
  { fen: 'r2qkb1r/ppp2ppp/2n1bn2/3p4/3P4/2N1PN2/PPP1BPPP/R1BQK2R w KQkq - 0 1', sol: ['c3d5', 'c6d4', 'd5f6'], theme: 'Discovered attack', rating: 1700 },
  { fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 1', sol: ['f3e5', 'c6e5', 'd3d4'], theme: 'Tactic', rating: 1300 },
  { fen: 'r4rk1/pppq1ppp/2n1bn2/3p4/3P4/2NBPN2/PPPQ1PPP/R4RK1 w - - 0 1', sol: ['d3h7', 'g8h7', 'f3g5'], theme: 'Greek gift', rating: 1800 },
  { fen: 'r2q1rk1/ppp1bppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1', sol: ['c4f7', 'f8f7', 'f3g5'], theme: 'Sacrifice', rating: 1550 },
  { fen: 'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 1', sol: ['c4d5', 'e6d5', 'c3d5'], theme: 'Opening trap', rating: 1100 },
  { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1', sol: ['c4f7', 'e8f7', 'f3e5'], theme: 'Fried liver', rating: 1400 },
];

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dayIndex(): number {
  return Math.floor(Date.parse(todayKey()) / 86400000);
}

/** Личность игрока — те же ключи localStorage, что и в остальном модуле шахмат. */
export function playerIdentity(): { userId: string; name: string } {
  if (typeof window === 'undefined') return { userId: '', name: '' };
  try {
    return {
      userId: window.localStorage.getItem('cyberchess.userId') || '',
      name: window.localStorage.getItem('cc_display_name') || '',
    };
  } catch {
    return { userId: '', name: '' };
  }
}

/** Запись банка: рейтинг там зовётся `r`, тема может отсутствовать. */
export type BankPuzzle = { fen?: unknown; sol?: unknown; r?: unknown; theme?: unknown };

/**
 * Приводим запись банка к тому, что умеет отрисовать страница.
 * Возвращаем null на всём, что нельзя поставить на доску: одна битая запись в банке
 * иначе роняет страницу целиком, и вместо задачи дня человек видит пустоту.
 */
export function bankPuzzleToLocal(raw: BankPuzzle | null | undefined): Puzzle | null {
  if (!raw || typeof raw.fen !== 'string' || !raw.fen) return null;
  if (!Array.isArray(raw.sol) || raw.sol.length === 0) return null;
  const sol = raw.sol.filter((m): m is string => typeof m === 'string' && m.length >= 4);
  /* Частично битое решение не «чиним» отбрасыванием плохих ходов: остаток — уже другая
     линия, и игрок получил бы «не тот ход» на правильном ходе. */
  if (sol.length !== raw.sol.length) return null;
  try {
    new Chess(raw.fen);
  } catch {
    return null;
  }
  const rating = typeof raw.r === 'number' && Number.isFinite(raw.r) ? Math.round(raw.r) : 0;
  const theme = typeof raw.theme === 'string' && raw.theme ? raw.theme : 'Тактика';
  return { fen: raw.fen, sol, theme, rating };
}
