import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Сбор адресов не закрывается платным доступом.
 *
 * Замер на проде 19.08.2026:
 *
 *   POST /api/veilnetx/waitlist   -> 201, {"ok":true,...,"waitlistCount":11}
 *   POST /api/qfusionai/waitlist  -> 402, "Модуль доступен на тарифах: full, enterprise"
 *
 * Разница только в том, что qfusionai попал в PAYWALL_MODULES. Человеку,
 * который хочет ВСТАТЬ В ОЧЕРЕДЬ на ещё не существующий продукт, предлагали
 * купить тариф за $49.
 *
 * Горькая деталь: upgradeResponse() записывает каждый 402 как «сигнал спроса».
 * Спрос фиксировали, а адрес человека теряли — наоборот к тому, ради чего лист
 * ожидания и заведён.
 *
 * Тест закрывает и обратную сторону: открыв подписку на будущее, легко случайно
 * открыть выдачу продукта. Поэтому рядом проверка, что боевые ручки остались
 * за тарифом.
 */

const ORIG = process.env.PAYWALL_MODULES;

async function gate() {
  vi.resetModules();
  return await import("../src/lib/planGate");
}

/** Минимальный req: шлюз смотрит только method и path. */
const req = (path: string, method = "POST") => ({ path, method } as any);

describe("платный доступ не закрывает сбор адресов", () => {
  beforeEach(() => { process.env.PAYWALL_MODULES = "qfusionai"; });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.PAYWALL_MODULES;
    else process.env.PAYWALL_MODULES = ORIG;
  });

  test("контроль: шлюз вообще включается", async () => {
    // Без этого все проверки ниже проходили бы на выключенном шлюзе.
    const g = await gate();
    expect(g.paywallEnabledFor("qfusionai"), "шлюз не включился — проверять нечего").toBe(true);
    expect(g.paywallEnabledFor("cyberchess"), "шлюз включился там, где не просили").toBe(false);
  });

  for (const p of ["/waitlist", "/subscribe"]) {
    test(`${p} остаётся открытым на закрытом модуле`, async () => {
      const g = await gate();
      const exempt = (g as any).__testables?.isExemptPath ?? null;
      // Если внутренняя функция не вынесена наружу — проверяем через поведение
      // сборки: путь обязан быть перечислен в исходнике рядом с health.
      const src = await import("node:fs").then((fs) =>
        fs.readFileSync(new URL("../src/lib/planGate.ts", import.meta.url), "utf8"));
      if (exempt) expect(exempt(req(p))).toBe(true);
      else expect(src, `${p} не в списке открытых — человек не сможет оставить адрес`)
        .toContain(`p.endsWith("${p}")`);
    });
  }

  test("боевые ручки остались за тарифом", async () => {
    // Обратная сторона: открыв подписку на будущее, легко случайно открыть
    // выдачу продукта. Эти пути в списке открытых быть НЕ должны.
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../src/lib/planGate.ts", import.meta.url), "utf8"));
    for (const p of ["/fusions", "/chat", "/generate", "/render", "/export"]) {
      expect(src, `${p} попал в список открытых — продукт раздаётся бесплатно`)
        .not.toContain(`p.endsWith("${p}")`);
    }
  });

  test("контроль: список открытых не пуст и содержит служебные", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../src/lib/planGate.ts", import.meta.url), "utf8"));
    expect(src).toContain('p.endsWith("/health")');
    expect(src).toContain('p.endsWith("/status")');
  });
});
