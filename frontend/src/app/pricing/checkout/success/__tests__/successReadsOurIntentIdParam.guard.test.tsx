/**
 * Сторож: страница после оплаты читает номер платежа под тем именем, под
 * которым его кладёт НАШ ЖЕ бэкенд.
 *
 * ЧТО НАШЛОСЬ (замер прода 12.10.2026 живым браузером, окно user-d7).
 * buildSuccessUrl — один сборщик адреса возврата на всех провайдеров — кладёт
 * `intentId`. Страница читала `session_id` и `sale_id`, а `intentId` не
 * читала вовсе (контроль прибора: поиск `get("session_id")` находит, код 0;
 * поиск `get("intentId")` не находит, код 1). Два захода на прод подряд,
 * разница ровно в имени параметра:
 *
 *   intentId=…   → h1 «Проверяем, была ли оплата», и ниже «В адресе нет
 *                  номера платежа… Если оплата не прошла, деньги не списаны»;
 *   session_id=… → h1 «Оплата принята — проверяем доступ», «Деньги получены».
 *
 * Первое читает человек, у которого деньги УЖЕ списаны. Выдача при этом
 * проходит — ручка статуса ищет ровно по этому номеру (bureauIntentId), её
 * просто не спрашивали.
 *
 * ПОЧЕМУ ЭТОГО НЕ ВИДЕЛИ 11 прежних сторожей экрана: все они задают адрес
 * сами, своей строкой, и ни один не брал адрес у той половины, которая его
 * СОБИРАЕТ. Поэтому ниже есть тест, связывающий две половины по имени
 * параметра, а не по моей памяти о нём.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { I18nProvider } from "@/lib/i18n";
import en from "@/lib/i18n-lang/en";

const параметры = { value: "" };
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(параметры.value),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/pricing/checkout/success",
}));

const ОЖИДАНИЕ = en["pricing.checkoutSuccess.titlePending"] ?? "";
const НЕТ_ПЛАТЕЖА = en["pricing.checkoutSuccess.titleNoPayment"] ?? "";

/** Адрес ровно той формы, которую собирает наш бэкенд для Lemon Squeezy. */
const АДРЕС_ОТ_БЭКЕНДА =
  "provider=lemonsqueezy&intentId=probe-user-d7-0c3f&ref=tier_pro_monthly&tier=pro&period=monthly&total=20000";

function ответ(тело: unknown) {
  return { ok: true, status: 200, json: async () => тело };
}

async function открыть(поиск: string) {
  параметры.value = поиск;
  const m = await import("@/app/pricing/checkout/success/page");
  const Страница = m.default as () => import("react").JSX.Element;
  await act(async () => {
    render(
      <I18nProvider>
        <Страница />
      </I18nProvider>,
    );
  });
}

const текст = () => document.body.textContent ?? "";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("экран после оплаты читает НАШ номер платежа", () => {
  it("КОНТРОЛЬ: подписи существуют и различны", () => {
    expect(ОЖИДАНИЕ.length, "подпись ожидания пропала из словаря").toBeGreaterThan(5);
    expect(НЕТ_ПЛАТЕЖА.length, "подпись «нет платежа» пропала из словаря").toBeGreaterThan(5);
    expect(ОЖИДАНИЕ === НЕТ_ПЛАТЕЖА, "подписи совпали — различить состояния нечем").toBe(false);
  });

  it("имя параметра у ДВУХ ПОЛОВИН совпадает (бэкенд кладёт — фронт читает)", () => {
    const сборщик = join(
      __dirname, "..", "..", "..", "..", "..", "..", "..",
      "aevion-globus-backend", "src", "lib", "payment", "successUrl.ts",
    );
    let исходникБэкенда: string;
    try {
      исходникБэкенда = readFileSync(сборщик, "utf8");
    } catch {
      // Честно падаем, а не пропускаем: сторож без второй половины
      // проверяет замысел, а не работу.
      throw new Error(`не прочитан сборщик адреса возврата: ${сборщик}`);
    }
    const имена = [...исходникБэкенда.matchAll(/q\.set\("([a-zA-Z_]+)"/g)].map((m) => m[1]);
    expect(имена.length, "в сборщике не найдено ни одного параметра — проверка пуста").toBeGreaterThan(3);
    expect(имена, "сборщик перестал класть intentId — сторож надо переписать под новое имя").toContain("intentId");

    const страница = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
    expect(
      страница.includes('sp.get("intentId")'),
      "бэкенд кладёт intentId, а страница его не читает — покупателю скажут «в адресе нет номера платежа»",
    ).toBe(true);
  });

  it("адрес от нашего бэкенда: платёж признан, а не отвергнут", async () => {
    const спрошено: string[] = [];
    vi.stubGlobal("fetch", (u: string) => {
      спрошено.push(String(u));
      return String(u).includes("/api/me/entitlements")
        ? Promise.resolve(ответ({ plan: "free", email: null }))
        : Promise.resolve(ответ({ ready: false }));
    });
    await открыть(АДРЕС_ОТ_БЭКЕНДА);

    expect(
      текст(),
      "покупателю сказано «в адресе нет номера платежа» — а номер в адресе есть",
    ).not.toContain(НЕТ_ПЛАТЕЖА);
    expect(текст(), "не сказано даже, что деньги получены").toContain(ОЖИДАНИЕ);
    expect(
      спрошено.some((u) => u.includes("/api/pricing/checkout/status") && u.includes("probe-user-d7-0c3f")),
      "ручка статуса не спрошена с нашим номером платежа",
    ).toBe(true);
  }, 60000);

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: голый заход без номера — платёж НЕ придумываем", async () => {
    vi.stubGlobal("fetch", (u: string) =>
      String(u).includes("/api/me/entitlements")
        ? Promise.resolve(ответ({ plan: "free", email: null }))
        : Promise.resolve(ответ({ ready: false })),
    );
    await открыть("");
    expect(
      текст(),
      "на голом заходе страница перестала говорить, что номера платежа нет",
    ).toContain(НЕТ_ПЛАТЕЖА);
    expect(текст(), "голый заход выдан за принятую оплату").not.toContain(ОЖИДАНИЕ);
  }, 60000);
});
