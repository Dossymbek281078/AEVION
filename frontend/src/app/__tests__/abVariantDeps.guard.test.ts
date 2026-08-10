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

/**
 * Массивы зависимостей ТОЛЬКО у `useEffect`.
 *
 * Первая версия брала любой `}, [a, b])` и потому ловила ещё `useCallback` и
 * `useMemo` — а там вариант в зависимостях законен: коллбэк от их смены не
 * выполняется, он лишь пересоздаётся. Проверено на живом коде: в
 * `bank/page.tsx:228` отложенное значение стоит именно в `useCallback`, и это
 * не дефект (issue #1042). Сторож, требующий переписать корректный код, хуже
 * отсутствующего.
 *
 * Границу вызова ищем балансировкой скобок от `useEffect(` — так вложенные
 * `useCallback` внутри эффекта не принимаются за его собственные зависимости.
 */
export function dependencyArrays(source: string): string[] {
  const out: string[] = [];
  const marker = /useEffect\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = marker.exec(source))) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < source.length && depth > 0; i++) {
      const ch = source[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
    }
    if (depth !== 0) continue; // незакрытый вызов — не наше дело
    // Аргументы эффекта: от `useEffect(` до закрывающей скобки. Массив
    // зависимостей — последний `[...]` перед ней.
    const call = source.slice(m.index + m[0].length, i - 1);
    const deps = call.match(/\[([^[\]]*)\]\s*$/);
    if (deps) out.push(deps[1]);
  }
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

describe("A/B-вариант не стоит в зависимостях эффекта", () => {
  const files = collectSourceFiles(APP_DIR);

  it("набор исходников непустой (сам сторож не должен молча проверять ноль файлов)", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => f.includes("pricing"))).toBe(true);
  });

  // 30 с вместо стандартных 5: проверка читает и разбирает все исходники
  // src/app. В одиночку она укладывается в полсекунды, а в полном прогоне
  // конкурирует за диск с полусотней файлов и падает по таймауту примерно
  // раз в три запуска — «зелёный в одиночку, красный в наборе»
  // (feedback_fs_scanning_test_timeout). Случайно краснеющий сторож
  // перестают читать, поэтому лечится время, а не сам сторож.
  it("ни одна страница не ставит вариант в зависимости", () => {
    expect(findVariantDepViolations(files)).toEqual([]);
  }, 30_000);

  it("сторож действительно ловит нарушение (негативный тест)", () => {
    const bad = `
      const heroVariant = useABVariant("hero");
      useEffect(() => { fetch("/api/pricing"); }, [heroVariant]);
    `;
    expect(variantVarNames(bad)).toEqual(["heroVariant"]);
    expect(dependencyArrays(bad)).toEqual(["heroVariant"]);
  });

  // Ложное срабатывание хуже отсутствия сторожа: оно заставит переписать
  // корректный код. Вариант в useCallback/useMemo законен — от их смены
  // ничего не выполняется, коллбэк лишь пересоздаётся (issue #1042,
  // живой пример — bank/page.tsx:228).
  it("useCallback и useMemo НЕ считаются нарушением", () => {
    const ok = `
      const heroVariant = useABVariant("hero");
      const pay = useCallback(() => { track({ v: heroVariant }); }, [heroVariant, other]);
      const label = useMemo(() => heroVariant + "!", [heroVariant]);
    `;
    expect(dependencyArrays(ok)).toEqual([]);
  });

  it("вложенный useCallback внутри эффекта не подменяет его зависимости", () => {
    const src = `
      useEffect(() => {
        const cb = useCallback(() => {}, [inner]);
        run(cb);
      }, [outer]);
    `;
    expect(dependencyArrays(src)).toEqual(["outer"]);
  });

  it("несколько эффектов разбираются по отдельности", () => {
    const src = `
      useEffect(() => { a(); }, []);
      useEffect(() => { b(); }, [x, y]);
    `;
    expect(dependencyArrays(src)).toEqual(["", "x, y"]);
  });
});
