import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import ChainReceiptPage from "../page";

/**
 * Результат проверки ОБЪЯВЛЯЕТСЯ, а не появляется молча.
 *
 * Находка соседнего окна 04.09.2026 и её уточнение: на эту страницу приходят
 * ТОЛЬКО полной загрузкой — ссылок на неё из интерфейса ноль (замер с
 * контролем: на /qsign ссылок 11, значит поиск работал). Объявитель смены
 * комнаты здесь молчит намеренно: первую страницу браузер и читалка называют
 * сами, повтор звучал бы заиканием.
 *
 * Значит живая область на этой странице — ЕДИНСТВЕННЫЙ способ сообщить исход,
 * а не один из двух. Поэтому она проверяется отдельно.
 *
 * Проверяем ДВА состояния, потому что между ними и живёт дефект: пока идут
 * запросы, список пуст, и пустой экран читается как «чека нет».
 */

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("steps=a1,b2"),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/chain",
}));

const исходныйFetch = globalThis.fetch;

function отложенныйОтвет(zaderzhka: number, telo: unknown) {
  return () =>
    new Promise((resolve) =>
      setTimeout(
        () => resolve({ ok: true, status: 200, json: async () => telo } as Response),
        zaderzhka,
      ),
    );
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  globalThis.fetch = исходныйFetch;
  vi.restoreAllMocks();
});

describe("чек цепочки объявляет исход", () => {
  it("пока идёт проверка — говорит, что проверяет", () => {
    // Ответ намеренно не приходит: ловим ПЕРВОЕ состояние.
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(
      <I18nProvider>
        <ChainReceiptPage />
      </I18nProvider>,
    );
    // Живых областей на странице ДВЕ: врезка о предварительном режиме и
    // итог проверки. Это не дефект — они про разное, — но выбирать нужную
    // приходится по содержимому, а не по роли.
    const области = screen.getAllByRole("status").map((э) => э.textContent ?? "");
    expect(
      области.some((т) => т.trim() !== ""),
      "молчит, пока идёт проверка — пустой экран читается как «чека нет»",
    ).toBe(true);
  });

  it("когда пришло — называет ЧИСЛА, а не просто «готово»", async () => {
    globalThis.fetch = vi.fn(
      otvet({ valid: true, revoked: false, payloadHash: "h", createdAt: null, dilithium: { mode: "preview" } }),
    ) as unknown as typeof fetch;
    render(
      <I18nProvider>
        <ChainReceiptPage />
      </I18nProvider>,
    );
    await waitFor(() => {
      const t = screen.getAllByRole("status").map((э) => э.textContent ?? "").join(" ");
      // Два шага в адресе — итог обязан их назвать. Без числа объявление
      // «проверено» не говорит человеку ничего проверяемого.
      expect(t, "итог не называет число шагов").toMatch(/2/);
    });
  });
});

function otvet(telo: unknown) {
  return отложенныйОтвет(0, telo);
}
