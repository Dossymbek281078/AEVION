import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Ответ, РАВНЫЙ исходнику, не кладётся в кэш.
 *
 * ЗАМЕР 28.07.2026: 39 подписей модулей на главной возвращались
 * непереведёнными каждому немецкому гостю, а те же строки, посланные
 * заново, переводились верно. Кэш запомнил ответ-тождество — и держал его
 * весь срок выкатки, то есть один неудачный момент отравлял выдачу всем.
 *
 * Свойство отдельное от degraded: модель может ОТВЕТИТЬ формально успешно
 * (массив нужной длины, degraded=false), но вернуть исходные строки. Тогда
 * первая проверка молчит, а кэш всё равно нельзя трогать.
 *
 * 08.09.2026 при слиянии двух веток эта половина условия чуть не потерялась:
 * мутация «убрать shouldCache» на тот момент НЕ ловилась ничем — сторожа не
 * было. Он и написан, чтобы следующее слияние не сняло починку молча.
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

describe("кэш переводов не запоминает ответ-тождество", () => {
  beforeEach(() => {
    vi.resetModules();
    callProvider.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
    delete process.env.DEEPL_API_KEY;
  });

  it("строка, вернувшаяся собой, спрашивается ЗАНОВО, а не берётся из кэша", async () => {
    const a = await app();

    // Модель формально успешна: длина совпала, degraded не выставлен —
    // но перевода нет, строка вернулась собой.
    callProvider.mockResolvedValueOnce({ reply: JSON.stringify(["Modules"]) });
    const first = await request(a).post("/api/i18n/translate").send({ target: "de", texts: ["Modules"] });
    expect(first.status).toBe(200);
    expect(first.body.degraded).not.toBe(true);
    expect(callProvider).toHaveBeenCalledTimes(1);

    // Второй заход: если тождество попало в кэш, провайдера НЕ позовут и
    // немецкий гость навсегда останется с английской подписью.
    callProvider.mockResolvedValueOnce({ reply: JSON.stringify(["Module"]) });
    const second = await request(a).post("/api/i18n/translate").send({ target: "de", texts: ["Modules"] });
    expect(second.status).toBe(200);
    expect(
      callProvider,
      "ответ-тождество осел в кэше: перевод больше не будет запрошен (замер 28.07.2026)",
    ).toHaveBeenCalledTimes(2);
    expect(second.body.translations).toEqual(["Module"]);
  });

  it("контроль прибора: НАСТОЯЩИЙ перевод кэшируется и провайдера не беспокоит", async () => {
    const a = await app();

    callProvider.mockResolvedValueOnce({ reply: JSON.stringify(["Module"]) });
    const first = await request(a).post("/api/i18n/translate").send({ target: "de", texts: ["Modules"] });
    expect(first.body.translations).toEqual(["Module"]);
    expect(callProvider).toHaveBeenCalledTimes(1);

    const second = await request(a).post("/api/i18n/translate").send({ target: "de", texts: ["Modules"] });
    expect(second.body.translations).toEqual(["Module"]);
    expect(
      callProvider,
      "кэш перестал работать вовсе — это не бережливость, а лишние деньги на каждый заход",
    ).toHaveBeenCalledTimes(1);
  });
});
