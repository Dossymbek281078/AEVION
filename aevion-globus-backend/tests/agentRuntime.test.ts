/**
 * Unit tests for the agent runtime — the real provider tool-use loop.
 *
 * Everything here is deterministic: the loop is dependency-injected, so we
 * drive it with fake `callModel` / `execTool` (no network, no ANTHROPIC key),
 * fake `fetch` for the DevHub executor, and exercise the Anthropic wire-format
 * conversion via the model builder with a stubbed fetch. No live provider I/O.
 */
import { describe, test, expect } from "vitest";
import {
  runAgentLoop,
  type CallModel,
  type ExecTool,
  type LoopMessage,
  type ModelStep,
  type ToolSpec,
} from "../src/services/agentRuntime/loop";
import { TOOL_SPECS, makeExecutor } from "../src/services/agentRuntime/tools";
import { makeAnthropicCallModel } from "../src/services/agentRuntime/anthropicClient";

// ── runAgentLoop ─────────────────────────────────────────────────────

describe("runAgentLoop", () => {
  test("no tool calls → returns the model's final text immediately", async () => {
    const callModel: CallModel = async () => ({ text: "Hello there.", toolCalls: [] });
    const execTool: ExecTool = async () => ({ ok: true, content: "should not be called" });

    const r = await runAgentLoop({
      messages: [{ role: "user", text: "hi" }],
      tools: TOOL_SPECS,
      callModel,
      execTool,
    });

    expect(r.finalText).toBe("Hello there.");
    expect(r.steps).toBe(1);
    expect(r.hitMaxSteps).toBe(false);
    // user + assistant
    expect(r.transcript.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  test("one tool call → executes it, feeds result back, then answers", async () => {
    const calls: string[] = [];
    let turn = 0;
    const callModel: CallModel = async (messages) => {
      turn += 1;
      if (turn === 1) {
        return {
          text: "Let me draw that.",
          toolCalls: [{ id: "t1", name: "generate_image", input: { prompt: "a cat" } }],
        };
      }
      // Second turn: the tool result must be in the transcript we were handed.
      const toolMsg = messages.find((m) => m.role === "tool");
      expect(toolMsg?.toolResults?.[0]?.name).toBe("generate_image");
      return { text: "Here is your cat image.", toolCalls: [] };
    };
    const execTool: ExecTool = async (call) => {
      calls.push(call.name);
      return { ok: true, content: { url: "https://img/cat.png" } };
    };

    const r = await runAgentLoop({
      messages: [{ role: "user", text: "draw a cat" }],
      tools: TOOL_SPECS,
      callModel,
      execTool,
    });

    expect(calls).toEqual(["generate_image"]);
    expect(r.finalText).toBe("Here is your cat image.");
    expect(r.steps).toBe(2);
    expect(r.hitMaxSteps).toBe(false);
    expect(r.transcript.map((m) => m.role)).toEqual(["user", "assistant", "tool", "assistant"]);
  });

  test("a throwing executor is caught and reported as a failed tool result", async () => {
    let turn = 0;
    let seenResult: { ok: boolean; content: unknown } | undefined;
    const callModel: CallModel = async (messages) => {
      turn += 1;
      if (turn === 1) {
        return { text: "", toolCalls: [{ id: "t1", name: "send_email", input: { to: "x@y.z", htmlBody: "hi" } }] };
      }
      const tr = messages.find((m) => m.role === "tool")?.toolResults?.[0];
      seenResult = tr && { ok: tr.ok, content: tr.content };
      return { text: "Sorry, that failed.", toolCalls: [] };
    };
    const execTool: ExecTool = async () => {
      throw new Error("smtp exploded");
    };

    const r = await runAgentLoop({
      messages: [{ role: "user", text: "email x" }],
      tools: TOOL_SPECS,
      callModel,
      execTool,
    });

    expect(seenResult).toEqual({ ok: false, content: "smtp exploded" });
    expect(r.finalText).toBe("Sorry, that failed.");
  });

  test("a model that never stops calling tools hits maxSteps honestly", async () => {
    const callModel: CallModel = async () => ({
      text: "again",
      toolCalls: [{ id: "t", name: "generate_image", input: { prompt: "loop" } }],
    });
    const execTool: ExecTool = async () => ({ ok: true, content: "ok" });

    const r = await runAgentLoop({
      messages: [{ role: "user", text: "go" }],
      tools: TOOL_SPECS,
      callModel,
      execTool,
      maxSteps: 3,
    });

    expect(r.hitMaxSteps).toBe(true);
    expect(r.steps).toBe(3);
    expect(r.finalText).toMatch(/maximum number of tool steps/i);
  });
});

// ── TOOL_SPECS ───────────────────────────────────────────────────────

describe("TOOL_SPECS", () => {
  test("every spec has a name, description and an object input schema", () => {
    expect(TOOL_SPECS.length).toBeGreaterThan(0);
    for (const t of TOOL_SPECS) {
      expect(typeof t.name).toBe("string");
      expect(t.name.length).toBeGreaterThan(0);
      expect(typeof t.description).toBe("string");
      expect((t.inputSchema as { type?: string }).type).toBe("object");
    }
  });

  test("tool names are unique", () => {
    const names = TOOL_SPECS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ── makeExecutor (DevHub internal-fetch) ─────────────────────────────

describe("makeExecutor", () => {
  test("POSTs to the mapped DevHub endpoint and returns its JSON", async () => {
    let seenUrl = "";
    let seenBody: unknown = null;
    const fakeFetch = (async (url: string, init?: { body?: string }) => {
      seenUrl = url;
      seenBody = JSON.parse(init?.body ?? "{}");
      return {
        ok: true,
        json: async () => ({ url: "https://img/out.png" }),
      };
    }) as unknown as typeof fetch;

    const exec = makeExecutor("http://127.0.0.1:4001", fakeFetch);
    const r = await exec({ id: "t1", name: "generate_image", input: { prompt: "a fox", size: "1024x1024" } });

    expect(seenUrl).toBe("http://127.0.0.1:4001/api/devhub/media/image");
    expect(seenBody).toEqual({ prompt: "a fox", size: "1024x1024" });
    expect(r.ok).toBe(true);
    expect(r.content).toEqual({ url: "https://img/out.png" });
  });

  test("unknown tool name → ok:false without any fetch", async () => {
    let called = false;
    const fakeFetch = (async () => {
      called = true;
      return { ok: true, json: async () => ({}) };
    }) as unknown as typeof fetch;

    const exec = makeExecutor("http://127.0.0.1:4001", fakeFetch);
    const r = await exec({ id: "t1", name: "delete_database", input: {} });

    expect(called).toBe(false);
    expect(r.ok).toBe(false);
    expect(String(r.content)).toMatch(/unknown tool/i);
  });

  test("payment_link fills sensible defaults for optional fields", async () => {
    let seenBody: Record<string, unknown> = {};
    const fakeFetch = (async (_url: string, init?: { body?: string }) => {
      seenBody = JSON.parse(init?.body ?? "{}");
      return { ok: true, json: async () => ({ link: "https://pay/abc" }) };
    }) as unknown as typeof fetch;

    const exec = makeExecutor("http://127.0.0.1:4001", fakeFetch);
    await exec({ id: "t1", name: "payment_link", input: { amountCents: 2500 } });

    expect(seenBody.amountCents).toBe(2500);
    expect(seenBody.name).toBe("AEVION payment");
    expect(seenBody.description).toBe("");
  });

  // Each new tool must hit its own DevHub endpoint with the endpoint's body shape.
  test.each([
    ["generate_music", "/api/devhub/media/music", { prompt: "lofi beat", musicLengthMs: 10000 }, { prompt: "lofi beat", musicLengthMs: 10000 }],
    ["generate_sound_effect", "/api/devhub/media/sfx", { text: "glass shatter", durationSeconds: 2 }, { text: "glass shatter", durationSeconds: 2 }],
    ["send_sms", "/api/devhub/media/sms", { recipient: "+15551234567", content: "hi" }, { recipient: "+15551234567", content: "hi" }],
    ["translate_text", "/api/devhub/media/translate", { text: "hello", targetLang: "RU" }, { text: "hello", targetLang: "RU" }],
  ])("%s routes to %s with the mapped body", async (name, path, input, expectedBody) => {
    let seenUrl = "";
    let seenBody: unknown = null;
    const fakeFetch = (async (url: string, init?: { body?: string }) => {
      seenUrl = url;
      seenBody = JSON.parse(init?.body ?? "{}");
      return { ok: true, json: async () => ({ ok: true }) };
    }) as unknown as typeof fetch;

    const exec = makeExecutor("http://127.0.0.1:4001", fakeFetch);
    const r = await exec({ id: "t1", name: name as string, input: input as Record<string, unknown> });

    expect(seenUrl).toBe(`http://127.0.0.1:4001${path}`);
    expect(seenBody).toEqual(expectedBody);
    expect(r.ok).toBe(true);
  });

  test("optional fields are omitted from the body when absent", async () => {
    let seenBody: Record<string, unknown> = {};
    const fakeFetch = (async (_url: string, init?: { body?: string }) => {
      seenBody = JSON.parse(init?.body ?? "{}");
      return { ok: true, json: async () => ({ ok: true }) };
    }) as unknown as typeof fetch;

    const exec = makeExecutor("http://127.0.0.1:4001", fakeFetch);
    await exec({ id: "t1", name: "generate_music", input: { prompt: "ambient" } });

    expect(seenBody).toEqual({ prompt: "ambient" });
    expect("musicLengthMs" in seenBody).toBe(false);
  });

  // generate_code is the one tool that needs per-request context (an open
  // DevHub project) instead of everything coming from the model's own input.
  test("generate_code with no projectId in context → ok:false without any fetch", async () => {
    let called = false;
    const fakeFetch = (async () => {
      called = true;
      return { ok: true, json: async () => ({}) };
    }) as unknown as typeof fetch;

    const exec = makeExecutor("http://127.0.0.1:4001", fakeFetch); // no context passed
    const r = await exec({ id: "t1", name: "generate_code", input: { prompt: "a login form" } });

    expect(called).toBe(false);
    expect(r.ok).toBe(false);
    expect(String(r.content)).toMatch(/no devhub project is open/i);
  });

  test("generate_code with projectId in context → posts to the project's /generate endpoint", async () => {
    let seenUrl = "";
    let seenBody: unknown = null;
    let seenHeaders: Record<string, string> = {};
    const fakeFetch = (async (url: string, init?: { body?: string; headers?: Record<string, string> }) => {
      seenUrl = url;
      seenBody = JSON.parse(init?.body ?? "{}");
      seenHeaders = init?.headers ?? {};
      return { ok: true, json: async () => ({ files: [{ path: "pages/login.tsx" }], aiGenerated: true }) };
    }) as unknown as typeof fetch;

    const exec = makeExecutor("http://127.0.0.1:4001", fakeFetch, { projectId: "proj-1", authHeader: "Bearer tok-1" });
    const r = await exec({ id: "t1", name: "generate_code", input: { prompt: "a login form", targetFile: "pages/login.tsx" } });

    expect(seenUrl).toBe("http://127.0.0.1:4001/api/devhub/projects/proj-1/generate");
    expect(seenBody).toEqual({ prompt: "a login form", targetFile: "pages/login.tsx" });
    expect(seenHeaders.Authorization).toBe("Bearer tok-1");
    expect(r.ok).toBe(true);
    expect(r.content).toEqual({ files: [{ path: "pages/login.tsx" }], aiGenerated: true });
  });

  test("generate_code omits Authorization header when the caller sent none (anonymous project)", async () => {
    let seenHeaders: Record<string, string> = {};
    const fakeFetch = (async (_url: string, init?: { body?: string; headers?: Record<string, string> }) => {
      seenHeaders = init?.headers ?? {};
      return { ok: true, json: async () => ({ files: [], aiGenerated: false }) };
    }) as unknown as typeof fetch;

    const exec = makeExecutor("http://127.0.0.1:4001", fakeFetch, { projectId: "proj-1" }); // no authHeader
    await exec({ id: "t1", name: "generate_code", input: { prompt: "x" } });

    expect("Authorization" in seenHeaders).toBe(false);
  });

  // create_pull_request is the other project-scoped tool — same "no project
  // context → clean error, not a fetch to a nonsensical path" contract as
  // generate_code, plus its own endpoint + body shape.
  test("create_pull_request with no projectId in context → ok:false without any fetch", async () => {
    let called = false;
    const fakeFetch = (async () => {
      called = true;
      return { ok: true, json: async () => ({}) };
    }) as unknown as typeof fetch;

    const exec = makeExecutor("http://127.0.0.1:4001", fakeFetch); // no context
    const r = await exec({ id: "t1", name: "create_pull_request", input: { title: "Add feature" } });

    expect(called).toBe(false);
    expect(r.ok).toBe(false);
    expect(String(r.content)).toMatch(/no devhub project is open/i);
  });

  test("create_pull_request with projectId routes to the project's github/pull-request endpoint", async () => {
    let seenUrl = "";
    let seenBody: unknown = null;
    const fakeFetch = (async (url: string, init?: { body?: string }) => {
      seenUrl = url;
      seenBody = JSON.parse(init?.body ?? "{}");
      return { ok: true, json: async () => ({ ok: true, prUrl: "https://github.com/o/r/pull/9", prNumber: 9 }) };
    }) as unknown as typeof fetch;

    const exec = makeExecutor("http://127.0.0.1:4001", fakeFetch, { projectId: "proj-1" });
    const r = await exec({ id: "t1", name: "create_pull_request", input: { title: "Add feature", body: "desc", branch: "feat/x" } });

    expect(seenUrl).toBe("http://127.0.0.1:4001/api/devhub/projects/proj-1/github/pull-request");
    expect(seenBody).toEqual({ title: "Add feature", body: "desc", branch: "feat/x" });
    expect(r.ok).toBe(true);
    expect(r.content).toEqual({ ok: true, prUrl: "https://github.com/o/r/pull/9", prNumber: 9 });
  });

  test("create_pull_request omits optional body/branch fields when absent", async () => {
    let seenBody: Record<string, unknown> = {};
    const fakeFetch = (async (_url: string, init?: { body?: string }) => {
      seenBody = JSON.parse(init?.body ?? "{}");
      return { ok: true, json: async () => ({ ok: true }) };
    }) as unknown as typeof fetch;

    const exec = makeExecutor("http://127.0.0.1:4001", fakeFetch, { projectId: "proj-1" });
    await exec({ id: "t1", name: "create_pull_request", input: { title: "Add feature" } });

    expect(seenBody).toEqual({ title: "Add feature" });
  });
});

// ── makeAnthropicCallModel (wire-format conversion) ──────────────────

describe("makeAnthropicCallModel", () => {
  test("throws a clear error when no API key is configured", async () => {
    const call = makeAnthropicCallModel({ apiKey: "" });
    await expect(call([{ role: "user", text: "hi" }], TOOL_SPECS)).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });

  test("sends tools + converted messages and parses text + tool_use blocks", async () => {
    let sent: Record<string, unknown> = {};
    const fakeFetch = (async (_url: string, init?: { body?: string; headers?: Record<string, string> }) => {
      sent = JSON.parse(init?.body ?? "{}");
      // Echo back one text block and one tool_use block.
      return {
        ok: true,
        json: async () => ({
          content: [
            { type: "text", text: "Drawing now." },
            { type: "tool_use", id: "tu_1", name: "generate_image", input: { prompt: "a dog" } },
          ],
        }),
      };
    }) as unknown as typeof fetch;

    const call = makeAnthropicCallModel({ apiKey: "sk-test", model: "claude-sonnet-5", fetchImpl: fakeFetch, system: "SYS" });

    const messages: LoopMessage[] = [
      { role: "user", text: "draw a dog" },
      { role: "assistant", text: "ok", toolCalls: [{ id: "prev", name: "generate_image", input: { prompt: "x" } }] },
      { role: "tool", toolResults: [{ callId: "prev", name: "generate_image", ok: true, content: { url: "u" } }] },
    ];

    const step: ModelStep = await call(messages, TOOL_SPECS);

    // Request shape.
    expect(sent.model).toBe("claude-sonnet-5");
    expect(sent.system).toBe("SYS");
    expect(Array.isArray(sent.tools)).toBe(true);
    expect((sent.tools as { name: string }[])[0]).toHaveProperty("input_schema");

    // Converted messages: user(text), assistant(blocks), user(tool_result).
    const wire = sent.messages as { role: string; content: unknown }[];
    expect(wire[0]).toEqual({ role: "user", content: "draw a dog" });
    expect(wire[1].role).toBe("assistant");
    expect(Array.isArray(wire[1].content)).toBe(true);
    expect(wire[2].role).toBe("user"); // tool results ride on a user turn
    const trBlock = (wire[2].content as { type: string; tool_use_id: string }[])[0];
    expect(trBlock.type).toBe("tool_result");
    expect(trBlock.tool_use_id).toBe("prev");

    // Parsed response.
    expect(step.text).toBe("Drawing now.");
    expect(step.toolCalls).toEqual([{ id: "tu_1", name: "generate_image", input: { prompt: "a dog" } }]);
  });

  test("propagates a non-OK provider response as an error", async () => {
    const fakeFetch = (async () => ({
      ok: false,
      status: 429,
      text: async () => "rate limited",
    })) as unknown as typeof fetch;

    const call = makeAnthropicCallModel({ apiKey: "sk-test", fetchImpl: fakeFetch });
    await expect(call([{ role: "user", text: "hi" }], TOOL_SPECS)).rejects.toThrow(/429/);
  });
});
