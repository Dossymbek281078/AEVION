/**
 * Тема обращения доезжает не только до записи, но и до УЧЁТА.
 *
 * Соседний сторож проверяет, что тема попадает в запись обращения. Но у формы
 * два получателя, и второй — поток событий, по которому считаются панели.
 * Запись уходила с темой, а событие без неё: в потоке все обращения выглядели
 * одинаково, и отличить вопрос отказавшегося от оплаты от вопроса про доступ
 * было нечем. Пара «два писателя одного факта», разъехавшаяся молча.
 *
 * ИСТОЧНИК события намеренно остаётся прежним. Сводка считает `bySource` по
 * точному совпадению строки, и метка в источнике расщепила бы один показатель
 * на три: прежние числа «упали» бы, хотя обращений не стало меньше. Поэтому
 * тема живёт в `meta`.
 *
 * Проверяем то, что реально уходит с формы, а не написание в исходнике:
 * событие собирается из трёх мест, и любое из них может отвалиться.
 *
 * Отправку смотрим через fetch: в jsdom `navigator.sendBeacon` отсутствует
 * (проверено), и `track()` уходит запасным путём. Подменять сам `navigator`
 * нельзя — попытка это сделать подвесила прогон на десять минут.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";

const параметры = { value: "", объект: new URLSearchParams("") };
function задать(поиск: string) {
  параметры.value = поиск;
  параметры.объект = new URLSearchParams(поиск);
}
vi.mock("next/navigation", () => ({
  // ССЫЛКА ОБЯЗАНА БЫТЬ СТАБИЛЬНОЙ. Страница держит useEffect с зависимостью
  // [sp]; настоящий Next отдаёт один и тот же объект между отрисовками, а мок,
  // создающий новый на каждый вызов, гонит бесконечную перерисовку. Прогон
  // висел десять минут, и выглядело это как зависшая страница, а не как
  // дефект проверки.
  useSearchParams: () => параметры.объект,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/pricing/contact",
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function отправитьФорму(поиск: string) {
  задать(поиск);

  const запросы: Array<{ адрес: string; тело: string }> = [];
  vi.stubGlobal("fetch", async (адрес: unknown, настройки?: { body?: unknown }) => {
    запросы.push({ адрес: String(адрес), тело: String(настройки?.body ?? "") });
    return { ok: true, status: 200, json: async () => ({ id: "lead-1" }) };
  });

  const m = await import("@/app/pricing/contact/page");
  const Страница = m.default as () => JSX.Element;
  await act(async () => {
    render(
      <I18nProvider>
        <Страница />
      </I18nProvider>,
    );
  });

  const почта = document.querySelector('input[type="email"]') as HTMLInputElement | null;
  const имя = Array.from(document.querySelectorAll("input")).find(
    (p) => p !== почта,
  ) as HTMLInputElement | undefined;
  expect(имя, "поле имени не найдено").toBeTruthy();
  expect(почта, "поле почты не найдено").toBeTruthy();

  fireEvent.change(имя as HTMLInputElement, { target: { value: "Проверка" } });
  fireEvent.change(почта as HTMLInputElement, { target: { value: "a@b.co" } });

  const форма = document.querySelector("form");
  expect(форма, "форма не найдена").toBeTruthy();
  await act(async () => {
    fireEvent.submit(форма as HTMLFormElement);
  });

  return запросы;
}

describe("тема обращения в учёте", () => {
  it("уходит в событие вместе с формой", async () => {
    const запросы = await отправитьФорму("topic=cancel");

    const лид = запросы.find((з) => з.адрес.includes("/api/pricing/lead"));
    expect(лид, "форма не отправила обращение").toBeTruthy();
    expect(лид?.тело, "тема не доехала до записи").toContain("pricing/contact:cancel");

    const событие = запросы.find((з) => з.адрес.includes("/api/pricing/events"))?.тело ?? "";
    expect(событие, "событие учёта не ушло вовсе").not.toBe("");
    expect(событие, "тема не доехала до учёта").toContain("cancel");
    expect(событие, "источник события расщеплён меткой").toContain('"source":"pricing/contact"');
  }, 60000);

  it("без темы в адресе ничего лишнего не добавляется", async () => {
    const запросы = await отправитьФорму("");
    const событие = запросы.find((з) => з.адрес.includes("/api/pricing/events"))?.тело ?? "";
    expect(событие, "событие учёта не ушло вовсе").not.toBe("");
    expect(событие, "тема появилась из ниоткуда").not.toContain('"topic"');
  }, 60000);
});
