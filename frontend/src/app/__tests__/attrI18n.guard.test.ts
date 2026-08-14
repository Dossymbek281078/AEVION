import { describe, expect, it, beforeAll } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Кириллица в атрибутах `title`, `aria-label`, `placeholder`, `alt` на
 * ПЕРЕВОДИМЫХ страницах.
 *
 * Почему отдельный сторож. Проверка ключей (`i18nKeys.test.ts` у модулей)
 * смотрит на словарь: есть ли ключ во всех локалях и совпадают ли подстановки.
 * Текст, зашитый прямо в атрибут, в словарь не попадает вовсе — то есть мимо
 * той проверки он проходит целиком. Найдено 14.08.2026 на своей же странице
 * QSkyway: `title="Проверить подпись двойника на бэкенде"` жил рядом с
 * полностью переведённым интерфейсом.
 *
 * Цена не косметическая. `aria-label` читает экранный диктор: англоязычный
 * незрячий пользователь слышит русское слово вместо кнопки. Такой дефект не
 * виден ни на одном скриншоте.
 *
 * ГРАНИЦА, которую надо знать. «Страница переводимая» определяется наличием
 * вызова `t("` в файле. Это грубо, но осознанно: без этого фильтра свип даёт
 * 881 место, из которых 872 — на одноязычных страницах (тренажёр сметы и
 * подобные), где русский текст ПРАВИЛЕН. Автоматический список — кандидаты,
 * а не находки; фильтр превращает 881 в 9. Обратная сторона: страница,
 * которую переводят без `t()`, сюда не попадёт.
 */

// Путь от самого файла теста, а не от process.cwd(): при полном прогоне
// достаточно одного теста, сменившего рабочую папку, чтобы сканирование
// ушло не в тот каталог (эти грабли уже ловил qsignClaims.guard).
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

const ATTR = /\b(title|aria-label|placeholder|alt)\s*=\s*"([^"]*[А-Яа-яЁё][^"]*)"/g;
const USES_T = /\bt\(\s*"/;

type Hit = { file: string; attr: string; text: string };

/**
 * Известные случаи в ЧУЖИХ зонах на 14.08.2026 (CyberChess ведётся отдельной
 * сессией, Bank — отдельным фронтендом). Сторож заведён не для того, чтобы
 * молча их простить: список сверяется НА РАВЕНСТВО. Починили — тест скажет
 * «удалите строку», и освобождение не забудется. Исключение, которое живёт
 * вечно, замораживает ровно то, что должно было беречь.
 */
const KNOWN: Hit[] = [
  { file: "bank/page.tsx", attr: "title", text: "Конституция Bank" },
  { file: "cyberchess/AiPersonalityPicker.tsx", attr: "aria-label", text: "Выбор стиля AI" },
  { file: "cyberchess/AntiCheatPanel.tsx", attr: "aria-label", text: "Закрыть" },
  { file: "cyberchess/FideCalibrationPanel.tsx", attr: "aria-label", text: "Закрыть" },
  { file: "cyberchess/matchmaking/page.tsx", attr: "placeholder", text: "Игрок" },
  { file: "cyberchess/replays/page.tsx", attr: "title", text: "Обновить" },
];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectSourceFiles(full));
    else if (/\.(tsx|jsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function scan(files: string[]): Hit[] {
  const hits: Hit[] = [];
  for (const full of files) {
    const text = readFileSync(full, "utf8");
    if (!USES_T.test(text)) continue; // одноязычная страница — русский там правилен
    for (const m of text.matchAll(ATTR)) {
      hits.push({
        file: relative(APP_DIR, full).replace(/\\/g, "/"),
        attr: m[1],
        text: m[2].slice(0, 40),
      });
    }
  }
  return hits;
}

const key = (h: Hit) => `${h.file} [${h.attr}] ${h.text}`;

// Сканирование в beforeAll, а не внутри it(): в одиночку это доли секунды, но
// в полном параллельном прогоне обход полутора тысяч файлов упирался в
// таймаут теста — сторож был зелёным изолированно и красным в наборе.
let files: string[] = [];
let hits: Hit[] = [];
beforeAll(() => {
  files = collectSourceFiles(APP_DIR);
  hits = scan(files);
});

describe("переводимые страницы: кириллица в атрибутах", () => {
  it("сканирует настоящий, непустой набор файлов", () => {
    // Без этого «нарушений нет» верно и при сломанном обходе.
    expect(files.length).toBeGreaterThan(200);
  });

  it("новых мест не появилось", () => {
    const unexpected = hits.filter((h) => !KNOWN.some((k) => key(k) === key(h)));
    expect(
      unexpected.map(key),
      "текст в атрибуте мимо переводов: заведите ключ и позовите t(...)",
    ).toEqual([]);
  });

  it("список известных не протух: всё, что в нём, ещё существует", () => {
    const gone = KNOWN.filter((k) => !hits.some((h) => key(h) === key(k)));
    expect(
      gone.map(key),
      "починено — удалите эти строки из KNOWN, иначе исключение переживёт причину",
    ).toEqual([]);
  });

  it("сторож действительно ловит нарушение (отрицательный контроль)", () => {
    const sample = 'export const X = () => <button aria-label="Закрыть окно">x</button>;\nt("some.key");';
    const found = [...sample.matchAll(ATTR)].map((m) => m[1]);
    expect(USES_T.test(sample)).toBe(true);
    expect(found).toEqual(["aria-label"]);
  });

  it("одноязычная страница не считается нарушением", () => {
    const sample = 'export const X = () => <button title="Закрыть">x</button>;';
    expect(USES_T.test(sample)).toBe(false);
  });
});
