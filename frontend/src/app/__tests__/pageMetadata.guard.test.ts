import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Два правила, каждое из которых уже было нарушено 19.08.2026.
 *
 * 1. Директива клиента обязана быть ПЕРВЫМ выражением файла.
 *    Я добавлял метаданные и вставил блок в начало page.tsx — директива уехала
 *    на 18-ю строку сразу у трёх страниц. `npx tsc --noEmit` при этом ответил 0:
 *    это правило сборки Next.js, а не системы типов. Поймал только собственный
 *    контрольный вопрос после правки, и это слишком хрупкая защита.
 *
 * 2. Продуктовая страница должна иметь СВОИ метаданные.
 *    `/longevity` — лучший бесплатный вход — наследовал общий заголовок сайта и
 *    описание про регистрацию интеллектуальной собственности, то есть был
 *    невидим в поиске по своей теме. То же было у `/tiktok-publisher`, адрес
 *    которого стоит в заявке на Content Posting API: ревьюер открывал инструмент
 *    для авторов и читал «Trust infrastructure for digital assets & IP».
 */

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT_DIRECTIVE = '"use client";';

/**
 * Убирает комментарии перед проверкой.
 *
 * Первая версия этого сторожа покраснела на моих же новых layout-файлах: в них
 * слова про директиву стоят в пояснении, зачем метаданные вынесены из страницы.
 * Сторож, считающий упоминание за код, находит не то — и приучает себя не
 * читать.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * Страницы, которым свои метаданные не нужны, и ПОЧЕМУ. Список именно
 * объяснённый: без причин он за месяц превратится в свалку, куда дописывают всё
 * покрасневшее.
 */
const NO_METADATA_NEEDED: Record<string, string> = {
  account: "личный кабинет за входом — в поиске ему делать нечего",
  status: "служебная страница состояния",
  "launch-status": "служебная страница состояния",
  revenue: "внутренний дашборд",
  "verify-offline": "утилита проверки без публичного трафика",
  "reconstruct-demo": "техническая демонстрация",
};

function topLevelPages(): string[] {
  return readdirSync(APP, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => !n.startsWith("_") && n !== "api" && n !== "admin")
    .filter((n) => existsSync(join(APP, n, "page.tsx")));
}

function hasOwnMetadata(page: string): boolean {
  for (const f of ["page.tsx", "layout.tsx"]) {
    const p = join(APP, page, f);
    if (!existsSync(p)) continue;
    const src = stripComments(readFileSync(p, "utf8"));
    if (/export\s+(const\s+metadata|(async\s+)?function\s+generateMetadata)/.test(src)) return true;
  }
  return false;
}

