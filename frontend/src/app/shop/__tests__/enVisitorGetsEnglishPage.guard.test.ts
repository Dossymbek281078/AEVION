import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "../../__tests__/helpers/sourceCode";

/**
 * Посетитель с выбранным английским получает английскую витрину.
 *
 * ЗАЧЕМ. Замер EN-свипа 06.09.2026: /shop под cookie en отдавала 73 %
 * кириллицы — худшая ДЕНЕЖНАЯ страница для en-покупателя. Починка —
 * серверный redirect по cookie `aevion_lang_v1` на /en/shop; третий случай
 * приёма (образцы /longevity и /go, мутации пойманы там).
 *
 * ГРАНИЦА ЧЕСТНО: сторож исходникового уровня. Живую работу на проде
 * проверяет проба: curl -H "Cookie: aevion_lang_v1=en" https://aevion.app/shop
 * → ждём 3xx на /en/shop.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
// Комментарии вырезаны: литералы живут и в пояснениях (урок сторожей
// /longevity и /go — оба раза ловилось мутацией).
const src = stripComments(readFileSync(join(HERE, "..", "page.tsx"), "utf8"));
const тело = src.slice(src.indexOf("export default"));

describe("языковая маршрутизация /shop", () => {
  it("читает cookie языка и уводит en-посетителя на /en/shop", () => {
    expect(тело).toContain('aevion_lang_v1');
    expect(тело).toContain('redirect(');
    expect(тело).toContain('/en/shop');
  });

  it("редирект стоит ДО учёта просмотра", () => {
    const iRedirect = тело.indexOf("redirect(");
    const iTracking = тело.indexOf("<PageTracking");
    expect(iRedirect).toBeGreaterThan(-1);
    expect(iTracking).toBeGreaterThan(-1);
    expect(iRedirect, "redirect должен идти раньше учёта просмотра").toBeLessThan(iTracking);
  });

  /*
   * 🔴 ПРАВКА 30.09.2026 — прежнее ожидание закрепляло сам дефект.
   *
   * Здесь ждали дословное `/en/shop?c=`, то есть РУЧНУЮ сборку адреса. Именно
   * она и теряла канал: в адрес подставлялось длинное ИМЯ (`?c=instagram`)
   * вместо короткой метки. Замер браузером 30.09: `/shop?c=ig` у гостя с
   * английской cookie заканчивалась на `/en/shop` вообще без `?c=` — а оба
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
  it("каждый редирект уводит на английскую витрину и несёт метку канала", () => {
    const адреса = [...src.matchAll(/redirect\(([^;]*)\)/g)].map((m) => m[1]);
    expect(адреса.length, "редирект должен быть").toBeGreaterThan(0);
    for (const а of адреса) {
      expect(а, "адрес собирает keepChannel — иначе метка теряется").toContain("keepChannel(");
      expect(а, "редирект ведёт на английскую версию").toContain('"/en/shop"');
    }
  });
});
