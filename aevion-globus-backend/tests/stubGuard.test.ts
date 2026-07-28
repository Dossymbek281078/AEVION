import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stubsAllowed } from "../src/lib/stubGuard";

/**
 * Класс: dev-заглушка отвечает на проде, потому что выключена «отсутствием
 * конфига», а не признаком среды — fail-open.
 *
 * 28.07.2026 таких было три: `qpaynet /deposit/confirm-stub` (зачисляет
 * депозит, не получив денег), `bureau /kyc-stub/:sessionId` (имитирует
 * пройденный KYC), `bank /test-webhook/*` (проверки среды не было вовсе).
 * Единственной реальной защитой был вход в аккаунт, а регистрация открытая.
 * Тот же класс 26.07 раздавал тариф Universe ($249.99/мес) бесплатно.
 *
 * Сторож ищет заглушки по ИМЕНИ МАРШРУТА во всех роутерах, а не по списку
 * файлов: список отстанет ровно тогда, когда появится четвёртая.
 */

const ROUTES_DIR = join(__dirname, "..", "src", "routes");

/** Путь маршрута, который по названию является заглушкой. */
const STUB_ROUTE = /Router\.(?:post|get|put|delete)\(\s*"([^"]*(?:stub|simulate|test-webhook)[^"]*)"/gi;

function collectStubHandlers(): { file: string; route: string; guarded: boolean }[] {
  const out: { file: string; route: string; guarded: boolean }[] = [];
  for (const f of readdirSync(ROUTES_DIR)) {
    if (!f.endsWith(".ts")) continue;
    const src = readFileSync(join(ROUTES_DIR, f), "utf8");
    for (const m of src.matchAll(STUB_ROUTE)) {
      // Гейт обязан стоять в первых строках обработчика: если он ниже проверки
      // токена или провайдера, по коду ответа уже видно, что заглушка жива.
      const head = src.slice(m.index ?? 0, (m.index ?? 0) + 400);
      out.push({ file: f, route: m[1], guarded: head.includes("stubBlocked(res)") });
    }
  }
  return out;
}

const HANDLERS = collectStubHandlers();

describe("dev-заглушки не отвечают в продакшене", () => {
  it("заглушки вообще найдены (иначе проверка ниже пуста)", () => {
    expect(HANDLERS.length).toBeGreaterThan(0);
  });

  it("у каждой заглушки стоит общий гейт", () => {
    const unguarded = HANDLERS.filter((h) => !h.guarded).map((h) => `${h.file}: ${h.route}`);
    expect(unguarded).toEqual([]);
  });

  it("гейт закрыт в продакшене и открывается только явным флагом", () => {
    const env = process.env.NODE_ENV;
    const flag = process.env.AEVION_ALLOW_STUBS;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.AEVION_ALLOW_STUBS;
      expect(stubsAllowed()).toBe(false);

      process.env.AEVION_ALLOW_STUBS = "1";
      expect(stubsAllowed()).toBe(true);

      delete process.env.AEVION_ALLOW_STUBS;
      process.env.NODE_ENV = "test";
      expect(stubsAllowed()).toBe(true);
    } finally {
      process.env.NODE_ENV = env;
      if (flag === undefined) delete process.env.AEVION_ALLOW_STUBS;
      else process.env.AEVION_ALLOW_STUBS = flag;
    }
  });
});
