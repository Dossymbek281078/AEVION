import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

/**
 * Каждый ключ `t("…")` должен быть в ТОМ словаре, из которого берётся этот `t`.
 *
 * ЗАЧЕМ. Глобальный `t()` при отсутствии ключа падает на САМ КЛЮЧ:
 * `tbl[lang]?.[key] || tbl["en"]?.[key] || key`. Пропущенный ключ не даёт ни
 * ошибки, ни пустого места — на кнопке появляется `mc.panel.editor.save`.
 * 28.07 таких нашлось 23, из них 22 на главной странице мультичата (кнопки
 * сохранить/сбросить/отменить/отправить, редактор промта, экспорт, пустое
 * состояние, aria-подписи). Обычные тесты этого не видят: строка есть, рендер
 * не падает.
 *
 * ПОЧЕМУ СНАЧАЛА НАДО ОПРЕДЕЛИТЬ СЛОВАРЬ. Первая, наивная версия этой проверки
 * сверяла все `t("…")` с глобальным словарём и выдала 332 «отсутствующих» ключа —
 * почти всё ложные срабатывания. Словарей в проекте не один, а минимум три:
 *   - глобальный `src/lib/i18n-data.ts` (через `useI18n`);
 *   - свой у CyberChess `src/app/cyberchess/i18n.ts` (через `useCcI18n`);
 *   - локальный `STR` со своей функцией `t(key, lang, vars)` в
 *     `src/app/healthai/_client.tsx`.
 * После учёта источника осталось 23 настоящих. Ложное срабатывание здесь особенно
 * дорого: оно заставило бы «починить» ключи, которые уже переведены в другом
 * словаре.
 */

const SRC = path.resolve(__dirname, "../..");
const GLOBAL_DICT = path.join(SRC, "lib", "i18n-data.ts");
const CC_DICT = path.join(SRC, "app", "cyberchess", "i18n.ts");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__tests__" || entry === ".next") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\./.test(entry)) out.push(full);
  }
  return out;
}

