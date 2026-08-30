import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * У каждой страницы воронки есть своя карточка для пересылки ссылки.
 *
 * ЗАЧЕМ. Замер на проде 28.08.2026: у русских `/go` и `/longevity` карточка
 * генерировалась, а у английских `og:image` не было ВОВСЕ — я создал страницы
 * и забыл про `opengraph-image.tsx`. Пересланная ссылка приходила без
 * картинки, а для трафика из роликов это заметная потеря: в ленте мессенджера
 * карточка без изображения почти не кликается.
 *
 * Дефект тихий: страница открывается, тесты зелёные, ничего не падает. Видно
 * его только в чужом мессенджере — то есть уже после того, как ссылку
 * разослали.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");

/** Страницы, на которые ведут ролики и внешние ссылки. Список ведётся руками:
 *  он и есть утверждение о том, что мы считаем входом в воронку. */
const FUNNEL = ["go", "longevity", "en/go", "en/longevity", "shop", "constitution/pricing", "qsign", "compare", "partner", "qrenew", "qventure", "qlearn", "bank", "qnews", "qai", "studio", "explore", "sdk", "api-explorer", "build", "build/pricing", "build/vacancies"];

/** Все каталоги, где кто-то нарисовал opengraph-image.tsx. Обходом, а не
 *  списком: картинку рисуют осознанно, и сам факт её появления означает
 *  «эту страницу будут пересылать». */
function withOgImage(dir: string, rel = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (e.name === "__tests__" || e.name === "_components") continue;
    const sub = join(dir, e.name);
    const route = rel ? `${rel}/${e.name}` : e.name;
    if (existsSync(join(sub, "opengraph-image.tsx"))) out.push(route);
    out.push(...withOgImage(sub, route));
  }
  return out;
}

describe("нарисована картинка — обязан быть и заголовок", () => {
  const pages = withOgImage(APP);

  it("таких страниц вообще много — иначе проверка пустая", () => {
    // Контроль охвата: если обход сломается (переименовали каталог, съехал
    // путь), список станет коротким, и проверка ниже будет зелёной, ничего
    // не проверяя. Замер 30.08.2026: страниц с картинкой 149.
    expect(pages.length).toBeGreaterThanOrEqual(100);
  });

  it("у каждой есть свой openGraph — в page.tsx или в layout.tsx", () => {
    // ДВА МЕСТА обязательно: страница с "use client" не может объявлять
    // metadata сама, и заголовок тогда живёт в layout.tsx рядом.
    // Замер 30.08.2026: без своего заголовка было 17 страниц из 149 —
    // ссылка на них приходила в мессенджер общим заголовком САЙТА.
    // Сегодня закрыты все; этот сторож держит ноль.
    const missing: string[] = [];
    for (const route of pages) {
      const dir = join(APP, ...route.split("/"));
      const has = ["page.tsx", "layout.tsx"].some((f) => {
        const file = join(dir, f);
        return existsSync(file) && readFileSync(file, "utf8").includes("openGraph");
      });
      if (!has) missing.push(route);
    }
    expect(missing, "нет своего openGraph — ссылка придёт с заголовком сайта").toEqual([]);
  });
});

