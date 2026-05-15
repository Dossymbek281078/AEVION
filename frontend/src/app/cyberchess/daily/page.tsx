'use client';

import { useEffect, useMemo, useState } from 'react';

type Puzzle = {
  fen: string;
  sol: string[];
  theme: string;
  rating: number;
};

type LeaderEntry = {
  name: string;
  streak: number;
  country: string;
};

// 30 mock puzzles. FEN is illustrative; solution validation is uci-compare only.
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
  { fen: 'r2qk2r/ppp1bppp/2n2n2/3p4/3P4/2N1PN2/PPP1BPPP/R1BQ1RK1 w kq - 0 1', sol: ['c3d5', 'f6d5', 'e2c4'], theme: 'Pin', rating: 1650 },
  { fen: '2r2rk1/pp1q1ppp/2n1bn2/3p4/3P4/2NBPN2/PPPQ1PPP/2KR3R w - - 0 1', sol: ['d3h7', 'g8h7', 'd2h6'], theme: 'Mating net', rating: 1900 },
  { fen: 'r1b1k2r/pppp1ppp/2n2q2/2b1n3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w kq - 0 1', sol: ['f3e5', 'f6e5', 'c1f4'], theme: 'Tactic', rating: 1500 },
  { fen: 'rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 1', sol: ['c4f7', 'e8f7', 'c3d5'], theme: 'Italian trap', rating: 1350 },
  { fen: '3r1rk1/ppq2ppp/2n1bn2/3p4/3P4/2NBPN2/PPPQ1PPP/2KR3R w - - 0 1', sol: ['c3d5', 'f6d5', 'd3h7'], theme: 'Combination', rating: 1750 },
  { fen: 'r1bqkbnr/ppp2ppp/2n5/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1', sol: ['e4d5', 'd8d5', 'b1c3'], theme: 'Center', rating: 1000 },
  { fen: 'r4rk1/pp1q1ppp/2nbbn2/3p4/3P4/2NBPN2/PPPQ1PPP/R4RK1 w - - 0 1', sol: ['d3h7', 'g8h7', 'f3g5'], theme: 'Greek gift', rating: 1850 },
  { fen: 'r1b2rk1/ppp1qppp/2nb1n2/3p4/3P4/2NBPN2/PPPQ1PPP/R1B2RK1 w - - 0 1', sol: ['c3d5', 'f6d5', 'd3h7'], theme: 'Double attack', rating: 1700 },
  { fen: 'r2qkb1r/ppp2ppp/2n1bn2/3pp3/3P4/2N1PN2/PPP1BPPP/R1BQK2R w KQkq - 0 1', sol: ['d4e5', 'c6e5', 'f3e5'], theme: 'Tactic', rating: 1450 },
  { fen: 'rnbqkbnr/pp3ppp/4p3/2pp4/3P4/2N1P3/PPP2PPP/R1BQKBNR w KQkq - 0 1', sol: ['c3b5', 'd5d4', 'b5d6'], theme: 'Knight outpost', rating: 1250 },
  { fen: 'r1bq1rk1/ppp1bppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1', sol: ['c4f7', 'f8f7', 'f3g5'], theme: 'Sacrifice', rating: 1600 },
  { fen: '2rq1rk1/pp1bbppp/2n1pn2/3p4/3P4/2NBPN2/PPPQ1PPP/2KR3R w - - 0 1', sol: ['d3h7', 'g8h7', 'd2h6'], theme: 'Attack', rating: 1950 },
  { fen: 'r1bqk2r/ppp1bppp/2n2n2/3pp3/3P4/2N1PN2/PPP1BPPP/R1BQK2R w KQkq - 0 1', sol: ['d4e5', 'c6e5', 'c3d5'], theme: 'Combination', rating: 1550 },
  { fen: 'rnb1k2r/ppp1qppp/3p1n2/4p3/1bP1P3/2N2N2/PPQP1PPP/R1B1KB1R w KQkq - 0 1', sol: ['a2a3', 'b4c3', 'd2c3'], theme: 'Bishop trap', rating: 1400 },
  { fen: 'r1bq1rk1/pp2bppp/2np1n2/4p3/2B1P3/2NP1N2/PPPB1PPP/R2Q1RK1 w - - 0 1', sol: ['c4f7', 'g8f7', 'f3g5'], theme: 'Sacrifice', rating: 1650 },
  { fen: 'r2qk2r/ppp1bppp/2n1bn2/3p4/3P4/2NBPN2/PPP2PPP/R1BQ1RK1 w kq - 0 1', sol: ['c3d5', 'f6d5', 'd3h7'], theme: 'Tactic', rating: 1700 },
  { fen: '3r1rk1/pp1q1ppp/2nbbn2/3p4/3P4/1QNBPN2/PPP2PPP/2KR3R w - - 0 1', sol: ['b3b7', 'c6a5', 'b7a7'], theme: 'Queen raid', rating: 1850 },
  { fen: 'r1bqkb1r/pp3ppp/2np1n2/4p3/3PP3/2N2N2/PPP2PPP/R1BQKB1R w KQkq - 0 1', sol: ['d4e5', 'd6e5', 'd1d8'], theme: 'Queen trade', rating: 1500 },
  { fen: 'r2q1rk1/ppp2ppp/2nb1n2/3p4/3P4/2NBPN2/PPP1QPPP/R1B2RK1 w - - 0 1', sol: ['d3h7', 'g8h7', 'f3g5'], theme: 'Greek gift', rating: 1800 },
  { fen: 'rnbqk2r/pp2bppp/4pn2/2pp4/3P4/2N1PN2/PPP1BPPP/R1BQK2R w KQkq - 0 1', sol: ['d4c5', 'b8d7', 'b2b4'], theme: 'Pawn grab', rating: 1300 },
];

