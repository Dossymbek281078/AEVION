import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Где можно заплатить — там же сказано, чем платить нельзя.
 *
 * Замер 29.08.2026 на живом проде: настроены только Lemon Squeezy и Gumroad,
 * оба берут карты через Stripe. PayBox (тенге) и PayPal — НЕ настроены,
 * проверено ручкой `/api/pricing/checkout/healthz`. Покупатель, у которого нет
 * подходящей карты, доходит до кассы и упирается в стену.
 *
 * Две поверхности об этом предупреждают:
 *   /shop     — компонентом PaymentReachNotice
 *   /pricing  — своим блоком (payboxLive → kztNote / kztFallbackNote)
 *
 * Ещё пять продают ровно так же и молчат. Стена у покупателя одна и та же
 * независимо от того, с какой страницы он нажал.
 *
 * ⚠️ Здесь ХРАПОВИК, а не запрет: пять страниц правят прямо сейчас чужие ветки
 * (проверено `aevion-claim.mjs --file`: у /go девятнадцать коммитов в трёх
 * ветках). Лезть туда — значит затереть чужую работу ради одной строки.
 * Поэтому известные случаи записаны поимённо и ждут своей очереди, а любая
 * НОВАЯ страница с кнопкой покупки и без предупреждения красит сборку сразу.
 *
 * Список обязан сокращаться: отдельная проверка требует, чтобы в нём не
 * осталось уже починенного.
 *
 * ЗНАМЕНАТЕЛЬ ПРОВЕРКИ, названный намеренно. В ту же ночь я подал основателю
 * находку со словами «этого нет НИГДЕ», просмотрев только своё дерево, — а
 * соседнее окно починило её тремя часами раньше. Верное наблюдение, неверный
 * вывод: свип отвечает не «есть ли это в проекте», а «есть ли это в том, что я
 * просмотрел».
 *
 * Поэтому здесь сказано прямо: пять страниц молчат не только у меня. Проверено
 * поимённо в четырёх ветках — `launch/2026-08-30`,
 * `deploy/startupx-merged-2026-08-29`, `deliver/site-500-and-i18n-2026-08-28`,
 * `feat/funnel-upsell-allaccess` (обе линии прода среди них): признаков
 * предупреждения ноль в каждой. Контроль прибора: у витрины в той же
 * `launch/2026-08-30` их два — значит поиск видит нужную форму.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");

/** Ждут своей очереди; правятся чужими ветками. Список только сокращается. */
const KNOWN_SILENT = [
  "en/go/page.tsx",
  "en/longevity/page.tsx",
  "go/page.tsx",
  "longevity/_client.tsx",
  "qrenew/_client.tsx",
];

/**
 * Админские и служебные страницы: там покупает не покупатель, а мы сами.
 * Предупреждение о способах оплаты им не адресовано.
 */
const NOT_A_BUYER_SURFACE = ["pricing/admin/page.tsx"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "__tests__" || entry === "node_modules") continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

const rel = (p: string) => relative(APP, p).split(sep).join("/");

/** Страницы, с которых человек может заплатить. */
function sellingPages(): string[] {
  return walk(APP)
    .filter((p) => readFileSync(p, "utf8").includes("<BuyLink"))
    .map(rel)
    .filter((r) => !NOT_A_BUYER_SURFACE.includes(r));
}

/** Предупреждает ли страница о способах оплаты — сама или компонентом. */
function warns(relPath: string): boolean {
  const text = readFileSync(join(APP, relPath), "utf8");
  return text.includes("PaymentReachNotice") || text.includes("kztReady") || text.includes("payboxLive");
}

describe("страница, с которой платят, предупреждает о способах оплаты", () => {
  const selling = sellingPages();
  const silent = selling.filter((p) => !warns(p));

  test("контроль: страницы с кнопкой покупки найдены", () => {
    // Пустой список сделал бы проверки ниже зелёными при любом состоянии сайта.
    expect(selling.length, `найдено: ${selling.join(", ")}`).toBeGreaterThanOrEqual(3);
  });

  test("контроль: способ различает предупреждающую страницу и молчащую", () => {
    // Без этого «все предупреждают» могло бы значить «признак совпадает везде».
    expect(warns("shop/page.tsx"), "витрина предупреждает, а способ этого не видит").toBe(true);
    expect(silent.length, "ни одной молчащей — тогда храповик ниже пуст и бессмыслен")
      .toBeGreaterThan(0);
  });

  test("новых молчащих страниц нет", () => {
    const fresh = silent.filter((p) => !KNOWN_SILENT.includes(p));
    expect(
      fresh,
      `с этой страницы платят, а о недоступных способах оплаты молчат: ${fresh.join(", ")}`,
    ).toEqual([]);
  });

  test("храповик не протух: всё, что в списке, всё ещё молчит", () => {
    const stale = KNOWN_SILENT.filter((p) => !silent.includes(p));
    expect(stale, `уже предупреждают, убрать из списка: ${stale.join(", ")}`).toEqual([]);
  });
});
