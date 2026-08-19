import { describe, expect, test } from "vitest";

import { numericClaims, numericConflicts, normalizeUnit } from "../src/services/multichat/dissent";

// Карта расхождений — главное обещание мультичата: «показываем, где агенты
// разошлись, потому что именно там ответу нельзя верить на слово». Тестов у неё не
// было ни в одной ветке, и на проде она отвечала неверно.
//
// Замер 19.08.2026 через ПУБЛИЧНУЮ ручку POST /api/multichat/dissent/preview
// (она не вызывает модели, поэтому проба ничего не стоит). Три ответа: двое дают
// 12000 долларов и 6 недель, третий — 30000 и 12 недель. Прод вернул ОДИН конфликт:
//
//   analyst: 12000 против writer: 12000 против writer: 6   (разброс 11994)
//
// Здесь неверно всё: 12000 против 12000 — это согласие; 12000 долларов сравнены с
// 6 неделями; настоящие расхождения (30000 и 12 недель) не показаны вовсе. Причин
// три — проверка «тот же агент» сравнивала кандидата только с затравкой, единица
// измерения не извлекалась, а несогласный агент формулирует иначе, и группировка по
// сходству предложений его теряла.

const PROD_SAMPLE = [
  { agentId: "analyst", ok: true, reply: "Стоимость проекта составит 12000 долларов, срок 6 недель. Риск: зависимость от внешнего API." },
  { agentId: "writer", ok: true, reply: "Оценка: около 12000 долларов и 6 недель работы. Главный риск — сроки поставки оборудования." },
  { agentId: "critic", ok: true, reply: "Я считаю оценку заниженной: реально 30000 долларов и не меньше 12 недель. Возможно, стоит пересмотреть." },
] as never;

const byUnitValues = (c: { values: Array<{ agentId: string; value: number }> }) =>
  c.values.map((v) => `${v.agentId}:${v.value}`).sort().join(" ");

describe("числовые расхождения: тот самый случай с прода", () => {
  const conflicts = numericConflicts(PROD_SAMPLE);

  test("прибор вообще что-то находит", () => {
    // Отрицательный контроль: без него все проверки ниже прошли бы на пустом списке.
    expect(conflicts.length).toBeGreaterThan(0);
  });

  test("найдено расхождение по деньгам — 12000 против 30000", () => {
    const money = conflicts.find((c) => c.values.some((v) => v.value === 30000));
    expect(money, "расхождение по деньгам потеряно").toBeTruthy();
    expect(byUnitValues(money!)).toBe("analyst:12000 critic:30000 writer:12000");
  });

  test("найдено расхождение по срокам — 6 против 12 недель", () => {
    const weeks = conflicts.find((c) => c.values.some((v) => v.value === 12));
    expect(weeks, "расхождение по срокам потеряно").toBeTruthy();
    expect(byUnitValues(weeks!)).toBe("analyst:6 critic:12 writer:6");
  });

  test("деньги и сроки НЕ смешаны в одном конфликте", () => {
    for (const c of conflicts) {
      const vals = c.values.map((v) => v.value);
      const hasMoney = vals.some((v) => v >= 1000);
      const hasWeeks = vals.some((v) => v <= 52);
      expect(hasMoney && hasWeeks, `в одном конфликте и деньги, и срок: ${byUnitValues(c)}`).toBe(false);
    }
  });

  test("один агент не встречается в конфликте дважды", () => {
    for (const c of conflicts) {
      const ids = c.values.map((v) => v.agentId);
      expect(new Set(ids).size, `агент повторился: ${ids.join(",")}`).toBe(ids.length);
    }
  });

  test("агент назвал ВИЛКУ — в конфликт идёт одно его значение, не два", () => {
    // Эту проверку пришлось дописать после мутации: на образце с прода у каждого
    // агента и так было по одному значению на единицу, поэтому снятие ограничения
    // «один агент — одно значение» ничего не меняло, и тест выше проходил на
    // сломанном коде. Вилка «от 100 до 300» — случай, где ограничение работает.
    // Формулировка выбрана так, чтобы у агента «a» вышло ДВА значения с одной и
    // той же единицей. Первый вариант («от 100 до 300 долларов») этого не давал:
    // у числа 100 следом стоит «до», и единица у него другая — мутация снова
    // проходила. Тест, не различающий сломанный код, бесполезен вдвойне, потому
    // что создаёт уверенность.
    const forked = [
      { agentId: "a", ok: true, reply: "Первый этап 100 долларов, второй этап 300 долларов." },
      { agentId: "b", ok: true, reply: "Весь проект 900 долларов." },
    ] as never;
    const cs = numericConflicts(forked);
    expect(cs.length).toBeGreaterThan(0);
    for (const c of cs) {
      const ids = c.values.map((v) => v.agentId);
      expect(new Set(ids).size, `агент повторился: ${ids.join(",")}`).toBe(ids.length);
    }
  });

  test("прежний ложный конфликт «12000 против 6» больше не появляется", () => {
    const bogus = conflicts.find((c) => {
      const vals = c.values.map((v) => v.value).sort((a, b) => a - b);
      return vals.length === 3 && vals[0] === 6 && vals[1] === 12000 && vals[2] === 12000;
    });
    expect(bogus).toBeFalsy();
  });
});

