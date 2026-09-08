import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Отказ модели перевода НЕ должен становиться 500 — и НЕ должен молчать.
 *
 * ЗАМЕР, из которого этот тест вырос (прод, 28.08.2026). Страница
 * `/cyberchess/tournament` шлёт 23 строки и получает 500 с
 * `Claude translation parse/length mismatch`. Воспроизведено одним curl,
 * 2 попытки из 2; те же строки, разбитые на четыре группы, переводятся
 * успешно (все 200). То есть модель сбивается именно на этой пачке.
 *
 * Два свойства проверяются отдельно, потому что чинят разное:
 *   1) запрос не падает и отдаёт исходные строки — человек видит страницу;
 *   2) ответ ПРИЗНАЁТСЯ, что перевода не было (`degraded: true`) — иначе
 *      «не перевели» неотличимо от «перевели», и никто не узнает.
 *
 * Третье свойство не менее важно: неудачу нельзя класть в кэш. Иначе исходные
 * строки залипнут на сутки, и починка отложится на сутки же.
 */

const callProvider = vi.fn();
vi.mock("../src/services/qcoreai/providers", () => ({
  callProvider: (...a: unknown[]) => callProvider(...a),
}));
vi.mock("../src/middleware/generationLimit", () => ({
  generationLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

async function app() {
  const { i18nRouter } = await import("../src/routes/i18n");
  const a = express();
  a.use(express.json());
  a.use("/api/i18n", i18nRouter);
  return a;
}

describe("перевод: отказ модели не роняет запрос и не притворяется успехом", () => {
  beforeEach(() => {
    vi.resetModules();          // кэш переводов живёт в модуле — сбрасываем
    callProvider.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
    delete process.env.DEEPL_API_KEY;   // без DeepL всё идёт в Claude, как на проде
  });

  it("несовпадение длины: 200, исходные строки и признание degraded", async () => {
    // Ровно то, что делает модель на проде: массив ДРУГОЙ длины.
    callProvider.mockResolvedValue({ reply: JSON.stringify(["Один"]) });

    const res = await request(await app())
      .post("/api/i18n/translate")
      .send({ target: "ru", texts: ["One", "Two", "Three"] });

    expect(res.status).toBe(200);
    expect(res.body.translations).toEqual(["One", "Two", "Three"]);
    expect(res.body.degraded).toBe(true);
    expect(String(res.body.reason)).toContain("mismatch");
  });

  it("неразбираемый ответ модели — тоже 200, а не 500", async () => {
    callProvider.mockResolvedValue({ reply: "извините, я не могу это перевести" });

    const res = await request(await app())
      .post("/api/i18n/translate")
      .send({ target: "ru", texts: ["One", "Two"] });

    expect(res.status).toBe(200);
    expect(res.body.translations).toEqual(["One", "Two"]);
    expect(res.body.degraded).toBe(true);
  });

  it("неудачу НЕ кладут в кэш: следующий запрос пробует снова", async () => {
    const a = await app();
    callProvider.mockResolvedValueOnce({ reply: "не json" });
    const first = await request(a).post("/api/i18n/translate").send({ target: "ru", texts: ["One"] });
    expect(first.body.degraded).toBe(true);

    callProvider.mockResolvedValueOnce({ reply: JSON.stringify(["Один"]) });
    const second = await request(a).post("/api/i18n/translate").send({ target: "ru", texts: ["One"] });
    expect(second.body.translations).toEqual(["Один"]);
    expect(second.body.degraded).toBeUndefined();
    // Провайдера позвали ДВАЖДЫ — значит первый (неудачный) ответ не осел в кэше.
    expect(callProvider).toHaveBeenCalledTimes(2);
  });

  it("удачный перевод не помечается degraded и кэшируется", async () => {
    const a = await app();
    callProvider.mockResolvedValue({ reply: JSON.stringify(["Один"]) });

    const first = await request(a).post("/api/i18n/translate").send({ target: "ru", texts: ["One"] });
    expect(first.body.translations).toEqual(["Один"]);
    expect(first.body.degraded).toBeUndefined();

    const second = await request(a).post("/api/i18n/translate").send({ target: "ru", texts: ["One"] });
    expect(second.body.translations).toEqual(["Один"]);
    // Второй раз провайдера НЕ зовут — значит кэш работает и правка его не сломала.
    expect(callProvider).toHaveBeenCalledTimes(1);
  });

  it("плохой запрос по-прежнему 400, а не «мягкий» 200", async () => {
    const res = await request(await app()).post("/api/i18n/translate").send({});
    expect(res.status).toBe(400);
  });
});
