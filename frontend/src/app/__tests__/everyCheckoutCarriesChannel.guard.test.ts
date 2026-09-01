import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/*
 * КАЖДЫЙ переход в кассу несёт метку канала.
 *
 * Класс закрывался дважды и дважды открывался заново, потому что путей больше,
 * чем видно из одного места:
 *
 *   30.08  ссылка из каталога товаров и кнопка апселла      — починены
 *   31.08  кнопка модуля: адрес приходит от бэкенда         — найдена браузером
 *   31.08  таблица тарифов и витрина модулей                — найдены этим свипом
 *
 * Каждый раз я писал «класс закрыт целиком» и каждый раз ошибался: греп искал
 * известную форму, а следующий путь имел другую. Поэтому здесь проверяется не
 * форма, а СЛЕДСТВИЕ — что рядом с любым уходом в кассу стоит withChannel.
 *
 * Получатели готовы у обеих касс: вебхук LemonSqueezy читает
 * custom_data.channel, вебхук Gumroad — url_params[channel]. Без отправителя
 * покупка приходит в отчёт как пришедшая ниоткуда.
 *
 * Разбор позиционный, без регулярок: собранная из строки регулярка на этой
 * машине теряет обратные слэши и молча перестаёт совпадать.
 */

const SRC = join(process.cwd(), "src");

/** Признаки ухода в кассу. */
const HOSTS = ["gumroad.com/l/", "lemonsqueezy.com/checkout", "pricing/checkout/session"];

/** Места, где метки нет осознанно или где её некому подхватить. */
const DEBT = new Map([
  [
    "app/constitution/page.tsx",
    "Копия файла в моей ветке от 18.08, четыре чужие ветки новее — правка " +
      "поверх отстающей копии унесла бы их починки (правило 7в).",
  ],
  [
    "app/constitution/pricing/page.tsx",
    "Та же ветка и тот же владелец, что у страницы выше: чинить обе должен он.",
  ],
]);

function files(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    if (e === "__tests__" || e === "node_modules") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (e.endsWith(".tsx") || e.endsWith(".ts")) out.push(p);
  }
  return out;
}

/**
 * Кусок исходника вокруг ухода в кассу: от начала строки-объявления до конца
 * выражения. Границей считается закрывающая фигурная скобка атрибута JSX или
 * точка с запятой — этого хватает, чтобы поймать и однострочный href, и
 * тернарник из трёх строк, как на витрине модулей.
 */
/**
 * Места ПЕРЕХОДА, а не места адреса. Первая версия сторожа искала адрес кассы
 * и смотрела вокруг него — и была ПУСТОЙ: у сессионных путей адрес приходит из
 * fetch, а переход стоит десятью строками ниже, вне любого окна. Все три
 * мутации прошли незамеченными. Считаем наоборот: находим уход браузера и
 * спрашиваем, чем он уходит.
 */
function statementAt(src: string, at: number): string {
  let end = at;
  for (let i = at; i < src.length && i - at < 300; i++) {
    if (src[i] === ";") { end = i; break; }
  }
  return src.slice(at, end + 1);
}

/**
 * Уходит ли этот переход в НАШУ кассу.
 *
 * Адрес от сессии засчитывается, только если файл вообще создаёт сессию покупки
 * (`pricing/checkout/session`). Без этого условия сторож поднял пополнение
 * кошелька в QPayNet: там человек кладёт СВОИ деньги себе, покупки нашего
 * продукта нет, и метка канала там бессмысленна. Ложная находка в стороже
 * дороже пропуска: на неё перестают смотреть.
 */
function goesToCheckout(stmt: string, fileSrc: string): boolean {
  if (stmt.includes(".url") && fileSrc.includes("pricing/checkout/session")) return true;
  return HOSTS.some((h) => stmt.includes(h));
}

function navigations(src: string): string[] {
  const out: string[] = [];
  for (const marker of ["location.href =", "location.assign("]) {
    let at = src.indexOf(marker);
    while (at !== -1) {
      out.push(statementAt(src, at));
      at = src.indexOf(marker, at + 1);
    }
  }
  return out;
}

/** Ссылки в разметке: адрес кассы прямо в href. */
function checkoutHrefs(src: string): string[] {
  const out: string[] = [];
  for (const h of HOSTS) {
    let at = src.indexOf(h);
    while (at !== -1) {
      const from = Math.max(0, at - 300);
      const chunk = src.slice(from, at);
      // Две формы записи одного и того же: href={...} в разметке и ctaHref: "..."
      // в данных. Вторую первая версия не видела, и долг по странице цен
      // конституции выглядел починенным.
      const k = Math.max(chunk.lastIndexOf("href="), chunk.lastIndexOf("Href:"), chunk.lastIndexOf("href:"));
      if (k !== -1) out.push(src.slice(from + k, at + 60));
      at = src.indexOf(h, at + 1);
    }
  }
  return out;
}

describe("каждый уход в кассу несёт метку канала", () => {
  const all = files(SRC);

  it("обход видит весь исходник — иначе пустой список читается как чистота", () => {
    expect(all.length).toBeGreaterThanOrEqual(400);
  });

  it("ни одного нового ухода без метки", () => {
    const bare: string[] = [];
    for (const f of all) {
      const rel = relative(SRC, f).split(sep).join("/");
      if (DEBT.has(rel)) continue;
      const src = readFileSync(f, "utf8");
      for (const stmt of navigations(src)) {
        if (!goesToCheckout(stmt, src)) continue;
        if (!stmt.includes("withChannel")) bare.push(`${rel}: ${stmt.slice(0, 70)}`);
      }
      for (const attr of checkoutHrefs(src)) {
        if (!attr.includes("withChannel")) bare.push(`${rel}: ${attr.slice(0, 70)}`);
      }
    }
    expect(bare, "уход в кассу без метки — покупка придёт в отчёт ниоткуда").toEqual([]);
  });

  it("долг не протух: перечисленные места всё ещё без метки", () => {
    for (const [rel] of DEBT) {
      const src = readFileSync(join(SRC, rel), "utf8");
      const stillBare =
        checkoutHrefs(src).some((a) => !a.includes("withChannel")) ||
        navigations(src).some((n) => goesToCheckout(n, src) && !n.includes("withChannel"));
      expect(stillBare, `${rel} уже несёт метку — вычеркните строку из долга`).toBe(true);
    }
  });
});
