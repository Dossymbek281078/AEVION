import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Событие, объявленное в воронке, обязано кем-то отправляться.
 *
 * Замер 29.08.2026: в `ConstitutionEvent` объявлено 18 событий, слали 11.
 * Из семи нулей четыре безобидны — самой возможности в продукте нет
 * (академии и голосований не существует, так что и мерить нечего). Три были
 * настоящими дырами:
 *
 *   ai_suggest   — платный совет с суточным лимитом aiSuggestPerDay;
 *                  расход шёл, а в воронке его не было вовсе;
 *   embed_view   — виджет грузится в iframe на ЧУЖИХ сайтах, то есть это
 *                  поверхность распространения, и её охват не мерился;
 *   blog_view    — блог открыт людям, верх воронки модуля пустой.
 *
 * Ни одна из трёх дыр не падала и не краснела: словарь и отправители живут в
 * разных файлах, и рассогласование между ними никого не будит.
 *
 * Сторож — храповик: список ниже разрешает ровно те события, у которых
 * возможности НЕТ. Появится возможность — снимите её из списка, и тест
 * потребует отправителя.
 */

const SRC = join(__dirname, "..", "..", "..");
const FUNNEL = join(SRC, "lib", "useFunnel.ts");

/**
 * Событий нет, потому что нет самой возможности. Причина обязательна.
 *
 * 🔴 30.08: список был на три четверти ЛОЖНЫМ, и это опаснее неверного
 * отчёта — прощённый пункт сторож не стережёт. Я писал «академии нет,
 * маршрута /academy не существует», а раздел называется /constitution/learn:
 * искал не то имя. Голосование я в тот же день чинил своими руками.
 */
const NO_FEATURE: Record<string, string> = {
  comment_posted: "комментариев в конституции нет: ни отправки, ни списка",
};

/**
 * ДОЛГ, а не отсутствие: возможность в продукте ЕСТЬ, отправителя нет.
 *
 * Разделено намеренно. «Возможности нет» — состояние продукта, оно может
 * держаться годами. «Отправителя нет» — незаконченная работа, и её надо
 * видеть как работу. Один список на оба смысла превращает долг в норму.
 */
const SENDER_OWED: Record<string, string> = {
  academy_lesson_done: "уроки есть в /constitution/learn, complete() вызывается — замера нет",
  academy_cert: "сертификат выдаётся там же по прохождении всех уроков — замера нет",
  vote_cast: "голосование работает на странице конституции (castVote) — замера нет",
};

function declaredEvents(): string[] {
  const s = readFileSync(FUNNEL, "utf8");
  const start = s.indexOf("export type ConstitutionEvent");
  expect(start, "тип ConstitutionEvent не найден — сторож смотрит не туда").toBeGreaterThan(-1);
  const end = s.indexOf(";", start);
  expect(end, "конец объявления типа не найден").toBeGreaterThan(start);
  const block = s.slice(start, end);
  const out: string[] = [];
  let i = 0;
  for (;;) {
    const a = block.indexOf('"', i);
    if (a < 0) break;
    const b = block.indexOf('"', a + 1);
    if (b < 0) break;
    out.push(block.slice(a + 1, b));
    i = b + 1;
  }
  return out;
}

function productFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      if (n === "node_modules") continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) {
        if (n === "__tests__") continue;
        walk(p);
      } else if (n.endsWith(".ts") || n.endsWith(".tsx")) {
        if (p.endsWith(join("lib", "useFunnel.ts"))) continue;
        out.push(p);
      }
    }
  };
  walk(SRC);
  return out;
}

// Читаем дерево ОДИН раз: обход в каждом it() давал таймаут под нагрузкой.
const EVENTS = declaredEvents();
const FILES = productFiles();
const BODIES = FILES.map((f) => readFileSync(f, "utf8"));

