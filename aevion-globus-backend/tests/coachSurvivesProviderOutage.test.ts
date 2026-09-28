/**
 * Тренер обязан отвечать, пока жив ХОТЬ ОДИН поставщик.
 *
 * ПОВОД. Замер прода 28.09.2026: `POST /api/coach/chat` → 400 «You have reached
 * your specified API usage limits… regain access on 2026-10-01», а `POST
 * /api/qcoreai/chat` тем же моментом → 200 от gemini-2.5-flash. Разница была не
 * в удаче: qcoreai ходит через реестр поставщиков, а тренер звал Anthropic своим
 * fetch и умер вместе с его счётом. Полный запуск шахмат — 30.09, то есть
 * витрина обещала бы разбор при молчащем тренере.
 *
 * Здесь закрепляется ПОВЕДЕНИЕ, а не текст: закрылся первый — отвечает
 * следующий; закрылись все — отказ честный (503) и с текстом поставщика, по
 * которому фронт называет человеку срок возврата; health говорит «могу ли
 * ответить», а не «задан ли ключ».
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const вызовы: string[] = [];

vi.mock("../src/services/qcoreai/providers", async () => {
  const реальный = await vi.importActual<typeof import("../src/services/qcoreai/providers")>(
    "../src/services/qcoreai/providers",
  );
  let закрыт = new Set<string>();
  const поставщики = [
    { id: "anthropic", configured: true, defaultModel: "claude-opus-4-8" },
    { id: "gemini", configured: true, defaultModel: "gemini-2.5-flash" },
    { id: "stub", configured: true, defaultModel: "stub" },
  ];
  return {
    ...реальный,
    getProviders: () => поставщики as any,
    isProviderOutOfService: (id: string) => закрыт.has(id),
    listProviderOutages: () =>
      [...закрыт].map((id) => ({ id, until: "2026-10-01T00:00:00.000Z", reason: "usage limit" })),
    noteProviderOutage: (id: string) => { закрыт.add(id); },
    resolveProvider: (пред?: string) => {
      if (пред && !закрыт.has(пред)) return пред;
      const живой = поставщики.find((p) => p.configured && p.id !== "stub" && !закрыт.has(p.id));
      return живой?.id ?? "stub";
    },
    callProvider: vi.fn(async (id: string) => {
      вызовы.push(id);
      if (id === "anthropic") {
        throw new Error(
          "You have reached your specified API usage limits. You will regain access on 2026-10-01 at 00:00 UTC.",
        );
      }
      return { reply: "Конь на f3 держит центр.", model: "gemini-2.5-flash", usage: null, providerUsed: id };
    }),
    __закрыть: (id: string) => закрыт.add(id),
    __сброс: () => { закрыт = new Set(); вызовы.length = 0; },
  };
});

const приложение = async () => {
  const { coachRouter } = await import("../src/routes/coach");
  const a = express();
  a.use(express.json());
  a.use("/api/coach", coachRouter);
  return a;
};

const тело = {
  system: "Ты шахматный тренер.",
  messages: [{ role: "user", content: "Какой ход лучше?" }],
  maxTokens: 100,
};

beforeEach(async () => {
  const m: any = await import("../src/services/qcoreai/providers");
  m.__сброс();
});

describe("тренер переживает закрытый счёт поставщика", () => {
  it("закрыт Anthropic — отвечает следующий живой, а не отказ", async () => {
    const m: any = await import("../src/services/qcoreai/providers");
    m.__закрыть("anthropic");
    const res = await request(await приложение()).post("/api/coach/chat").send(тело);
    expect(res.status).toBe(200);
    expect(вызовы).toContain("gemini");
    expect(вызовы).not.toContain("anthropic"); // в закрытую дверь не стучимся
  });

  it("форма ответа прежняя — её разбирают три места шахмат", async () => {
    const m: any = await import("../src/services/qcoreai/providers");
    m.__закрыть("anthropic");
    const res = await request(await приложение()).post("/api/coach/chat").send(тело);
    // Именно так фронт достаёт текст: data.content[].text
    const текст = (res.body.content || []).map((c: any) => c.text || "").join("");
    expect(текст).toContain("Конь");
    expect(res.body.provider).toBe("gemini");
  });

  it("контроль: пока никто не закрыт — идём к Anthropic, как и раньше", async () => {
    const res = await request(await приложение()).post("/api/coach/chat").send(тело);
    // Anthropic бросает лимит, и переход делает сам реестр (здесь он замокан),
    // поэтому проверяем именно ПЕРВОГО, к кому пошли.
    expect(вызовы[0]).toBe("anthropic");
    expect(res.status).toBeLessThan(600);
  });

  it("health отвечает «могу ли ответить», а не «задан ли ключ»", async () => {
    const res = await request(await приложение()).get("/api/coach/health");
    expect(res.status).toBe(200);
    expect(res.body.canAnswer).toBe(true);
    expect(res.body.ok).toBe(true);
    // Прежнее поле обещало не то, о чём его спрашивали.
    expect(res.body.apiKeyConfigured).toBeUndefined();
  });

  it("health краснеет, когда живых поставщиков не осталось", async () => {
    const m: any = await import("../src/services/qcoreai/providers");
    m.__закрыть("anthropic");
    m.__закрыть("gemini");
    const res = await request(await приложение()).get("/api/coach/health");
    expect(res.body.ok).toBe(false);
    expect(res.body.canAnswer).toBe(false);
    expect(res.body.outages.map((o: any) => o.id)).toContain("anthropic");
  });

  it("health не печатает значений ключей", async () => {
    const res = await request(await приложение()).get("/api/coach/health");
    expect(JSON.stringify(res.body)).not.toMatch(/sk-|AIza|api[_-]?key/i);
  });
});
