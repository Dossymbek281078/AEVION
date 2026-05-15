import { beforeEach, describe, expect, it } from "vitest";
import {
  mint,
  spend,
  RATE_CARD,
  previewQuality,
  questionsToday,
  askQuestion,
  removeQuestion,
  triggerInsightHit,
  INSIGHT,
  type AEVWallet,
  type InsightState,
  type InsightQuestion,
} from "../aevToken";

const freshWallet = (over: Partial<AEVWallet> = {}): AEVWallet => ({
  v: 1,
  balance: 0,
  lifetimeMined: 0,
  lifetimeSpent: 0,
  globalSupplyMined: 0,
  modes: { play: true, compute: false, stewardship: true },
  stake: [],
  recent: [],
  startTs: Date.now(),
  dividendsClaimed: 0,
  ...over,
});

const freshInsight = (questions: InsightQuestion[] = []): InsightState => ({
  v: 1,
  questions,
  totalHits: 0,
  totalEarned: 0,
});

beforeEach(() => {
  // jsdom provides localStorage; clear between tests
  try { localStorage.clear() } catch {}
});

describe("mint", () => {
  it("ignores non-positive amounts", () => {
    const w = freshWallet();
    expect(mint(w, 0,  { kind: "custom", tag: "x" }, "noop")).toBe(w);
    expect(mint(w, -1, { kind: "custom", tag: "x" }, "noop")).toBe(w);
  });

  it("increases balance + lifetimeMined + globalSupplyMined", () => {
    const w = freshWallet({ balance: 1, lifetimeMined: 2, globalSupplyMined: 5 });
    const r = mint(w, 3, { kind: "custom", tag: "test" }, "+3");
    expect(r.balance).toBe(4);
    expect(r.lifetimeMined).toBe(5);
    expect(r.globalSupplyMined).toBe(8);
    expect(r.recent[0].amount).toBe(3);
    expect(r.recent[0].balanceAfter).toBe(4);
  });

  it("clamps mint at total supply cap", () => {
    const w = freshWallet({ globalSupplyMined: RATE_CARD.totalSupplyCap - 2 });
    const r = mint(w, 10, { kind: "custom", tag: "cap" }, "near cap");
    expect(r.balance).toBe(2);
    expect(r.globalSupplyMined).toBe(RATE_CARD.totalSupplyCap);
  });

  it("returns wallet unchanged when cap fully reached", () => {
    const w = freshWallet({ globalSupplyMined: RATE_CARD.totalSupplyCap });
    expect(mint(w, 5, { kind: "custom", tag: "x" }, "over")).toBe(w);
  });
});

describe("spend", () => {
  it("returns null if balance insufficient", () => {
    const w = freshWallet({ balance: 0.5 });
    expect(spend(w, 1, "buy")).toBeNull();
  });

  it("decreases balance + increases lifetimeSpent + logs event", () => {
    const w = freshWallet({ balance: 10, lifetimeSpent: 5 });
    const r = spend(w, 4, "buy theme")!;
    expect(r.balance).toBe(6);
    expect(r.lifetimeSpent).toBe(9);
    expect(r.recent[0].amount).toBe(-4);
  });

  it("returns wallet unchanged for zero amount", () => {
    const w = freshWallet({ balance: 10 });
    expect(spend(w, 0, "noop")).toBe(w);
  });
});

describe("Insight · previewQuality", () => {
  it("returns 0..100", () => {
    expect(previewQuality("")).toBeGreaterThanOrEqual(0);
    expect(previewQuality("hi")).toBeLessThanOrEqual(100);
    const long = "a".repeat(500);
    expect(previewQuality(long)).toBeLessThanOrEqual(100);
  });

  it("rewards length, question marks, word-count, and uniqueness", () => {
    const short = previewQuality("hi");
    const longer = previewQuality("Why does the chess engine prefer this move over the obvious capture?");
    expect(longer).toBeGreaterThan(short);
  });

  it("rewards unique words over repeated words", () => {
    const repeat = previewQuality("test test test test test test test test test test");
    const varied = previewQuality("alpha beta gamma delta epsilon zeta eta theta iota kappa");
    expect(varied).toBeGreaterThan(repeat);
  });
});

describe("Insight · questionsToday", () => {
  it("counts only today's questions", () => {
    const today = Date.now();
    const yesterday = today - 30 * 3600 * 1000;
    const qs: InsightQuestion[] = [
      { id: "1", q: "x", topic: "general", ts: today,     hits: 0, earned: 0, quality: 50, lastHitTs: 0 },
      { id: "2", q: "y", topic: "general", ts: yesterday, hits: 0, earned: 0, quality: 50, lastHitTs: 0 },
    ];
    expect(questionsToday(qs)).toBe(1);
  });
});

describe("Insight · askQuestion", () => {
  it("rejects empty / too-short input", () => {
    const s = freshInsight();
    expect("error" in askQuestion(s, "")).toBe(true);
    expect("error" in askQuestion(s, "short")).toBe(true);
  });

  it("accepts valid question and prepends to list", () => {
    const s = freshInsight();
    const r = askQuestion(s, "How does the engine value piece activity?", "chess");
    expect("error" in r).toBe(false);
    if ("state" in r) {
      expect(r.state.questions).toHaveLength(1);
      expect(r.state.questions[0].topic).toBe("chess");
      expect(r.state.questions[0].quality).toBeGreaterThan(0);
    }
  });

  it("blocks at daily limit", () => {
    const today = Date.now();
    const qs: InsightQuestion[] = Array.from({ length: INSIGHT.dailyAskLimit }, (_, i) => ({
      id: `q${i}`, q: "filler question content here", topic: "general",
      ts: today, hits: 0, earned: 0, quality: 50, lastHitTs: 0,
    }));
    const s = freshInsight(qs);
    const r = askQuestion(s, "One more meaningful prompt please", "general");
    expect("error" in r).toBe(true);
  });
});

describe("Insight · removeQuestion + triggerInsightHit", () => {
  it("removeQuestion drops by id", () => {
    const s = freshInsight([
      { id: "a", q: "?", topic: "general", ts: 0, hits: 0, earned: 0, quality: 50, lastHitTs: 0 },
      { id: "b", q: "?", topic: "general", ts: 0, hits: 0, earned: 0, quality: 50, lastHitTs: 0 },
    ]);
    expect(removeQuestion(s, "a").questions.map((q) => q.id)).toEqual(["b"]);
  });

  it("triggerInsightHit mints AEV and bumps stats", () => {
    const w = freshWallet();
    const s = freshInsight([
      { id: "a", q: "Why does the AEV cap matter?", topic: "general", ts: 0, hits: 0, earned: 0, quality: 50, lastHitTs: 0 },
    ]);
    const r = triggerInsightHit(w, s, "a");
    expect(r.wallet.balance).toBe(INSIGHT.perHitAev);
    expect(r.insight.totalHits).toBe(1);
    expect(r.insight.totalEarned).toBe(INSIGHT.perHitAev);
    expect(r.insight.questions[0].hits).toBe(1);
  });

  it("triggerInsightHit on missing id is no-op", () => {
    const w = freshWallet();
    const s = freshInsight();
    const r = triggerInsightHit(w, s, "nope");
    expect(r.wallet).toBe(w);
    expect(r.insight).toBe(s);
  });
});
