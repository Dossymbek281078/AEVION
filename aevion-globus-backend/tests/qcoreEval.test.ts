import { describe, test, expect, vi } from "vitest";

// Force in-memory mode by failing the SELECT 1 probe.
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn().mockRejectedValue(new Error("no db")),
}));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, on: () => {} }),
}));

import {
  createEvalSuite,
  listEvalSuites,
  getEvalSuite,
  updateEvalSuite,
  deleteEvalSuite,
  createEvalRun,
  updateEvalRun,
  getEvalRun,
  listSuiteRuns,
  type EvalCase,
} from "../src/services/qcoreai/store";
import { judgeCase, aggregateScore } from "../src/services/qcoreai/evalRunner";

describe("QCoreEvalSuite (in-memory)", () => {
  test("createEvalSuite normalizes name, defaults strategy + cases", async () => {
    const owner = "user-" + Math.random().toString(36).slice(2);
    const s = await createEvalSuite({
      ownerUserId: owner,
      name: "  Onboarding writer  ",
      description: "  Catch regressions  ",
      strategy: "weird",
      cases: [{ id: "c1", name: "Has TLDR", input: "test", judge: { type: "contains", needle: "TLDR" } }],
    });
    expect(s.name).toBe("Onboarding writer");
    expect(s.description).toBe("Catch regressions");
    expect(s.strategy).toBe("sequential");
    expect(s.cases.length).toBe(1);
    expect(s.cases[0].id).toBe("c1");
    expect(s.cases[0].judge.type).toBe("contains");
  });

  test("createEvalSuite drops cases with empty input or unknown judge type", async () => {
    const owner = "user-" + Math.random().toString(36).slice(2);
    const s = await createEvalSuite({
      ownerUserId: owner,
      name: "filtered",
      cases: [
        { id: "ok", input: "real prompt", judge: { type: "contains", needle: "ok" } },
        { id: "empty", input: "   ", judge: { type: "contains", needle: "x" } },
        { id: "weird", input: "valid", judge: { type: "wat", needle: "x" } },
        { id: "regex_ok", input: "p", judge: { type: "regex", pattern: "^ok$" } },
      ],
    });
    expect(s.cases.length).toBe(2);
    expect(s.cases.map((c) => c.id).sort()).toEqual(["ok", "regex_ok"]);
  });

  test("listEvalSuites is owner-scoped, sorted by updatedAt desc", async () => {
    const a = "user-" + Math.random().toString(36).slice(2);
    const b = "user-" + Math.random().toString(36).slice(2);
    const a1 = await createEvalSuite({ ownerUserId: a, name: "A1" });
    await new Promise((r) => setTimeout(r, 5));
    const a2 = await createEvalSuite({ ownerUserId: a, name: "A2" });
    await createEvalSuite({ ownerUserId: b, name: "B1" });

    const list = await listEvalSuites(a);
    expect(list.length).toBe(2);
    expect(list[0].id).toBe(a2.id); // newest first
    expect(list[1].id).toBe(a1.id);
    // Should not see other user's suites.
    expect(list.find((s) => s.ownerUserId === b)).toBeUndefined();
  });

  test("updateEvalSuite is owner-only and patches fields", async () => {
    const u = "user-" + Math.random().toString(36).slice(2);
    const stranger = "user-" + Math.random().toString(36).slice(2);
    const s = await createEvalSuite({ ownerUserId: u, name: "orig" });

    expect(await updateEvalSuite(s.id, stranger, { name: "hijack" })).toBeNull();
    const fetched = await getEvalSuite(s.id);
    expect(fetched?.name).toBe("orig");

    const updated = await updateEvalSuite(s.id, u, {
      name: "renamed",
      strategy: "parallel",
      cases: [{ id: "c", input: "p", judge: { type: "min_length", chars: 100 } }],
    });
    expect(updated?.name).toBe("renamed");
    expect(updated?.strategy).toBe("parallel");
    expect(updated?.cases.length).toBe(1);
  });

  test("deleteEvalSuite is owner-only and clears child runs", async () => {
    const u = "user-" + Math.random().toString(36).slice(2);
    const stranger = "user-" + Math.random().toString(36).slice(2);
    const s = await createEvalSuite({ ownerUserId: u, name: "to-delete" });
    const r = await createEvalRun({ suiteId: s.id, ownerUserId: u, totalCases: 0 });

    expect(await deleteEvalSuite(s.id, stranger)).toBe(false);
    expect(await getEvalSuite(s.id)).not.toBeNull();

    expect(await deleteEvalSuite(s.id, u)).toBe(true);
    expect(await getEvalSuite(s.id)).toBeNull();
    // Run history should also be gone.
    const runs = await listSuiteRuns(s.id);
    expect(runs.find((x) => x.id === r.id)).toBeUndefined();
  });

  test("createEvalRun + updateEvalRun + listSuiteRuns persist progress", async () => {
    const u = "user-" + Math.random().toString(36).slice(2);
    const s = await createEvalSuite({ ownerUserId: u, name: "trk" });
    const run = await createEvalRun({ suiteId: s.id, ownerUserId: u, totalCases: 3 });
    expect(run.status).toBe("running");
    expect(run.totalCases).toBe(3);
    expect(run.passedCases).toBe(0);

    const updated = await updateEvalRun(run.id, {
      status: "done",
      score: 0.6667,
      passedCases: 2,
      totalCostUsd: 0.123,
      completedAt: new Date().toISOString(),
    });
    expect(updated?.status).toBe("done");
    expect(updated?.score).toBeCloseTo(0.6667, 3);
    expect(updated?.passedCases).toBe(2);

    const got = await getEvalRun(run.id);
    expect(got?.id).toBe(run.id);

    const list = await listSuiteRuns(s.id);
    expect(list[0].id).toBe(run.id);
  });
});

