/**
 * Большая пачка в kk переводится целиком: пачки по 12 + один повтор «эха».
 *
 * ПОВОД (замер на проде 20.10.2026): /multichat-engine при kk шлёт 56 строк одной
 * пачкой; модель вернула без перевода больше половины латинских строк, хотя
 * пачкой в 5 переводит их все. Клиент запоминает эхо как готовый перевод —
 * 22 английские строки на казахской странице.
 *
 * Заглушка модели ведёт себя как на проде: на пачке больше 12 строк отвечает
 * эхом; на малой — переводит; строку «Debate» с первого раза возвращает эхом.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

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

let debateSeen = 0;
function модельКакНаПроде(_p: unknown, messages: Array<{ role: string; content: string }>) {
  const texts: string[] = JSON.parse(messages[messages.length - 1].content);
  if (texts.length > 12) return Promise.resolve({ reply: JSON.stringify(texts) }); // эхо на большой пачке
  return Promise.resolve({
    reply: JSON.stringify(texts.map((t) => {
      if (t === "Debate" && debateSeen++ === 0) return t; // одна строка — эхом с первого раза
      if (t === "AEVION") return t;                         // бренд остаётся
      return `kk:${t}`;
    })),
  });
}

const СТРОКИ = Array.from({ length: 40 }, (_, i) => `Feature number ${i}`).concat(["Debate", "AEVION", "Уже по-русски"]);

describe("kk: большая пачка", () => {
  beforeEach(() => {
    vi.resetModules();
    callProvider.mockReset();
    debateSeen = 0;
    process.env.ANTHROPIC_API_KEY = "test-key";
    delete process.env.DEEPL_API_KEY;
  });

  it("43 строки: всё латинское переведено, бренд остался, ни одна пачка не больше 12", async () => {
    callProvider.mockImplementation(модельКакНаПроде);
    const res = await request(await app()).post("/api/i18n/translate").send({ target: "kk", texts: СТРОКИ });
    expect(res.status).toBe(200);
    const t: string[] = res.body.translations;
    const непереведено = СТРОКИ.filter((s, i) => /^[A-Za-z ]+\d*$/.test(s) && s !== "AEVION" && t[i] === s);
    expect(непереведено, "латинские строки вернулись без перевода").toEqual([]);
    expect(t[СТРОКИ.indexOf("Debate")]).toBe("kk:Debate");
    expect(t[СТРОКИ.indexOf("AEVION")]).toBe("AEVION");
    const размеры = callProvider.mock.calls.map((c) => JSON.parse((c[1] as any[]).at(-1).content).length);
    expect(Math.max(...размеры)).toBeLessThanOrEqual(12);
  });

  it("латинская цель (de): эхо не переспрашивается — там оно бывает верным", async () => {
    callProvider.mockImplementation(async (_p: unknown, m: Array<{ content: string }>) => ({ reply: m.at(-1)!.content }));
    const res = await request(await app()).post("/api/i18n/translate").send({ target: "de", texts: ["Editor", "Status"] });
    expect(res.status).toBe(200);
    expect(callProvider).toHaveBeenCalledTimes(1);
  });
});
