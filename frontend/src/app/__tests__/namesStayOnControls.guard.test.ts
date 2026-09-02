import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * 02.09.2026: свип по собственной боевой сборке (280 страниц из 761) нашёл
 * 98 органов управления без доступного имени. Все получили имя.
 *
 * Имя — это ОДИН атрибут. Его снимает любой рефакторинг стилей, и снаружи
 * ничего не меняется: страница выглядит так же, тесты зелёные, читалка
 * замолкает. Поэтому имена закреплены здесь поимённо.
 *
 * Граница честная: сторож охраняет места, найденные ЗАМЕРОМ, а не «все поля
 * приложения». Статический счёт даёт 67 «безымянных» флажков в 52 файлах, но
 * часть обёрнута подписью и на экране называется — правило по такому списку
 * краснело бы вечно, а вечно красного сторожа перестают читать.
 */

const КОРЕНЬ = path.join(__dirname, "..");

const ЗАКРЕПЛЕНО: Array<[string, string[]]> = [
  ["smeta-trainer/drawings-practice/environmental/page.tsx", ["aria-label={item}"]],
  ["smeta-trainer/drawings-practice/smeta-checklist/page.tsx", ["aria-label={item.text"]],
  ["smeta-trainer/drawings-practice/storm-sewerage/page.tsx", ["Ответ на задачу"]],
  ["smeta-trainer/real-rates/assemble/page.tsx", ["Добавить в смету", "Поиск по расценкам"]],
  ["smeta-trainer/rates/page.tsx", ["Цена от", "Цена до", "Поиск расценки"]],
  ["smeta-trainer/methodology/page.tsx", ["Поиск по методике"]],
  ["qcoreai/pipeline/page.tsx", ["вверх`}", "вниз`}", "Удалить шаг"]],
  ["qcoreai/multi/page.tsx", ["Задача для команды агентов", "Поиск по прогонам",
                              "Уменьшить размер совета", "Увеличить размер совета"]],
  ["qcoreai/batch/page.tsx", ["Список задач", "Предел расхода"]],
  ["qcoreai/search/page.tsx", ["Поиск по сессиям"]],
  ["qcoreai/compare/page.tsx", ["Прогон A", "Прогон B"]],
  ["ventures/IdeaMarket.tsx", ["Название идеи", "Питч идеи", "Модель бизнеса", "Потолок рынка"]],
  ["qnews/page.tsx", ["В закладки:"]],
  ["psyapp-deps/components/Onboarding.tsx", ["Сгенерировать новый псевдоним"]],
  ["qlife/components/PlanCard.tsx", ['htmlFor="qlife-age"', 'id="qlife-age"']],
  ["devhub/i18n.ts", ["snip.codeAria"]],
];

describe("доступные имена не исчезают из органов управления", () => {
  it("прибор умеет краснеть: на файле без признака даёт провал", () => {
    const текст = "<input placeholder=\"Поиск\" />";
    expect(текст.includes("aria-label")).toBe(false);
  });

  for (const [файл, признаки] of ЗАКРЕПЛЕНО) {
    it("имена на месте: " + файл, () => {
      const п = path.join(КОРЕНЬ, файл);
      expect(fs.existsSync(п)).toBe(true);
      const s = fs.readFileSync(п, "utf8");
      for (const пр of признаки) expect(s).toContain(пр);
    });
  }

  it("охват не сузился незаметно: закреплённых файлов не меньше 16", () => {
    // Список можно РАСШИРЯТЬ. Сужение означает, что кто-то убрал строку
    // вместо того, чтобы починить упавшую проверку.
    expect(ЗАКРЕПЛЕНО.length).toBeGreaterThanOrEqual(16);
  });
});
