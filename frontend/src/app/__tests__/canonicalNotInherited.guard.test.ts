import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Страница не должна молча наследовать canonical родителя.
 *
 * ЗАЧЕМ. В Next метаданные сливаются сверху вниз: canonical, заданный в макете
 * раздела, достаётся всем дочерним страницам, которые не объявили свой. Такая
 * страница говорит поисковику «я копия, индексируй родителя вместо меня».
 * Ошибки при этом нет: сборка проходит, тесты зелёные, страница просто
 * исчезает из поиска.
 *
 * Проверено пробой ЖИВОГО прода 30.08.2026, а не по коду:
 *   /payments/api      canonical https://aevion.app/payments
 *   /bank/leaderboard  canonical https://aevion.app/bank
 *   /awards/results    canonical https://aevion.app/awards
 * Контроль: /pricing со своим canonical отвечает правильно — проба различает.
 *
 * ПОЧЕМУ ИЩЕМ ИМЕННО "canonical:" С ДВОЕТОЧИЕМ, а не слово. Первая версия искала
 * слово и была ПУСТОЙ: рядом с каждым добавленным canonical стоит комментарий,
 * объясняющий, зачем он нужен, и слово находилось в нём. Мутация (убрать
 * настоящий ключ, оставить пояснение) проходила незамеченной. Двоеточие
 * отличает ключ объекта от прозы: в коде 164 файла, со словом вообще 186.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const KEY = "canonical:";

/** Страницы, наследующие чужой canonical на 30.08.2026. ХРАПОВИК: список
 *  заморожен, чтобы ловить НОВЫЕ случаи, пока эти разбирают поштучно. Часть
 *  из них, вероятно, законна — служебным адресам вроде auth/success и
 *  страницам с идентификатором в пути место в поиске не нужно. Вычёркивать
 *  отсюда можно, только починив или назвав причину. */
//
// РАЗБОР СПИСКА на 30.08.2026, чтобы следующий не считал заново:
//   29 динамических (идентификатор в пути) — в поиске не нужны, это записи;
//    5 служебных (вход, ящик, настройки, админка, экраны после действия);
//    5 публичных — вот их и стоит разбирать.
// Из семи публичных сразу отпадает `pricing/paddle`: это страница-
// перенаправление, ей собственный canonical не нужен по устройству.
// Четыре банковских (`bank/api`, `bank/badge`, `bank/explore`,
// `bank/leaderboard`) ведёт соседняя вкладка в своей зоне.
// Остаются `bureau/launch` (расходится между ветками — сперва свести) и
// `qright/transparency` (собирает метаданные функцией, нужен generateMetadata).
const INHERITING_TODAY = new Set([
    "auth/success",
    "awards/badge/[entryId]",
    "awards/entry/[entryId]",
    "bank/api",
    "bank/badge",
    "bank/explore",
    "bank/leaderboard",
    "bank/share/[handle]",
    "bureau/author/[slug]",
    "bureau/badge/[certId]",
    "bureau/cert/[certId]",
    "bureau/cert/[certId]/notarize",
    "bureau/notaries/[notaryId]",
    "bureau/org/[orgId]",
    "bureau/org/accept/[token]",
    "bureau/upgrade/[certId]",
    "constitution/admin",
    "multichat-engine/shared/[token]",
    "planet/artifact/[id]",
    "planet/badge/[certId]",
    "planet/webhooks/[id]",
    "pricing/[tierId]",
    "pricing/admin",
    "pricing/checkout/cancel",
    "pricing/checkout/success",
    "pricing/for/[industry]",
    "pricing/paddle",
    "qchaingov/proposals/[id]",
    "qcontract/documents/[id]",
    "qcontract/documents/[id]/log",
    "qmaskcard/charges/[id]",
    "qpersona/view/[alias]",
    "qright/badge/[id]",
    "qright/object/[id]",
    "qright/object/[id]/policies",
    "qright/webhooks/[id]",
    "qsign/embed/[id]",
    "qsign/verify/[id]",
    "quantum-shield/[id]"
]);

/** Страница, которой ЗАПРЕЩЕНА индексация, в поиске не участвует — наследование
 *  чужого canonical ей ничем не вредит, и чинить там нечего. Уточнение соседней
 *  вкладки 30.08.2026: из её восьми кандидатов четыре оказались именно такими.
 *  Без этого условия список замороженных держал бы страницы, которые никто
 *  никогда не починит, никогда не дошёл бы до нуля и перестал бы читаться. */
function isNoIndex(dir: string): boolean {
  return ["page.tsx", "layout.tsx"].some((f) => {
    const file = join(dir, f);
    if (!existsSync(file)) return false;
    const src = readFileSync(file, "utf8");
    return src.includes("index: false") || src.includes("index:false");
  });
}

function hasOwnCanonical(dir: string): boolean {
  return ["page.tsx", "layout.tsx"].some((f) => {
    const file = join(dir, f);
    return existsSync(file) && readFileSync(file, "utf8").includes(KEY);
  });
}

function scan(): { parents: string[]; inheriting: string[] } {
  const parents: string[] = [];
  const pages: string[] = [];
  const walk = (dir: string, rel: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name === "__tests__" || e.name === "_components") continue;
      const sub = join(dir, e.name);
      const route = rel ? rel + "/" + e.name : e.name;
      const lay = join(sub, "layout.tsx");
      if (existsSync(lay) && readFileSync(lay, "utf8").includes(KEY)) parents.push(route);
      if (existsSync(join(sub, "page.tsx"))) pages.push(route);
      walk(sub, route);
    }
  };
  walk(APP, "");
  const inheriting = pages.filter(
    (r) => !parents.includes(r) && parents.some((p) => r.startsWith(p + "/")) && !hasOwnCanonical(join(APP, ...r.split("/")))
      && !isNoIndex(join(APP, ...r.split("/"))),
  );
  return { parents, inheriting };
}

describe("canonical не наследуется молча", () => {
  const { parents, inheriting } = scan();

  it("обход находит и родителей, и страницы — иначе проверка пустая", () => {
    // Контроль охвата: сломается обход — списки опустеют, и проверки ниже
    // пройдут, ничего не проверив. Замер 30.08.2026: 125 родителей, 70
    // наследующие страницы.
    expect(parents.length).toBeGreaterThanOrEqual(50);
    expect(inheriting.length).toBeGreaterThanOrEqual(30);
  });

  it("новых наследующих страниц не появилось", () => {
    const fresh = inheriting.filter((r) => !INHERITING_TODAY.has(r));
    expect(fresh, "страница под разделом с canonical не объявила свой — она выпадет из поиска").toEqual([]);
  });

  it("храповик не протух: замороженные всё ещё наследуют", () => {
    // Починили страницу, а из списка не вычеркнули — список начинает прощать
    // несуществующее и однажды простит настоящее.
    const gone = [...INHERITING_TODAY].filter((r) => !inheriting.includes(r));
    expect(gone, "эти страницы уже не наследуют — вычеркните их из списка").toEqual([]);
  });
});
