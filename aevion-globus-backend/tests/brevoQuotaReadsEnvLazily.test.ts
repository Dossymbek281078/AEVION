import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Суточный потолок писем читается ПРИ ВЫЗОВЕ, а не при загрузке модуля.
 *
 * Замер 31.08.2026. Было `const DAILY_SOFT_CAP = Number(process.env...) || 300`
 * — значение замерзало в момент первого импорта. Снаружи безобидно, а по сути
 * означает, что поведение модуля зависит от ПОРЯДКА ИМПОРТА, которого никто не
 * контролирует.
 *
 * Как это проявилось. Тесты квоты задают потолок 30 в beforeEach, а первый
 * импорт случался внутри первого теста — то есть после хука, и всё работало по
 * счастливой случайности. Стоило добавить прогрев модулей в beforeAll (обычная
 * мера против таймаута), как модуль взял боевые 300, и три теста перестали
 * видеть тревогу. Ни один прогон до этого о хрупкости не говорил.
 *
 * Почему сторож нужен именно здесь. Свип по 62 чтениям окружения в src дал
 * ровно ОДИН такой случай: остальной код объявляет их стрелками
 * (`GUMROAD_TOKEN`, `isProd`). То есть заморозка тут была отклонением от
 * общего правила, и вернуть её обратно легко — строка выглядит нормально.
 *
 * Цена возврата не в тестах: потолок, прочитанный один раз при старте, не
 * заметит смены переменной в сервисе. Подняли квоту у поставщика, поменяли
 * значение — сервис продолжит предупреждать по старому числу до перезапуска.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const QUOTA = join(HERE, "..", "src", "lib", "brevoQuota.ts");

/** Строки кода без комментариев: упоминание в пояснении — не объявление. */
function codeOnly(text: string): string {
  return text
    .split(String.fromCharCode(10))
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join(String.fromCharCode(10));
}

describe("потолок писем не замораживается при загрузке модуля", () => {
  const code = codeOnly(readFileSync(QUOTA, "utf8"));

  test("контроль: файл прочитан и потолок в нём вообще есть", () => {
    // Иначе «заморозки нет» означало бы «я читаю не тот файл».
    expect(code.length, "файл пуст или не прочитан").toBeGreaterThan(300);
    expect(code, "переменная потолка исчезла — сторож стережёт пустоту").toContain(
      "BREVO_DAILY_SOFT_CAP",
    );
  });

  test("значение потолка не присваивается константе на верхнем уровне", () => {
    // Признак заморозки: объявление верхнего уровня, где справа СРАЗУ значение
    // из окружения. Стрелка (`= () =>`) под этот признак не попадает — она и
    // есть правильная форма.
    const frozen = code
      .split(String.fromCharCode(10))
      .filter((l) => l.startsWith("const ") && l.includes("process.env.BREVO_DAILY_SOFT_CAP"))
      .filter((l) => !l.includes("=>"));
    expect(
      frozen,
      "потолок снова читается при загрузке: поведение модуля станет зависеть от " +
        "порядка импорта, а смена переменной в сервисе не подействует до перезапуска",
    ).toEqual([]);
  });

  test("контроль: признак заморозки умеет срабатывать", () => {
    // Отрицательная сторона — пробой с заранее известным ответом, а не
    // существованием дефекта в репозитории: иначе после починки контроль
    // краснел бы именно потому, что чинить больше нечего.
    const frozenSample = 'const DAILY_SOFT_CAP = Number(process.env.BREVO_DAILY_SOFT_CAP) || 300;';
    const lazySample = 'const dailySoftCap = () => Number(process.env.BREVO_DAILY_SOFT_CAP) || 300;';
    const looksFrozen = (l: string) =>
      l.startsWith("const ") && l.includes("process.env.BREVO_DAILY_SOFT_CAP") && !l.includes("=>");
    expect(looksFrozen(frozenSample), "признак не видит заморозку").toBe(true);
    expect(looksFrozen(lazySample), "признак считает заморозкой правильную форму").toBe(false);
  });
});
