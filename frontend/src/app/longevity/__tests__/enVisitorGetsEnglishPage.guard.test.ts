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
    /*
     * 🔴 УТВЕРЖДЕНИЕ ЗДЕСЬ МЕНЯЛОСЬ ДВАЖДЫ ЗА ОДИН ДЕНЬ, и это само по себе
     * диагноз. Сперва оно требовало «страница уводит на /en/longevity» — и
     * ровно это давало бесконечный круг, потому что английской страницы не
     * существовало. Потом я перевернул его в «уводить некуда». Теперь страница
     * появилась, и прежняя формулировка снова неверна.
     *
     * Поэтому проверяем не НАПРАВЛЕНИЕ, а ИНВАРИАНТ: страница уводит тогда и
     * только тогда, когда адрес есть в общем списке. Такое утверждение верно при
     * любом из трёх состояний и не потребует третьего переворота.
     */
    const цель = englishVersionFor("/longevity");
    const уводит = /redirect\(keepChannelOrProbe\(enUrl/.test(src);
    expect(src, "адрес берётся из общего списка").toContain('englishVersionFor("/longevity")');
    expect(уводит, "уводит ровно тогда, когда есть куда").toBe(цель !== null);
    // Контроль прибора: у страницы со своей версией список её называет,
    // у страницы без неё — молчит.
    expect(englishVersionFor("/go")).toBe("/en/go");
    expect(englishVersionFor("/pricing"), "у /pricing своей английской страницы нет").toBeNull();
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
