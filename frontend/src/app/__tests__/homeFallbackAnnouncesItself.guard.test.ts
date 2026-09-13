import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Главная страница при недоступном бэкенде подставляет демонстрационные данные.
 * Это законно — пустая главная хуже. Незаконным было другое: та же ветка
 * ГАСИЛА оба признака ошибки (setProjectsError(null), setQrightError(null)) и
 * подставляла выдуманные числа (участников 12, голосов 8, сертификатов 3,
 * заявок 15). Снаружи это неотличимо от работающей платформы: посетитель и
 * основатель видят цифры и верят им.
 *
 * Замер 13.09.2026: в то же утро на машине был обрыв DNS, то есть ветка
 * исполнялась не гипотетически.
 *
 * Сторож проверяет ВЕТКУ catch, а не файл целиком: сброс признаков ПЕРЕД
 * запросом законен и должен остаться (иначе прошлая ошибка висела бы вечно).
 *
 * ⚠️ Граница честная: это проверка ИСХОДНИКА, а не отрисовки. Она поймает
 * возврат прежнего поведения и не поймает, например, заметку, набранную белым
 * по белому. Отрисовку главной здесь не поднимаем намеренно: страница тянет
 * трёхмерный глобус, и такой тест краснел бы от нагрузки машины, а не по делу
 * (этот класс у нас уже был — сканирующий сторож в it()).
 */

const SRC = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

/** Текст ветки «бэкенд не ответил»: от catch до finally. */
function vetkaOtkaza(): string {
  const nachalo = SRC.indexOf("} catch {");
  expect(nachalo, "в page.tsx нет ветки catch — прибор смотрит не туда").toBeGreaterThan(0);
  const konec = SRC.indexOf("} finally {", nachalo);
  expect(konec, "у ветки catch нет finally — разбор оборвался").toBeGreaterThan(nachalo);
  return SRC.slice(nachalo, konec);
}

describe("главная не выдаёт заглушку за настоящие данные", () => {
  it("прибор работает: ветка отказа найдена и непуста", () => {
    const v = vetkaOtkaza();
    expect(v.length, "ветка отказа подозрительно короткая").toBeGreaterThan(200);
    expect(v, "контроль: в ветке нет подстановки проектов").toContain("setProjects(");
  });

  it("признаки ошибки в ветке отказа НЕ гасятся", () => {
    const v = vetkaOtkaza();
    expect(v, "setProjectsError(null) вернулся в catch: страница снова молчит об отказе")
      .not.toContain("setProjectsError(null)");
    expect(v, "setQrightError(null) вернулся в catch").not.toContain("setQrightError(null)");
  });

  it("заглушка называет себя: оба признака получают текст", () => {
    const v = vetkaOtkaza();
    expect(v, "в ветке отказа не выставлен projectsError").toMatch(/setProjectsError\(\s*[A-Z_]/);
    expect(v, "в ветке отказа не выставлен qrightError").toMatch(/setQrightError\(\s*[A-Z_]/);
  });

  it("выдуманных ЧИСЕЛ в ветке отказа нет", () => {
    const v = vetkaOtkaza();
    expect(v, "setPlanetStats в catch — это выдуманные числа на витрине")
      .not.toContain("setPlanetStats(");
  });

  it("подсказка разработчику не показывается посетителю", () => {
    const i = SRC.indexOf("Start backend on 4001");
    expect(i, "текст подсказки исчез — проверьте, не переписан ли блок").toBeGreaterThan(0);
    const okno = SRC.slice(Math.max(0, i - 400), i);
    expect(okno, "подсказка про порт и переменные не закрыта проверкой NODE_ENV")
      .toContain('process.env.NODE_ENV !== "production"');
  });
});
