import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Панель возможностей не объявляет настроенным то, что наша же проверка
 * провайдеров опровергает.
 *
 * Замер на проде 28.08.2026 — сравнение ДВУХ НАШИХ ответов об одном и том же:
 *
 *   /studio/capabilities   domain (aevion.build)  →  "live"
 *   /providers/health      cloudflare_zone        →  ok=false, "zone status: unknown"
 *
 * Панель судила по наличию трёх переменных окружения, а настоящая проверка в
 * этом же файле спрашивает Cloudflare и требует status === "active". Человек
 * читал «Настроено: 14 из 16», и домен был среди настроенных.
 *
 * Наличие ключа — не то же самое, что делегированная зона.
 */

const SRC = fs.readFileSync(
  path.resolve(__dirname, "..", "src", "routes", "devhub.ts"),
  "utf8",
);

function capabilityLine(id: string): string {
  const i = SRC.indexOf(`id: "${id}"`);
  expect(i, `возможность ${id} не найдена — сторож смотрит не туда`).toBeGreaterThan(0);
  const start = SRC.lastIndexOf("{", i);
  const end = SRC.indexOf("\n", i);
  return SRC.slice(start, end);
}

describe("статус возможности не спорит с пробой", () => {
  test("прибор исправен: строки возможностей читаются", () => {
    // Иначе проверки ниже были бы зелёными на пустой строке.
    expect(capabilityLine("domain").length).toBeGreaterThan(40);
    expect(capabilityLine("railway").length).toBeGreaterThan(40);
  });

  test("домен не объявляется настроенным по наличию ключей", () => {
    const line = capabilityLine("domain");
    // Прежнее условие судило по трём переменным Cloudflare. Оно и расходилось
    // с пробой: ключи есть, зона не делегирована.
    expect(
      line.includes("CLOUDFLARE_API_TOKEN &&"),
      "статус домена снова выводится из наличия ключей",
    ).toBe(false);
    expect(line).toContain("not_available");
  });

  test("возвращает возможность отдельный осознанный флаг", () => {
    // Не «ключ появился», а «человек проверил зону и включил». Тот же приём,
    // что у Railway: DEVHUB_RAILWAY_PER_PROJECT.
    expect(capabilityLine("domain")).toContain("DEVHUB_AEVION_BUILD_ZONE_ACTIVE");
  });

  test("проверка провайдера по-прежнему требует активной зоны", () => {
    // Если ослабить её до «ответ получен», расхождение исчезнет ложным путём:
    // обе стороны будут говорить «хорошо» при недоступной зоне.
    expect(SRC).toContain('ok: status === "active"');
  });
});