/** Ключи словаря: строки вида `"ключ": "значение"`. */
export function dictKeys(file: string): Set<string> {
  const src = readFileSync(file, "utf8");
  return new Set(Array.from(src.matchAll(/"([^"\s][^"]*)":\s*"/g), (m) => m[1]));
}

type Resolution = "global" | "cyberchess" | "local" | "unknown";

/** Из какого словаря берётся `t` в этом файле. */
export function resolveDict(source: string): Resolution {
  if (/useCcI18n/.test(source)) return "cyberchess";
  // Признак должен отвечать на вопрос «откуда берётся ИМЕННО вызываемый t»,
  // а не «упоминается ли i18n в файле». Два промаха, оба проверены фактом:
  //
  // 1. `const t = (` — слишком широко: в `planet/page.tsx` так объявлена обычная
  //    переменная (`const t = (sp.get("type") || …)`), и файл ошибочно считался
  //    «локальным», из-за чего 46 его ключей не сверялись НИ С ЧЕМ. Ложный
  //    пропуск у сторожа опаснее ложного срабатывания: он не мешает, он молчит.
  // 2. «сначала глобальный, если есть импорт i18n» — тоже неверно:
  //    `healthai/_client.tsx` импортирует `useI18n` (для языка) И объявляет свою
  //    `function t(key, lang, vars)` со своим набором строк. При таком порядке он
  //    попал в глобальную проверку и дал 182 ложных нарушения.
  //
  // Верный признак — деструктуризация `const { t } = useI18n()`: именно она
  // вводит в файл глобальный `t`.
  if (/\{\s*[^}]*t[^}]*\}\s*=\s*useI18n\(/.test(source)) return "global";
  // Своя функция t с собственным набором строк.
  if (/^\s*function t\(/m.test(source)) return "local";
  if (/from "@\/lib\/i18n"/.test(source)) return "global";
  return "unknown";
}

/**
 * Ключи словаря, объявленного В САМОМ файле:
 * `const STR: Record<string, Record<Lang, string>> = { ключ: { ru, en, kk } }`.
 *
 * Нужен, чтобы не оставлять исключений. Единственный такой файл —
 * `healthai/_client.tsx`, и его `t` тоже падает на ключ
 * (`STR[key]?.[lang] ?? key`), то есть пропуск виден на экране так же, как у
 * глобального. Границы объявления берутся балансировкой фигурных скобок; ключи —
 * с верхнего уровня блока (отступ ровно два пробела).
 *
 * Возвращает `null`, если объявление не найдено или скобки не сбалансированы, —
 * тогда файл честно уходит в `skipped`, а не проверяется чужим словарём.
 */
export function localDictKeys(source: string): Set<string> | null {
  const decl = /const\s+[A-Za-z_][A-Za-z0-9_]*\s*:\s*Record<[^=]*=\s*\{/.exec(source);
  if (!decl) return null;
  const open = source.indexOf("{", decl.index);
  let depth = 0;
  let i = open;
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) return null;
  const block = source.slice(open, i + 1);
  const keys = Array.from(block.matchAll(/\n {2}"?([A-Za-z0-9_.]+)"?\s*:\s*\{/g), (m) => m[1]);
  return keys.length ? new Set(keys) : null;
}

export function findMissingKeys(files: string[]): {
  violations: string[];
  scanned: number;
  resolved: number;
  skipped: number;
} {
  const dicts: Record<string, Set<string>> = {
    global: dictKeys(GLOBAL_DICT),
    cyberchess: dictKeys(CC_DICT),
  };
  const violations: string[] = [];
  let scanned = 0;
  let resolved = 0;
  let skipped = 0;

  for (const file of files) {
    scanned++;
    if (file === GLOBAL_DICT || file === CC_DICT) continue;
    const src = readFileSync(file, "utf8");
    const used = new Set(Array.from(src.matchAll(/\bt\(\s*"([^"]+)"/g), (m) => m[1]));
    if (used.size === 0) continue;
    const where = resolveDict(src);
    let dict = dicts[where];
    if (where === "local") {
      // Не пропускаем: словарь лежит в самом файле и проверяется им же.
      const own = localDictKeys(src);
      if (!own) { skipped++; continue; }
      dict = own;
    }
    if (!dict) {
      // unknown — источник `t` не распознан. Проверять его глобальным словарём
      // нельзя: это дало бы ложные срабатывания на чужих ключах.
      skipped++;
      continue;
    }
    resolved++;
    const rel = path.relative(SRC, file).replace(/\\/g, "/");
    for (const key of used) {
      if (!dict.has(key)) violations.push(`${rel}  [${where}]  ${key}`);
    }
  }
  return { violations, scanned, resolved, skipped };
}

describe("ключи i18n есть в своём словаре", () => {
  const files = walk(SRC);

  it("словари и обход не пусты — иначе проверка молча ничего не сверяет", () => {
    // Пороги ЗАМЕРЕНЫ 28.07, а не прикинуты: глобальный словарь — 7283
    // уникальных ключа, cyberchess — 166 (это один набор на три языка, ключи
    // повторяются). Первую версию я написал «> 200» по догадке, и она упала на
    // 166 — порог из головы проверяет фантазию автора, а не код.
    expect(dictKeys(GLOBAL_DICT).size).toBeGreaterThan(5000);
    expect(dictKeys(CC_DICT).size).toBeGreaterThan(100);
    const { scanned, resolved } = findMissingKeys(files);
    expect(scanned, "обход дерева вернул слишком мало файлов").toBeGreaterThan(500);
    expect(resolved, "ни один файл не сопоставлен со словарём — сломан resolveDict").toBeGreaterThan(50);
  });

  it("ни один используемый ключ не отсутствует в своём словаре", () => {
    const { violations } = findMissingKeys(files);
    expect(
      violations,
      `Эти ключи используются в коде, но их нет в словаре — на экран выведется САМ КЛЮЧ ` +
        `(t() падает на ключ):\n  ${violations.join("\n  ")}\n\n` +
        "Добавьте их в соответствующий словарь. Если строка не должна переводиться — " +
        "не оборачивайте её в t().",
    ).toEqual([]);
  });

  it("файл со своей функцией t ПРОВЕРЯЕТСЯ своим словарём, а не пропускается", () => {
    // Без этой проверки поддержка локальных словарей осталась бы мёртвым кодом:
    // тест выше был бы зелёным и при полном пропуске файла.
    const healthai = path.join(SRC, "app", "healthai", "_client.tsx");
    const src = readFileSync(healthai, "utf8");
    expect(resolveDict(src), "healthai должен опознаваться как локальный").toBe("local");
    const own = localDictKeys(src);
    expect(own, "локальный словарь healthai не разобран").not.toBeNull();
    // Замерено 28.07: 236 объявленных ключей при 182 используемых.
    expect(own!.size).toBeGreaterThan(200);
    expect(own!.has("bmi")).toBe(true);
    // И он действительно попадает в проверку, а не в skipped.
    const { violations, resolved, skipped } = findMissingKeys([healthai]);
    expect(resolved, "файл ушёл в skipped вместо проверки").toBe(1);
    expect(skipped).toBe(0);
    expect(violations).toEqual([]);
  });

  it("сторож ловит отсутствующий ключ (негативная проверка)", () => {
    const tmp = path.join(SRC, "app", "__fixture_i18n_missing.tsx");
    writeFileSync(
      tmp,
      'import { useI18n } from "@/lib/i18n";\n' +
        'export default function X() { const { t } = useI18n(); return <b>{t("нет.такого.ключа.28.07")}</b>; }\n',
      "utf8",
    );
    try {
      const { violations } = findMissingKeys([tmp]);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain("нет.такого.ключа.28.07");
      expect(violations[0]).toContain("[global]");
    } finally {
      rmSync(tmp, { force: true });
    }
  });

  it("файл со СВОИМ словарём не проверяется глобальным — защита от ложных срабатываний", () => {
    // Ровно то, из-за чего наивная версия дала 332 ложных находки.
    const tmp = path.join(SRC, "app", "__fixture_i18n_local.tsx");
    writeFileSync(
      tmp,
      "function t(key: string) { return ({ local_only: \"Местная строка\" } as Record<string, string>)[key] ?? key; }\n" +
        'export default function X() { return <b>{t("local_only")}</b>; }\n',
      "utf8",
    );
    try {
      const { violations, skipped } = findMissingKeys([tmp]);
      expect(violations).toEqual([]);
      expect(skipped).toBe(1);
    } finally {
      rmSync(tmp, { force: true });
    }
  });
}, 30_000);
