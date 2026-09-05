import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Строка о доступности оплаты честна в ОБЕ стороны.
 *
 * Замер 29.08.2026: воронка вела к стене оплаты молча — работают только
 * провайдеры со Stripe, карты РФ не проходят, и ни одна страница об этом не
 * говорила. Первая попытка чинить спрашивала состояние на СЕРВЕРЕ и не
 * сработала (там другой адрес API); откатил и переписал на клиент.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const NOTICE = join(HERE, "..", "PaymentReachNotice.tsx");
const SHOP = join(HERE, "..", "..", "app", "shop", "page.tsx");

describe("подпись о доступности оплаты", () => {
  const notice = readFileSync(NOTICE, "utf8");
  const shop = readFileSync(SHOP, "utf8");

  test("контроль: файлы прочитались", () => {
    expect(notice.length).toBeGreaterThan(500);
    expect(shop.length).toBeGreaterThan(1000);
  });

  test("состояние спрашивается из БРАУЗЕРА, а не на сервере", () => {
    // Серверный запрос уже пробовали — apiUrl там резолвится в внутренний
    // адрес, и подпись не появлялась вовсе.
    expect(notice).toContain('"use client"');
    expect(notice).toContain("useEffect");
    expect(notice).toContain("/api/pricing/checkout/healthz");
  });

  test("подпись показывается ТОЛЬКО при подтверждённом выключении", () => {
    // Не «не true», а именно false: при неизвестном состоянии молчим.
    expect(notice).toContain("kztReady !== false");
  });

  test("неизвестное не додумывается до выключенного", () => {
    expect(notice).toContain("useState<boolean | null>(null)");
  });

  test("магазин её действительно показывает", () => {
    // Компонент без потребителя — это код, который ничего не обещает.
    // Именно ОТРИСОВКА, а не импорт: мутация показала, что проверка на имя
    // проходила даже когда компонент убрали из разметки, оставив import.
    expect(shop).toContain("<PaymentReachNotice");
  });
});