const COUNTRIES = ['🇷🇺', '🇺🇸', '🇩🇪', '🇫🇷', '🇪🇸', '🇮🇹', '🇰🇿', '🇺🇦', '🇵🇱', '🇧🇷', '🇨🇳', '🇯🇵', '🇮🇳', '🇬🇧', '🇰🇷', '🇳🇱', '🇸🇪', '🇳🇴', '🇫🇮', '🇦🇷'];
const NAMES = ['Magnus', 'Hikaru', 'Fabiano', 'Ding', 'Anish', 'Ian', 'Levon', 'Wesley', 'Maxime', 'Alireza', 'Praggnanandhaa', 'Gukesh', 'Erigaisi', 'Nakamura', 'Carlsen', 'Caruana', 'Liren', 'Giri', 'Vachier', 'Firouzja', 'Karjakin', 'Aronian', 'So', 'MVL', 'Pragg', 'Dommaraju', 'Niemann', 'Abdusattorov', 'Esipenko', 'Sarana'];

function mockLeaderboard(): LeaderEntry[] {
  const out: LeaderEntry[] = [];
  for (let i = 0; i < 100; i++) {
    const name = `${NAMES[i % NAMES.length]}${i < NAMES.length ? '' : '_' + Math.floor(i / NAMES.length)}`;
    const country = COUNTRIES[i % COUNTRIES.length];
    const streak = Math.max(1, 365 - i * 3 - Math.floor(Math.random() * 5));
    out.push({ name, country, streak });
  }
  return out.sort((a, b) => b.streak - a.streak);
}

// Unicode pieces by FEN char
const PIECE: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

function fenToBoard(fen: string): string[][] {
  const rows = fen.split(' ')[0].split('/');
  return rows.map((row) => {
    const cells: string[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < parseInt(ch, 10); i++) cells.push('');
      } else {
        cells.push(ch);
      }
    }
    return cells;
  });
}

