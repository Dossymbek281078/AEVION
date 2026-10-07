import { describe, test, expect } from "vitest";
import { render } from "@testing-library/react";
import SiteHeader from "../SiteHeader";

/**
 * 🔴 Сторож проверяет КАСКАД, а не прямоугольники.
 *
 * Прямоугольники в jsdom нулевые у ВСЕГО — сторож «при закрытом details пункты
 * имеют нулевой прямоугольник» был бы зелёным и на сломанном коде, то есть
 * пустым. Поэтому спрашиваем то, что jsdom считает честно: getComputedStyle
 * панели при закрытом и при открытом details. Именно эта пара и сломалась
 * 07.10 — авторское `display: grid` на панели перебивало скрытие закрытого
 * <details>, которое браузер делает правилом своего стиля, и 464 из 844
 * первого экрана на телефоне занимало меню, которого никто не открывал.
 *
 * Чего сторож НЕ проверяет (прямо, чтобы не выдавали за полное): медиазапрос
 * (max-width: 700px) jsdom не применяет, поэтому «скрыто ли меню на 1024»
 * здесь не решается — это мерится браузером на 390 и 1024.
 */
describe("панель гамбургера скрыта, пока details закрыт", () => {
  const ПАНЕЛЬ = ".aev-hdr-menu-panel";

  test("закрытый details → панель display: none; открытый → grid", () => {
    const { container } = render(<SiteHeader />);
    const details = container.querySelector("details.aev-hdr-menu") as HTMLDetailsElement | null;
    const панель = container.querySelector(ПАНЕЛЬ) as HTMLElement | null;
    expect(details, "details.aev-hdr-menu не найден — сторож ослеп").not.toBeNull();
    expect(панель, "панель не найдена — сторож ослеп").not.toBeNull();

    // знаменатель: сколько пунктов вообще лежит в панели
    const пунктов = панель!.querySelectorAll("a").length;
    process.stderr.write(`[сторож] пунктов в панели гамбургера: ${пунктов}${String.fromCharCode(10)}`);
    expect(пунктов, "в панели нет ссылок — проверять нечего").toBeGreaterThan(0);

    expect(details!.open, "details должен рождаться закрытым").toBe(false);
    const закрыт = getComputedStyle(панель!).display;
    expect(закрыт, `при закрытом details панель display=${закрыт}, а должна быть none`).toBe("none");

    details!.open = true;
    const открыт = getComputedStyle(панель!).display;
    expect(открыт, `при открытом details панель display=${открыт}, а должна быть grid`).toBe("grid");
  });
});
