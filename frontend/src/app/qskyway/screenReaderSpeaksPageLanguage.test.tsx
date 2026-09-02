import { describe, test, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import Client from "./_client";
import cityMinimal from "./__fixtures__/cityMinimal.json";

/**
 * Читалка экрана не должна отвечать по-русски на английской странице.
 *
 * ПОВОД (29.08.2026). Замер отрисованной страницы: имена кнопок для
 * читалки собраны, пустых нет — но ПЯТЬ отвечают по-русски, когда
 * страница отрисована по-английски. Одна из пяти — моя, добавленная в
 * этом же окне: у компонента приёма адресов подпись кнопки по умолчанию
 * русский литерал. На четырёх соседних страницах это верно, они
 * одноязычные; здесь три языка.
 *
 * В ИСХОДНИКЕ этого не видно вовсе: там стоит вызов компонента без
 * подписи, и выглядит он безупречно. Видно только у отрисованной
 * страницы — тот же класс, что `undefined` на экране.
 *
 * ⚠️ ХРАПОВИК, а не запрет. Четыре известных случая перечислены
 * поимённо: они не мои, лежат в общих компонентах, и требовать ноль
 * сегодня значит сделать проверку вечно красной — такие перестают
 * читать. Краснеет на НОВОМ.
 *
 * Список по СОДЕРЖИМОМУ, а не по номеру кнопки: номера съезжают от
 * любой правки разметки, и тогда сторож краснеет на невиновном.
 */
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function jsonOk(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

function mount() {
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    // ПОРЯДОК РЕШАЕТ: «/cities» содержит «/city», и проверка на «/city»,
    // стоящая первой, перехватывает ЗАПРОС СПИСКА тоже. 02.09.2026 из-за этого
    // выбор города не отрисовывался ни в одном тесте модуля.
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

/** Известный долг: не мои, лежат в общих компонентах. Новые запрещены. */
/**
 * Известный долг, поимённо. Список НЕ пустой, поэтому обязан объяснять,
 * что именно он разрешает и почему — иначе через месяц никто не отличит
 * осознанный размен от забытой строки.
 *
 * | строка | откуда | почему не чиню я |
 * |---|---|---|
 * | «Источник ограничения» | общий компонент подсказки: обёртка
 *   переведена, термин внутри нет | компонент общий, правка разъедется
 *   с его другими страницами |
 * | «Провенанс данных» | там же | там же |
 * | «QSkyway и навигация…» | блок сравнения с конкурентами
 *   (`CompetitorMatrix` + данные `lib/competitors.ts`) | им пользуется
 *   ещё `/compare`; перевод чужого набора данных в одиночку сломает их
 *   страницу |
 *
 * Все три переданы оркестратору отчётом, а не правкой. Появится
 * четвёртая — сторож покраснеет, и это правильно: список закрывает
 * ИЗВЕСТНОЕ, а не «кириллицу вообще».
 */
const KNOWN_RUSSIAN_LABELS = [
  "Источник ограничения",
  // ⚠️ ЖДЁТ МЕРЖА (01.09.2026). Окно запуска починило эту подпись в чипе
  // провенанса — она теперь приходит из словаря. На ИХ сборке храповик
  // поэтому краснеет и требует убрать строку; на моей ветке починки нет, и
  // убрать её сейчас значит покрасить свою ветку. Строка уходит сама при
  // мерже — отдельной работы не требует, поднимать в сводку не надо.
  //
  // Тот же случай, что у порога `IDENTICAL_TODAY` в
  // languageActuallySwitches.test.tsx: храповик описывает СВОЁ дерево, а
  // не сборку, и это не дефект храповика.
  "Провенанс данных",
  "QSkyway и навигация городского неба",
];

function hasCyrillic(s: string): boolean {
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x0400 && c <= 0x04ff) return true;
  }
  return false;
}

describe("имена кнопок для читалки — на языке страницы", () => {
  test("новых русских подписей на английской отрисовке нет", async () => {
    const r = mount();
    // Ждём ПРИЗНАК НУЖНОГО состояния, а не «кнопок больше трёх». Прежнее
    // условие удовлетворялось кнопками, отрисованными до загрузки города, и
    // сбор шёл по неполной странице. Предмет этого сторожа — подписи для
    // диктора, поэтому ждём кнопку С ПОДПИСЬЮ: раньше неё проверять нечего.
    await waitFor(
      () => expect(r.container.querySelector("button[aria-label]"), "кнопок с подписью ещё нет").not.toBeNull(),
      { timeout: 10000 },
    );

    const names: string[] = [];
    r.container.querySelectorAll("button").forEach((b) => {
      names.push(((b.getAttribute("aria-label") || b.textContent) ?? "").trim());
    });

    // Отрицательный контроль: без него пустой список пройдёт как чистый.
    expect(names.filter((n) => n.length > 0).length, "имён кнопок не собрано — сканер смотрит не туда").toBeGreaterThan(5);

    const unexpected = names.filter(
      (n) => hasCyrillic(n) && !KNOWN_RUSSIAN_LABELS.some((k) => n.includes(k)),
    );
    expect(
      unexpected,
      "читалка ответит по-русски на английской странице: " + JSON.stringify(unexpected),
    ).toEqual([]);
  }, 30000);

  test("известный долг всё ещё существует — иначе список пора чистить", async () => {
    // Храповик обязан замечать и УЛУЧШЕНИЕ: если долг починили, а строка
    // осталась в списке, она молча разрешает новую такую же.
    const r = mount();
    // Ждём ПРИЗНАК НУЖНОГО состояния, а не «кнопок больше трёх». Прежнее
    // условие удовлетворялось кнопками, отрисованными до загрузки города, и
    // сбор шёл по неполной странице. Предмет этого сторожа — подписи для
    // диктора, поэтому ждём кнопку С ПОДПИСЬЮ: раньше неё проверять нечего.
    await waitFor(
      () => expect(r.container.querySelector("button[aria-label]"), "кнопок с подписью ещё нет").not.toBeNull(),
      { timeout: 10000 },
    );

    const all = Array.from(r.container.querySelectorAll("button"))
      .map((b) => ((b.getAttribute("aria-label") || b.textContent) ?? "").trim())
      .join(" | ");
    const stale = KNOWN_RUSSIAN_LABELS.filter((k) => !all.includes(k));
    expect(stale, "долг починен, уберите из списка: " + JSON.stringify(stale)).toEqual([]);
  }, 30000);
});
