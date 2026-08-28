import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Ворота 6 окна запуска: человеку, который не готов платить прямо сейчас,
 * должно быть куда оставить контакт.
 *
 * Замер 28.08.2026, до правки: на странице модуля не было ни поля почты, ни
 * ссылки на страницу запуска. Значит весь трафик первого дня, кроме
 * покупателей, уходил бы без следа — подписчиков в системе на тот момент 3.
 *
 * Сторож держит именно ПУТЬ, а не конкретную вёрстку: текст и оформление
 * блока менять можно, исчезнуть он не должен.
 */
const stranica = fs.readFileSync(path.join(__dirname, "..", "page.tsx"), "utf8");

describe("со страницы шахмат есть путь оставить контакт", () => {
  test("ссылка на страницу запуска стоит в разметке", () => {
    expect(stranica).toContain('href="/cyberchess/launch"');
  });

  test("рядом со ссылкой человеческое обещание, а не голый адрес", () => {
    const i = stranica.indexOf('href="/cyberchess/launch"');
    expect(i).toBeGreaterThan(-1);
    // Берём кусок разметки вокруг ссылки и требуем в нём живой русской фразы:
    // без неё блок превращается в непонятную кнопку, на которую не нажимают.
    const okno = stranica.slice(i, i + 1200);
    expect(okno).toMatch(/[А-Яа-яё]{4,}[^<>]{10,}/);
  });

  test("обещание не сулит больше, чем придёт человеку", () => {
    const i = stranica.indexOf('href="/cyberchess/launch"');
    const okno = stranica.slice(i, i + 1200);
    // Страница запуска обещает ОДНО письмо. Всё, что обещает регулярную
    // рассылку или разборы, — обещание сверх продукта: именно это я написал
    // в первой версии блока и убрал после проверки.
    for (const lishnee of ["разбор партий", "каждую неделю", "еженедельн", "рассылк"]) {
      expect(okno.toLowerCase()).not.toContain(lishnee);
    }
  });

  test("после дня запуска блок скрывается, а не обещает прошедшее", () => {
    // 30 августа обещание «напишем в день запуска» уже неуместно: запуск
    // состоялся. Проверяем, что показ ограничен датой И что дата берётся
    // ОДНИМ способом с посадочной — иначе страницы разойдутся на пять часов.
    const i = stranica.indexOf('href="/cyberchess/launch"');
    const okno = stranica.slice(Math.max(0, i - 900), i);
    expect(okno).toContain("daysUntilLaunch(Date.UTC(2026, 7, 30)) > 0");
    expect(stranica).toContain('import { daysUntilLaunch } from "@/lib/daysUntilLaunch";');
  });
});
