# AEVION CyberChess — Development Roadmap to World-Class Level

## Vision
CyberChess is not "another chess app." It is the **first chess platform integrated into an IP economy** — where games, puzzles, and tournaments generate Trust Graph data, ratings feed into AEVION Bank royalties, and chess AI engines are registered as IP in QRight.

## Current State (April 2026)
- Play vs AI with 6 difficulty levels (400-2400 ELO)
- 15 chess puzzles across 5 categories
- Color selection (White/Black/Random)
- 8 time controls (1+0 to 30+0 + unlimited)
- Basic rating system (starts at 1000)
- Runs entirely in browser (no server-side engine)

## What chess.com Has That We Don't (Gap Analysis)

| Feature | chess.com | CyberChess Now | Priority |
|---------|-----------|----------------|----------|
| Stockfish 16+ engine | Yes (WASM) | Custom minimax (weak) | P0 — Critical |
| 100,000+ puzzles | Yes | 15 puzzles | P0 — Critical |
| Online multiplayer | Yes | No | P1 — High |
| Opening explorer | Yes | No | P1 — High |
| Game analysis | Yes | No | P1 — High |
| Puzzle rating system | Yes | No | P2 — Medium |
| Tournaments | Yes | No | P2 — Medium |
| Game database | Yes | No | P2 — Medium |
| Mobile app | Yes | Browser only | P3 — Later |
| Lessons/courses | Yes | No | P3 — Later |

## Phase 1: Engine & Puzzles (April-May 2026) — "Make it Real"

### 1.1 Integrate Stockfish WASM
- Replace custom minimax with Stockfish 16.1 WASM
- Already available: `stockfish.js` npm package (installed in frontend!)
- Map 6 AI levels to Stockfish skill levels (0-20) and depth limits
- Result: AI plays at genuine ELO strength, not fake difficulty

### 1.2 Puzzle Database Expansion
- Import 5,000 puzzles from Lichess puzzle database (CC0 license — free to use)
- Categories: Tactics, Endgame, Opening traps, Checkmate patterns, Defense
- Difficulty rating per puzzle (800-2500)
- Spaced repetition: show failed puzzles again
- Daily puzzle feature

### 1.3 Game Analysis
- After each game, run Stockfish analysis on all moves
- Show accuracy % per player
- Mark blunders (??), mistakes (?), inaccuracies (?!)
- Best move suggestions with evaluation bar
- Engine eval graph (like chess.com's)

**Deliverable:** CyberChess plays real chess, has thousands of puzzles, analyzes games.

## Phase 2: Multiplayer & Community (June-July 2026) — "Make it Social"

### 2.1 WebSocket Multiplayer
- Real-time games via WebSocket (backend already has WS infrastructure from QCoreAI)
- Matchmaking by rating (±200 ELO range)
- Time controls with server-side clock
- Resign, draw offer, rematch

### 2.2 Rating System (Glicko-2)
- Proper Glicko-2 rating algorithm
- Separate ratings: Bullet, Blitz, Rapid, Classical, Puzzle
- Rating history graph
- Leaderboard

### 2.3 Opening Explorer
- Integrate Lichess opening database (free API)
- Show opening name, win rates, popular continuations
- Personal opening stats

### 2.4 Game Database
- Save all games to PostgreSQL
- PGN export/import
- Review past games with engine analysis
- Share game links

**Deliverable:** Players can compete against each other, track progress, explore openings.

## Phase 3: AEVION Integration (July-August 2026) — "Make it Unique"

### 3.1 Trust Graph Integration
- Every game result feeds into player's Trust Graph score
- Chess rating visible in AEVION profile
- Tournament wins = Planet submissions

### 3.2 IP-Protected Chess Engines
- Users can register custom chess engines via QRight
- Engine vs Engine tournaments
- Royalties when someone uses your engine

### 3.3 Tournament System
- Weekly automated tournaments (Swiss system)
- Prize pool in AEC tokens
- Tournament certificates via IP Bureau

### 3.4 Anti-Cheat
- Move time analysis
- Statistical anomaly detection
- Comparison with Stockfish evaluation
- Fair play score

**Deliverable:** CyberChess is not just chess — it's chess integrated into the AEVION economy.

## Phase 4: Polish & Scale (August 2026+) — "Make it Beautiful"

### 4.1 UI/UX Upgrade
- Piece animations (drag & drop + click-click)
- Sound effects (move, capture, check, castle)
- Board themes (wood, tournament, dark, neon)
- Piece sets (classic, neo, alpha)
- Mobile-responsive layout
- Pre-moves

### 4.2 Content
- Interactive lessons (beginner to advanced)
- Video analysis integration
- Coach mode (engine suggestions during play)

### 4.3 Performance
- Service Worker for offline puzzle solving
- PWA (installable on mobile)
- < 100ms engine response for puzzles

## Competitive Advantages Over chess.com

1. **IP Economy Integration** — no other chess platform connects games to intellectual property registration
2. **Trust Graph** — chess rating feeds into a broader reputation system across 27 products
3. **Token Economy** — win tournaments, earn AEC, spend across the ecosystem
4. **Open Engine Registry** — register and monetize custom chess engines
5. **All-in-One Platform** — chess + banking + IP + AI in one ecosystem

## Technical Stack
- Frontend: Next.js 16 + React (current)
- Chess logic: chess.js (current) + Stockfish WASM (to add)
- Multiplayer: WebSocket via existing backend WS infrastructure
- Database: PostgreSQL via pg Pool
- Rating: Glicko-2 algorithm (to implement)

## Timeline Summary

| Month | Milestone | Key Metric |
|-------|-----------|------------|
| April 2026 | Stockfish WASM integration | Real AI strength |
| May 2026 | 5,000 puzzles + game analysis | Content depth |
| June 2026 | Multiplayer MVP | 2-player games |
| July 2026 | Tournaments + AEVION integration | Economy connected |
| August 2026 | Polish + investor demo | Demo-ready |

## For Investors
CyberChess alone is a **$50M+ opportunity** within the $1.8B online chess market. But as part of AEVION's 27-product ecosystem, it becomes a **user acquisition engine** that feeds the entire Trust Graph economy. Every chess player is a potential IP creator, every game is a Trust Graph data point, every tournament win is a certified achievement on the blockchain.
