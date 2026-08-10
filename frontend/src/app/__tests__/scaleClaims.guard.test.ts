/**
 * Сторож заявлений о масштабе экосистемы.
 *
 * ЗАЧЕМ. pitchNumbers.guard проверяет ИМЕНОВАННЫЙ список отставных чисел на
 * ИМЕНОВАННОМ списке поверхностей. Этого хватало ровно до тех пор, пока
 * устаревшая цифра появлялась там, куда уже смотрели. 27.07.2026 сплошной
 * обход нашёл 31 расхождение — почти всё под /pricing, куда ходят клиенты, и
 * ни один файл из тех не был в списке поверхностей.
 *
 * Показательный случай: бейдж матрицы сравнения печатал «27 МОДУЛЕЙ × 4
 * ТАРИФА» строкой, пока фильтр в нескольких пикселях правее рисовал живое
 * data.modules.length из того же ответа API. Два числа на одном экране, и оба
 * в бейдже неверны.
 *
 * Поэтому здесь наоборот: сканируется ВЕСЬ фронтенд, а исключения
 * перечисляются поимённо и с причиной. Новое устаревшее число падает по
 * умолчанию; чтобы его пропустить, надо осознанно дописать строку сюда.
 *
 * Сеть не нужна: истина читается из projects.ts, как и в соседнем стороже.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "../..");
const REGISTRY = path.resolve(SRC_ROOT, "../../aevion-globus-backend/src/data/projects.ts");

/** Каталоги, где чисел про модули экосистемы быть не может по смыслу. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "__tests__",
  // Учебные чертежи сметного тренажёра: там «Модуль #278» — номер урока.
  "drawings-practice",
]);

/**
 * Законные вхождения. Каждое — с причиной, потому что без причины это просто
 * способ заглушить сторож. Совпадение по подстроке строки исходника.
 */
const ALLOWED: Array<{ fragment: string; reason: string }> = [
  {
    fragment: "the other 38 modules are upside",
    reason: "три флагмана + 38 = 41; арифметика сходится с реестром",
  },
  {
    fragment: "the launched 12 modules",
    reason:
      "рамка аудита объективности #484: выложено ≠ доделано (~a dozen feature-complete)",
  },
  {
    fragment: "score cp -45 nodes",
    reason: "узлы перебора шахматного движка, не модули",
  },
  {
    fragment: "~11 module pages",
    reason: "комментарий о числе файлов, импортирующих кнопку апгрейда",
  },
  {
    fragment: "(~11 модулей)",
    reason: "то же самое, русский комментарий",
  },
  {
    fragment: '"29 modules"',
    reason: "пример отставного числа внутри объясняющей шапки pitchFacts",
  },
  {
    fragment: "19 modules and 30 services",
    reason:
      "индекс API — свой счёт эндпоинтов, не реестр модулей. Не сверено (см. бэклог), но и не выдаёт себя за число реестра",
  },
  {
    fragment: "30 modules (those copy)",
    reason: "приблизительная формулировка в аргументе о ценности, не счёт",
  },
];

/** Строки чейнджлога описывают, что было выпущено ТОГДА. Это не устаревание. */
const CHANGELOG_LINE = /changelog/i;

/** Комментарий, который объясняет само устаревание, а не утверждает число. */
const EXPLANATORY_COMMENT = /Раньше тут стояло|stale module count|retired/i;

/**
 * Строка целиком комментарий — её читатель страницы не увидит никогда.
 *
 * До 10.08.2026 объяснения пропускались по списку фраз («Раньше тут стояло»,
 * «stale module count», «retired»). Список — это второй источник правды: я
 * написал в investor/page.tsx комментарий «здесь стояло ?? 27 при 41 записи
 * в реестре», объясняющий ровно ту поломку, ради которой сторож и живёт, и
 * сторож покраснел на объяснении. Ложно краснеющего сторожа отключают, а
 * вместе с ним пропадает и настоящая проверка.
 *
 * Признак теперь структурный, а не по фразе: строка начинается с `//`, `*`
 * или `/*`. Число внутри комментария пользователю не показывается по
 * определению, поэтому пропускать его безопасно.
 */
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/;

