import { describe, expect, test } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Магазин честно говорит, чем можно заплатить.
 *
 * Замер 29.08.2026: настроены только lemonsqueezy и gumroad, а они берут карты
 * через Stripe — карты РФ там не проходят (записано ещё 14.08 замером из
 * Астаны). При этом НИ ОДНА страница воронки об этом не предупреждала, хотя
 * /pricing умеет: там ответ ручки решает, какую подпись показать. Человек
 * доходил до кассы и упирался в стену молча.
 *
 * Сторож стережёт две противоположные ошибки сразу:
 *   • подпись исчезла — человек снова упрётся без предупреждения;
 *   • подпись выводится БЕЗУСЛОВНО — тогда она соврёт в другую сторону, как
 *     только PayBox настроят, и будет отпугивать платящих.
 *
 * ⚠️ Почему сторож смотрит НЕ ТОЛЬКО в page.tsx (переписано 29.08.2026).
 *
 * Первая версия читала один файл и требовала признаки внутри него. Это
 * закрепляло РАСПОЛОЖЕНИЕ кода, а не способность магазина предупредить: перенос
 * той же логики в компонент делал сторожа красным при полностью сохранённом
 * поведении. Ровно это и случилось — предупреждение переехало в
 * PaymentReachNotice.tsx, признаков в странице стало ноль из четырёх, а человек
 * при этом видел то же самое.
 *
 * Красное, которое не является поломкой, опаснее отсутствия проверки: рядом с
 * ним тонет настоящая находка. Поэтому проверяется ПОВЕРХНОСТЬ страницы —
 * сама страница плюс те её собственные компоненты, которые она отрисовывает.
 * Признак может лежать где угодно внутри этой поверхности; исчезнуть из неё
 * целиком он не может, не унеся с собой предупреждение.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, "..", "page.tsx");
const SRC = resolve(HERE, "..", "..", "..");

/** Расширения, которыми в этом проекте оканчиваются наши собственные модули. */
const TRIES = [".tsx", ".ts", "/index.tsx", "/index.ts"];

/** Наш ли это модуль: пакеты из node_modules нас не интересуют. */
function isLocal(spec: string): boolean {
  return spec.startsWith("@/") || spec.startsWith("./") || spec.startsWith("../");
}

function resolveLocal(fromFile: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? join(SRC, spec.slice(2))
    : resolve(dirname(fromFile), spec);
  for (const ext of TRIES) {
    const candidate = base + ext;
    if (existsSync(candidate)) return candidate;
  }
  return existsSync(base) ? base : null;
}

function importsOf(source: string): string[] {
  const out: string[] = [];
  for (const line of source.split("\n")) {
    const m = /^\s*import[^"']*["']([^"']+)["']/.exec(line);
    if (m && isLocal(m[1])) out.push(m[1]);
  }
  return out;
}

/**
 * Поверхность = страница и её собственные модули, на два уровня вглубь.
 * Двух уровней хватает: страница → компонент → его помощник. Глубже уходить
 * незачем, а обход всего графа притащил бы половину приложения и сделал бы
 * проверку неотличимой от «где-то в проекте такая строка есть».
 */
function surfaceOf(entry: string, maxDepth = 2): Map<string, string> {
  const seen = new Map<string, string>();
  const walk = (file: string, depth: number) => {
    if (seen.has(file) || depth > maxDepth) return;
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      return;
    }
    seen.set(file, text);
    for (const spec of importsOf(text)) {
      const target = resolveLocal(file, spec);
      if (target) walk(target, depth + 1);
    }
  };
  walk(entry, 0);
  return seen;
}

describe("магазин честен про способы оплаты", () => {
  const files = surfaceOf(PAGE);
  const surface = [...files.values()].join("\n");
  const names = [...files.keys()].map((f) => f.replace(SRC, "").replace(/\\/g, "/"));

  test("контроль: страница прочиталась", () => {
    const page = files.get(PAGE) ?? "";
    expect(page.length).toBeGreaterThan(1000);
  });

  test("контроль охвата: поверхность шире одной страницы", () => {
    // Без этого контроля поломка разбора импортов молча схлопнула бы сторожа
    // обратно в «читаю один файл» — и он снова краснел бы на переносе.
    // У страницы магазина собственных импортов трижды по три (BuyLink,
    // apiBase/PaymentReachNotice, PageTracking), поэтому 3 — не круглое число,
    // а замер.
    expect(names.length, `прочитано: ${names.join(", ")}`).toBeGreaterThanOrEqual(3);
  });

  test("магазин спрашивает сервер о состоянии касс", () => {
    expect(surface, `поверхность: ${names.join(", ")}`).toContain(
      "/api/pricing/checkout/healthz",
    );
    expect(surface).toMatch(/providers\??\.\s*paybox/);
  });

  test("подпись показывается ТОЛЬКО когда провайдер точно выключен", () => {
    // Строго false, а не «не true»: при неизвестном состоянии (ручка не
    // ответила) утверждать про чужие карты нельзя — молчание честнее догадки.
    // Обе записи выражают одно: показать при false, промолчать при null.
    //   • kztReady === false  — условие показа
    //   • kztReady !== false  — ранний выход, «не показывать»
    const strictlyFalse =
      /kztReady\s*===\s*false/.test(surface) || /kztReady\s*!==\s*false/.test(surface);
    expect(strictlyFalse, `поверхность: ${names.join(", ")}`).toBe(true);
  });

  test("состояние не додумывается: неизвестное остаётся неизвестным", () => {
    // Начальное значение обязано быть null. Заменят на false — подпись начнёт
    // показываться всем, включая случаи, когда ручка просто не ответила.
    const startsUnknown =
      /useState<\s*boolean\s*\|\s*null\s*>\(\s*null\s*\)/.test(surface) ||
      /kztReady:\s*boolean\s*\|\s*null\s*=\s*null/.test(surface);
    expect(startsUnknown, `поверхность: ${names.join(", ")}`).toBe(true);
  });
});
