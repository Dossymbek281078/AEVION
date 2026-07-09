import { describe, it, expect } from "vitest";
import { diffLocalModels, summarizeFeedback, type FeedbackEntry } from "./agentMemory";

describe("agentMemory — diffLocalModels", () => {
  it("detects added and removed local models", () => {
    const prev = [{ id: "ollama", models: ["llama3.1", "qwen2.5"] }];
    const curr = [{ id: "ollama", models: ["llama3.1", "deepseek-r1"] }];
    const d = diffLocalModels(prev, curr);
    expect(d.added).toEqual(["ollama:deepseek-r1"]);
    expect(d.removed).toEqual(["ollama:qwen2.5"]);
  });

  it("is empty when nothing changed", () => {
    const snap = [{ id: "lmstudio", models: ["qwen2.5-7b"] }];
    expect(diffLocalModels(snap, snap)).toEqual({ added: [], removed: [] });
  });

  it("treats a first-ever snapshot as all added", () => {
    const d = diffLocalModels([], [{ id: "jan", models: ["llama3.2-3b"] }]);
    expect(d.added).toEqual(["jan:llama3.2-3b"]);
    expect(d.removed).toEqual([]);
  });

  it("tolerates missing/empty model arrays", () => {
    expect(diffLocalModels([{ id: "x", models: [] }], [{ id: "x", models: [] }])).toEqual({ added: [], removed: [] });
  });
});

describe("agentMemory — summarizeFeedback", () => {
  const entries: FeedbackEntry[] = [
    { ts: 1, message: "a", mode: "action", toolId: "image", rating: "up" },
    { ts: 2, message: "b", mode: "action", toolId: "image", rating: "down" },
    { ts: 3, message: "c", mode: "chat", toolId: null, rating: "up" },
  ];

  it("aggregates totals and per-tool tallies", () => {
    const s = summarizeFeedback(entries);
    expect(s.total).toBe(3);
    expect(s.up).toBe(2);
    expect(s.down).toBe(1);
    expect(s.byTool.image).toEqual({ up: 1, down: 1 });
    expect(s.byTool.chat).toEqual({ up: 1, down: 0 });
  });

  it("ignores malformed ratings", () => {
    const s = summarizeFeedback([{ ts: 1, message: "x", mode: "chat", toolId: null, rating: "maybe" as never }]);
    expect(s.total).toBe(0);
  });

  it("handles an empty log", () => {
    expect(summarizeFeedback([])).toEqual({ total: 0, up: 0, down: 0, byTool: {} });
  });
});