describe("карточки страниц воронки", () => {
  it("у каждой входной страницы есть opengraph-image", () => {
    for (const route of FUNNEL) {
      const file = join(APP, ...route.split("/"), "opengraph-image.tsx");
      expect(existsSync(file), `/${route}: нет opengraph-image.tsx — ссылка придёт без картинки`)
        .toBe(true);
    }
  });

  it("карточка объявляет размер и тип, иначе Next её не отдаст", () => {
    for (const route of FUNNEL) {
      const src = readFileSync(join(APP, ...route.split("/"), "opengraph-image.tsx"), "utf8");
      expect(src, `/${route}: нет size`).toMatch(/export const size/);
      expect(src, `/${route}: нет contentType`).toMatch(/export const contentType/);
      expect(src, `/${route}: нет alt`).toMatch(/export const alt/);
    }
  });

  it("английские карточки написаны по-английски", () => {
    // Обратный контроль: файл может существовать и при этом нести русский
    // текст, скопированный с русской страницы. Для англоязычного читателя это
    // хуже отсутствующей картинки — он видит незнакомый алфавит.
    for (const route of ["en/go", "en/longevity"]) {
      const src = readFileSync(join(APP, ...route.split("/"), "opengraph-image.tsx"), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ");
      const cyr = (src.match(/[а-яА-ЯёЁ]/g) || []).length;
      expect(cyr, `/${route}: в карточке ${cyr} русских букв`).toBe(0);
    }
  });

  // Короткие входы ищутся ОБХОДОМ, а не по списку в тесте.
  //
  // Замер 29.08.2026: список здесь был зашит — ["tt","ig","yt","en/tt","en/ig"].
  // Я завёл /dz, /vk, /tg, в список их не внёс, и сторож их не проверял вовсе.
  // Тем же заходом они попали в sitemap.xml вопреки noindex — ровно то, от чего
  // этот файл и охраняет. Список, который ведут руками, защищает только то, что
  // в него не забыли добавить.
  const shortRedirects = (() => {
    const found: string[] = [];
    const walk = (dir: string, segs: string[]) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) {
          if (e.name.startsWith("[") || e.name.startsWith("_") || e.name.startsWith("(")) continue;
          if (segs.length === 0 && (e.name === "api" || e.name === "__tests__")) continue;
          walk(join(dir, e.name), [...segs, e.name]);
        } else if (e.name === "page.tsx" && segs.length > 0) {
          const src = readFileSync(join(dir, e.name), "utf8");
          // Признак короткого входа: перенаправление на /go с меткой канала.
          if (/redirect\(\s*["`]\/(en\/)?go\?c=/.test(src)) found.push(segs.join("/"));
        }
      }
    };
    walk(APP, []);
    return found;
  })();

  // Известный долг: страницы без своего openGraph.
  //
  // Замер 29.08.2026 — 15 из 22. Сперва я думал, что забыл у двух (/go и /shop),
  // и записал так основателю; пересчёт показал, что класс платформенный.
  // Поэтому база, а не пустой список: сторож, красный с первого дня, перестают
  // читать, и он не поймает НОВЫЙ пропуск — тот утонет среди пятнадцати старых.
  //
  // Сокращать список можно только вниз. Строку убирают вместе с добавлением
  // openGraph на страницу — образец рядом, в /longevity и /en/go.
  // Долг пересчитан 30.08.2026 после того, как сторож научился смотреть и в
  // layout.tsx: из пятнадцати «должников» настоящих оказалось ДВА. Остальные
  // тринадцать заголовок имеют — просто в layout, потому что их page.tsx
  // клиентский и metadata объявлять не может.
  // Сокращение списка делает сторожа СТРОЖЕ: те тринадцать теперь под охраной,
  // и если у кого-то заголовок пропадёт, набор покраснеет.
  // У /go и /shop layout.tsx нет вовсе — им нужен либо он, либо перенос
  // разметки в серверный компонент. Это работа, а не строчка, поэтому долг.
  // 30.08.2026 долг ЗАКРЫТ ПОЛНОСТЬЮ: /go и /shop получили свой openGraph
  // (обе страницы серверные, metadata у них был — не хватало только блока
  // предпросмотра). Список пуст намеренно: теперь КАЖДАЯ входная страница
  // обязана иметь свой заголовок, и появление новой без него краснит набор.
  const OG_TITLE_DEBT = new Set<string>([]);

  it("новая входная страница обязана иметь СВОЙ заголовок предпросмотра", () => {
    // Карточка-картинка и заголовок — разные вещи, и я это перепутал. На живом
    // сайте картинки были у всех, а свой openGraph.title — у меньшинства: при
    // шеринге /go показывал общий заголовок макета «AEVION — Trust
    // infrastructure & AI», то есть безликую вывеску вместо страницы.
    const fresh: string[] = [];
    for (const route of FUNNEL) {
      if (OG_TITLE_DEBT.has(route)) continue;
      const file = join(APP, ...route.split("/"), "page.tsx");
      if (!existsSync(file)) continue;
      // ДВА МЕСТА, а не одно. Страница с "use client" не может объявлять
      // metadata вовсе — Next это запрещает, и заголовок тогда живёт в
      // layout.tsx рядом. Замер 30.08.2026: сторож смотрел только page.tsx
      // и записал в долг ВОСЕМЬ страниц, у которых заголовок есть в layout
      // (qsign, partner, qlearn, studio, explore, qventure, qnews, qai).
      // Настоящий долг был у двух — /go и /shop, где layout нет вовсе.
      const layout = join(APP, ...route.split("/"), "layout.tsx");
      const hasOg = readFileSync(file, "utf8").includes("openGraph")
        || (existsSync(layout) && readFileSync(layout, "utf8").includes("openGraph"));
      if (!hasOg) fresh.push(route);
    }
    expect(fresh).toEqual([]);
  });

  it("долг не растёт молча: список сверен с действительностью", () => {
    // Если страницу починили, а строку из долга убрать забыли — список начнёт
    // покрывать исправное и однажды скроет настоящий пропуск.
    const stale: string[] = [];
    for (const route of OG_TITLE_DEBT) {
      const file = join(APP, ...route.split("/"), "page.tsx");
      if (!existsSync(file)) continue;
      if (readFileSync(file, "utf8").includes("openGraph")) stale.push(route);
    }
    expect(stale, "починено, но осталось в списке долга — уберите строку").toEqual([]);
  });

  it("обход вообще находит короткие входы — иначе две проверки ниже пусты", () => {
    // Без этого утверждения любая поломка обхода делает сторожа зелёным и
    // бессмысленным: он проверит пустой список и промолчит.
    expect(shortRedirects.length).toBeGreaterThanOrEqual(6);
  });

  it("у коротких адресов карточки НЕТ — они только перенаправляют", () => {
    // Иначе они начнут соревноваться в выдаче с той страницей, куда ведут.
    for (const route of shortRedirects) {
      const file = join(APP, ...route.split("/"), "opengraph-image.tsx");
      expect(existsSync(file), `/${route}: у редиректа появилась карточка`).toBe(false);
    }
  });

  it("каждый короткий адрес запрещён в robots — иначе он попадёт в карту сайта", () => {
    // Карта берёт исключения из DISALLOWED_PATHS. Пропуск в ОБОИХ местах сразу
    // (нет в запретах, есть в карте) прежний сторож карты не ловил: он сверяет
    // списки в одну сторону. Проверено мутацией 29.08.2026.
    const robots = readFileSync(join(APP, "robots.ts"), "utf8");
    for (const route of shortRedirects) {
      expect(robots.includes(`"/${route}"`), `/${route}: нет в DISALLOWED_PATHS robots.ts`).toBe(true);
    }
  });
});
