import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/*
 * 🔴 Отказ тренера по смыслу (не тот язык / огрызок) — не авария.
 *
 * Решение оркестратора 13.10.2026: /api/coach/chat отвечает 200 с
 * fallback:"engine", причиной и текстом для человека; 5xx поднимал мониторинг
 * зря (§15: 5xx = «у нас сломалось»). У /chat/stream отказ остаётся 502 —
 * фронт с него сам падает на /chat, и это держат его собственные сторожа.
 */
vi.mock("../src/services/qcoreai/providers", async () => {
  const реальный = await vi.importActual<typeof import("../src/services/qcoreai/providers")>(
    "../src/services/qcoreai/providers",
  );
  const поставщики = [
    { id: "gemini", configured: true, defaultModel: "gemini-2.5-flash" },
    { id: "stub", configured: true, defaultModel: "stub" },
  ];
  return {
    ...реальный,
    getProviders: () => поставщики as any,
    isProviderOutOfService: () => false,
    listProviderOutages: () => [],
    noteProviderOutage: () => {},
    resolveProvider: () => "gemini",
    // дважды подряд — английский ответ на русский вопрос: отбраковка по языку
    callProvider: vi.fn(async (id: string) => ({ reply: "Castling hides the king and connects the rooks.", model: "m", usage: null, providerUsed: id })),
  };
});

async function приложение() {
  const { coachRouter } = await import("../src/routes/coach");
  const a = express();
  a.use(express.json());
  a.use("/api/coach", coachRouter);
  return a;
}

describe("отказ тренера по смыслу — не авария", () => {
  it("🔴 /chat: 200, fallback:\"engine\", причина и текст; чужой язык наружу не идёт", async () => {
    const r = await request(await приложение()).post("/api/coach/chat").send({
      system: "Ты шахматный тренер. Отвечай по-русски.",
      messages: [{ role: "user", content: "Какой ход лучше в этой позиции и почему?" }],
      maxTokens: 100,
    });
    expect(r.status, JSON.stringify(r.body).slice(0, 200)).toBe(200);
    expect(r.body.fallback).toBe("engine");
    expect(["wrong-language", "fragment"]).toContain(r.body.reason);
    expect(String(r.body.message)).toContain("Тренер");
    expect(JSON.stringify(r.body)).not.toContain("Castling hides");
    expect(r.body.content).toBeUndefined();
  });
});
