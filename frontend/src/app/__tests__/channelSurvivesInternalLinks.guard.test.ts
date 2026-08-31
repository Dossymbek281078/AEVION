import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Сторож против МОЛЧАЛИВОЙ потери источника покупки.
 *
 * Замер 28.08.2026: воронка теряла метку канала на двух переходах — и оба раза
 * незаметно. Целевая страница канал читает, ссылка на неё метки не несёт,
 * покупка приходит в отчёт как «источник неизвестен». Ни один тест этого не
 * видел: страница работает одинаково с меткой и без.
 *
 * Правило простое: если страница ЧИТАЕТ канал (зовёт channelFrom), то ссылки на
 * неё обязаны его НЕСТИ — через keepChannel, а не строкой.
 */

const APP = path.join(process.cwd(), "src", "app");
const COMPONENTS = path.join(process.cwd(), "src", "components");

/** Шапка сайта — осознанное исключение, а не недосмотр.
 *
 *  Она рендерится на ВСЕХ страницах через ClientProviders и параметров страницы
 *  не получает. Единственный способ дать ей канал — useSearchParams(), а это
 *  Suspense и риск увести 762 статические страницы в динамический рендер. Цена
 *  несоразмерна: метка теряется на одной навигационной ссылке, а платит вся
 *  платформа. Решение пересматривать вместе с рендерингом макета, не отдельно. */
/* ПРОВЕРЕНО 30.08.2026 — список прощённых честен, и вот чем это показано.
 * Список исключений выключает охрану, поэтому его мало обосновать один раз:
 * надо спросить, нет ли ТОГО ЖЕ в местах, которые никто не прощал.
 *   - целей (страниц, читающих канал): 9;
 *   - файлов со ссылкой на них БЕЗ метки: 1, и это ровно SiteHeader;
 *   - useSearchParams живёт в 39 файлах, но все они в app/ — то есть на
 *     конкретных страницах, где цена динамики уже уплачена локально.
 *     В глобальных компонентах его нет, значит довод «увело бы всю
 *     платформу» в силе, а не унаследован из прошлого. */
