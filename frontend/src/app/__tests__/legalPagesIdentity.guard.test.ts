import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Юридический слой сайта: кто продавец, куда писать, и один ли документ.
 *
 * Что было 19.08.2026, до этой проверки (замер, не опасение):
 *   · Ни одна юридическая страница НЕ называла юрлицо. Компания AEVION LLC
 *     зарегистрирована 20.07.2026, EIN получен 17.08 — страницы об этом не знали.
 *   · На проде жили ДВА комплекта условий и приватности: /terms + /privacy и
 *     сиротские /legal/terms + /legal/privacy + /legal/refund, на которые не
 *     ссылался никто. Они противоречили друг другу: подсудность Астана против
 *     Алматы.
 *   · Сироты печатали три адреса на aevion.app — у домена НЕТ записи MX,
 *     то есть письма отбиваются. Проверено отправкой.
 *
 * Почему это стерегут тестом, а не «мы же помним»: страницу условий правят
 * редко и не глядя, и пропажу одной строки с юрлицом никто не заметит — а
 * платёжная система сверяет заявителя с сайтом, и расхождение стоит отказа.
 */

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const CANONICAL = ["terms/page.tsx", "privacy/page.tsx"];
const ORPHANS = ["legal/terms/page.tsx", "legal/privacy/page.tsx", "legal/refund/page.tsx"];

/** Домены без почты. Печатать на них адрес = обещать канал, которого нет. */
const DEAD_MAIL_DOMAINS = ["@aevion.app"];

describe("юридические страницы называют продавца и не врут адресами", () => {
  test("контроль: файлы на месте и не пустые", () => {
    // Без этого все проверки ниже прошли бы на несуществующих файлах.
    for (const f of [...CANONICAL, ...ORPHANS]) {
      expect(existsSync(join(ROOT, f)), `нет файла ${f}`).toBe(true);
      expect(read(f).length, `${f} подозрительно пуст`).toBeGreaterThan(200);
    }
  });

  // ⚠️ Найдено мутацией 29.08.2026: имя юрлица встречается на странице
  // ТРИЖДЫ (в шапке, в контактах, в подвале), а проверка ниже требует лишь
  // одного вхождения. Переименуют в заголовке, оставят в подвале — она
  // промолчит, а покупатель увидит другую компанию. Поэтому отдельно
  // запрещаем ЧУЖИЕ формы: частичное переименование выдаёт себя ими.
  const WRONG_FORMS = ["AEVION Inc", "AEVION Ltd", "AEVION GmbH", "AEVION Limited"];
  for (const f of CANONICAL) {
    test(`${f} не называет ЧУЖОЕ юрлицо`, () => {
      const s = read(f);
      const found = WRONG_FORMS.filter((w) => s.includes(w));
      expect(found, `${f} называет ${found.join(", ")} — частичное переименование`).toEqual([]);
    });
  }

  for (const f of CANONICAL) {
    test(`${f} называет юрлицо`, () => {
      const s = read(f);
      expect(s, `${f} не называет компанию — покупатель не знает, с кем договор`).toContain("AEVION LLC");
      expect(s, `${f} не называет юрисдикцию компании`).toMatch(/Wyoming/);
      expect(s, `${f} не даёт почтового адреса компании`).toMatch(/Sheridan/);
    });

    test(`${f} не печатает адрес на домене без почты`, () => {
      const s = read(f);
      for (const d of DEAD_MAIL_DOMAINS) {
        // Комментарии тоже считаем: если адрес упомянут, кто-то захочет его вернуть.
        const inProse = s.split("\n").filter((l) => l.includes(d) && !l.trim().startsWith("//") && !l.trim().startsWith("*"));
        expect(inProse, `${f}: адрес на ${d} не принимает писем (у домена нет MX)`).toEqual([]);
      }
    });
  }

  for (const f of ORPHANS) {
    test(`${f} — только перенаправление, не второй документ`, () => {
      const s = read(f);
      expect(s, `${f} снова стал отдельной страницей — на сайте два разных документа об одном`).toContain("permanentRedirect");
      // Второй признак: настоящий документ длинный, перенаправление короткое.
      expect(s.split("\n").length, `${f} слишком длинный для перенаправления`).toBeLessThan(40);
    });
  }

  test("контроль: проверка умеет отличать документ от перенаправления", () => {
    // Иначе «только перенаправление» проходило бы на чём угодно.
    const real = read("terms/page.tsx");
    expect(real).not.toContain("permanentRedirect");
    expect(real.split("\n").length).toBeGreaterThan(40);
  });
});
