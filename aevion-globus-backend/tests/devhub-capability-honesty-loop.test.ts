import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";

import { devhubRouter } from "../src/routes/devhub";
import { __resetProviderHealth } from "../src/lib/providerHealth";

// Смоук 06.09.2026: «github обещан live, а проба github: HTTP 401» — класс
// «два наших ответа спорят об одном». Пробник /providers/health мерил ключи,
// но не кормил providerHealth, и /studio/capabilities объявлял возможность
// живой до первого обжёгшегося человека. Сторож закрепляет замкнутую петлю:
// после пробы с отказом capabilities говорят degraded с причиной.

let fetchMock: ReturnType<typeof vi.fn>;
const realFetch = globalThis.fetch;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);
  return app;
}

beforeEach(() => {
  __resetProviderHealth();
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env.GITHUB_TOKEN = "expired-token";
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.GITHUB_TOKEN;
  __resetProviderHealth();
});

describe("петля честности возможностей", () => {
  test("проба провайдеров с 401 у github переводит возможность в degraded", async () => {
    const app = makeApp();
    fetchMock.mockImplementation(async (url: string) => {
      const ok = !String(url).includes("api.github.com");
      return { ok, status: ok ? 200 : 401, json: async () => ({}), text: async () => "" } as unknown as Response;
    });

    const health = await request(app).get("/api/devhub/providers/health");
    expect(health.status).toBe(200);
    expect(health.body.failing).toContain("github");

    const caps = await request(app).get("/api/devhub/studio/capabilities");
    const github = (caps.body.capabilities as Array<{ id: string; status: string; lastError?: string }>)
      .find((c) => c.id === "github");
    expect(github, "возможности github нет в списке").toBeTruthy();
    expect(github!.status, "проба знает про 401, а витрина всё ещё обещает live — петля разомкнута").toBe("degraded");
    // ПЕРЕНЕСЕНО 08.09.2026 с текста на КОД, замысел прежний: витрина обязана
    // назвать ПРИЧИНУ, а не просто погасить огонёк. Раньше причиной был сырой
    // текст пробы («провайдер-проба: HTTP 401»), и он уходил в подсказку на
    // ПУБЛИЧНОЙ витрине — ворота §3.4 запрещают коды и адреса в том, что читает
    // человек, а атрибут title вдобавок не переводится доводчиком. Теперь
    // наружу идёт машинный код, слова подбирает словарь витрины.
    expect(
      (github as unknown as { offCode?: string }).offCode,
      "причина отказа больше не доезжает до витрины — петля снова разомкнута",
    ).toBe("auth_rejected");
  });

  test("после зелёной пробы возможность остаётся live", async () => {
    const app = makeApp();
    fetchMock.mockImplementation(async () =>
      ({ ok: true, status: 200, json: async () => ({}), text: async () => "" }) as unknown as Response);

    await request(app).get("/api/devhub/providers/health");
    const caps = await request(app).get("/api/devhub/studio/capabilities");
    const github = (caps.body.capabilities as Array<{ id: string; status: string }>).find((c) => c.id === "github");
    expect(github!.status).toBe("live");
  });
});
