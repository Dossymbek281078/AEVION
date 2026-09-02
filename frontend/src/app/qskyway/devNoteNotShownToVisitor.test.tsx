import { describe, test, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import Client from "./_client";
import cityMinimal from "./__fixtures__/cityMinimal.json";

/**
 * Заметка для РАЗРАБОТЧИКА не показывается посетителю.
 *
 * ПОВОД (02.09.2026, замер живого прода). Чип провенанса берёт подсказку из
 * `dataQuality.note` и ЗАМЕЩАЕТ ею своё пояснение. У наших городов в этом поле
 * лежит расшифровка кодировки для того, кто читает API:
 *
 *   «hs 0=обмерено властями … 1=выведено(тег height из OSM либо
 *    levels×3.2+1.6м парапет) 2=угадано(75-й процентиль …)»
 *
 * Именно её и читал посетитель, наведя курсор, — по-русски на любом языке,
 * вместо переведённого на три языка человеческого объяснения.
 *
 * Поле у чипа НЕ лишнее: соседние страницы кладут туда осмысленный текст.
 * Неверна была наша сторона.
 *
 * ПРОВЕРЯЕМ СЛЕДСТВИЕ, а не вызов. Утверждение «страница зовёт
 * devNoteStripped» закрепило бы форму: переименуют помощник — сторож
 * покраснеет зря, а положат заметку другим путём — промолчит.
 */

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function jsonOk(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

function mount() {
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    // Порядок: «/cities» содержит «/city», см. соседние файлы модуля.
    if (url.includes("/api/qskyway/cities")) {
      return jsonOk({ default: "astana", cities: [{ id: "astana", name: "Astana" }] });
    }
    if (url.includes("/api/qskyway/city")) return jsonOk(cityMinimal);
    if (url.includes("/api/qskyway/route")) return Promise.reject(new Error("route unavailable"));
    return jsonOk({});
  }) as unknown as typeof fetch;
  return render(
    <I18nProvider>
      <Client />
    </I18nProvider>,
  );
}

// Ровно та строка, что лежит в данных всех трёх городов и на проде.
const DEV_SHORTHAND = "hs 0=";

function everythingVisitorCanRead(root: HTMLElement): string {
  const parts: string[] = [root.textContent ?? ""];
  for (const el of Array.from(root.querySelectorAll("*"))) {
    for (const a of ["title", "aria-label", "placeholder", "alt"]) {
      const v = el.getAttribute(a);
      if (v) parts.push(v);
    }
  }
  return parts.join(" ");
}

describe("заметка для разработчика не уходит посетителю", () => {
  test("расшифровки кодировки нет ни в тексте, ни в подсказках", async () => {
    const r = mount();

    // Ждём отрисовки чипа, а не «чего-нибудь»: без этого проверка пройдёт на
    // пустой странице и ничего не докажет.
    await waitFor(
      () => expect(r.container.querySelectorAll("[title]").length, "подсказок нет — страница ещё пуста").toBeGreaterThan(0),
      { timeout: 10000 },
    );

    // ОТКРЫВАЕМ подсказки. Без этого сторож был ДЕКОРАТИВНЫМ: текст живёт в
    // состоянии `InfoTip` и попадает в дерево только после нажатия, поэтому
    // сбор по закрытой странице проходил и на сломанном коде. Поймано
    // мутацией сразу после написания — сам тест выглядел разумным.
    const tips = Array.from(r.container.querySelectorAll("button[aria-expanded]"));
    expect(tips.length, "кнопок подсказки нет — открывать нечего").toBeGreaterThan(0);
    for (const b of tips) (b as HTMLButtonElement).click();

    // ЖДЁМ перерисовки. Нажатие меняет состояние, а дерево обновляется после
    // разбора очереди React: читать сразу после `click()` значит смотреть на
    // страницу ДО открытия подсказки. Второй раз за один сторож наступил на
    // «прочитал не тот момент» — первый был с закрытой подсказкой.
    await waitFor(
      () => expect(r.container.querySelector("[role=tooltip]"), "подсказка не открылась").not.toBeNull(),
      { timeout: 10000 },
    );

    const seen = everythingVisitorCanRead(r.container);

    // Контроль прибора: он обязан ВИДЕТЬ подсказки, иначе ноль ничего не значит.
    expect(seen.length, "собрано пусто — сборщик смотрит не туда").toBeGreaterThan(200);

    // Контроль ПРЕДМЕТА: чип провенанса обязан быть на странице. Без него
    // проверка ниже зелена потому, что смотреть было не на что, — и останется
    // зелёной, когда чип снова начнёт показывать заметку.
    expect(seen, "чипа провенанса нет на странице — проверять нечего").toContain("📊");

    expect(
      seen.includes(DEV_SHORTHAND),
      "расшифровка кодировки `hs` дошла до посетителя вместо человеческого пояснения",
    ).toBe(false);
  }, 30000);

  test("контроль: эта строка действительно лежит в данных", () => {
    // Иначе проверка выше зелена потому, что искать было нечего, и останется
    // зелёной, даже если чип снова начнёт показывать заметку.
    expect(
      (cityMinimal as { dataQuality?: { note?: string } }).dataQuality?.note ?? "",
      "в фикстуре нет заметки разработчика — проверка выше ничего не проверяет",
    ).toContain(DEV_SHORTHAND);
  });
});
