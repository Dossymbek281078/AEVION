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
