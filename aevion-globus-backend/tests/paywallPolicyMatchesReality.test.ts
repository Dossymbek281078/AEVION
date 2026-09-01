import { describe, test, expect, afterAll } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: публичная политика стены совпадает с тем, как стена решает НА САМОМ ДЕЛЕ.
 *
 * ЗАЧЕМ. Эту ручку читают снаружи, чтобы узнать, какие модули закрыты. Я сам
 * пользовался ею 01.09.2026 как прибором и на её ответе построил вывод про
 * запуск. Прибор, которому доверяют выводы, обязан быть проверен: замер в тот
 * же день показал, что ручку не звал ни один тест.
 *
 * Проверяется не список модулей (он меняется), а СОГЛАСИЕ двух наших ответов:
 * что ручка объявляет закрытым — то и должно быть закрыто по решению стены.
 */
process.env.PAYWALL_MODULES = "multichat-engine,qai";

const { entitlementsRouter } = await import("../src/routes/entitlements");
const { paywallEnabledFor, tiersForModule, normalizeTier } = await import("../src/lib/planGate");

function приложение() {
  const a = express();
  a.use("/api", entitlementsRouter);
  return a;
}

afterAll(() => { delete process.env.PAYWALL_MODULES; });

describe("политика стены совпадает с решением стены", () => {
  test("ручка отвечает и перечисляет модули", async () => {
    const res = await request(приложение()).get("/api/paywall/policy");
    expect(res.status).toBe(200);
    // Контроль охвата: пустой список сделал бы проверку ниже бессмысленной.
    expect((res.body.modules ?? []).length, "политика вернула пустой список")
      .toBeGreaterThanOrEqual(10);
  });

  test("каждое объявленное enforced совпадает с реальным решением", async () => {
    const res = await request(приложение()).get("/api/paywall/policy");
    const расхождения = (res.body.modules ?? []).filter(
      (m: { module: string; enforced: boolean }) =>
        m.enforced !== paywallEnabledFor(m.module),
    );
    expect(
      расхождения.map((m: { module: string }) => m.module),
      "ручка объявляет одно, а стена решает другое",
    ).toEqual([]);
  });

  test("объявленные требования к тарифу совпадают с реальными", async () => {
    const res = await request(приложение()).get("/api/paywall/policy");
    const расхождения = (res.body.modules ?? []).filter(
      (m: { module: string; requiredTiers: string[] }) =>
        // Ручка отдаёт тарифы в ПРИВЕДЁННОЙ форме (business -> full), поэтому
        // сравнивать надо с такой же — иначе сторож ловит нормализацию, а не
        // расхождение.
        JSON.stringify(m.requiredTiers) !==
          JSON.stringify(
            tiersForModule(m.module)
              .map(normalizeTier)
              // «free» ручка убирает НАМЕРЕННО: политика перечисляет платные
              // тарифы, открывающие модуль, и бесплатный там не к месту.
              .filter((t: string) => t !== "free"),
          ),
    );
    expect(
      расхождения.map((m: { module: string }) => m.module),
      "ручка обещает не те тарифы, что требует стена",
    ).toEqual([]);
  });

  test("КОНТРОЛЬ: включённые модули действительно помечены enforced", async () => {
    // Иначе «совпадает» могло бы значить, что и там, и там всегда false.
    const res = await request(приложение()).get("/api/paywall/policy");
    const включённые = (res.body.modules ?? []).filter(
      (m: { enforced: boolean }) => m.enforced,
    );
    expect(
      включённые.map((m: { module: string }) => m.module).sort(),
      "переменная задана двумя модулями, а помечен ни один",
    ).toEqual(["multichat-engine", "qai"]);
  });
});
