import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Класс: процессинг возвращает заплатившего человека на маршрут, которого во
 * фронтенде нет.
 *
 * 28.07.2026 замер curl'ом: https://aevion.app/payment/success → **404**.
 * LemonSqueezy — основной живой процессинг подписок — задаёт
 * `redirect_url: ${base}/payment/success?intentId=...`
 * (`lib/payment/lemonSqueezyProvider.ts`), а такой страницы не существовало.
 * Последним, что видел заплативший, была страница «не найдено». PayBox при
 * этом возвращал на живой `/pricing/checkout/success`, поэтому глазами дыра
 * не замечалась: один провайдер работал, другой нет.
 *
 * Сторож берёт адреса ИЗ КОДА провайдеров, а не из списка в тесте: список
 * отстанет ровно тогда, когда кто-то добавит пятый процессинг.
 */

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAYMENT_LIB = join(APP_DIR, "..", "..", "..", "aevion-globus-backend", "src", "lib", "payment");

/** `${base}/что-то` внутри строкового шаблона — это адрес возврата. */
const REDIRECT = /\$\{base\}(\/[A-Za-z0-9\-_/[\]]+)/g;

function collectRedirectPaths(): string[] {
  if (!existsSync(PAYMENT_LIB)) return [];
  const paths = new Set<string>();
  for (const f of readdirSync(PAYMENT_LIB)) {
    if (!f.endsWith(".ts")) continue;
    const src = readFileSync(join(PAYMENT_LIB, f), "utf8");
    for (const m of src.matchAll(REDIRECT)) {
      // `/api/...` — ручки бэкенда (вебхуки процессингов), а не страницы
      // App Router. Возврат человека туда не ведёт.
      if (m[1].startsWith("/api/")) continue;
      paths.add(m[1]);
    }
  }
  return [...paths];
}

/** Есть ли под этим адресом страница в App Router. */
function routeExists(route: string): boolean {
  const segments = route.split("/").filter(Boolean);
  let dir = APP_DIR;
  for (const seg of segments) {
    const direct = join(dir, seg);
    if (existsSync(direct)) {
      dir = direct;
      continue;
    }
    // Динамический сегмент: [id] или [...slug] на этом уровне.
    const dynamic = readdirSync(dir).find((e) => e.startsWith("[") && e.endsWith("]"));
    if (!dynamic) return false;
    dir = join(dir, dynamic);
  }
  return existsSync(join(dir, "page.tsx"));
}

const REDIRECT_PATHS = collectRedirectPaths();
const MISSING = REDIRECT_PATHS.filter((p) => !routeExists(p));

describe("процессинг возвращает покупателя на существующую страницу", () => {
  it("адреса возврата вообще найдены в коде провайдеров", () => {
    // Иначе тест ниже зелёный просто потому, что список пуст.
    expect(REDIRECT_PATHS.length).toBeGreaterThan(0);
  });

  it("каждый адрес возврата отвечает страницей, а не 404", () => {
    expect(MISSING).toEqual([]);
  });

  it("проверка маршрутов умеет говорить «нет» (негативный тест)", () => {
    expect(routeExists("/pricing")).toBe(true);
    expect(routeExists("/payment/success")).toBe(true);
    // Одиночный несуществующий сегмент проверять бесполезно: его законно
    // ловит динамический маршрут `[id]` — витрина модуля. Поэтому берём путь
    // глубже, где перехватить некому.
    expect(routeExists("/payment/success/такого-шага-нет")).toBe(false);
  });
});
