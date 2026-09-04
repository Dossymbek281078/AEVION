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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chargeCurrencyNoteKey } from "@/lib/chargeCurrencyNote";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
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
    /*
     * 04.09: раньше здесь проверялось, что на экране ВИДНО сообщение движка
     * («неполный ответ: нет tiers…»). Это противоречило второму правилу — не
     * показывать человеку нашу диагностику, — и я его же сегодня чинил на
     * соседних экранах.
     *
     * Мирит их журнал: человеку фраза из словаря, причина в консоль. Поэтому
     * проверяем ЧЕСТНОСТЬ, а не текст ошибки: экран не делает вид, что всё в
     * порядке, и не показывает внутренностей.
     */
    expect(текст, "внутренности уехали на экран").not.toContain("/api/");
    expect(текст, "внутренности уехали на экран").not.toContain("неполный ответ");
    expect(
      текст.length > 40,
      "экран пуст: человек не понял, что произошло",
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

    /*
     * НЕПУСТАЯ ПОДПИСЬ — ЕЩЁ НЕ ВЕРНАЯ. До сегодня проверка кончалась строкой
     * выше, и её удовлетворял ЛЮБОЙ текст — включая обещание списать в тенге
     * при неработающей тенге-кассе. Это ровно тот случай, когда ждёшь наличия
     * вместо признака нужного.
     *
     * Сверяем экран с РЕШЕНИЕМ селектора, а не с формулировкой: текст подписи
     * менять можно свободно, нельзя — показать не ту подпись.
     */
    const словарь = readFileSync(join(process.cwd(), "src/lib/i18n-data.ts"), "utf8");
    const значение = (ключ: string): string => {
      const метка = '"' + ключ + '": "';
      const от = словарь.indexOf(метка);
      expect(от, `ключ ${ключ} не найден в словаре`).toBeGreaterThan(-1);
      const начало = от + метка.length;
      return словарь.slice(начало, словарь.indexOf('"', начало));
    };
    const текстПодписи = () =>
      document.querySelector('[data-testid="charge-currency-note"]')?.textContent ?? "";

    expect(текстПодписи(), "в долларах показана не та подпись").toContain(
      значение(chargeCurrencyNoteKey("USD", false)),
    );

    /*
     * А теперь ветка, живая на проде СЕГОДНЯ. Замер 03.09.2026: PayBox не
     * настроен — `configured: false` и у переменных сервиса, и у нашей ручки
     * состояния каналов. Значит выбравший тенге спишется в долларах, и экран
     * обязан сказать это заранее.
     *
     * Валюту переключаем по-настоящему, через тот же select, что и человек:
     * подделка состояния проверяла бы подделку.
     */
    const выбор = document.querySelector("select") as HTMLSelectElement | null;
    expect(выбор, "переключателя валюты нет на экране").not.toBeNull();
    await act(async () => {
      fireEvent.change(выбор as HTMLSelectElement, { target: { value: "KZT" } });
    });

    const ожидаемый = chargeCurrencyNoteKey("KZT", false);
    const обещаниеТенге = chargeCurrencyNoteKey("KZT", true);
    expect(ожидаемый, "селектор перестал различать эти два случая").not.toBe(обещаниеТенге);

    expect(текстПодписи(), "на экране не та подпись, которую выбрал селектор").toContain(
      значение(ожидаемый),
    );
    expect(текстПодписи(), "экран обещает списание в тенге при неработающей кассе").not.toContain(
      значение(обещаниеТенге),
    );
  }, 120000);
});
