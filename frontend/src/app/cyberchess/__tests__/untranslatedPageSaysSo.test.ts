import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Переключатель языка обещает перевод, а «Задача дня» словарь не использует
 * (0 обращений против 269 на главной). Человек с английским браузером видел
 * кнопку EN и русский текст, не понимая, сломалось ли что-то.
 *
 * Страница теперь говорит об этом прямо — тем же приёмом, что уже применён
 * к запасной задаче («банк задач не ответил»).
 */
const STR = join(__dirname, "..", "daily", "page.tsx");
const kod = readFileSync(STR, "utf8");

describe("непереведённая страница честно об этом говорит", () => {
  it("предупреждение показывается только при не-русском языке", () => {
    expect(kod).toMatch(/ne_russkiy\s*&&/);
    expect(kod).toContain("Russian only");
  });

  it("язык читается в эффекте, а не при отрисовке", () => {
    // чтение браузера в теле компонента ломает гидратацию — ровно тот класс,
    // который на этой странице уже разбирался
    const vyzov = kod.indexOf("loadLocale()");
    expect(vyzov).toBeGreaterThan(0);
    const do_vyzova = kod.slice(0, vyzov);
    const posledniy_effekt = do_vyzova.lastIndexOf("useEffect");
    const posledniy_return = do_vyzova.lastIndexOf("return (");
    expect(posledniy_effekt).toBeGreaterThan(posledniy_return);
  });

  it("текст предупреждения на языке того, кто его прочтёт", () => {
    // русскому читателю оно не показывается, поэтому и написано по-английски
    const m = kod.match(/This page is available[^<]*/);
    expect(m).toBeTruthy();
    expect(m![0]).not.toMatch(/[а-яА-Я]/);
  });
});
