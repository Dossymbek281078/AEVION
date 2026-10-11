import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож ПРАВДЫ для фронтового уведомления над кнопкой «Запустить» в
 * QFusionAI (frontend/src/app/qfusionai/components/FusionPlayground.tsx):
 * «Платно — входит в подписку AEVION».
 *
 * Это обещание на экране верно ровно до тех пор, пока ручка действия
 * POST /api/qfusionai/route действительно закрывает гостя. Проверяется не
 * текст страницы и не копия правила, а РЕАЛЬНЫЙ гейт requireModule — тот же,
 * что index.ts вешает на `/api/qfusionai` (строка регистрации пейволла,
 * `["/api/qfusionai", "qfusionai", qfusionaiRouter]`). Если кто-то снимет
 * qfusionai со стены — уведомление станет ложью, и этот сторож покраснеет.
 *
 * §0-СТОРОЖ-ДЕЛАЕТ-ЗАПРОС: сторож на ручку делает ЗАПРОС к ручке и смотрит
 * ТЕЛО ответа, а не функцию и не свою копию. §0-ДОКЛАД-ПРОВЕРЕН: рядом
 * отрицательный контроль — при спящем пейволле та же ручка отвечает 200,
 * иначе тест был бы зелёным и на «всегда 402».
 *
 * appSubscriptionState замокан на "none", чтобы путь отказа не зависел от
 * базы (для гостя с email=null прав нет и так; мок лишь убирает поход в БД).
 */
vi.mock("../src/lib/appEntitlements", () => ({
  appSubscriptionState: vi.fn(async () => "none"),
}));

import { requireModule } from "../src/lib/planGate";

function приложение() {
  const app = express();
  app.use(express.json());
  // Тот же гейт, что в проде, перед заглушкой-ручкой: успех downstream = 200.
  app.post(
    "/api/qfusionai/route",
    requireModule("qfusionai"),
    (_req, res) => { res.status(200).json({ ok: true }); },
  );
  return app;
}

const СНЯТЬ = ["PAYWALL_MODULES", "PAYWALL_SOURCE", "PAYWALL_DISABLED"] as const;
let сохранённые: Record<string, string | undefined> = {};

beforeEach(() => {
  сохранённые = {};
  for (const k of СНЯТЬ) { сохранённые[k] = process.env[k]; delete process.env[k]; }
});
afterEach(() => {
  for (const k of СНЯТЬ) {
    if (сохранённые[k] === undefined) delete process.env[k];
    else process.env[k] = сохранённые[k];
  }
  vi.clearAllMocks();
});

describe("ручка qfusionai/route закрывает гостя, когда модуль на стене", () => {
  it("PAYWALL_MODULES=qfusionai → гость получает 402 upgrade_required", async () => {
    process.env.PAYWALL_MODULES = "qfusionai";
    const res = await request(приложение())
      .post("/api/qfusionai/route")
      .send({ prompt: "2+2?", strategy: "auto" });
    expect(res.status).toBe(402);
    expect(res.body?.error).toBe("upgrade_required");
  });

  // Отрицательный контроль: стена спит (переменная не задана — «dormant by
  // default») → та же ручка пускает. Без него сторож был бы зелёным и на
  // ручке, которая отвечает 402 ВСЕГДА, и уведомление «платно» ничем бы не
  // подтверждалось.
  it("пейволл выключен → та же ручка отвечает 200 (контроль, 402 идёт от гейта)", async () => {
    const res = await request(приложение())
      .post("/api/qfusionai/route")
      .send({ prompt: "2+2?", strategy: "auto" });
    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
  });
});