describe("единицы измерения", () => {
  test("падежи сходятся к одному ключу", () => {
    expect(normalizeUnit("долларов")).toBe("usd");
    expect(normalizeUnit("доллара")).toBe("usd");
    expect(normalizeUnit("$")).toBe("usd");
    expect(normalizeUnit("недель")).toBe("week");
    expect(normalizeUnit("неделя")).toBe("week");
    expect(normalizeUnit("%")).toBe("pct");
  });

  test("разные единицы не сходятся к одному ключу", () => {
    // Обратный конец контроля: без него normalizeUnit могла бы возвращать одно и
    // то же на всё, и группировка склеила бы деньги со сроками снова.
    expect(normalizeUnit("долларов")).not.toBe(normalizeUnit("недель"));
    expect(normalizeUnit("человек")).not.toBe(normalizeUnit("процентов"));
  });

  test("единица извлекается из русского слова после числа", () => {
    const claims = numericClaims("реально 30000 долларов и не меньше 12 недель");
    expect(claims.map((c) => `${c.value}:${c.unit}`)).toEqual(["30000:usd", "12:week"]);
  });
});

describe("согласие не выдаётся за спор", () => {
  test("одинаковые значения у двух агентов конфликтом не считаются", () => {
    const same = [
      { agentId: "a", ok: true, reply: "Бюджет 500 долларов." },
      { agentId: "b", ok: true, reply: "Бюджет 500 долларов." },
    ] as never;
    expect(numericConflicts(same)).toEqual([]);
  });

  test("а разные — считаются", () => {
    // Контроль к предыдущему: иначе пустой ответ мог бы означать «функция сломана».
    const diff = [
      { agentId: "a", ok: true, reply: "Бюджет 500 долларов." },
      { agentId: "b", ok: true, reply: "Бюджет 900 долларов." },
    ] as never;
    expect(numericConflicts(diff)).toHaveLength(1);
  });
});

describe("текст, который читает человек", () => {
  test("согласные агенты сгруппированы, а не противопоставлены", async () => {
    // Прежний текст склеивал ВСЕ значения через «против», и выходило
    // «analyst: 12000 против writer: 12000 против critic: 30000» — то есть 12000
    // против 12000. Человек читает список «что проверить» первым, и бессмыслица в
    // нём обесценивает всю карту.
    const { buildDissentMap } = await import("../src/services/multichat/dissent");
    const m = buildDissentMap(PROD_SAMPLE);
    const numbers = m.checks.filter((c) => c.kind === "number");
    expect(numbers.length).toBeGreaterThan(0);

    for (const c of numbers) {
      // Ни одно значение не должно стоять «против» самого себя.
      const sides = c.text.split(" против ");
      const values = sides.map((sd) => (/:\s*([\d\s.,]+)/.exec(sd) || [])[1]?.trim());
      expect(new Set(values).size, `одно и то же значение по обе стороны: ${c.text}`).toBe(values.length);
    }

    const money = numbers.find((c) => c.text.includes("30000"));
    expect(money?.text).toContain("analyst и writer: 12000 против critic: 30000");
  });
});