// Три формы записи первого аргумента. Кавычки собраны из кодов символов:
// экранирование обратной кавычки в шаблоне уже один раз молча съело слэш
// на границе вызова, и файл переставал разбираться при зелёном виде.
const DQ = String.fromCharCode(34);
const SQ = String.fromCharCode(39);
const BQ = String.fromCharCode(96);
const QUOTED = {
  some1: (e: string) => DQ + e + DQ,
  some2: (e: string) => SQ + e + SQ,
  some3: (e: string) => BQ + e + BQ,
};

function sendersOf(event: string): number {
  let n = 0;
  for (const s of BODIES) {
    // Вторая форма отправки: серверная страница не может звать хук, поэтому
    // событие уезжает пропом <ConstitutionFunnelPing event="..." />. Считать
    // только вызовы track() значило бы объявить такую страницу неизмеряемой —
    // на этом детектор один раз уже соврал.
    if (s.includes("ConstitutionFunnelPing") && s.includes("event=" + DQ + event + DQ)) {
      n += 1;
    }
    let i = 0;
    for (;;) {
      i = s.indexOf("track(", i);
      if (i < 0) break;
      const arg = s.slice(i + 6, i + 6 + event.length + 2);
      if (arg === QUOTED.some1(event) || arg === QUOTED.some2(event) || arg === QUOTED.some3(event)) n += 1;
      i += 6;
    }
  }
  return n;
}

describe("объявленное событие воронки кто-то отправляет", () => {
  test("контроль: словарь и дерево прочитаны", () => {
    expect(EVENTS.length, "события не разобрались — весь тест был бы пустым").toBeGreaterThan(10);
    expect(FILES.length, "продуктовые файлы не найдены").toBeGreaterThan(100);
  });

  test("контроль: способ УМЕЕТ находить отправителя", () => {
    // Без этого «ноль отправителей» неотличимо от «не умею искать».
    expect(sendersOf("page_view"), "не нахожу даже заведомо живое событие").toBeGreaterThan(0);
  });

  test("у каждого события есть отправитель либо названная причина его не иметь", () => {
    const orphans: string[] = [];
    for (const e of EVENTS) {
      if (sendersOf(e) === 0 && !NO_FEATURE[e] && !SENDER_OWED[e]) orphans.push(e);
    }
    expect(
      orphans,
      `событие объявлено в воронке, но его никто не шлёт: ${orphans.join(", ")}. ` +
        "Либо поставьте отправитель, либо внесите в NO_FEATURE с причиной.",
    ).toEqual([]);
  });

  test("список разрешённых не разросся: в нём только то, чего нет в продукте", () => {
    // Храповик в обратную сторону: событие, у которого ПОЯВИЛСЯ отправитель,
    // обязано уйти из списка, иначе список начнёт прикрывать живые дыры.
    const stale = [...Object.keys(NO_FEATURE), ...Object.keys(SENDER_OWED)].filter((e) => sendersOf(e) > 0);
    expect(stale, `возможность появилась — уберите из NO_FEATURE: ${stale.join(", ")}`).toEqual([]);
    expect(Object.keys(NO_FEATURE).length, "список разрешённых подозрительно велик").toBeLessThan(8);
  });

  test("обе поверхности блога считаются, а не одна", () => {
    // «Хотя бы один отправитель» терпит потерю всех, кроме последнего:
    // мутация убрала замер со СПИСКА постов, а сторож остался зелёным, потому
    // что страница поста ещё слала. Список и пост — разные шаги воронки,
    // поэтому требуем каждый поимённо.
    const pages = [
      join(SRC, "app", "constitution", "blog", "page.tsx"),
      join(SRC, "app", "constitution", "blog", "[slug]", "page.tsx"),
    ];
    for (const p of pages) {
      const body = readFileSync(p, "utf8");
      expect(
        body.includes("ConstitutionFunnelPing") && body.includes("event=" + DQ + "blog_view" + DQ),
        `${p} перестала считать заход — этот шаг воронки станет пустым`,
      ).toBe(true);
    }
  });

  test("три починенные дыры остаются закрытыми", () => {
    for (const e of ["ai_suggest", "embed_view", "blog_view"]) {
      expect(sendersOf(e), `${e} снова никто не шлёт`).toBeGreaterThan(0);
    }
  });
});
