'use client';
/* CyberChess — задача дня.
 *
 * Задача берётся из общего банка (`/api/cyberchess-puzzles/daily`) — из того же
 * места, что и виджет «пазл дня» на главной странице, чтобы у продукта была ОДНА
 * задача дня.
 *
 * До 2026-08-10 эта страница выбирала задачу сама, из десяти зашитых позиций, по
 * формуле `POOL[номер_суток % длина_пула]`. Формула та же, что на сервере, а длина
 * пула другая (10 против 365) — значит 355 дней из 365 игрок решал не ту задачу,
 * которую сервер считал задачей дня и против которой записывал результат.
 * Совпадение формул выглядело как согласованность и ею не было.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Chess, Square } from 'chess.js';
import { bumpDaily } from '../DailyMission';
import {
  API_BANK,
  API_DAILY,
  FALLBACK_POOL,
  bankPuzzleToLocal,
  dayIndex,
  playerIdentity,
  todayKey,
  type Puzzle,
} from './dailyPuzzleSource';

type LeaderEntry = {
  name: string;
  streak: number;
  country: string;
  score?: number;
};

type HintLevel = 0 | 1 | 2 | 3;

/** Откуда взялась показанная задача — это видно игроку, а не только в консоли. */
type PuzzleSource = 'bank' | 'fallback';

/* Таблица лидеров раньше рисовалась здесь функцией `mockLeaderboard()`: сто
   выдуманных игроков — Magnus, Hikaru, Carlsen — со streak'ами от 365 вниз и
   разбросом через `Math.random()`. Заголовок над ними говорил «🏆 Top-100
   Streaks», без пометки, что это декорация. Реальный игрок с серией 3 видел себя
   не просто вне сотни, а вне мира. Теперь показываем тех, кто действительно
   решал: пусто — значит пусто. */

