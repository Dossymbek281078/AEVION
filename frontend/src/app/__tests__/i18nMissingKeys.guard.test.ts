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
  // Своя функция t в файле — свой набор строк, глобальным словарём не проверяется.
  if (/^\s*function t\(/m.test(source) || /const t = \(/.test(source)) return "local";
  if (/useI18n|from "@\/lib\/i18n"/.test(source)) return "global";
  return "unknown";
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
    const dict = dicts[where];
    if (!dict) {
      // local / unknown — свой набор строк, глобальным словарём не проверяется.
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
