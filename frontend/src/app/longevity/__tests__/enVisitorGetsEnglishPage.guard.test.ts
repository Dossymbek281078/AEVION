import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Посетитель с выбранным английским получает английскую страницу.
 *
 * ЗАЧЕМ. Замер 06.09.2026 (EN-свип): /longevity под cookie en отдавала 75 %
 * кириллицы при ЖИВОЙ /en/longevity — англоязычный покупатель книги читал
 * русский протокол. Починка — серверный redirect по cookie `aevion_lang_v1`
 * (та, которую пишет общий переключатель).
 *
 * ГРАНИЦА ЧЕСТНО: сторож исходникового уровня — он закрепляет, что редирект
 * НЕ ИСЧЕЗ и стоит ДО платной стены и до учёта (иначе просмотр считался бы
 * дважды). Что редирект работает НА ПРОДЕ, проверяется living-пробой:
 *   curl -s -o /dev/null -w "%{http_code} %{redirect_url}" \
 *     -H "Cookie: aevion_lang_v1=en" https://aevion.app/longevity
 * — ждём 3xx на /en/longevity.
 */
import { stripComments } from "../../__tests__/helpers/sourceCode";

const HERE = dirname(fileURLToPath(import.meta.url));
// Комментарии вырезаем: литералы (имя cookie, адрес) живут и в пояснениях,
// и сторож по сырому исходнику был бы зелёным при удалённом КОДЕ — поймано
// мутацией при создании этого файла.
const src = stripComments(readFileSync(join(HERE, "..", "page.tsx"), "utf8"));

import { englishVersionFor } from "@/lib/englishPages";

describe("языковая маршрутизация /longevity", () => {
  it("читает cookie языка и уводит en-посетителя на /en/longevity", () => {
    expect(src).toContain('aevion_lang_v1');
    expect(src).toContain('redirect(');
    // 🔴 01.10.2026 УТВЕРЖДЕНИЕ ПЕРЕВЁРНУТО. Этот сторож требовал, чтобы страница
    // уводила гостя на /en/longevity, — и ровно это давало бесконечный круг:
    // английской страницы нет, middleware возвращал гостя назад, страница снова
    // уводила. Замер прода: 6 шагов и опять 307, без куки 200. На /longevity
    // пришли ОБА платежа за всё время, то есть круг стоял на денежной странице.
    // Теперь страница спрашивает общий список и не уводит никуда.
    expect(src).toContain('englishVersionFor("/longevity")');
    expect(englishVersionFor("/longevity"), "английской страницы нет — уводить некуда").toBeNull();
    // Контроль: там, где английская версия ЕСТЬ, список её называет.
    expect(englishVersionFor("/go")).toBe("/en/go");
  });

  it("редирект стоит ДО платной стены и ДО учёта просмотра", () => {
    const iRedirect = src.indexOf("redirect(");
    const iPaywall = src.indexOf("fetchOrPaywall(");
    const iTracking = src.indexOf("<PageTracking");
    expect(iRedirect).toBeGreaterThan(-1);
    expect(iPaywall).toBeGreaterThan(-1);
    expect(iRedirect, "redirect должен идти раньше платной стены").toBeLessThan(iPaywall);
    expect(iRedirect, "redirect должен идти раньше учёта просмотра").toBeLessThan(iTracking);
  });

  /*
   * 🔴 ПРАВКА 30.09.2026 — прежнее ожидание закрепляло сам дефект.
   *
   * Здесь ждали дословное `/en/longevity?c=`, то есть РУЧНУЮ сборку адреса. Именно
   * она и теряла канал: в адрес подставлялось длинное ИМЯ (`?c=instagram`)
   * вместо короткой метки. Замер браузером 30.09: `/longevity?c=ig` у гостя с
   * английской cookie заканчивалась на `/en/longevity` вообще без `?c=` — а оба
   * наших единственных платежа за всё время пришли с книги на этой странице.
   *
   * Теперь адрес собирает общая функция `keepChannel`, и дословной метки в
   * исходнике нет: требовать её значило бы требовать вернуть дефект.
   *
   * Проверяем КАЖДЫЙ redirect, а не количество вхождений адреса: прежний
   * подсчёт «не меньше двух» ловил подмену в одной из двух ветвей, но с одной
   * ветвью стал бы зелёным всегда. Обход по всем адресам сильнее — новая ветвь
   * без keepChannel покраснеет.
   */
  it("каждый редирект уводит на английскую страницу и несёт метку канала", () => {
    const адреса = [...src.matchAll(/redirect\(([^;]*)\)/g)].map((m) => m[1]);
    expect(адреса.length, "редирект должен быть").toBeGreaterThan(0);
    for (const а of адреса) {
      expect(а, "адрес собирает общая функция — иначе метка теряется").toMatch(/keepChannel(OrProbe)?\(/);
      expect(а, "редирект собирается из общего списка").toContain("enUrl");
    }
  });
});