// Unicode pieces by FEN char
const PIECE: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

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
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [puzzleSource, setPuzzleSource] = useState<PuzzleSource | null>(null);
  // null = ещё не ответили; [] = ответили, и решавших пока нет
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[] | null>(null);
  // Отдельно от пустой таблицы: пустая означает «никто не решал», а это
  // заявление обо ВСЕХ игроках. Получать его из упавшего запроса нельзя.
  const [standingsFailed, setStandingsFailed] = useState(false);
  const [serverStats, setServerStats] = useState<{ bestStreak: number; totalSolved: number } | null>(null);

  // chess engine (mutable via ref to keep instance stable across renders)
  const chessRef = useRef<Chess>(new Chess());
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

  /* Задача дня — из общего банка, как у виджета на главной. Резервные позиции
     берём, только если банк не ответил, и говорим об этом на экране: иначе игрок
     решит одну задачу, а в зачёт пойдёт другая, и он об этом не узнает. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: Puzzle | null = null;
      try {
        const r = await fetch(`${API_BANK}/daily`);
        if (r.ok) {
          const d = await r.json();
          if (d && d.ok) next = bankPuzzleToLocal(d.puzzle);
        }
      } catch {
        // сеть недоступна — ниже возьмём резерв
      }
      if (cancelled) return;
      if (next) {
        setPuzzle(next);
        setPuzzleSource('bank');
      } else {
        setPuzzle(FALLBACK_POOL[dayIndex() % FALLBACK_POOL.length]);
        setPuzzleSource('fallback');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Доска следует за задачей: она приходит из сети, а не существует с первого рендера
  useEffect(() => {
    if (!puzzle) return;
    chessRef.current = new Chess(puzzle.fen);
    setBoard(buildBoardFromChess(chessRef.current));
    setSelected(null);
    setLegalDests([]);
    setLastMove(null);
    setSolIndex(0);
  }, [puzzle]);

  // Таблица лидеров и личная статистика — с сервера, без выдуманных строк
  const loadStandings = useCallback(async () => {
    try {
      const r = await fetch(`${API_DAILY}/leaderboard?limit=100`);
      if (r.ok) {
        const d = await r.json();
        // Пустой список от ответившего сервера — законный ответ: сегодня ещё
        // никто не решал. Пустой список ВМЕСТО ответа — совсем другое.
        setLeaderboard(Array.isArray(d?.leaderboard) ? (d.leaderboard as LeaderEntry[]) : []);
        setStandingsFailed(false);
      } else {
        setLeaderboard(null);
        setStandingsFailed(true);
      }
    } catch {
      setLeaderboard(null);
      setStandingsFailed(true);
    }
    const { userId } = playerIdentity();
    if (!userId) return;
    try {
      const r = await fetch(`${API_DAILY}/user/${encodeURIComponent(userId)}/stats`);
      if (!r.ok) return;
      const d = await r.json();
      if (typeof d?.bestStreak === 'number' && typeof d?.totalSolved === 'number') {
        setServerStats({ bestStreak: d.bestStreak, totalSolved: d.totalSolved });
      }
    } catch {
      // личная статистика не критична для игры — молча остаёмся на локальной
    }
  }, []);

  useEffect(() => {
    void loadStandings();
  }, [loadStandings]);

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
        setMessage(`Уже решено сегодня. Streak: ${curStreak}`);
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
        ? `Решено за ${formatTime(totalMs)} с подсказками (${hUsed}). Streak не растёт, но и не сбрасывается: ${newStreak}.`
        : `Поздравляем! Решено за ${formatTime(totalMs)}. Streak +1 = ${newStreak}. Best: ${newBest}`
    );

    /* Засчитываем задание «Реши пазл дня». Раньше это делал только виджет на
       главной, а сюда ведут и карточка раздела, и палитра команд, и push-
       уведомление — то есть игрок решал пазл дня и видел задание невыполненным. */
    try {
      bumpDaily('daily-puzzle');
    } catch {
      // счётчик заданий не должен мешать засчитать решение
    }

    /* Отправляем результат на сервер. Личность обязательна: бэкенд по своему же
       правилу не пускает в таблицу записи от 'anonymous', а без userId мы слали
       именно их — то есть решения копились в общей безымянной куче и не попадали
       ни в таблицу, ни в личную статистику. */
    const { userId, name } = playerIdentity();
    if (!userId) return;
    try {
      const res = await fetch(`${API_DAILY}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streak: newStreak,
          day: today,
          timeMs: totalMs,
          hintsUsed: hUsed,
          userId,
          ...(name ? { name } : {}),
        }),
      });
      if (res.ok) {
        await loadStandings();
      } else {
        /* Отказ сервера раньше пропадал здесь молча. Локальная серия при этом
           сохранена, поэтому игрок видел решённый пазл и был уверен, что попал
           в таблицу — а результат туда не доехал. Это ровно тот случай, когда
           ничего не падает и никто ничего не узнаёт. */
        const why =
          res.status === 429
            ? 'слишком много отправок подряд, попробуй через минуту'
            : `сервер не принял результат (код ${res.status})`;
        setMessage((m) => `${m} ⚠ В общую таблицу не попало: ${why}.`);
      }
    } catch {
      /* То же самое для обрыва связи: локально засчитано, в таблице — нет,
         и сказать об этом должны мы, а не тишина. */
      setMessage((m) => `${m} ⚠ В общую таблицу не попало: нет связи с сервером.`);
    }
  }, [streak, bestStreak, stopTimer, loadStandings]);

  const applyPlayerMove = useCallback((from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n') => {
    if (solved || !puzzle) return;
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
      setMessage(`Не тот ход для пазла. Ожидался другой. Попробуй ещё раз.`);
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
          // shouldn't happen, but guard
          const totalMs = startedAtRef.current != null ? Date.now() - startedAtRef.current : timeMs;
          finalizeSolved(totalMs, hintsUsed);
        } else {
          setMessage('Твой ход.');
        }
      }, 600);
    } else {
      setMessage('Верно. Продолжай.');
    }
  }, [solved, puzzle, solIndex, hintsUsed, timeMs, refreshBoard, startTimerIfNeeded, playBotReply, finalizeSolved]);

  function onCellClick(r: number, c: number) {
    if (solved || botPending || promoMove || !puzzle) return;
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
    if (solved || !puzzle) return;
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
    if (solved || !puzzle) return;
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
          🧩 Daily Puzzle
        </h1>
        <p style={{ color: '#9aa0b4', margin: '0 0 16px 0', fontSize: 14 }}>
          Один пазл в день. Решай каждый день — держи streak. Многоходовые пазлы: бот отвечает за противника.
        </p>

        {puzzleSource === 'fallback' && (
          <div
            style={{
              margin: '0 0 24px 0',
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(255, 216, 77, 0.08)',
              border: '1px solid rgba(255, 216, 77, 0.3)',
              color: '#ffd84d',
              fontSize: 13,
            }}
          >
            Банк задач сейчас недоступен, поэтому показана резервная позиция — она может отличаться от
            сегодняшней задачи у других игроков, и результат не попадёт в общую таблицу.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 24, alignItems: 'start' }}>
          {/* Left: board + controls */}
          <div>
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
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#00ff9d' }}>
                    {puzzle ? puzzle.theme : '…'}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#9aa0b4' }}>Время</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#ffd84d', fontVariantNumeric: 'tabular-nums' }}>
                    ⏱ {formatTime(timeMs)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#9aa0b4' }}>Рейтинг</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#b56bff' }}>
                    {/* 0 у банка означает «рейтинг не указан» — прочерк честнее нуля */}
                    {puzzle ? (puzzle.rating > 0 ? puzzle.rating : '—') : '…'}
                  </div>
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <div
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
                      return (
                        <div
                          key={`${r}-${c}`}
                          onClick={() => onCellClick(r, c)}
                          style={{
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
                        </div>
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
                  title="3 уровня подсказки: район → клетка-начало → полный ход. Каждая снимает +1 hint и блокирует +1 streak за пазл."
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
                <div style={{ fontSize: 12, color: '#9aa0b4' }}>Текущий streak</div>
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
                <div style={{ fontSize: 12, color: '#9aa0b4' }}>Лучший streak</div>
                {/* Серверный рекорд переживает чистку браузера, локальный — нет.
                    Если сервер знает больше, показываем его число, а не меньшее. */}
                <div style={{ fontSize: 32, fontWeight: 800, color: '#b56bff' }}>
                  🏆 {Math.max(bestStreak, serverStats?.bestStreak ?? 0)}
                </div>
                {serverStats && (
                  <div style={{ fontSize: 12, color: '#9aa0b4', marginTop: 4 }}>
                    Решено задач дня: {serverStats.totalSolved}
                  </div>
                )}
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
              background: 'rgba(20, 20, 32, 0.6)',
              border: '1px solid rgba(181, 107, 255, 0.2)',
              borderRadius: 16,
              padding: 16,
              maxHeight: 'calc(100vh - 80px)',
              overflowY: 'auto',
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0', color: '#b56bff' }}>
              🏆 Лучшие серии
            </h2>
            {/* Серию, время и подсказки присылает браузер игрока — сервер их
                только ограничивает разумными рамками, проверить решение он не
                может: в отчёте о решении нет ходов. Пока это так, таблица
                обязана называть себя тем, что она есть, иначе выдуманная серия
                стоит на публичной странице как измеренная. */}
            <div style={{ color: '#7c8296', fontSize: 11.5, lineHeight: 1.5, margin: '0 0 12px 0' }}>
              Серии игроки отправляют сами — сервер их не перепроверяет.
            </div>

            {leaderboard === null && !standingsFailed && (
              <div style={{ color: '#9aa0b4', fontSize: 13 }}>Загружаем…</div>
            )}

            {standingsFailed && (
              <div style={{ color: '#9aa0b4', fontSize: 13, lineHeight: 1.6 }}>
                Таблицу сейчас не удалось загрузить.
                <br />
                Это не значит, что она пустая — попробуйте позже.
              </div>
            )}

            {leaderboard !== null && !standingsFailed && leaderboard.length === 0 && (
              <div style={{ color: '#9aa0b4', fontSize: 13, lineHeight: 1.6 }}>
                Пока никто не решал — таблица пустая.
                <br />
                Реши сегодняшнюю задачу, и первая строка будет твоей.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(leaderboard ?? []).map((entry, i) => (
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
