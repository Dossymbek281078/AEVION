/**
 * Подпись о валюте списания ДОХОДИТ ДО ЭКРАНА.
 *
 * Решение о ней я вынес в чистую функцию (`chargeCurrencyNoteKey`) именно
 * потому, что считал страницу тарифов неотрисовываемой в стенде. Функция с тех
 * пор проверена, а вопрос «а показывает ли её страница» оставался открытым —
 * ровно класс «правда обрывается на границе»: решение верное, читателя нет.
 *
 * Замер 02.09: модуль страницы импортируется за 3 секунды, отрисовка проходит.
 * То есть обходной путь был нужен, а отказ от отрисовки — нет.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/pricing",
}));

/** Сервер отвечает так, будто касса в тенге НЕ настроена — как на проде 02.09. */
function ответыСервера() {
  vi.stubGlobal("fetch", async (u: string) => {
    const адрес = String(u);
    // Стенд разбирает адрес: страница тянет ТРИ источника, и подсунуть всем
    // один ответ нельзя — цепочки вроде `trust.numbers.length` не защищены и
    // падают, а не деградируют.
    if (адрес.includes("checkout/healthz")) {
      const h = { ok: true, providers: { paybox: { configured: false }, lemonsqueezy: { configured: true } } };
      return { ok: true, status: 200, json: async () => h } as unknown as Response;
    }
    if (адрес.includes("/pricing/trust")) {
      // Страница читает trust.numbers и trust.badges — оба без защиты после
      // проверки самого trust. Прод шлёт ровно эти два ключа.
      const t = { numbers: [], badges: [] };
      return { ok: true, status: 200, json: async () => t } as unknown as Response;
    }
    const тело = false
      ? {}
      : {
          // Страница читает currencies[валюта].symbol/rate напрямую, без
          // защиты от отсутствия ключа — значит стенду нужен реальный набор.
          currencies: {
            USD: { symbol: "$", rate: 1 },
            KZT: { symbol: "₸", rate: 470 },
            EUR: { symbol: "€", rate: 0.92 },
          },
          // Пять полей, которые страница читает БЕЗ защиты (замер 02.09:
          // девять обращений к пяти полям). Все пять прод шлёт, поэтому
          // живого дефекта нет — но стенду они нужны все, иначе отрисовка
          // падает, а не деградирует.
          tiers: [],
          modules: [],
          bundles: [],
          notes: [],
          items: [],
          runs: [],
        };
    return { ok: true, status: 200, json: async () => тело } as unknown as Response;
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("неполный ответ сервера", () => {
  it("ведёт в честную ошибку, а не в падение и не в пустую таблицу", async () => {
    /*
     * Половины платформы выкатываются раздельно. При разъезде версий сервер
     * может прислать ответ без части полей — и страница читает пять из них БЕЗ
     * защиты, то есть падала бы целиком.
     *
     * Подставлять пустые значения нельзя: пустая таблица тарифов читается как
     * «покупать нечего». Поэтому проверяем именно ошибку — её человек увидит и
     * обновит страницу.
     */
    vi.stubGlobal("fetch", async (u: string) => {
      const адрес = String(u);
      const тело = адрес.includes("checkout/healthz")
        ? { ok: true, providers: { paybox: { configured: false } } }
        : адрес.includes("/pricing/trust")
          ? { numbers: [], badges: [] }
          : { currencies: { USD: { symbol: "$", rate: 1 } }, tiers: [] }; // нет modules, bundles, notes
      return { ok: true, status: 200, json: async () => тело } as unknown as Response;
    });
    const m = await import("@/app/pricing/page");
    const Страница = m.default as () => JSX.Element;
    await act(async () => {
      render(
        <I18nProvider>
          <Страница />
        </I18nProvider>,
      );
    });
    const текст = document.body.textContent ?? "";
    expect(текст, "страница не отрисовалась вовсе").not.toBe("");
    expect(
      текст.includes("неполный ответ") || текст.toLowerCase().includes("error") || текст.includes("Ошибка"),
      "неполный ответ прошёл молча — человек увидит пустоту вместо цен",
    ).toBe(true);
  }, 120000);
});

describe("подпись о валюте на экране", () => {
  it("страница тарифов отрисовывается и несёт подпись о списании", async () => {
    ответыСервера();
    const m = await import("@/app/pricing/page");
    const Страница = m.default as () => JSX.Element;
    await act(async () => {
      render(
        <I18nProvider>
          <Страница />
        </I18nProvider>,
      );
    });
    const подпись = document.querySelector('[data-testid="charge-currency-note"]');
    expect(подпись, "подписи о валюте нет на экране").not.toBeNull();
    expect(подпись?.textContent?.trim().length ?? 0, "подпись пустая").toBeGreaterThan(0);
  }, 120000);
});
