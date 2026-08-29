import { describe, it, expect, afterEach } from "vitest";
import { sentryEnvironment } from "@/lib/sentry";

/**
 * Сторож: боевые ошибки не имеют права уезжать в Sentry помеченными
 * как тестовые.
 *
 * Раньше при незаданной `NEXT_PUBLIC_BANK_MODE` здесь молча вставало
 * "test". Направление ошибки самое дорогое: тревога не приходит, а тишина
 * неотличима от благополучия — отфильтрованные боевые ошибки выглядят
 * ровно как их отсутствие.
 *
 * Та же переменная с тем же дефолтом читается в TestModeBanner, и там
 * дефолт БЕЗОПАСЕН: показывает лишнее предупреждение. Одна переменная,
 * один дефолт, противоположные последствия — поэтому проверяем именно
 * это место отдельно.
 */
const БЫЛО = process.env.NEXT_PUBLIC_BANK_MODE;
afterEach(() => {
  if (БЫЛО === undefined) delete process.env.NEXT_PUBLIC_BANK_MODE;
  else process.env.NEXT_PUBLIC_BANK_MODE = БЫЛО;
});

describe("метка окружения Sentry честна", () => {
  it("боевой домен без переменной — production, а не test", () => {
    delete process.env.NEXT_PUBLIC_BANK_MODE;
    expect(sentryEnvironment("aevion.app")).toBe("production");
  });

  it("превью и localhost без переменной — test", () => {
    delete process.env.NEXT_PUBLIC_BANK_MODE;
    expect(sentryEnvironment("localhost")).toBe("test");
    expect(sentryEnvironment("aevion-git-feat-x.vercel.app")).toBe("test");
  });

  it("явно заданная переменная главнее домена", () => {
    process.env.NEXT_PUBLIC_BANK_MODE = "staging";
    expect(sentryEnvironment("aevion.app")).toBe("staging");
  });
});
