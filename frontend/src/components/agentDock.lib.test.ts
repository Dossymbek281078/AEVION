import { describe, test, expect } from "vitest";
import {
  clampMaxSteps,
  buildRunRequest,
  canSend,
  describeToolActivity,
  summarizeRun,
  type DockTranscriptMsg,
} from "./agentDock.lib";

describe("clampMaxSteps", () => {
  test("clamps to 1..8 and defaults on garbage", () => {
    expect(clampMaxSteps(5)).toBe(5);
    expect(clampMaxSteps(0)).toBe(1);
    expect(clampMaxSteps(99)).toBe(8);
    expect(clampMaxSteps("abc")).toBe(5);
    expect(clampMaxSteps(undefined)).toBe(5);
    expect(clampMaxSteps(3.9)).toBe(3);
  });
});

describe("buildRunRequest / canSend", () => {
  test("trims the message and clamps steps", () => {
    expect(buildRunRequest("  hi  ", 20)).toEqual({ message: "hi", maxSteps: 8 });
    expect(buildRunRequest("draw a cat")).toEqual({ message: "draw a cat", maxSteps: 5 });
  });
  test("canSend rejects blank", () => {
    expect(canSend("   ")).toBe(false);
    expect(canSend("x")).toBe(true);
  });
});

describe("describeToolActivity", () => {
  const transcript: DockTranscriptMsg[] = [
    { role: "user", text: "draw a cat then email it" },
    { role: "assistant", text: "ok", toolCalls: [{ id: "a", name: "generate_image" }] },
    { role: "tool", toolResults: [{ callId: "a", name: "generate_image", ok: true }] },
    { role: "assistant", text: "", toolCalls: [{ id: "b", name: "send_email" }] },
    { role: "tool", toolResults: [{ callId: "b", name: "send_email", ok: false }] },
    { role: "assistant", text: "Done." },
  ];

  test("pairs each tool call with its result ok flag, in order", () => {
    expect(describeToolActivity(transcript)).toEqual([
      { name: "generate_image", ok: true },
      { name: "send_email", ok: false },
    ]);
  });

  test("missing result → ok:false; empty/absent → []", () => {
    expect(describeToolActivity([{ role: "assistant", toolCalls: [{ id: "z", name: "x" }] }])).toEqual([
      { name: "x", ok: false },
    ]);
    expect(describeToolActivity(undefined)).toEqual([]);
    expect(describeToolActivity([])).toEqual([]);
  });
});

describe("summarizeRun", () => {
  test("direct answer", () => {
    expect(summarizeRun({ ok: true, finalText: "hello", transcript: [{ role: "assistant", text: "hello" }] })).toBe(
      "Answered directly.",
    );
  });
  test("lists tools used and failures", () => {
    const res = {
      ok: true,
      transcript: [
        { role: "assistant" as const, toolCalls: [{ id: "a", name: "generate_music" }] },
        { role: "tool" as const, toolResults: [{ callId: "a", name: "generate_music", ok: true }] },
      ],
    };
    expect(summarizeRun(res)).toBe("Used generate_music.");
  });
  test("error surfaces", () => {
    expect(summarizeRun({ ok: false, error: "boom" })).toBe("boom");
  });
});
