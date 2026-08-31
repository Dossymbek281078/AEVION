import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Адрес с секретом в пути не должен попадать в поисковую выдачу.
 *
 * ЗАЧЕМ. Если в адресе лежит токен доступа, приглашение или хеш, то попадание
 * такого адреса в индекс означает, что доступ виден любому, кто прочитает
 * выдачу. Ссылку такого вида дают адресно — одному человеку, — а поисковик
 * делает её публичной.
 *
 * Замер 30.08.2026: адресов с секретом в пути ДВЕНАДЦАТЬ, и ШЕСТЬ из них были
 * без запрета. То есть класс знали и закрывали по одной странице, а не разом:
 * bank/r, qpaynet/r, qcontract/v, qcoreai/shared, bureau/org/accept,
 * multichat-engine/shared уже имели запрет, а build/r, qcoreai/collab,
 * qcoreai/embed, planet/webhooks и две страницы тренажёра — нет.
 *
 * ЧТО СЧИТАЕТСЯ СЕКРЕТОМ: имя параметра пути. `[token]`, `[code]`, `[hash]`,
 * `[secret]`, `[key]`, `[invite]`, `[link]`. Не `[id]` и не `[slug]` — они
 * сплошь и рядом публичны (сертификат, автор, артефакт), и запрещать их
 * скопом значило бы убрать из поиска то, что мы сами показываем как
 * доказательство.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const SECRET = /\[(token|code|secret|key|invite|hash|link)\]/i;

/** Три исключения, каждое с причиной. Список НЕ для удобства: пока строка
 *  здесь, страница может попасть в выдачу. */
const ALLOWED = new Map([
  ["qcoreai/widget/[token]", "встраиваемый виджет живёт внутри чужого сайта; его видимость в выдаче может быть намеренной — решает владелец продукта"],
  ["smeta-trainer/certificate-exam/[hash]", "по коду не видно, секрет ли hash; нужен тот, кто знает предметную область"],
  ["smeta-trainer/ssc-compare/[code]", "code здесь может быть кодом норматива, а не доступа"],
]);

function pagesWithSecretInPath(dir: string, rel = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === "__tests__" || e.name === "_components") continue;
    const sub = join(dir, e.name);
    const route = rel ? `${rel}/${e.name}` : e.name;
    if (existsSync(join(sub, "page.tsx")) && SECRET.test(route)) out.push(route);
    out.push(...pagesWithSecretInPath(sub, route));
  }
  return out;
}

function forbidsIndexing(route: string): boolean {
  const dir = join(APP, ...route.split("/"));
  return ["page.tsx", "layout.tsx"].some((f) => {
    const file = join(dir, f);
    if (!existsSync(file)) return false;
    const src = readFileSync(file, "utf8");
    return src.includes("index: false") || src.includes("index:false");
  });
}

describe("адрес с секретом в пути закрыт от поиска", () => {
  const pages = pagesWithSecretInPath(APP);

  it("такие адреса вообще находятся — иначе проверка пустая", () => {
    // Контроль охвата: сломается обход или регулярка — список опустеет, и
    // проверка ниже пройдёт, ничего не проверив. Замер 30.08.2026: 12 адресов.
    expect(pages.length).toBeGreaterThanOrEqual(8);
  });

  it("у каждого стоит index: false", () => {
    const open = pages.filter((r) => !forbidsIndexing(r) && !ALLOWED.has(r));
    expect(open, "секрет в адресе, а страница разрешена к показу в выдаче").toEqual([]);
  });

  it("исключения не протухли: каждое ещё существует", () => {
    // Страницу удалили или закрыли, а строку из списка не убрали — список
    // начинает прощать несуществующее и однажды простит настоящее.
    const gone = [...ALLOWED.keys()].filter((r) => !pages.includes(r) || forbidsIndexing(r));
    expect(gone, "эти исключения больше не нужны — уберите их из списка").toEqual([]);
  });
});