function countRegistryTotal(): number {
  const src = readFileSync(REGISTRY, "utf8");
  return Array.from(src.matchAll(/status:\s*["'](\w+)["']/g)).length;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

/**
 * Число рядом со словом масштаба, в обе стороны. Намеренно шире, чем нужно:
 * первая версия этого обхода требовала уточнения после существительного
 * («modules deployed»), и голое «27 MODULES» на /pricing/roadmap проскочило.
 */
const SCALE_WORD =
  "(?:product\\s+nodes?|nodes?|modules?|модул\\w*|узл\\w*|МОДУЛ\\w*)";
const NUM_THEN_WORD = new RegExp(`\\b(\\d{2,3})\\s*\\+?\\s+${SCALE_WORD}\\b`, "gi");

describe("заявления о масштабе экосистемы сверены с реестром", () => {
  const total = countRegistryTotal();
  const nodes = total - 1; // globus — оболочка карты, не продуктовый узел

  /**
   * Числа, которые не являются устаревшими:
   *   total  — записей в реестре
   *   nodes  — узлов на карте
   *   live   — живых модулей (считается ниже)
   *   43     — модулей в тарифном реестре (свой список, шире экосистемного)
   * Плюс «N+», пока N не превышает факта: «30+ модулей» при 41 — правда.
   */
  const registrySrc = readFileSync(REGISTRY, "utf8");
  const live = Array.from(registrySrc.matchAll(/status:\s*["']live["']/g)).length;
  const EXACT_OK = new Set([String(total), String(nodes), String(live), "43"]);

  it("реестр читается и не пуст (сам счётчик не должен молча вернуть 0)", () => {
    expect(total).toBeGreaterThan(20);
    expect(live).toBeGreaterThan(10);
  });

  it("ни одно число рядом со словом масштаба не разошлось с реестром", () => {
    const violations: string[] = [];

    for (const file of walk(SRC_ROOT)) {
      const rel = path.relative(SRC_ROOT, file).replace(/\\/g, "/");
      const lines = readFileSync(file, "utf8").split("\n");

      lines.forEach((line, idx) => {
        // Гигантские сгенерированные строки переводов сканируем, но без
        // экстремальных: там одна строка может быть на пол-экрана.
        if (line.length > 900) return;
        if (CHANGELOG_LINE.test(line)) return;
        if (COMMENT_LINE.test(line)) return;
        if (EXPLANATORY_COMMENT.test(line)) return;
        if (/Модуль\s*#\d/.test(line)) return;
        if (ALLOWED.some((a) => line.includes(a.fragment))) return;

        for (const m of line.matchAll(NUM_THEN_WORD)) {
          const num = m[1];
          if (EXACT_OK.has(num)) continue;
          const value = Number(num);
          if (value > 100) continue; // явно не про счёт модулей
          // «N+» — занижение, а не ошибка, пока N не больше факта.
          if (m[0].includes("+") && value <= total) continue;
          violations.push(`${rel}:${idx + 1}  «${m[0].trim()}»`);
        }
      });
    }

    expect(
      violations,
      `Реестр держит ${total} записей (${nodes} узлов на карте, ${live} live), ` +
        `но найдены расходящиеся числа:\n  ${violations.join("\n  ")}\n\n` +
        "Либо поправь число, либо — если оно про что-то другое — впиши его в " +
        "ALLOWED в этом файле С ПРИЧИНОЙ. Молча заглушать нельзя: " +
        "исключение без причины ничем не отличается от бага.",
    ).toEqual([]);
    // 30с, а не дефолтные 5: тест обходит весь src на диске. В одиночку это
    // ~0.4с, но при параллельном прогоне всего набора конкуренция за диск
    // выводила его за лимит — и падение выглядело как найденное расхождение,
    // хотя было таймаутом.
  }, 30_000);
});