describe("метаданные страниц и директива клиента", () => {
  const pages = topLevelPages();

  it("страницы вообще нашлись — иначе проверки ниже зелёные впустую", () => {
    expect(pages.length).toBeGreaterThan(50);
  });

  it("директива клиента стоит первой строкой везде, где она есть", () => {
    const broken: string[] = [];
    for (const page of pages) {
      for (const f of ["page.tsx", "layout.tsx"]) {
        const p = join(APP, page, f);
        if (!existsSync(p)) continue;
        const src = stripComments(readFileSync(p, "utf8"));
        if (!src.includes(CLIENT_DIRECTIVE)) continue;
        const firstCode = src.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
        if (firstCode !== CLIENT_DIRECTIVE) broken.push(`${page}/${f}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("клиентская страница не экспортирует metadata — Next этого не примет", () => {
    const broken: string[] = [];
    for (const page of pages) {
      const p = join(APP, page, "page.tsx");
      if (!existsSync(p)) continue;
      const src = stripComments(readFileSync(p, "utf8"));
      if (src.includes(CLIENT_DIRECTIVE) && /export\s+const\s+metadata/.test(src)) broken.push(page);
    }
    expect(broken).toEqual([]);
  });

  it("у публичных страниц есть свои метаданные", () => {
    const missing = pages.filter((p) => !(p in NO_METADATA_NEEDED) && !hasOwnMetadata(p));
    expect(missing).toEqual([]);
  });
});

/**
 * Правило 3 (13.09.2026): у модулей волны 20 сентября превью ссылки обязано
 * быть НА РУССКОМ.
 *
 * Замер 09.09 и повтор 13.09 уже ПОСЛЕ выкатки цикла 14: у четырёх модулей из
 * восьми `og:title` и `og:description` были английскими. Подписчик волны
 * русский, письмо русское, страница русская — а первое, что он видит по ссылке
 * в мессенджере, приходило на чужом языке. Тексты замены написали 09.09 и в код
 * не внесли: четыре дня это числилось «ждёт выкатки», хотя выкатывать было
 * нечего.
 *
 * Проверяется именно `openGraph`, а не заголовок страницы: `title` и
 * `description` у этих модулей двуязычны намеренно — их читают поиск и внешние
 * интеграторы. Превью читает человек, и он один.
 *
 * Список написан руками, и это его слабое место: модуль, забытый в списке,
 * сторож пропустит молча. Поэтому рядом стоит проверка размера — она краснеет,
 * если список усох.
 */
const ВОЛНА_РУССКОГО_ПРЕВЬЮ = [
  "qright",
  "qsign",
  "multichat-engine",
  "devhub",
  "qskyway",
  "qventure",
  "startup-exchange",
];
const КИРИЛЛИЦА = /[а-яА-ЯёЁ]/;

/**
 * Достаёт блок openGraph и ПОДСТАВЛЯЕТ значения констант, на которые он
 * ссылается.
 *
 * Первая версия читала только текст блока — и покраснела на `qventure`, где
 * поля заданы как `title: TITLE, description: OG_DESCRIPTION`, а сами строки
 * объявлены выше по файлу и по-русски. То есть сторож нашёл бы «английское
 * превью» там, где превью русское: живой замер прода в ту же минуту показывал
 * `og:title=двуязычный`. Ложная тревога у сторожа хуже его отсутствия — к ней
 * привыкают и перестают читать.
 */
function поляOpenGraph(src: string): { title: string; description: string } | null {
  const чистый = stripComments(src);
  const i = чистый.indexOf("openGraph");
  if (i < 0) return null;
  const блок = чистый.slice(i, i + 900);
  // Значения могут быть не строкой, а именем константы (так у qventure).
  const константы = new Map<string, string>();
  for (const m of чистый.matchAll(/const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^;]{0,400});/g)) {
    константы.set(m[1], m[2]);
  }
  // Регулярки — ЛИТЕРАЛАМИ, а не через new RegExp со строкой: строковый
  // литерал съедает одиночный обратный слэш, и шаблон превращается в
  // "titles*:s*", который не совпадает никогда. Первая версия этого сторожа
  // была именно такой: тест зеленел, а мутация «верни английский заголовок»
  // проходила насквозь — то есть охранял он пустоту.
  const взять = (шаблон: RegExp): string => {
    const m = блок.match(шаблон);
    if (!m) return "";
    const сырое = m[1].trim();
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(сырое) ? (константы.get(сырое) ?? "") : сырое;
  };
  return {
    title: взять(/title\s*:\s*([\s\S]{0,320}?),\s/),
    description: взять(/description\s*:\s*([\s\S]{0,320}?),\s/),
  };
}


describe("превью ссылки у модулей волны — по-русски", () => {
  it("список волны не усох — иначе проверка ниже зелёная впустую", () => {
    expect(ВОЛНА_РУССКОГО_ПРЕВЬЮ.length).toBeGreaterThanOrEqual(7);
  });

  it("у каждого модуля волны найден блок openGraph", () => {
    const без: string[] = [];
    for (const модуль of ВОЛНА_РУССКОГО_ПРЕВЬЮ) {
      const есть = ["layout.tsx", "page.tsx"]
        .map((f) => join(APP, модуль, f))
        .filter((p) => existsSync(p))
        .some((p) => поляOpenGraph(readFileSync(p, "utf8")) !== null);
      if (!есть) без.push(модуль);
    }
    expect(без).toEqual([]);
  });

  /**
   * Проверяются ОБА поля по отдельности, и это не педантизм.
   * Первая версия требовала «хоть где-то в блоке есть кириллица» — и мутация
   * прошла насквозь: вернул заголовок qsign в английский, тест остался
   * зелёным, потому что описание рядом было русским. Утверждение «либо одно,
   * либо другое» разрешает худшее из двух.
   */
  it("и заголовок, и описание превью — по-русски у каждого модуля волны", () => {
    const английские: string[] = [];
    for (const модуль of ВОЛНА_РУССКОГО_ПРЕВЬЮ) {
      for (const f of ["layout.tsx", "page.tsx"]) {
        const п = join(APP, модуль, f);
        if (!existsSync(п)) continue;
        const поля = поляOpenGraph(readFileSync(п, "utf8"));
        if (!поля) continue;
        if (поля.title && !КИРИЛЛИЦА.test(поля.title)) английские.push(модуль + " og:title");
        if (поля.description && !КИРИЛЛИЦА.test(поля.description)) {
          английские.push(модуль + " og:description");
        }
      }
    }
    expect(английские).toEqual([]);
  });
});