describe("evalRunner judges", () => {
  test("contains: case-insensitive by default", () => {
    expect(judgeCase({ type: "contains", needle: "TL;DR" }, "Here is the TL;DR section").passed).toBe(true);
    expect(judgeCase({ type: "contains", needle: "tl;dr" }, "Here is the TL;DR section").passed).toBe(true);
    expect(judgeCase({ type: "contains", needle: "missing" }, "Here is the TL;DR section").passed).toBe(false);
  });

  test("contains: caseSensitive flag works", () => {
    const j = judgeCase({ type: "contains", needle: "tl;dr", caseSensitive: true }, "TL;DR section");
    expect(j.passed).toBe(false);
  });

  test("not_contains: passes when needle absent", () => {
    expect(
      judgeCase({ type: "not_contains", needle: "as a large language model" }, "Friendly answer here").passed
    ).toBe(true);
    expect(
      judgeCase({ type: "not_contains", needle: "model" }, "as a large language model, I…").passed
    ).toBe(false);
  });

  test("equals: trim + case-insensitive defaults", () => {
    expect(judgeCase({ type: "equals", expected: "Yes" }, "  yes  ").passed).toBe(true);
    expect(
      judgeCase({ type: "equals", expected: "yes", caseSensitive: true, trim: false }, "Yes").passed
    ).toBe(false);
  });

  test("regex: respects flags + handles invalid pattern", () => {
    expect(judgeCase({ type: "regex", pattern: "^TL;DR.*", flags: "m" }, "TL;DR\nrest").passed).toBe(true);
    expect(judgeCase({ type: "regex", pattern: "[unclosed" }, "anything").passed).toBe(false);
  });

  test("min_length / max_length", () => {
    expect(judgeCase({ type: "min_length", chars: 5 }, "hello world").passed).toBe(true);
    expect(judgeCase({ type: "min_length", chars: 50 }, "short").passed).toBe(false);
    expect(judgeCase({ type: "max_length", chars: 10 }, "short").passed).toBe(true);
    expect(judgeCase({ type: "max_length", chars: 10 }, "way too long content").passed).toBe(false);
  });

  test("aggregateScore weights cases properly", () => {
    const cases: EvalCase[] = [
      { id: "a", input: "x", judge: { type: "contains", needle: "x" }, weight: 1 },
      { id: "b", input: "x", judge: { type: "contains", needle: "x" }, weight: 3 },
    ];
    const results = [
      { caseId: "a", caseName: "a", passed: true,  judgeKind: "contains", reason: "", output: "", costUsd: 0, durationMs: 0 },
      { caseId: "b", caseName: "b", passed: false, judgeKind: "contains", reason: "", output: "", costUsd: 0, durationMs: 0 },
    ];
    // 1 of 4 weight units passed = 0.25
    expect(aggregateScore(cases, results)).toBeCloseTo(0.25, 4);

    const allPass = results.map((r) => ({ ...r, passed: true }));
    expect(aggregateScore(cases, allPass)).toBe(1);
  });
});
