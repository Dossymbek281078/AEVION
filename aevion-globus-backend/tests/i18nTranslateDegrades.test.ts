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

  /*
   * Ручка состояния обязана ПРИЗНАВАТЬСЯ, что перевода нет.
   *
   * Замер 07.10.2026: `status` был зашит в "ok" константой. Ручка отвечала
   * «всё хорошо» и при engine: "none" (ни одного ключа — перевод невозможен),
   * и во время передышки по исчерпанной квоте DeepL. Снаружи «доступно»
   * читалось как «пригодно»: единственный потребитель `AutoTranslate` поля
   * `degraded` не читал вовсе, и у отказа не оставалось ни одного читателя.
   */
  it("состояние: без ключей — down, перевод невозможен", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.DEEPL_API_KEY;

    const res = await request(await app()).get("/api/i18n/health");

    expect(res.status).toBe(200);
    expect(res.body.status, "без единого ключа ручка обязана признать down").toBe("down");
    expect(res.body.translationPossible).toBe(false);
    expect(res.body.engine).toBe("none");
  });

  it("состояние: ключ есть — ok, и поле передышки присутствует", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    delete process.env.DEEPL_API_KEY;

    const res = await request(await app()).get("/api/i18n/health");

    expect(res.body.status).toBe("ok");
    expect(res.body.translationPossible).toBe(true);
    // Поле обязано СУЩЕСТВОВАТЬ даже когда передышки нет: иначе читатель
    // снаружи не отличит «нет передышки» от «ручка о ней не знает».
    expect(res.body, "нет поля deeplQuotaCooldown — читателю нечего спросить")
      .toHaveProperty("deeplQuotaCooldown");
    expect(res.body.deeplQuotaCooldown).toBe(false);
  });

  it("состояние: DeepL в передышке по квоте, запасного нет — degraded", async () => {
    process.env.DEEPL_API_KEY = "test-key";
    delete process.env.ANTHROPIC_API_KEY;

    const a = await app();
    // Загоняем DeepL в передышку ТЕМ ЖЕ путём, что и прод: отказ по квоте.
    const прежний = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("Quota exceeded", { status: 456 })) as typeof fetch;
    try {
      await request(a).post("/api/i18n/translate").send({ target: "de", texts: ["One"] });
    } finally {
      globalThis.fetch = прежний;
    }

    const res = await request(a).get("/api/i18n/health");
    expect(res.body.deeplQuotaCooldown, "передышка не отражена в ручке состояния").toBe(true);
    expect(res.body.status, "в передышке без запасного ручка обязана признать down/degraded")
      .not.toBe("ok");
    expect(Number(res.body.quotaCooldownSecondsLeft)).toBeGreaterThan(0);
  });
});
