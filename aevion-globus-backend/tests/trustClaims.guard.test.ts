import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Сторож публичных счётчиков бэкенда — 10.08.2026.
 *
 * ЗАЧЕМ. `data/trust.ts` отдаётся наружу (`/api/pricing/trust`) и печатал
 * «Модулей платформы: 27», когда в реестре `data/projects.ts` было уже 41.
 * Фронтовый `scaleClaims.guard` ловит ровно такие расхождения, но он
 * сканирует только `frontend/src` — до бэкендовых файлов не достаёт, и это
 * число прожило там незамеченным.
 *
 * Здесь закрывается та же дыра со стороны бэкенда: счёт читается из реестра,
 * а не сравнивается с другой константой. Сравнение константы с константой
 * зелёное всегда — именно так «27» и пережило рост реестра.
 */

const SRC = path.resolve(__dirname, "../src");
const REGISTRY = path.join(SRC, "data/projects.ts");
const TRUST = path.join(SRC, "data/trust.ts");

/** Записей в реестре модулей. */
function registryEntries(): number {
  const src = readFileSync(REGISTRY, "utf8");
  return Array.from(src.matchAll(/status:\s*["'](\w+)["']/g)).length;
}

/**
 * Публичный счёт продуктовых узлов = записи реестра минус оболочка карты
 * `globus`. Та же арифметика, что в frontend/src/data/pitchFacts.ts —
 * дублировать её тут приходится потому, что фронт и бэк собираются
 * раздельно и общего импорта между ними нет.
 */
const MAP_SHELL_ENTRIES = 1;

describe("data/trust.ts — публичные счётчики не расходятся с реестром", () => {
  test("счёт модулей равен записям реестра минус оболочка карты", () => {
    const expected = registryEntries() - MAP_SHELL_ENTRIES;
    const trust = readFileSync(TRUST, "utf8");
    const m = trust.match(/label:\s*"Модулей платформы",\s*value:\s*"(\d+)"/);
    expect(m, 'В trust.ts не найдена строка "Модулей платформы" — её переименовали?').toBeTruthy();
    expect(
      Number(m![1]),
      `В projects.ts сейчас ${registryEntries()} записей, значит публичный счёт — ` +
        `${expected}. Это число отдаётся наружу на /api/pricing/trust.`,
    ).toBe(expected);
  });

  test("подпись не ссылается на несуществующий тариф", () => {
    // `business` — deprecated-алиас без объекта в TIERS: он остался только для
    // старых вебхуков. Публичная подпись, обещающая «всё в одной подписке на
    // Business», отправляет покупателя за тарифом, которого нет в прайсе.
    const trust = readFileSync(TRUST, "utf8");
    const line = trust.split("\n").find((l) => l.includes('label: "Модулей платформы"')) ?? "";
    expect(
      /Business/i.test(line),
      `Подпись счётчика модулей ссылается на тариф Business, которого нет в TIERS ` +
        `(см. data/pricing.ts). Все продукты в одной подписке — это Full.`,
    ).toBe(false);
  });
});

/**
 * Отставные цены тарифов в ПУБЛИЧНЫХ данных бэкенда.
 *
 * Фронтовый `retiredPrices.guard` делает ровно это по frontend/src и по той же
 * причине не видит `src/data/*.ts`, хотя эти файлы отдаются наружу. Здесь —
 * та же проверка со стороны бэкенда, на тот же короткий список из четырёх
 * отставных цен (19 / 29 / 49 / 149.99 — репрайсинг 22.07.2026).
 */
const PUBLIC_DATA = ["data/trust.ts", "data/cases.ts", "data/changelog.ts", "data/roadmap.ts"];

/**
 * Законные вхождения — с причиной, иначе это просто заглушённый сторож.
 *
 * Отзывы клиентов правке НЕ подлежат: цитата подписана именем человека, и
 * переписать в ней цену — значит подделать отзыв. Поэтому они здесь, а не
 * «исправлены»: сторож фиксирует, что про них знают, и оставляет решение
 * основателю (реальные это отзывы или демо — и что с ними делать).
 */
const ALLOWED_BACKEND: Array<{ fragment: string; reason: string }> = [
  {
    fragment: "Теперь всё под одним аккаунтом за $19/мес",
    reason: "цитата отзыва в trust.ts — правка = подделка отзыва, ждёт решения основателя",
  },
  {
    fragment: "дал нам это за $19/мес",
    reason: "цитата кейса в cases.ts — то же самое",
  },
];

/** Запись чейнджлога описывает, что произошло ТОГДА. «Lite $19→$24» — правда. */
const CHANGELOG_ENTRY = /→\s*\$|kind:\s*"changed"/;

describe("публичные данные бэкенда не печатают отставные цены тарифов", () => {
  test("сплошной обход data/*.ts не находит ни одной", () => {
    const re = /\$(19|29|49|149\.99)(?![\d.,]*[\dBMKbmk])/g;
    const violations: string[] = [];

    for (const rel of PUBLIC_DATA) {
      const abs = path.join(SRC, rel);
      let content: string;
      try {
        content = readFileSync(abs, "utf8");
      } catch {
        continue; // файл переименовали — это не задача этого сторожа
      }
      content.split("\n").forEach((line, idx) => {
        re.lastIndex = 0;
        if (!re.test(line)) return;
        if (CHANGELOG_ENTRY.test(line)) return;
        if (ALLOWED_BACKEND.some((a) => line.includes(a.fragment))) return;
        violations.push(`${rel}:${idx + 1}  «${line.trim().slice(0, 110)}»`);
      });
    }

    expect(
      violations,
      "Отставные цены тарифов (19/29/49/149.99 — репрайсинг 22.07.2026) в публичных " +
        "данных бэкенда:\n  " + violations.join("\n  ") +
        "\n\nЖивые цены — в data/pricing.ts. Если это законное вхождение, впиши его " +
        "в ALLOWED_BACKEND С ПРИЧИНОЙ.",
    ).toEqual([]);
  });

  test("список исключений не протух", () => {
    const corpus = PUBLIC_DATA.map((rel) => {
      try {
        return readFileSync(path.join(SRC, rel), "utf8");
      } catch {
        return "";
      }
    }).join("\n");
    const dead = ALLOWED_BACKEND.filter((a) => !corpus.includes(a.fragment)).map((a) => a.fragment);
    expect(
      dead,
      `Эти исключения больше ни на что не указывают — удали их:\n  ${dead.join("\n  ")}`,
    ).toEqual([]);
  });
});
