'use client';
// CyberChess Daily Puzzle — real chess.js + 365 pool + leaderboard + streak

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { themeRu } from './themes';
import { tournamentUserId, tournamentDisplayName } from '../tournaments/playerIdentity';
import { Chess, Square } from 'chess.js';

type Puzzle = {
  /** Есть только у задач из банка; у встроенных его нет. */
  id?: string;
  fen: string;
  sol: string[];
  theme: string;
  rating: number;
};

type LeaderEntry = {
  name: string;
  streak: number;
  country: string;
  score?: number;
};

type HintLevel = 0 | 1 | 2 | 3;

// Десять встроенных задач — РЕЗЕРВ на случай, когда банк не ответил:
// показываются мгновенно, затем их заменяет настоящая задача дня.
// Раньше здесь стояло «30 mock puzzles» при десяти — счёт в комментарии
// стареет молча, а читатель верит ему, а не коду.
// Легальность ходов проверена chess.js: 10 из 10 (01.09.2026).
const POOL: Puzzle[] = [
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


// Списки NAMES и COUNTRIES удалены вместе с выдумкой: там лежали имена
// НАСТОЯЩИХ гроссмейстеров (Magnus, Hikaru, Ding), которыми подписывались
// несуществующие игроки. Показывать живых людей как своих пользователей
// нельзя, и держать такой список «на всякий случай» — значит однажды его
// снова использовать.
/**
 * Таблица лидеров приходит С СЕРВЕРА. Выдумывать её нельзя.
 *
 * Здесь стояла mockLeaderboard(): сто игроков с именами из списка и сериями до
 * 365 дней, показанные ровно как настоящие — медали, флаги, огонь. Живых
 * игроков при этом ноль. Такую таблицу человек читает как факт: «я 101-й из
 * ста», хотя соревноваться не с кем.
 *
 * Ту же выдумку из ста seed-игроков убрали из бэкенда 10.08; фронт продолжал
 * сочинять свою независимо. Теперь источник один — ручка
 * /api/cyberchess-daily/leaderboard, и три состояния различаются словами:
 * загрузка, пусто, отказ. Пустая таблица это НЕ отказ, и наоборот.
 */

// Unicode pieces by FEN char
const PIECE: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

/**
 * Названия фигур словами — для экранного диктора и клавиатуры.
 *
 * Найдено окном запуска 18.08.2026 живым прохождением: дерево доступности
 * видело один образ «Шахматная доска» без клеток и фигур, то есть партия была
 * недоступна и с клавиатуры, и с диктором. Символы ♔♕♖ диктор читает как
 * «белый шахматный король» на английском или молчит вовсе — подпись словами
 * нужна отдельно от глифа.
 */
const PIECE_NAME: Record<string, string> = {
  K: 'белый король', Q: 'белый ферзь', R: 'белая ладья',
  B: 'белый слон', N: 'белый конь', P: 'белая пешка',
  k: 'чёрный король', q: 'чёрный ферзь', r: 'чёрная ладья',
  b: 'чёрный слон', n: 'чёрный конь', p: 'чёрная пешка',
};

/** Подпись клетки: координата, что на ней стоит и что с ней можно сделать. */
function squareLabel(sq: string, piece: string, opts: { selected: boolean; legal: boolean }): string {
  const what = piece ? (PIECE_NAME[piece] ?? 'фигура') : 'пусто';
  const extra = [
    opts.selected ? 'выбрана' : '',
    opts.legal ? 'возможный ход' : '',
  ].filter(Boolean).join(', ');
  return extra ? `${sq}, ${what}, ${extra}` : `${sq}, ${what}`;
}

function coordToUci(r: number, c: number): string {
  const file = 'abcdefgh'[c];
  const rank = String(8 - r);
  return `${file}${rank}`;
}

function uciToCoord(uci: string): [number, number] {
  const file = uci.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = 8 - parseInt(uci[1], 10);
  return [rank, file];
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayIndex(): number {
  return Math.floor(Date.parse(todayKey()) / 86400000);
}

function pieceCharFromChess(piece: { type: string; color: 'w' | 'b' } | null): string {
  if (!piece) return '';
  const ch = piece.type;
  return piece.color === 'w' ? ch.toUpperCase() : ch.toLowerCase();
}

function buildBoardFromChess(chess: Chess): string[][] {
  const board = chess.board();
  return board.map((row) => row.map((sq) => pieceCharFromChess(sq as any)));
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function DailyPuzzlePage() {
  /**
   * Задача дня приходит С СЕРВЕРА, а встроенный набор — только запасной путь.
   *
   * Замер 19.08.2026: в банке ChessPuzzle 502 584 записи с живыми темами и
   * рейтингами, а страница брала позицию из тридцати, зашитых в браузерный
   * пакет. Тридцать — это цикл повтора в месяц; к публичному запуску 30.08
   * человек его заметит. Ручка бэкенда при этом уже отдавала настоящую задачу —
   * страница её просто не звала.
   *
   * Порядок именно такой: встроенная показывается СРАЗУ (страница не ждёт сеть
   * и работает даже при мёртвом бэкенде), а как только придёт настоящая —
   * заменяет её. Обратный порядок дал бы пустую доску на секунду и белый экран
   * при недоступной сети.
   */
  const [puzzle, setPuzzle] = useState<Puzzle>(() => POOL[dayIndex() % POOL.length]);
  const [fromBank, setFromBank] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [lbState, setLbState] = useState<'loading' | 'ok' | 'failed'>('loading');

  // chess engine (mutable via ref to keep instance stable across renders)
  const chessRef = useRef<Chess>(new Chess(puzzle.fen));
  const [board, setBoard] = useState<string[][]>(() => buildBoardFromChess(chessRef.current));
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [legalDests, setLegalDests] = useState<string[]>([]); // list of UCI dest squares for current selected
  const [lastMove, setLastMove] = useState<{ from: [number, number]; to: [number, number] } | null>(null);

  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [solved, setSolved] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [shareCopied, setShareCopied] = useState(false);

  // Puzzle solution flow
  const [solIndex, setSolIndex] = useState(0); // index in puzzle.sol the player must play next
  const [hintLevel, setHintLevel] = useState<HintLevel>(0);
  const [hintsUsed, setHintsUsed] = useState(0);

  // Promotion modal state
  const [promoMove, setPromoMove] = useState<{ from: Square; to: Square } | null>(null);

  // Stopwatch
  const [timeMs, setTimeMs] = useState(0);
  const [running, setRunning] = useState(false);
  const startedAtRef = useRef<number | null>(null);

  // Bot reply pending (visual)
  const [botPending, setBotPending] = useState(false);

  // Таблица лидеров — с сервера, и её три состояния различаются. Пустой список
  // на упавшем запросе выглядел бы так же, как честное «никто ещё не решал», —
  // а это разные вещи для человека, который решает, стоит ли играть.
  useEffect(() => {
    let alive = true;
    fetch('/api-backend/api/cyberchess-daily/leaderboard?limit=100', { signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (!alive) return;
        const rows = Array.isArray(j?.leaderboard) ? j.leaderboard : [];
        setLeaderboard(
          rows.map((e: Record<string, unknown>) => ({
            name: String(e.name ?? e.userId ?? 'игрок'),
            streak: Number(e.streak) || 0,
            country: String(e.country ?? '🌍'),
            score: typeof e.score === 'number' ? e.score : undefined,
          })),
        );
        setLbState('ok');
      })
      .catch(() => {
        if (alive) setLbState('failed');
      });
    return () => {
      alive = false;
    };
  }, []);

  // Забираем настоящую задачу дня. Ошибку глотаем намеренно: страница уже
  // показывает встроенную, и падать из-за сети ей незачем — но подпись внизу
  // честно скажет, что задача резервная.
  useEffect(() => {
    let alive = true;
    fetch('/api-backend/api/cyberchess-daily/puzzle', { signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        const p = j?.puzzle;
        if (!p?.fen || !Array.isArray(p.sol) || p.sol.length === 0) return;
        // Ходы обязаны быть ходами. Проверка стоит здесь, а не только на
        // сервере, потому что ПОТРЕБИТЕЛЬ значения — движок на этой странице:
        // он сравнивает ход игрока с этим списком, и мусор в списке делает
        // задачу нерешаемой молча, без единой ошибки на экране.
        //
        // Так и случилось 19.08.2026: сервер отдавал `["c5c3"` вместо `c5c3`,
        // а здешняя проверка `Array.isArray` пропускала — массив-то был.
        const sol = p.sol.map((m: unknown) => String(m));
        if (!sol.every((m: string) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m))) return;
        setPuzzle({
          id: String(p.id),
          fen: String(p.fen),
          sol,
          theme: String(p.theme ?? 'Тактика'),
          rating: Number(p.rating) || 1200,
        });
        // Признак берётся из ответа сервера, а не угадывается: сервер сам знает,
        // ответил ли банк.
        //
        // Раньше здесь стояла проверка ПОДСТРОКИ в source — и она давала
        // обратный ответ: строка отказа «резервный пул из 30 задач: банк не
        // ответил» содержит слово «банк», поэтому страница писала «задача из
        // общего банка, одна и та же у всех» ровно в тот момент, когда банк
        // не ответил. Замер 02.09.2026: сервер сказал «банк не ответил»,
        // экран сказал обратное.
        //
        // Теперь читаем машинный признак. Старый разбор оставлен запасным на
        // случай сервера прежней версии, но точным сравнением, а не подстрокой.
        setFromBank(
          typeof j?.fromBank === 'boolean'
            ? j.fromBank
            : j?.source === 'ChessPuzzle — настоящий банк задач',
        );
      })
      .catch(() => {
        /* остаёмся на встроенной задаче */
      });
    return () => {
      alive = false;
    };
  }, []);

  // Смена задачи обязана сбросить ВСЁ состояние решения. Иначе останутся ходы
  // и подсказки от прошлой позиции — тот же класс, что «ответы под чужими
  // вопросами».
  useEffect(() => {
    chessRef.current = new Chess(puzzle.fen);
    setBoard(buildBoardFromChess(chessRef.current));
    setSelected(null);
    setLegalDests([]);
    setLastMove(null);
    setSolIndex(0);
    setHintLevel(0);
    setHintsUsed(0);
    setSolved(false);
    setMessage('');
    setPromoMove(null);
    setBotPending(false);
  }, [puzzle]);

  // load streak from localStorage on mount
  useEffect(() => {
    try {
      const today = todayKey();
      const lastSolved = localStorage.getItem('cc_daily_last_solved') || '';
      const rawStreak = parseInt(localStorage.getItem('cc_daily_streak') || '0', 10) || 0;
      const rawBest = parseInt(localStorage.getItem('cc_daily_best_streak') || '0', 10) || 0;

      let curStreak = rawStreak;
      if (lastSolved) {
        const diff = (Date.parse(today) - Date.parse(lastSolved)) / 86400000;
        if (diff > 1) {
          curStreak = 0;
          localStorage.setItem('cc_daily_streak', '0');
        }
      }
      setStreak(curStreak);
      setBestStreak(rawBest);
      if (lastSolved === today) {
        setSolved(true);
        setMessage(`Уже решено сегодня. Серия: ${curStreak}`);
      }
    } catch {
      // ignore
    }
  }, []);

  // Stopwatch tick
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (startedAtRef.current != null) {
        setTimeMs(Date.now() - startedAtRef.current);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [running]);

  const startTimerIfNeeded = useCallback(() => {
    if (startedAtRef.current == null) {
      startedAtRef.current = Date.now();
      setRunning(true);
    }
  }, []);

  const stopTimer = useCallback(() => {
    setRunning(false);
    if (startedAtRef.current != null) {
      setTimeMs(Date.now() - startedAtRef.current);
    }
  }, []);

  const refreshBoard = useCallback(() => {
    setBoard(buildBoardFromChess(chessRef.current));
  }, []);

  const computeLegalDests = useCallback((fromSq: Square): string[] => {
    try {
      const moves = chessRef.current.moves({ square: fromSq, verbose: true }) as any[];
      return moves.map((m) => m.to as string);
    } catch {
      return [];
    }
  }, []);

  const playBotReply = useCallback((expectedSol: string[], nextIdx: number) => {
    if (nextIdx >= expectedSol.length) return;
    const botUci = expectedSol[nextIdx];
    if (!botUci || botUci.length < 4) return;
    const from = botUci.slice(0, 2) as Square;
    const to = botUci.slice(2, 4) as Square;
    const promotion = botUci.length === 5 ? botUci[4] : undefined;
    setBotPending(true);
    window.setTimeout(() => {
      try {
        const res = chessRef.current.move({ from, to, promotion: promotion as any });
        if (res) {
          setLastMove({ from: uciToCoord(from), to: uciToCoord(to) });
          refreshBoard();
        }
      } catch {
        // ignore — invalid bot move in fixture, just skip
      }
      setBotPending(false);
    }, 450);
  }, [refreshBoard]);

  const finalizeSolved = useCallback(async (totalMs: number, hUsed: number) => {
    const today = todayKey();
    const usedHints = hUsed > 0;
    // Streak: hint-use breaks streak gain but does not zero it. Per spec:
    // "Использование hint = streak break (но не reset)" → we interpret as: streak stays same, no +1.
    const newStreak = usedHints ? streak : streak + 1;
    const newBest = Math.max(bestStreak, newStreak);
    try {
      localStorage.setItem('cc_daily_streak', String(newStreak));
      localStorage.setItem('cc_daily_best_streak', String(newBest));
      localStorage.setItem('cc_daily_last_solved', today);
      localStorage.setItem('cc_daily_last_time_ms', String(totalMs));
      localStorage.setItem('cc_daily_last_hints', String(hUsed));
    } catch {}
    setStreak(newStreak);
    setBestStreak(newBest);
    setSolved(true);
    stopTimer();
    setMessage(
      usedHints
        ? `Решено за ${formatTime(totalMs)} с подсказками (${hUsed}). Серия не растёт, но и не сбрасывается: ${newStreak}.`
        : `Поздравляем! Решено за ${formatTime(totalMs)}. Серия +1 = ${newStreak}. Рекорд: ${newBest}`
    );

    // Отправка на сервер. Изменилось два раза за 19.08.2026, и оба важны.
    //
    // 1. Шлём ХОДЫ, а не длину серии. Прежде сервер брал `streak` числом на
    //    веру — проверено на проде: запрос со «серией 364» без единого хода
    //    ставил отправителя первым в таблице. Теперь сервер сверяет решение и
    //    считает серию сам.
    // 2. Шлём userId. Без него сервер считал игрока анонимом и В ТАБЛИЦУ НЕ
    //    ЗАНОСИЛ вовсе: человек решал задачу и не появлялся в списке никогда.
    //    Личность — из общего источника модуля, а не своя четвёртая.
    try {
      const r = await fetch('/api-backend/api/cyberchess-daily/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day: today,
          moves: puzzle.sol,
          timeMs: totalMs,
          hintsUsed: hUsed,
          userId: tournamentUserId(),
          name: tournamentDisplayName() || undefined,
        }),
      });
      // Серию показываем ТУ, что признал сервер: иначе на экране одно число, а
      // в таблице лидеров другое — два писателя одного значения.
      if (r.ok) {
        const j = (await r.json()) as { streak?: number; bestStreak?: number };
        if (typeof j.streak === 'number') {
          setStreak(j.streak);
          try { localStorage.setItem('cc_daily_streak', String(j.streak)); } catch {}
          // Сообщение тоже пересобирается по серверному числу. Иначе экран
          // противоречит сам себе: в тексте одно, на значке другое. Расходятся
          // они в понятном случае — местная серия осталась с давних времён, а
          // вчерашний день не решён, и сервер честно отвечает 0.
          if (j.streak !== newStreak) {
            setMessage(
              usedHints
                ? `Решено за ${formatTime(totalMs)} с подсказками (${hUsed}). Серия не растёт: ${j.streak}.`
                : `Поздравляем! Решено за ${formatTime(totalMs)}. Серия: ${j.streak}.`
            );
          }
        }
        if (typeof j.bestStreak === 'number') {
          setBestStreak(j.bestStreak);
          try { localStorage.setItem('cc_daily_best_streak', String(j.bestStreak)); } catch {}
        }
      } else {
        // ОТКАЗ СЕРВЕРА. Раньше здесь не было ничего: местная серия уже выросла,
        // человек видел «Серия +1», а сервер её не признал — и назавтра число
        // молча менялось. Это те же «два писателя одного значения», от которых
        // защищается ветка выше, только в тихой половине.
        //
        // Технический код (moves_required, wrong_day) не показываем: сервер шлёт
        // рядом человеческую подсказку, её и читаем, а код уходит в консоль.
        let podskazka = 'Сервер не засчитал решение. Попробуйте ещё раз.';
        try {
          const j = (await r.json()) as { error?: string; hint?: string };
          if (typeof j.hint === 'string' && j.hint) podskazka = j.hint;
          console.warn('[daily] сервер отказал:', j.error ?? r.status);
        } catch {
          console.warn('[daily] сервер отказал:', r.status);
        }
        setMessage(podskazka);

        // ОТКАТ. Серию мы прибавляем ДО запроса намеренно: страница обязана
        // работать без сети, и обрыв связи (ветка catch ниже) местный счёт не
        // трогает — он догонит при следующей удачной отправке.
        //
        // Но отказ сервера — не обрыв. Это определённое «нет»: ходы не те,
        // день не тот. Оставить прибавку значит показывать человеку серию,
        // которой у него нет, и молча расходиться с таблицей лидеров.
        setStreak(streak);
        setBestStreak(bestStreak);
        setSolved(false);
        try {
          localStorage.setItem('cc_daily_streak', String(streak));
          localStorage.setItem('cc_daily_best_streak', String(bestStreak));
          localStorage.removeItem('cc_daily_last_solved');
        } catch {}
      }
    } catch {
      // ignore network errors — local state already saved
    }
  }, [streak, bestStreak, stopTimer]);

  const applyPlayerMove = useCallback((from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n') => {
    if (solved) return;
    const expectedUci = puzzle.sol[solIndex];
    if (!expectedUci) return;

    const attemptedUci = `${from}${to}${promotion || ''}`;
    const expectedFrom = expectedUci.slice(0, 2);
    const expectedTo = expectedUci.slice(2, 4);
    const expectedPromo = expectedUci.length === 5 ? expectedUci[4] : undefined;

    const correct =
      from === expectedFrom &&
      to === expectedTo &&
      (expectedPromo ? promotion === expectedPromo : true);

    // Try to apply the move on a snapshot to validate legality first
    const snapshotFen = chessRef.current.fen();
    let moveRes: any = null;
    try {
      moveRes = chessRef.current.move({ from, to, promotion: promotion as any });
    } catch {
      moveRes = null;
    }
    if (!moveRes) {
      setMessage('Невозможный ход. Попробуй другой.');
      return;
    }

    startTimerIfNeeded();
    setLastMove({ from: uciToCoord(from), to: uciToCoord(to) });
    refreshBoard();
    setSelected(null);
    setLegalDests([]);

    if (!correct) {
      // wrong move: rollback engine, board, and inform user
      const c2 = new Chess(snapshotFen);
      chessRef.current = c2;
      refreshBoard();
      setLastMove(null);
      setMessage(`Не тот ход для этой задачи. Ожидался другой. Попробуй ещё раз.`);
      return;
    }

    // Correct move
    const nextIdx = solIndex + 1;
    setSolIndex(nextIdx);

    if (nextIdx >= puzzle.sol.length) {
      // Solved (final player move)
      const totalMs = startedAtRef.current != null ? Date.now() - startedAtRef.current : timeMs;
      setTimeMs(totalMs);
      finalizeSolved(totalMs, hintsUsed);
      return;
    }

    // Check if next move is bot's reply: in pool, player plays sol[0], sol[2], sol[4], ...
    // Indices 1, 3, ... are bot replies.
    if (nextIdx % 2 === 1 && nextIdx < puzzle.sol.length) {
      setMessage(`Верно. Бот отвечает...`);
      playBotReply(puzzle.sol, nextIdx);
      // After bot reply, advance solIndex past bot's move
      window.setTimeout(() => {
        setSolIndex((s) => s + 1);
        const afterBotIdx = nextIdx + 1;
        if (afterBotIdx >= puzzle.sol.length) {
          // Это ОСНОВНОЙ путь завершения, а не запасной. Прежний комментарий
          // говорил «shouldn't happen, but guard» — и приглашал удалить живой
          // код при первой уборке.
          //
          // Замер по настоящему банку 19.08.2026: у всех семи проверенных задач
          // решение ЧЁТНОЙ длины (четыре и шесть ходов). Игрок ходит по чётным
          // индексам, бот по нечётным — значит последний ход делает бот, и
          // задача закрывается ровно здесь. Нечётная длина (игрок ходит
          // последним) закрывается выше, по nextIdx >= sol.length.
          const totalMs = startedAtRef.current != null ? Date.now() - startedAtRef.current : timeMs;
          finalizeSolved(totalMs, hintsUsed);
        } else {
          setMessage('Твой ход.');
        }
      }, 600);
    } else {
      setMessage('Верно. Продолжай.');
    }
  }, [solved, puzzle.sol, solIndex, hintsUsed, timeMs, refreshBoard, startTimerIfNeeded, playBotReply, finalizeSolved]);

  function onCellClick(r: number, c: number) {
    if (solved || botPending || promoMove) return;
    const sq = coordToUci(r, c) as Square;
    const pieceHere = board[r][c];

    if (!selected) {
      // must select a piece of side-to-move
      if (!pieceHere) return;
      const isWhitePiece = pieceHere === pieceHere.toUpperCase();
      const sideToMove = chessRef.current.turn(); // 'w' | 'b'
      if ((sideToMove === 'w' && !isWhitePiece) || (sideToMove === 'b' && isWhitePiece)) {
        // not your piece
        return;
      }
      setSelected([r, c]);
      setLegalDests(computeLegalDests(sq));
      return;
    }

    const [fr, fc] = selected;
    if (fr === r && fc === c) {
      setSelected(null);
      setLegalDests([]);
      return;
    }

    // If clicking another own piece — reselect
    if (pieceHere) {
      const isWhitePiece = pieceHere === pieceHere.toUpperCase();
      const sideToMove = chessRef.current.turn();
      if ((sideToMove === 'w' && isWhitePiece) || (sideToMove === 'b' && !isWhitePiece)) {
        setSelected([r, c]);
        setLegalDests(computeLegalDests(sq));
        return;
      }
    }

    // Attempt the move
    const fromSq = coordToUci(fr, fc) as Square;
    const toSq = sq;

    // Detect promotion
    const fromPiece = board[fr][fc];
    const isPawn = fromPiece.toLowerCase() === 'p';
    const promotionRank = fromPiece === 'P' ? 0 : fromPiece === 'p' ? 7 : -1;
    if (isPawn && r === promotionRank) {
      // Ask for piece (modal). Auto-queen default but user can pick.
      setPromoMove({ from: fromSq, to: toSq });
      return;
    }

    applyPlayerMove(fromSq, toSq);
  }

  function chooseHint() {
    if (solved) return;
    const next = Math.min(3, hintLevel + 1) as HintLevel;
    setHintLevel(next);
    setHintsUsed((h) => h + 1);
    const exp = puzzle.sol[solIndex];
    if (!exp) return;
    if (next === 1) {
      setMessage(`Подсказка 1/3: ищи ход в районе клетки ${exp.slice(0, 2)}.`);
    } else if (next === 2) {
      setMessage(`Подсказка 2/3: ход начинается с ${exp.slice(0, 2)}.`);
    } else {
      setMessage(`Подсказка 3/3: полный ход — ${exp}.`);
    }
  }

  function resetBoard() {
    if (solved) return;
    chessRef.current = new Chess(puzzle.fen);
    refreshBoard();
    setSelected(null);
    setLegalDests([]);
    setLastMove(null);
    setSolIndex(0);
    setMessage('Доска сброшена. Твой ход.');
    // Note: timer continues; hints are kept (penalty stays)
  }

  async function sharePuzzle() {
    const text = `Я решил puzzle of the day на AEVION CyberChess streak ${streak}! 🧩 #AEVION`;
    try {
      await navigator.clipboard.writeText(text);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setMessage('Не удалось скопировать. Текст: ' + text);
    }
  }

  function confirmPromotion(piece: 'q' | 'r' | 'b' | 'n') {
    if (!promoMove) return;
    const { from, to } = promoMove;
    setPromoMove(null);
    applyPlayerMove(from, to, piece);
  }

  function cancelPromotion() {
    setPromoMove(null);
  }

  const isLastMoveCell = (r: number, c: number) => {
    if (!lastMove) return false;
    return (lastMove.from[0] === r && lastMove.from[1] === c) || (lastMove.to[0] === r && lastMove.to[1] === c);
  };
  const isLegalDest = (r: number, c: number) => legalDests.includes(coordToUci(r, c));

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a14 0%, #14081a 100%)',
        color: '#e6e6f0',
        padding: '32px 24px',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <h1
          style={{
            fontSize: 36,
            fontWeight: 800,
            margin: '0 0 8px 0',
            background: 'linear-gradient(90deg, #00ff9d 0%, #b56bff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          🧩 Задача дня
        </h1>
        <p style={{ color: '#9aa0b4', margin: '0 0 24px 0', fontSize: 14 }}>
          Одна задача в день. Решай каждый день — держи серию. Многоходовые задачи: бот отвечает за противника.
        </p>

        {/* Перенос вместо сетки: жёсткие 360px боковой колонки плюс отступ 24 не
            помещались в телефон (замер: документ 408 при экране 375). При переносе
            широкий экран не меняется — колонки те же 896/360, проверено. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          {/* Left: board + controls */}
          <div style={{ flex: '1 1 520px', minWidth: 0 }}>
            <div
              style={{
                background: 'rgba(20, 20, 32, 0.6)',
                border: '1px solid rgba(0, 255, 157, 0.2)',
                borderRadius: 16,
                padding: 20,
                boxShadow: '0 0 40px rgba(0, 255, 157, 0.08)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#9aa0b4' }}>Тема</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#00ff9d' }}>{themeRu(puzzle.theme)}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#9aa0b4' }}>Время</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#ffd84d', fontVariantNumeric: 'tabular-nums' }}>
                    ⏱ {formatTime(timeMs)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#9aa0b4' }}>Рейтинг</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#b56bff' }}>{puzzle.rating}</div>
                </div>
              </div>

              {/* Откуда задача. Без этой строки резервная позиция неотличима от
                  настоящей: та же доска, та же тема, тот же рейтинг — и человек
                  решает, что играет сегодняшнюю задачу всей платформы, когда на
                  самом деле банк не ответил и ему досталась одна из тридцати
                  встроенных. Признак берётся с сервера, а не угадывается. */}
              <div
                data-testid="daily-puzzle-source"
                style={{ fontSize: 12, color: fromBank ? '#9aa0b4' : '#ffd84d', marginBottom: 10 }}
              >
                {fromBank
                  ? 'Задача дня из общего банка — одна и та же у всех игроков сегодня'
                  : 'Резервная задача: банк задач не ответил, у других игроков сегодня может быть другая'}
              </div>

              <div style={{ position: 'relative' }}>
                <div
                  // Имя у самой доски: без него диктор объявляет 64 кнопки
                  // подряд, не сказав, что это. Роль grid не ставим намеренно —
                  // она потребовала бы строк и ячеек по спецификации, а
                  // полсделанной семантики хуже honest-простой.
                  aria-label="Шахматная доска задачи дня"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(8, 1fr)',
                    width: 'min(560px, 100%)',
                    aspectRatio: '1 / 1',
                    margin: '0 auto',
                    border: '2px solid #2a2a3e',
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  {board.map((row, r) =>
                    row.map((piece, c) => {
                      const dark = (r + c) % 2 === 1;
                      const sel = selected && selected[0] === r && selected[1] === c;
                      const hl = isLastMoveCell(r, c);
                      const legal = isLegalDest(r, c);
                      const bg = sel
                        ? 'rgba(0, 255, 157, 0.45)'
                        : hl
                        ? 'rgba(181, 107, 255, 0.35)'
                        : dark
                        ? '#1a1a28'
                        : '#2a2a3e';
                      const isWhite = piece && piece === piece.toUpperCase();
                      const sq = coordToUci(r, c);
                      return (
                        // Кнопка, а не div: фокус с клавиатуры, Enter и пробел
                        // работают сами, роль читается диктором. Раньше клетки
                        // были неинтерактивными для всех, кто не пользуется
                        // мышью.
                        <button
                          type="button"
                          key={`${r}-${c}`}
                          onClick={() => onCellClick(r, c)}
                          aria-label={squareLabel(sq, piece, { selected: !!sel, legal: !!legal })}
                          aria-pressed={!!sel}
                          disabled={solved || botPending}
                          style={{
                            border: 'none',
                            font: 'inherit',
                            padding: 0,
                            background: bg,
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 'clamp(20px, 5vw, 42px)',
                            cursor: solved || botPending ? 'default' : 'pointer',
                            userSelect: 'none',
                            color: isWhite ? '#ffffff' : '#0a0a14',
                            textShadow: isWhite ? '0 0 4px rgba(0,0,0,0.6)' : '0 0 4px rgba(255,255,255,0.4)',
                            transition: 'background 120ms',
                          }}
                        >
                          {piece ? PIECE[piece] || '' : ''}
                          {legal && (
                            <span
                              style={{
                                position: 'absolute',
                                width: piece ? '70%' : '28%',
                                height: piece ? '70%' : '28%',
                                borderRadius: '50%',
                                background: piece ? 'transparent' : 'rgba(0, 255, 157, 0.55)',
                                border: piece ? '3px solid rgba(0, 255, 157, 0.7)' : 'none',
                                pointerEvents: 'none',
                              }}
                            />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                {promoMove && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.65)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      gap: 12,
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ color: '#e6e6f0', fontWeight: 700 }}>Выбери фигуру для превращения</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['q', 'r', 'b', 'n'] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => confirmPromotion(p)}
                          style={{
                            fontSize: 32,
                            width: 56,
                            height: 56,
                            border: '2px solid #00ff9d',
                            borderRadius: 8,
                            background: '#14081a',
                            color: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          {p === 'q' ? '♕' : p === 'r' ? '♖' : p === 'b' ? '♗' : '♘'}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={cancelPromotion}
                      style={{
                        background: 'transparent',
                        color: '#9aa0b4',
                        border: '1px solid #3a3a52',
                        borderRadius: 6,
                        padding: '4px 12px',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                <button
                  onClick={chooseHint}
                  disabled={solved || hintLevel === 3}
                  style={{
                    background: solved || hintLevel === 3 ? '#2a2a3e' : 'linear-gradient(90deg, #ffd84d 0%, #f6a700 100%)',
                    color: solved || hintLevel === 3 ? '#9aa0b4' : '#0a0a14',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 20px',
                    fontWeight: 700,
                    cursor: solved || hintLevel === 3 ? 'not-allowed' : 'pointer',
                    fontSize: 14,
                  }}
                  title="3 уровня подсказки: район → клетка-начало → полный ход. Каждая тратит одну подсказку и снимает прибавку к серии за эту задачу."
                >
                  💡 Подсказка ({hintLevel}/3)
                </button>
                <button
                  onClick={resetBoard}
                  disabled={solved}
                  style={{
                    background: 'transparent',
                    color: '#e6e6f0',
                    border: '1px solid #3a3a52',
                    borderRadius: 8,
                    padding: '10px 20px',
                    fontWeight: 600,
                    cursor: solved ? 'not-allowed' : 'pointer',
                    fontSize: 14,
                  }}
                >
                  ↺ Сброс
                </button>
                <button
                  onClick={sharePuzzle}
                  style={{
                    background: 'linear-gradient(90deg, #b56bff 0%, #8b3dff 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 20px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  {shareCopied ? '✓ Скопировано!' : '📤 Поделиться'}
                </button>
              </div>

              {message && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 8,
                    background: solved ? 'rgba(0, 255, 157, 0.1)' : 'rgba(181, 107, 255, 0.08)',
                    border: `1px solid ${solved ? 'rgba(0, 255, 157, 0.3)' : 'rgba(181, 107, 255, 0.25)'}`,
                    fontSize: 14,
                  }}
                >
                  {message}
                </div>
              )}
            </div>

            {/* Streak stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
              <div
                style={{
                  background: 'rgba(20, 20, 32, 0.6)',
                  border: '1px solid rgba(0, 255, 157, 0.2)',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 12, color: '#9aa0b4' }}>Текущая серия</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#00ff9d' }}>🔥 {streak}</div>
              </div>
              <div
                style={{
                  background: 'rgba(20, 20, 32, 0.6)',
                  border: '1px solid rgba(181, 107, 255, 0.2)',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 12, color: '#9aa0b4' }}>Лучшая серия</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#b56bff' }}>🏆 {bestStreak}</div>
              </div>
              <div
                style={{
                  background: 'rgba(20, 20, 32, 0.6)',
                  border: '1px solid rgba(255, 216, 77, 0.2)',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 12, color: '#9aa0b4' }}>Подсказки</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#ffd84d' }}>💡 {hintsUsed}</div>
              </div>
            </div>
          </div>

          {/* Right: leaderboard */}
          <div
            style={{
              flex: '0 1 360px',
              minWidth: 0,
              background: 'rgba(20, 20, 32, 0.6)',
              border: '1px solid rgba(181, 107, 255, 0.2)',
              borderRadius: 16,
              padding: 16,
              maxHeight: 'calc(100vh - 80px)',
              overflowY: 'auto',
            }}
          >
            {/* Название по факту, а не по замыслу. Сервер хранит МАКСИМАЛЬНУЮ
                серию игрока за всё время (`Math.max` при обновлении), а не
                текущую. «Top-100 Streaks» читается как «сейчас», и человек с
                серией 3 не понимал бы, почему рядом стоит 40 у того, кто уже
                месяц не заходил. Название исправлено, потому что менять правило
                хуже: таблица, ежедневно вычёркивающая людей, отталкивает. */}
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px 0', color: '#b56bff' }}>
              🏆 Лучшие серии — топ-100
            </h2>
            <div style={{ fontSize: 11, color: '#9aa0b4', margin: '0 0 10px 0' }}>
              Личный рекорд каждого игрока, а не серия на сегодня.
            </div>
            {/* Три состояния различаются СЛОВАМИ. Пустой список и отказ
                выглядели бы одинаково — пустой таблицей, — а для человека это
                разные вещи: в первом случае он первый, во втором мы не знаем. */}
            {lbState === 'loading' && (
              <div style={{ fontSize: 13, color: '#9aa0b4' }}>Загружаем таблицу…</div>
            )}
            {lbState === 'failed' && (
              <div data-testid="daily-lb-failed" style={{ fontSize: 13, color: '#ffd84d' }}>
                Таблицу не удалось загрузить. Это не значит, что она пуста — мы просто не смогли
                спросить сервер.
              </div>
            )}
            {lbState === 'ok' && leaderboard.length === 0 && (
              <div data-testid="daily-lb-empty" style={{ fontSize: 13, color: '#9aa0b4' }}>
                Сегодня задачу ещё никто не решил. Решите — и будете первым.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {leaderboard.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 24px 1fr auto',
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: i < 3 ? 'rgba(0, 255, 157, 0.06)' : 'transparent',
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: i < 3 ? '#00ff9d' : '#9aa0b4', fontWeight: 700 }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </span>
                  <span>{entry.country}</span>
                  <span style={{ color: '#e6e6f0' }}>{entry.name}</span>
                  <span style={{ color: '#00ff9d', fontWeight: 700 }}>🔥{entry.streak}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
