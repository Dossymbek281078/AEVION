import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * ОТКАЗ ПЛАТНОЙ СТЕНЫ ПОКАЗЫВАЕТ ЧЕЛОВЕКУ, КУДА ИДТИ ПЛАТИТЬ.
 *
 * Рядом живёт сторож paywallDenialIsActionable — он читает ИСХОДНИК и
 * убеждается, что в файле есть `j?.message` и `upgradeUrl`. Такой признак
 * ошибается в обе стороны: он совпадёт с упоминанием в комментарии и
 * пройдёт на странице, где ссылка стоит под условием, которое никогда не
 * выполняется. Здесь страница ОТРИСОВЫВАЕТСЯ и нажимается кнопка.
 *
 * ГРАНИЦА: покрыт экран одиночного анализа. У пакетного (qventure/batch)
 * ссылка та же, но путь к отказу начинается с загрузки файла, и довести
 * его до 402 в тесте заметно дороже. Пока пакетный экран стережёт только
 * текстовый сторож — то есть слабее. Пишу это здесь, чтобы читатель не
 * решил, что отрисовкой покрыты обе страницы.
 *
 * Почему это денежный путь: 402 приходит ровно в тот момент, когда человек
 * готов заплатить. Отказ без ссылки — тупик в самом дорогом месте.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/qventure",
}));
vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));
// Общие компоненты подменяются пустышками: они ходят в сеть и требуют
// роутер, а предмет проверки — отказ стены, а не они. Оставь их живыми —
// и падение соседнего компонента читалось бы как «ссылки на оплату нет».
vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@/components/ProductPageShell", () => ({
  ProductPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ModulePricingChip", () => ({ default: () => null }));

import QVenturePage from "../page";

const OTKAZ = {
  error: "upgrade_required",
  message: "QVenture входит в тариф Pro. Оформите подписку, чтобы запускать анализ.",
  upgradeUrl: "/pricing?module=qventure",
};

function podmenitFetch(otvetAnaliza: { status: number; body: unknown }) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/qventure/sectors")) {
      return new Response(JSON.stringify({ sectors: [] }), { status: 200 });
    }
    if (url.includes("/api/qventure/analyze")) {
      return new Response(JSON.stringify(otvetAnaliza.body), { status: otvetAnaliza.status });
    }
    return new Response("{}", { status: 200 });
  });
}

// Обработчик СНАЧАЛА проверяет форму: без названия и описания (от 12
// символов) он возвращает ошибку и запроса не делает вовсе. Первая редакция
// теста жала кнопку по пустой форме и падала на «текста отказа нет» —
// падение выглядело дефектом страницы, а было дефектом теста.
function zapolnitFormu() {
  const nazvanie = screen.getAllByLabelText("Название компании или продукта")[0];
  fireEvent.change(nazvanie, { target: { value: "Тестовая компания" } });
  const opisanie = screen.getAllByPlaceholderText(/One-paragraph description/i)[0];
  fireEvent.change(opisanie, {
    target: { value: "Сервис для разбора инвестиционных сделок с проверкой метрик." },
  });
}

describe("отказ платной стены в QVenture", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  test("человек видит и причину, и ссылку на оплату", async () => {
    vi.stubGlobal("fetch", podmenitFetch({ status: 402, body: OTKAZ }));
    render(<QVenturePage />);

    zapolnitFormu();
    await userEvent.click(await screen.findByRole("button", { name: "Разобрать" }));

    // Причина — словами человека, а не кодом upgrade_required.
    await waitFor(() =>
      expect(screen.getByText(/входит в тариф Pro/i), "текст отказа не показан").toBeTruthy(),
    );
    const ssylka = screen.getByRole("link", { name: /Посмотреть тарифы/i });
    expect(ssylka.getAttribute("href"), "ссылка ведёт не туда").toBe(OTKAZ.upgradeUrl);
  });

  test("при обычной ошибке ссылки на оплату НЕТ", async () => {
    // Отрицательный контроль: без него первая проверка прошла бы и на
    // странице, которая показывает ссылку на оплату ВСЕГДА — в том числе
    // когда дело вовсе не в деньгах.
    vi.stubGlobal(
      "fetch",
      podmenitFetch({ status: 500, body: { error: "internal", message: "Сервис недоступен" } }),
    );
    render(<QVenturePage />);

    zapolnitFormu();
    await userEvent.click(await screen.findByRole("button", { name: "Разобрать" }));

    await waitFor(() => expect(screen.getByText(/недоступ/i)).toBeTruthy());
    expect(
      screen.queryByRole("link", { name: /Посмотреть тарифы/i }),
      "ссылка на оплату показана при ошибке, не связанной с деньгами",
    ).toBeNull();
  });
});
