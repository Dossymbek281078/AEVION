import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Сторож: значение от `useABVariant` не должно стоять в зависимостях эффекта.
 *
 * `useABVariant` отдаёт заглушку из `DEFAULT_VARIANTS` на первом рендере и
 * настоящее значение из куки уже после mount — точно так же, как `lang` в
 * i18n. Любой `useEffect` с вариантом в зависимостях выполняется ДВАЖДЫ у
 * каждого, кому выпал не дефолтный вариант.
 *
 * Замерено на проде 27.07 (issue #1016): на `/pricing` так уходило по два
 * запроса `pricing`, `pricing/promo`, `pricing/testimonials`, `pricing/trust`
 * и, что хуже, по две копии событий воронки — `page_view` и `ab_assigned`.
 * Аналитика показывала вдвое больше просмотров, чем было.
 *
 * Правильный способ прочитать вариант внутри эффекта — `getAllVariants()`:
 * он читает куку синхронно и не требует второго рендера.
 */

const APP_DIR = join(process.cwd(), "src", "app");

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Имена переменных, присвоенных из useABVariant(...). */
export function variantVarNames(source: string): string[] {
  const names: string[] = [];
  const re = /const\s+([A-Za-z_$][\w$]*)\s*=\s*useABVariant\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) names.push(m[1]);
  return names;
}

/** Массивы зависимостей вида `}, [a, b]);` — то, что React сравнивает между рендерами. */
export function dependencyArrays(source: string): string[] {
  const out: string[] = [];
  const re = /\}\s*,\s*\[([^\]]*)\]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) out.push(m[1]);
  return out;
}

export function findVariantDepViolations(files: string[]): string[] {
  const violations: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const names = variantVarNames(text);
    if (names.length === 0) continue;
    for (const deps of dependencyArrays(text)) {
      for (const name of names) {
        if (new RegExp(`\\b${name}\\b`).test(deps)) {
          violations.push(
            `${file.replace(APP_DIR, "src/app")} — «${name}» в зависимостях [${deps.trim()}]: ` +
              `эффект выполнится дважды. Читайте вариант через getAllVariants() внутри эффекта.`
          );
        }
      }
    }
  }
  return violations;
}

// Скан вынесен на загрузку модуля. Внутри it() он падал по таймауту в полном
// прогоне, оставаясь зелёным в одиночку: 28.07.2026 в src/app добавилось 305
// layout-файлов практикума, и 5 секунд перестало хватать. Красный от нагрузки
// неотличим от настоящей находки — см. feedback_fs_scanning_test_timeout.
const FILES = collectSourceFiles(APP_DIR);
const VIOLATIONS = findVariantDepViolations(FILES);

describe("A/B-вариант не стоит в зависимостях эффекта", () => {
  it("набор исходников непустой (сам сторож не должен молча проверять ноль файлов)", () => {
    expect(FILES.length).toBeGreaterThan(50);
    expect(FILES.some((f) => f.includes("pricing"))).toBe(true);
  });

  it("ни одна страница не ставит вариант в зависимости", () => {
    expect(VIOLATIONS).toEqual([]);
  });

  it("сторож действительно ловит нарушение (негативный тест)", () => {
    const bad = `
      const heroVariant = useABVariant("hero");
      useEffect(() => { fetch("/api/pricing"); }, [heroVariant]);
    `;
    expect(variantVarNames(bad)).toEqual(["heroVariant"]);
    expect(dependencyArrays(bad)).toEqual(["heroVariant"]);
  });
});
