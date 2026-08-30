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
const INHERITING_TODAY = new Set([
    "aev/tokenomics",
    "auth/success",
    "awards/badge/[entryId]",
    "awards/entry/[entryId]",
    "awards/results",
    "bank/api",
    "bank/audit-log",
    "bank/badge",
    "bank/contacts",
    "bank/diagnostics",
    "bank/explore",
    "bank/gift/[id]",
    "bank/inbox",
    "bank/income",
    "bank/leaderboard",
    "bank/notifications",
    "bank/pay",
    "bank/qr-scan",
    "bank/r/[code]",
    "bank/receipt/[id]",
    "bank/settings",
    "bank/share/[handle]",
    "bank/smoke",
    "bank/statement",
    "build/vacancies/map",
    "bureau/author/[slug]",
    "bureau/badge/[certId]",
    "bureau/cert/[certId]",
    "bureau/cert/[certId]/notarize",
    "bureau/launch",
    "bureau/notaries",
    "bureau/notaries/[notaryId]",
    "bureau/org",
    "bureau/org/[orgId]",
    "bureau/org/accept/[token]",
    "bureau/upgrade/[certId]",
    "constitution/admin",
    "constitution/demo",
    "multichat-engine/launch",
    "multichat-engine/shared/[token]",
    "planet/artifact/[id]",
    "planet/badge/[certId]",
    "planet/transparency",
    "planet/webhooks/[id]",
    "pricing/[tierId]",
    "pricing/admin",
    "pricing/checkout/cancel",
    "pricing/checkout/success",
    "pricing/for/[industry]",
    "pricing/paddle",
    "qchaingov/new",
    "qchaingov/proposals/[id]",
    "qcontract/documents/[id]",
    "qcontract/documents/[id]/log",
    "qcontract/v/[token]",
    "qmaskcard/charges/[id]",
    "qmaskcard/dashboard",
    "qmaskcard/new",
    "qpersona/view/[alias]",
    "qright/badge/[id]",
    "qright/object/[id]",
    "qright/object/[id]/policies",
    "qright/transparency",
    "qright/webhooks/[id]",
    "qsign/embed/[id]",
    "qsign/verify/[id]",
    "quantum-shield/[id]",
    "qventure/a/[id]",
    "qventure/batch",
    "qventure/watchlist"
]);

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
    (r) => !parents.includes(r) && parents.some((p) => r.startsWith(p + "/")) && !hasOwnCanonical(join(APP, ...r.split("/"))),
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
