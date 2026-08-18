import { describe, test, expect } from "vitest";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Куда возвращается человек после оплаты — экран, который решает, поверил он
 * покупке или пошёл за возвратом. Замер 12.08.2026: `aevion.app/payment/success`
 * отдавал 404, а именно туда вёл основной провайдер подписок. Деньги
 * списывались, доступ выдавался, ломался только последний экран — поэтому
 * дефект ничем себя не выдавал.
 *
 * Проверяем ПОВЕДЕНИЕМ функции, а не грепом по исходнику: в самом файле
 * провайдера строка "/payment/success" осталась в комментарии, и поиск по
 * тексту покраснел бы на объяснении вместо кода.
 */

// eslint-disable-next-line import/first
import { successRedirectUrl } from "../src/lib/payment/lemonSqueezyProvider";

const APP_DIR = resolve(__dirname, "../../frontend/src/app");

/** Есть ли у пути реальная страница Next.js. */
function routeExists(pathname: string): boolean {
  const segments = pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  const dir = join(APP_DIR, ...segments);
  return existsSync(join(dir, "page.tsx")) || existsSync(join(dir, "page.ts"));
}

function pathOf(url: string): string {
  return new URL(url).pathname;
}

describe("возврат после оплаты ведёт на существующую страницу", () => {
  test("страница, на которую ведём, есть в приложении", () => {
    const url = successRedirectUrl("https://aevion.app", "intent-1", {
      reference: "tier_full_monthly",
      amountCents: 8900,
      currency: "USD",
      description: "AEVION Full",
      email: null,
    } as never);

    expect(routeExists(pathOf(url))).toBe(true);
  });

  test("несуществующий адрес /payment/success больше не используется", () => {
    const url = successRedirectUrl("https://aevion.app", "intent-2", {
      reference: "tier_lite_monthly",
      amountCents: 2400,
      currency: "USD",
      description: "AEVION Lite",
      email: null,
    } as never);

    expect(pathOf(url)).not.toBe("/payment/success");
    // Контроль: сама проверка умеет отличать живой путь от мёртвого —
    // иначе первый тест прошёл бы на чём угодно.
    expect(routeExists("/payment/success")).toBe(false);
    expect(routeExists("/pricing/checkout/success")).toBe(true);
  });

  test("страница получает тариф, период и сумму, а не голый intentId", () => {
    const url = new URL(
      successRedirectUrl("https://aevion.app", "intent-3", {
        reference: "tier_medium_annual",
        amountCents: 39000,
        currency: "USD",
        description: "AEVION Medium",
        email: null,
      } as never),
    );

    expect(url.searchParams.get("tier")).toBe("medium");
    expect(url.searchParams.get("period")).toBe("annual");
    expect(url.searchParams.get("total")).toBe("39000");
    expect(url.searchParams.get("provider")).toBe("lemonsqueezy");
  });

  test("покупка отдельного модуля тоже ведёт на живую страницу", () => {
    const url = successRedirectUrl("https://aevion.app", "intent-4", {
      reference: "app_devhub",
      amountCents: 14900,
      currency: "USD",
      description: "AEVION DevHub Studio Pro",
      email: null,
    } as never);

    expect(routeExists(pathOf(url))).toBe(true);
  });
});
