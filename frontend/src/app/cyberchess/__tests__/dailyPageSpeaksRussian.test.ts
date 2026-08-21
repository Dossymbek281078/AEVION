import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { themeRu } from "../daily/themes";

const SRC = path.join(__dirname, "..", "daily", "page.tsx");
const src = () => fs.readFileSync(SRC, "utf-8");

// 20.08.2026. Найдено глазами на живой странице, а не тестом: на флагманской
// странице модуля запуска смешаны языки — «Daily Puzzle», «держи streak»,
// «Текущий streak», а тема задачи приходила английской меткой прямо из банка.
// Правило платформы: вся проза по-русски.

describe("страница задачи дня говорит по-русски", () => {
  test("перевод темы работает и честно отступает на незнакомой", () => {
    expect(themeRu("Discovered attack")).toBe("Вскрытое нападение");
    expect(themeRu("Fork")).toBe("Вилка");
    // Незнакомую метку показываем КАК ЕСТЬ: пустота или прочерк были бы хуже —
    // по английскому слову человек хотя бы поймёт, о чём задача.
    expect(themeRu("Хитрая новая тема")).toBe("Хитрая новая тема");
    expect(themeRu("Zwischenzug")).toBe("Zwischenzug");
  });

  test("тема на экран идёт через перевод, а не сырой меткой", () => {
    expect(src()).toContain("themeRu(puzzle.theme)");
    expect(src()).not.toContain(">{puzzle.theme}<");
  });

  test("английских подписей на экране нет", () => {
    // Смотрим ТОЛЬКО видимый текст: в ключах localStorage слово streak
    // законно (cc_daily_streak), и запрещать его там значило бы ломать
    // сохранённые данные ради косметики.
    const kod = src()
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .filter((l) => !l.includes("localStorage") && !l.includes("cc_daily"))
      .join("\n");
    for (const angl of ["Daily Puzzle", "Текущий streak", "Лучший streak", "держи streak"]) {
      expect(kod, `английская подпись «${angl}» вернулась на страницу`).not.toContain(angl);
    }
  });
});

describe("отказ сервера доходит до человека", () => {
  // 21.08. У обработчика ответа была только ветка r.ok. Если сервер отказывал
  // (moves_required, wrong_day), страница молчала — а местная серия уже выросла,
  // и человек видел «Серия +1», которой сервер не признал. Назавтра число молча
  // менялось. Это те же «два писателя одного значения», только в тихой половине.
  const src = () => fs.readFileSync(SRC, "utf-8");

  test("ветка отказа есть и показывает подсказку сервера", () => {
    const s = src();
    expect(s, "нет ветки else у r.ok — отказ снова молчит").toMatch(/}\s*else\s*{/);
    expect(s, "подсказка сервера не читается").toContain("j.hint");
    expect(s, "подсказка не доходит до экрана").toContain("setMessage(podskazka)");
  });

  test("технический код не показывается человеку, а уходит в консоль", () => {
    const s = src();
    expect(s).toContain("console.warn('[daily] сервер отказал:'");
    // Код ошибки в setMessage попадать не должен.
    expect(s).not.toMatch(/setMessage\([^)]*j\.error/);
  });

  test("в сообщениях нет английского Streak", () => {
    const kod = src()
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    // Без предела длины: {0,200} не дотягивался до второй ветки тернарника,
    // и мутация «вернул Streak» проходила зелёной. Обрезка в шаблоне —
    // такая же ложь, как обрезка вывода.
    for (const m of kod.matchAll(/setMessage\(([^;]*)/g)) {
      // Подстановки вырезаем: ${curStreak} — имя переменной, а не текст на
      // экране. Без этого сторож краснел на верной строке.
      const tekst = m[1].replace(/\$\{[^}]*}/g, "");
      expect(tekst, "английское Streak в сообщении человеку").not.toContain("Streak");
    }
  });
});

describe("отказ сервера откатывает завышенную серию", () => {
  // Серия прибавляется ДО запроса намеренно — страница обязана работать без
  // сети. Но отказ сервера это не обрыв связи, а определённое «нет»: оставить
  // прибавку значит показывать человеку серию, которой у него нет, и молча
  // разойтись с таблицей лидеров.
  const src = () => fs.readFileSync(SRC, "utf-8");

  test("в ветке отказа состояние возвращается к прежнему", () => {
    const s = src();
    // Якорь — уникальная строка обработчика, а не первый "} else {" в файле:
    // на первом попавшемся сторож брал чужой кусок и краснел зря.
    // Якорь — уникальная строка обработчика; конец берём окном, а не первым
    // "} catch {": сразу за якорем стоит catch разбора JSON, и срез обрывался
    // на нём, из-за чего сторож краснел на верном коде.
    const i = s.indexOf("[daily] сервер отказал");
    expect(i, "ветки отказа нет вовсе").toBeGreaterThan(0);
    const vetka = s.slice(i, i + 1600);
    expect(vetka, "серия не откатывается").toContain("setStreak(streak)");
    expect(vetka, "рекорд не откатывается").toContain("setBestStreak(bestStreak)");
    expect(vetka, "день остаётся помеченным решённым").toContain("removeItem('cc_daily_last_solved')");
    expect(vetka, "нельзя повторить попытку").toContain("setSolved(false)");
  });

  test("обрыв связи местный счёт НЕ трогает — это разные случаи", () => {
    const s = src();
    // Якорь — уникальный комментарий ветки обрыва. По "} catch {" сторож
    // попадал на catch внутри самого отката и мутацию пропускал.
    const i = s.indexOf("ignore network errors");
    expect(i, "ветка обрыва связи не найдена").toBeGreaterThan(0);
    const vetka = s.slice(Math.max(0, i - 120), i + 120);
    expect(vetka, "в ветке обрыва появился откат — офлайн сломан").not.toContain("setStreak(streak)");
  });
});
