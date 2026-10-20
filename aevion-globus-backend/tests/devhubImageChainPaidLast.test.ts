/**
 * Цепочка картинок DevHub: платный OpenAI — последним.
 *
 * ПОВОД (20.10.2026). providers/health на проде: OpenAI «ключ годен, денег нет»
 * (429). Он стоял ПЕРВЫМ в цепочке картинок, и каждая картинка начиналась с
 * пустого вызова; проба пробным аккаунтом: картинку отдал gemini за 7,7 с.
 * Слово Оркестратора: не просить денег, а поставить OpenAI последним.
 *
 * Проверяется поведение, а не текст: fetch подменён, считаются вызовы по адресам.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery }),
  getPoolStats: () => null,
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));

// eslint-disable-next-line import/first
import { generateImageViaChain } from "../src/routes/devhub";

const КЛЮЧИ = {
  OPENAI_API_KEY: "sk-test",
  CLOUDFLARE_API_TOKEN: "cf-test",
  CLOUDFLARE_ACCOUNT_ID: "acc-test",
  GEMINI_API_KEY: "gm-test",
  TOGETHER_API_KEY: "tg-test",
};
const кто = (url: string) =>
  url.includes("api.openai.com") ? "openai"
  : url.includes("cloudflare.com") ? "workers-ai"
  : url.includes("generativelanguage.googleapis.com") ? "gemini"
  : url.includes("together.xyz") ? "together"
  : "other";

const прежние: Record<string, string | undefined> = {};
const realFetch = global.fetch;
let вызовы: string[] = [];

function подменитьFetch(живые: Set<string>) {
  global.fetch = vi.fn(async (url: any) => {
    const k = кто(String(url));
    вызовы.push(k);
    if (!живые.has(k)) return new Response("no credits", { status: k === "openai" ? 429 : 401 });
    if (k === "gemini") {
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: "QUJD" } }] } }] }), { status: 200 });
    }
    if (k === "openai" || k === "together") {
      return new Response(JSON.stringify({ data: [{ b64_json: "QUJD" }] }), { status: 200 });
    }
    return new Response("x", { status: 500 });
  }) as any;
}

beforeEach(() => {
  вызовы = [];
  for (const [k, v] of Object.entries(КЛЮЧИ)) { прежние[k] = process.env[k]; process.env[k] = v; }
});
afterEach(() => {
  global.fetch = realFetch;
  for (const k of Object.keys(КЛЮЧИ)) {
    if (прежние[k] === undefined) delete process.env[k]; else process.env[k] = прежние[k];
  }
});

describe("цепочка картинок: платный последним", () => {
  test("как на проде 20.10: workers 401, gemini жив — картинку даёт gemini, OpenAI не зовётся вовсе", async () => {
    подменитьFetch(new Set(["gemini"]));
    const { result } = await generateImageViaChain("кофейная чашка", "1024x1024", "standard");
    expect(result?.provider).toBe("gemini");
    expect(вызовы).toEqual(["workers-ai", "gemini"]);
    expect(вызовы).not.toContain("openai");
  });

  test("все бесплатные упали — OpenAI спрашивается последним и отвечает", async () => {
    подменитьFetch(new Set(["openai"]));
    const { result, attempts } = await generateImageViaChain("кофейная чашка", "1024x1024", "standard");
    expect(вызовы).toEqual(["workers-ai", "gemini", "together", "openai"]);
    expect(result?.provider).toBe("openai");
    expect(attempts.map((a) => a.provider)).toEqual(["workers-ai", "gemini", "together"]);
  });

  test("все упали, включая OpenAI — результата нет, причины всех четырёх видны", async () => {
    подменитьFetch(new Set());
    const { result, attempts } = await generateImageViaChain("кофейная чашка", "1024x1024", "standard");
    expect(result).toBeNull();
    expect(attempts.map((a) => a.provider)).toEqual(["workers-ai", "gemini", "together", "openai"]);
  });
});
