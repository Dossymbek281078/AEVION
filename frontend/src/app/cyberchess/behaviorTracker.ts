/**
 * AEVION CyberChess — Browser Behavioral Tracker
 *
 * Captures non-invasive browser-level signals during an active game.
 * Rating-independent — detects the *mechanics* of cheating, not its quality.
 *
 * Monitored signals:
 *  1. Tab visibility  — tab hidden during player's turn (checking another tab/app)
 *  2. Window focus    — window blur/focus (alt-tab, another app)
 *  3. FEN clipboard   — copies a FEN string while game is active (feeding engine)
 *  4. Rapid return    — tab hidden 3-30s, then move played within 3s of return
 *  5. DevTools        — window inner width drops >300px (DevTools opened on side)
 *  6. Pre-move speed  — move played faster than humanly possible for complexity
 *
 * Privacy note: we never record clipboard content. We only test if the
 * pattern LOOKS LIKE a FEN string (rank/rank/rank with chess chars).
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type BehaviorEventType =
  | "tab_hidden"    // tab hidden during player's turn
  | "tab_visible"   // tab shown after being hidden during player's turn
  | "window_blur"   // window lost focus (app switch)
  | "fen_copy"      // FEN-like string detected in clipboard copy
  | "devtools_open" // window width shrank >300px (DevTools side panel)
  | "rapid_return"  // hidden 3-30s then move < 3s after return
  | "instant_move"; // move played < 800ms after position appeared (pre-loaded?)

export type BehaviorEvent = {
  type: BehaviorEventType;
  moveIndex: number;       // which player move index (0-based)
  timestamp: number;
  hiddenDurationMs?: number;  // for tab_visible / rapid_return
  moveTimeMs?: number;        // for instant_move / rapid_return
};

export type BehaviorSummary = {
  // Raw counts
  tabHiddenCount: number;      // times tab hidden during player's turn
  windowBlurCount: number;     // window blur events during game
  fenCopyCount: number;        // FEN clipboard copies
  rapidReturnCount: number;    // rapid-return events
  instantMoveCount: number;    // suspiciously fast moves
  devtoolsCount: number;       // DevTools open events
  // Derived
  maxHiddenMs: number;         // longest single hidden duration during player's turn
  totalHiddenMs: number;       // total ms hidden during player turns
  suspicionEvents: BehaviorEvent[];  // most suspicious events (for display)
  // Composite
  behaviorScore: number;       // 0–100, higher = more suspicious
  fenCopyDetected: boolean;    // any FEN copy = immediate high-priority flag
};

// ── FEN detector ───────────────────────────────────────────────────────────

function looksLikeFen(text: string): boolean {
  if (!text || text.length < 15 || text.length > 200) return false;
  const board = text.trim().split(/\s+/)[0] ?? "";
  const ranks = board.split("/");
  if (ranks.length !== 8) return false;
  // Each rank: only valid chess piece chars + digit 1-8
  return ranks.every(r => r.length > 0 && /^[rnbqkpRNBQKP1-8]+$/.test(r));
}

// ── BehaviorTracker class ──────────────────────────────────────────────────

type ListenerEntry = { target: Document | Window; event: string; fn: EventListener };

export class BehaviorTracker {
  private events: BehaviorEvent[] = [];
  private moveIndex: number = 0;
  private isPlayerTurn: boolean = false;
  private hiddenAt: number | null = null;
  private returnedAt: number | null = null;
  private playerTurnStartAt: number = 0;
  private baseInnerWidth: number = 0;
  private active: boolean = false;
  private listeners: ListenerEntry[] = [];

  // ── Lifecycle ────────────────────────────────────────────────────────────

  attach(): void {
    if (typeof window === "undefined" || this.active) return;
    this.active = true;
    this.baseInnerWidth = window.innerWidth;

    const onVisChange = () => {
      if (!this.active) return;
      if (document.hidden) {
        this.hiddenAt = Date.now();
        if (this.isPlayerTurn) {
          this.push({ type: "tab_hidden", moveIndex: this.moveIndex, timestamp: Date.now() });
        }
      } else {
        const dur = this.hiddenAt !== null ? Date.now() - this.hiddenAt : 0;
        this.hiddenAt = null;
        this.returnedAt = Date.now();
        if (this.isPlayerTurn) {
          this.push({
            type: "tab_visible", moveIndex: this.moveIndex,
            timestamp: Date.now(), hiddenDurationMs: dur,
          });
        }
      }
    };

    const onBlur = () => {
      if (!this.active || !this.isPlayerTurn) return;
      this.push({ type: "window_blur", moveIndex: this.moveIndex, timestamp: Date.now() });
    };

    const onCopy = (e: Event) => {
      if (!this.active) return;
      const text = (e as ClipboardEvent).clipboardData?.getData("text/plain") ?? "";
      if (looksLikeFen(text)) {
        this.push({ type: "fen_copy", moveIndex: this.moveIndex, timestamp: Date.now() });
      }
    };

    const onResize = () => {
      if (!this.active) return;
      const delta = this.baseInnerWidth - window.innerWidth;
      if (delta > 320) {
        this.push({ type: "devtools_open", moveIndex: this.moveIndex, timestamp: Date.now() });
        this.baseInnerWidth = window.innerWidth;
      }
    };

    this.addListener(document, "visibilitychange", onVisChange);
    this.addListener(window,   "blur",             onBlur);
    this.addListener(document, "copy",             onCopy);
    this.addListener(window,   "resize",           onResize);
  }

  detach(): void {
    for (const { target, event, fn } of this.listeners) {
      target.removeEventListener(event, fn);
    }
    this.listeners = [];
    this.active = false;
  }

  reset(): void {
    this.events = [];
    this.moveIndex = 0;
    this.isPlayerTurn = false;
    this.hiddenAt = null;
    this.returnedAt = null;
    this.playerTurnStartAt = 0;
  }

  // ── Move lifecycle hooks (called from page.tsx) ────────────────────────

  /** Call when it becomes the player's turn (opponent just moved / game started). */
  onTurnStart(moveIndex: number): void {
    this.moveIndex = moveIndex;
    this.isPlayerTurn = true;
    this.playerTurnStartAt = Date.now();
    this.returnedAt = null;
  }

  /** Call immediately after the player executes their move. */
  onMoveMade(moveIndex: number, moveTimeMs: number): void {
    // Rapid return: was hidden 3-30s and moved within 3s of returning?
    if (this.returnedAt !== null) {
      const sinceReturn = Date.now() - this.returnedAt;
      const visEvent = [...this.events]
        .reverse()
        .find(e => e.type === "tab_visible" && e.moveIndex === moveIndex);
      const hiddenMs = visEvent?.hiddenDurationMs ?? 0;
      if (sinceReturn < 3000 && hiddenMs >= 3000 && hiddenMs <= 45000) {
        this.push({
          type: "rapid_return", moveIndex,
          timestamp: Date.now(),
          hiddenDurationMs: hiddenMs,
          moveTimeMs: sinceReturn,
        });
      }
    }
    // Instant move: total decision time < 800ms (pre-loaded or instant lookup)
    if (moveTimeMs < 800 && moveIndex > 4) {
      this.push({ type: "instant_move", moveIndex, timestamp: Date.now(), moveTimeMs });
    }
    this.isPlayerTurn = false;
    this.returnedAt = null;
  }

  // ── Result ───────────────────────────────────────────────────────────────

  getSummary(): BehaviorSummary {
    const tabHiddenCount   = this.events.filter(e => e.type === "tab_hidden").length;
    const windowBlurCount  = this.events.filter(e => e.type === "window_blur").length;
    const fenCopyCount     = this.events.filter(e => e.type === "fen_copy").length;
    const rapidReturnCount = this.events.filter(e => e.type === "rapid_return").length;
    const instantMoveCount = this.events.filter(e => e.type === "instant_move").length;
    const devtoolsCount    = this.events.filter(e => e.type === "devtools_open").length;

    const hiddenDurations = this.events
      .filter(e => e.type === "tab_visible")
      .map(e => e.hiddenDurationMs ?? 0);
    const maxHiddenMs   = hiddenDurations.length ? Math.max(...hiddenDurations) : 0;
    const totalHiddenMs = hiddenDurations.reduce((s, v) => s + v, 0);

    // Priority events for the UI
    const suspicionEvents = this.events.filter(e =>
      e.type === "fen_copy" ||
      e.type === "rapid_return" ||
      (e.type === "tab_visible" && (e.hiddenDurationMs ?? 0) > 8000),
    );

    // Composite score (0-100)
    let score = 0;
    if (fenCopyCount > 0)    score += Math.min(60, fenCopyCount * 40);  // very high weight
    if (rapidReturnCount > 0) score += Math.min(45, rapidReturnCount * 25);
    const longHidden = hiddenDurations.filter(d => d > 5000).length;
    if (longHidden > 0)      score += Math.min(25, longHidden * 12);
    if (tabHiddenCount > 3)  score += Math.min(15, (tabHiddenCount - 3) * 4);
    if (devtoolsCount > 0)   score += 10;
    if (instantMoveCount > 5) score += Math.min(15, (instantMoveCount - 5) * 3);
    score = Math.min(100, Math.round(score));

    return {
      tabHiddenCount, windowBlurCount, fenCopyCount, rapidReturnCount,
      instantMoveCount, devtoolsCount, maxHiddenMs, totalHiddenMs,
      suspicionEvents, behaviorScore: score,
      fenCopyDetected: fenCopyCount > 0,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private push(e: BehaviorEvent): void {
    this.events.push(e);
  }

  private addListener(
    target: Document | Window,
    event: string,
    fn: (e: Event) => void,
  ): void {
    const bound = fn as EventListener;
    target.addEventListener(event, bound);
    this.listeners.push({ target, event, fn: bound });
  }
}