function coordToUci(r: number, c: number): string {
  const file = 'abcdefgh'[c];
  const rank = String(8 - r);
  return `${file}${rank}`;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayIndex(): number {
  return Math.floor(Date.now() / 86400000);
}

export default function DailyPuzzlePage() {
  const puzzle = useMemo(() => POOL[dayIndex() % POOL.length], []);
  const leaderboard = useMemo(() => mockLeaderboard(), []);

  const [board, setBoard] = useState<string[][]>(() => fenToBoard(puzzle.fen));
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [lastMove, setLastMove] = useState<{ from: [number, number]; to: [number, number] } | null>(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [solved, setSolved] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [shareCopied, setShareCopied] = useState(false);

  // load streak from localStorage on mount
  useEffect(() => {
    try {
      const today = todayKey();
      const lastSolved = localStorage.getItem('cc_daily_last_solved') || '';
      const rawStreak = parseInt(localStorage.getItem('cc_daily_streak') || '0', 10) || 0;
      const rawBest = parseInt(localStorage.getItem('cc_daily_best_streak') || '0', 10) || 0;

      // Determine if streak should reset (missed a day)
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
      // ignore (SSR / no localStorage)
    }
  }, []);

  function onCellClick(r: number, c: number) {
    if (solved) return;
    if (!selected) {
      if (board[r][c]) setSelected([r, c]);
      return;
    }
    const [fr, fc] = selected;
    if (fr === r && fc === c) {
      setSelected(null);
      return;
    }
    const uci = `${coordToUci(fr, fc)}${coordToUci(r, c)}`;
    // apply move visually
    const next = board.map((row) => [...row]);
    next[r][c] = next[fr][fc];
    next[fr][fc] = '';
    setBoard(next);
    setLastMove({ from: [fr, fc], to: [r, c] });
    setSelected(null);
    setMessage(`Ход: ${uci} — нажми "Решил!" для проверки`);
    // remember the attempted move on the board element via state (lastMove)
  }

  function checkSolution() {
    if (!lastMove) {
      setMessage('Сначала сделай ход!');
      return;
    }
    const uci = `${coordToUci(lastMove.from[0], lastMove.from[1])}${coordToUci(lastMove.to[0], lastMove.to[1])}`;
    if (uci === puzzle.sol[0]) {
      const today = todayKey();
      const newStreak = streak + 1;
      const newBest = Math.max(bestStreak, newStreak);
      try {
        localStorage.setItem('cc_daily_streak', String(newStreak));
        localStorage.setItem('cc_daily_best_streak', String(newBest));
        localStorage.setItem('cc_daily_last_solved', today);
      } catch {}
      setStreak(newStreak);
      setBestStreak(newBest);
      setSolved(true);
      setMessage(`Поздравляем! Streak +1 = ${newStreak}. Best: ${newBest}`);
    } else {
      setMessage(`Не тот ход. Ожидалось: ${puzzle.sol[0]}. Попробуй ещё раз.`);
      // reset board to original puzzle
      setBoard(fenToBoard(puzzle.fen));
      setLastMove(null);
    }
  }

  function resetBoard() {
    if (solved) return;
    setBoard(fenToBoard(puzzle.fen));
    setSelected(null);
    setLastMove(null);
    setMessage('');
  }

  async function sharePuzzle() {
    const text = `Я решил puzzle of the day на AEVION CyberChess streak ${streak}! 🧩 #AEVION`;
    try {
      await navigator.clipboard.writeText(text);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setMessage('Не удалось скопировать. Текст: ' + text);
    }
  }

  const isHighlighted = (r: number, c: number) => {
    if (!lastMove) return false;
    return (lastMove.from[0] === r && lastMove.from[1] === c) || (lastMove.to[0] === r && lastMove.to[1] === c);
  };

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
        <p style={{ color: '#9aa0b4', margin: '0 0 24px 0', fontSize: 14 }}>
          Один пазл в день. Решай каждый день — держи streak.
        </p>

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#9aa0b4' }}>Тема</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#00ff9d' }}>{puzzle.theme}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#9aa0b4' }}>Рейтинг</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#b56bff' }}>{puzzle.rating}</div>
                </div>
              </div>

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
                    const hl = isHighlighted(r, c);
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
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 'clamp(20px, 5vw, 42px)',
                          cursor: solved ? 'default' : 'pointer',
                          userSelect: 'none',
                          color: isWhite ? '#ffffff' : '#0a0a14',
                          textShadow: isWhite ? '0 0 4px rgba(0,0,0,0.6)' : '0 0 4px rgba(255,255,255,0.4)',
                          transition: 'background 120ms',
                        }}
                      >
                        {piece ? PIECE[piece] || '' : ''}
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                <button
                  onClick={checkSolution}
                  disabled={solved}
                  style={{
                    background: solved ? '#2a2a3e' : 'linear-gradient(90deg, #00ff9d 0%, #00cc7a 100%)',
                    color: solved ? '#9aa0b4' : '#0a0a14',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 20px',
                    fontWeight: 700,
                    cursor: solved ? 'not-allowed' : 'pointer',
                    fontSize: 14,
                  }}
                >
                  ✓ Решил!
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
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
                <div style={{ fontSize: 32, fontWeight: 800, color: '#b56bff' }}>🏆 {bestStreak}</div>
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
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px 0', color: '#b56bff' }}>
              🏆 Top-100 Streaks
            </h2>
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
