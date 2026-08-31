import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Не обещать канал оплаты, которого нет.
 *
 * Подпись под ценой говорила «KZT → локальные карты КЗ + Kaspi (PayBox)» на
 * всех трёх языках. 18.08.2026 проверено запросами к живому проду:
 *
 *   /api/pricing/checkout/healthz  → paybox.configured = false
 *   POST /api/pricing/checkout/session с currency=KZT
 *                                  → ссылка на LemonSqueezy, оплата в долларах
 *
 * То есть покупатель из Казахстана читал про Kaspi и попадал на долларовый
 * чекаут. Продажа при этом не ломается — запасной путь работает, — и именно
 * поэтому дефект был невидим: ничего не падало, просто обещание не совпадало
 * с делом.
 *
 * Сторож держит связь в обе стороны: обещание про Kaspi показывается только
 * когда сервер подтвердил, что PayBox включён, и для случая «не подтвердил»
 * есть отдельный честный текст на каждом языке.
 */

const SRC = join(__dirname, "..", "page.tsx");

/**
 * Словарь читается по одному файлу на язык (28.08.2026).
 *
 * До перестройки все одиннадцать словарей лежали в `i18n-data.ts`, и сторож
 * искал ключи в его тексте. Теперь там только метаинформация о языках, а строки
 * живут в `lib/i18n-lang/{язык}.ts`. Читаем ровно те три языка, о которых
 * говорит проверка ниже, — так «во всех трёх языках» остаётся буквальным, а не
 * зависит от того, сколько языков окажется в общем файле.
 */
const LANG_FILES = ["ru", "en", "kk"].map((l) =>
  join(__dirname, "..", "..", "..", "lib", "i18n-lang", `${l}.ts`),
);

describe("обещание про Kaspi следует за фактом", () => {
  const page = readFileSync(SRC, "utf8");
  const i18n = LANG_FILES.map((p) => readFileSync(p, "utf8")).join("\n");

  test("контроль: страница и словарь прочитались", () => {
    // Пустые файлы дали бы зелёный на любом состоянии кода.
    expect(page.length).toBeGreaterThan(1000);
    expect(i18n).toContain("pricing.home.heroModule.kztNote");
  });

  test("незнание о продаваемости НЕ выключает кнопки покупки", () => {
    // Поле sellable добавлено в healthz 29.08.2026. Пока бэкенд не выкачен,
    // его в ответе нет — и это «не знаем», а не «купить нельзя».
    //
    // Направление ошибки здесь самое дорогое: если незнание закроет
    // кнопки, один сетевой сбой остановит ВСЕ продажи. Поэтому проверяем
    // именно значение по умолчанию.
    expect(page).toContain("notSellable === null ? true");
    // и что решение вообще применяется к кнопкам
    expect(page).toMatch(/disabled=\{checkingOut === "lite" \|\| !/);
  });

  test("«не смогли спросить» не выдаётся за «Kaspi не подключён»", () => {
    // Прежде состояние было двоичным: null (не спросили) — ложное
    // значение, и оно уходило в ветку «Kaspi не подключён». Код бережно
    // хранил незнание, а экран его терял и утверждал покупателю то,
    // чего мы не проверяли.
    expect(page).toContain("payboxLive === null");
    expect(i18n).toContain("pricing.home.heroModule.kztUnknownNote");

    // И проверка незнания обязана стоять РАНЬШЕ проверки истинности:
    // иначе ветка недостижима, а тест выше был бы зелёным всё равно.
    const незнание = page.indexOf("payboxLive === null");
    const истинность = page.indexOf("? t(\"pricing.home.heroModule.kztNote\")");
    expect(незнание).toBeGreaterThan(-1);
    expect(истинность).toBeGreaterThan(-1);
    expect(незнание).toBeLessThan(истинность);
  });

  test("страница спрашивает сервер, включён ли PayBox", () => {
    expect(page).toContain("/api/pricing/checkout/healthz");
    expect(page).toMatch(/providers\??\.\s*paybox/);
  });

  test("обещание про Kaspi показывается только при подтверждении", () => {
    // Ключевое: kztNote не должен появляться в разметке безусловно.
    const unconditional = /\?\s*t\("pricing\.home\.heroModule\.kztNote"\)\s*:\s*t\("pricing\.home\.heroModule\.usdNote"\)/;
    expect(
      unconditional.test(page),
      "подпись про Kaspi выводится без проверки, включён ли PayBox",
    ).toBe(false);

    expect(page).toContain("payboxLive");

    // 31.08.2026: решение «что написать под ценой» вынесено из страницы в
    // lib/chargeCurrencyNote.ts — страница цен в тестовой среде не поднимается
    // без полного слепка данных, и правило проверять было негде. Проверка
    // ДОПОЛНЕНА, а не заменена: честный ключ обязан быть там, где принимается
    // решение, и это место называется прямо.
    const правило = readFileSync(
      join(process.cwd(), "src/lib/chargeCurrencyNote.ts"),
      "utf8",
    );
    expect(
      page.includes("kztFallbackNote") || page.includes("chargeCurrencyNoteKey"),
      "страница больше не связана с честной подписью ни текстом, ни правилом",
    ).toBe(true);
    expect(правило, "честный запасной текст исчез из правила").toContain("kztFallbackNote");
    expect(правило, "ветка «не спросили» исчезла — вернётся ложное «Kaspi не подключён»")
      .toContain("kztUnknownNote");

    // Свойство от соседней вкладки, перенесённое сюда вместе с логикой:
    // проверка НЕЗНАНИЯ обязана стоять РАНЬШЕ проверки истинности. Иначе
    // ветка «не спросили» недостижима, а тест выше остаётся зелёным — он
    // видит нужный ключ в файле и не знает, что до него не доходит ход.
    const незнание = правило.indexOf("payboxLive === null");
    const истинность = правило.indexOf("payboxLive");
    expect(незнание, "в правиле нет ветки «не спросили»").toBeGreaterThan(-1);
    expect(
      незнание,
      "проверка незнания стоит после проверки истинности — ветка недостижима",
    ).toBeLessThanOrEqual(правило.indexOf("? \"pricing.home.heroModule.kztNote\""));
    expect(истинность).toBeGreaterThan(-1);
  });

  test("честный текст есть на всех трёх языках", () => {
    const count = (i18n.match(/"pricing\.home\.heroModule\.kztFallbackNote"/g) || []).length;
    const promised = (i18n.match(/"pricing\.home\.heroModule\.kztNote"/g) || []).length;

    expect(promised, "ключ обещания пропал — сторож ослеп").toBeGreaterThanOrEqual(3);
    expect(count, `запасной текст есть только для ${count} языков из ${promised}`).toBe(promised);
  });

  test("запасной текст не обещает Kaspi", () => {
    // Иначе «честная» подпись повторила бы то же самое обещание.
    for (const m of i18n.matchAll(/"pricing\.home\.heroModule\.kztFallbackNote":\s*"([^"]+)"/g)) {
      expect(m[1].toLowerCase(), `запасной текст всё ещё обещает Kaspi: ${m[1]}`).not.toContain("kaspi (paybox)");
    }
  });
});