const KNOWN_EXCEPTIONS = new Set(["components/SiteHeader.tsx"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "__tests__") continue;
      out.push(...walk(full));
    } else if (e.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

/* ДОЛГ ОТ 30.08.2026, датированный намеренно.
 *
 * В этот день страница цен научилась читать метку канала и доводить её до
 * кассы — до того она метку не читала вовсе, поэтому в список целей не входила
 * и ссылки на неё сторож не смотрел. Стоило ей войти, как открылось 24 места,
 * где метка теряется. Ни одно из них не появилось сегодня: они лежали столько
 * же, сколько существуют страницы, просто были вне охвата.
 *
 * Почему не починены здесь и сейчас:
 *
 *   20 из 24  это «← к ценам» ВНУТРИ самого раздела цен. Метка теряется на
 *             обратном шаге, а не на входе; чинить их значит править двадцать
 *             файлов раздела ради случая, когда человек уже дошёл до цен и
 *             вернулся назад.
 *   4 из 24   настоящие внешние входы (кабинет, баннер шахмат, витрина,
 *             счётчик расхода QCoreAI). Все четыре — клиентские компоненты, и
 *             все четыре ПРЯМО СЕЙЧАС правят другие ветки: у трёх из них по
 *             две–пять расходящихся версий. Править файл, который в чужой
 *             ветке новее, — это перенос к себе чужих уже исправленных
 *             дефектов, а не польза.
 *
 * Список датирован и заперт проверкой ниже: если место починят, сторож
 * потребует вычеркнуть его отсюда. Долг, из которого нельзя выйти молча.
 */
// Дополнено 31.08: витрина модулей /apps научилась читать метку и доводить её
// до кассы, поэтому вошла в список целей — и открылась одна ссылка на неё.
// Файл devhub правят СЕГОДНЯ (merge/devhub-backlog-2026-08-27), моя копия от
// 23.08. Правка поверх отстающей копии унесла бы чужую работу; передано
// владельцу, починка — та же, что на витрине: метка в состоянии и keep у href.
const LOSING_SINCE_2026_08_30 = new Set([
  "app/devhub/page.tsx → /apps",
  "app/account/page.tsx → /pricing",
  "app/cyberchess/AevionProjectsBanner.tsx → /pricing",
  "app/explore/page.tsx → /pricing",
  "app/qcoreai/QcoreQuotaMeter.tsx → /pricing",
  "app/pricing/[tierId]/page.tsx → /pricing",
  "app/pricing/admin/page.tsx → /pricing",
  "app/pricing/affiliate/page.tsx → /pricing",
  "app/pricing/api-pricing/page.tsx → /pricing",
  "app/pricing/cases/page.tsx → /pricing",
  "app/pricing/changelog/page.tsx → /pricing",
  "app/pricing/checkout/cancel/page.tsx → /pricing",
  "app/pricing/checkout/success/page.tsx → /pricing",
  "app/pricing/compare/page.tsx → /pricing",
  "app/pricing/contact/page.tsx → /pricing",
  "app/pricing/edu/page.tsx → /pricing",
  "app/pricing/for/[industry]/page.tsx → /pricing",
  "app/pricing/glossary/page.tsx → /pricing",
  "app/pricing/integrations/page.tsx → /pricing",
  "app/pricing/migrations/page.tsx → /pricing",
  "app/pricing/partners/page.tsx → /pricing",
  "app/pricing/provisioning/page.tsx → /pricing",
  "app/pricing/refund-policy/page.tsx → /pricing",
  "app/pricing/roadmap/page.tsx → /pricing",
  "app/pricing/security/page.tsx → /pricing",
]);

describe("метка канала переживает внутренние переходы", () => {
  const appFiles = walk(APP);
  const allFiles = [...appFiles, ...walk(COMPONENTS)];

  /** Пути страниц, которые читают канал, — то есть те, для кого метка не мусор. */
  const targets = appFiles
    .filter((f) => f.endsWith(`${path.sep}page.tsx`))
    .filter((f) => fs.readFileSync(f, "utf8").includes("channelFrom"))
    .map((f) => {
      const rel = path.relative(APP, path.dirname(f)).split(path.sep).join("/");
      return rel === "" ? "/" : `/${rel}`;
    });

  it("такие страницы вообще существуют — иначе сторож проверяет пустоту", () => {
    // Без этого утверждения список целей мог бы стать пустым (переименовали
    // channelFrom, переехали страницы), и сторож остался бы зелёным, ничего
    // не проверяя. Молчаливо слепой сторож хуже, чем его отсутствие.
    expect(targets.length).toBeGreaterThanOrEqual(5);
  });

  it("ни одна ссылка на них не потеряла метку", () => {
    const lost: string[] = [];
    for (const file of allFiles) {
      const rel = path.relative(path.join(process.cwd(), "src"), file).split(path.sep).join("/");
      if (KNOWN_EXCEPTIONS.has(rel)) continue;
      const src = fs.readFileSync(file, "utf8");
      for (const t of targets) {
        // ТРИ формы записи одной и той же ссылки. Сторож знал только первую,
        // и мутация 30.08.2026 прошла незамеченной: замена keepChannel(...) на
        // литерал даёт href={"/путь"} — в фигурных скобках, мимо шаблона.
        // У слепоты сторожа два измерения: какие файлы он читает и какие ФОРМЫ
        // видит. Охват был верным, форма — нет.
        const forms = [`href="${t}"`, `href={"${t}"}`, `href={'${t}'}`];
        if (forms.some((f) => src.includes(f))) lost.push(`${rel} → ${t}`);
      }
    }
    const fresh = lost.filter((l) => !LOSING_SINCE_2026_08_30.has(l));
    expect(
      fresh,
      "новая ссылка теряет метку канала: оберните адрес тем же способом, каким " +
        "это делает соседняя ссылка на той же странице",
    ).toEqual([]);
  });

  it("долг не протух: перечисленные места всё ещё теряют метку", () => {
    // Без этой проверки список превращается в вечное прощение: место починят,
    // строка останется, и следующая ПОТЕРЯ в том же файле пройдёт молча.
    const stillLosing = new Set<string>();
    for (const file of allFiles) {
      const rel = path.relative(path.join(process.cwd(), "src"), file).split(path.sep).join("/");
      const src = fs.readFileSync(file, "utf8");
      for (const t of targets) {
        const forms = [`href="${t}"`, `href={"${t}"}`, `href={'${t}'}`];
        if (forms.some((f) => src.includes(f))) stillLosing.add(`${rel} → ${t}`);
      }
    }
    const healed = [...LOSING_SINCE_2026_08_30].filter((l) => !stillLosing.has(l));
    expect(healed, "эти места уже не теряют метку — вычеркните их из списка долга").toEqual([]);
  });

  it("нормализованное значение не подставляют в ?c= руками", () => {
    // ВТОРОЙ ОБЛИК того же класса, и он тише первого: ссылка выглядит несущей
    // метку, проходит вычитку — и молча её теряет, потому что в ?c= уезжает
    // длинное значение (youtube), а следующая страница ждёт короткий ключ (yt).
    // Замер 29.08.2026: две такие подстановки на странице запуска шахмат.
    const handmade: string[] = [];
    for (const file of allFiles) {
      const rel = path.relative(path.join(process.cwd(), "src"), file).split(path.sep).join("/");
      const src = fs.readFileSync(file, "utf8");
      if (src.includes("c=${channel}")) handmade.push(rel);
    }
    expect(handmade).toEqual([]);
  });

  it("исключение названо честно и всё ещё существует", () => {
    // Исключение, указывающее в пустоту, — это забытая строка, которая молча
    // расширяет дыру: файл переименуют, а сторож продолжит кого-то пропускать.
    for (const rel of KNOWN_EXCEPTIONS) {
      expect(fs.existsSync(path.join(process.cwd(), "src", rel))).toBe(true);
    }
  });
});
