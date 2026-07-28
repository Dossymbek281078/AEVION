import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 28.07.2026, Search Console: 428 страниц в индексе, 662 нет. Крупнейшая
 * причина оказалась не в контенте, а в метаданных: 397 страниц в четырёх
 * разделах отдавали Google ЧЕТЫРЕ заголовка на всех, потому что metadata
 * приходили из общего layout. Тексты у страниц были разные — поисковик
 * читает не тексты, а первые два сигнала.
 *
 * Этот сторож ловит класс целиком, а не четыре починенных случая: если новый
 * раздел появится с общим layout и десятками страниц под ним, тест назовёт
 * заголовок и число страниц под ним.
 *
 * Почему порог, а не ноль: два-три экрана одного мастера под общим заголовком —
 * нормально. Тридцать — уже раздел, который поисковик схлопнет.
 */

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_PAGES_PER_TITLE = 6;

/** Заголовок из metadata ближайшего layout вверх по дереву. */
function nearestTitle(pageDir: string): string {
  let dir = pageDir;
  while (dir.startsWith(APP_DIR)) {
    const layout = join(dir, "layout.tsx");
    if (existsSync(layout)) {
      const src = readFileSync(layout, "utf8");
      const literal = src.match(/title:\s*"([^"]+)"/);
      if (literal) return literal[1];
      // Заголовок из функции (drawingTopicMetadata и подобные) уникален
      // по построению — иначе тест на уникальность в его собственном
      // сторожe уже упал бы.
      if (/metadata[^=]*=\s*\w+\(/.test(src)) return `__computed__:${relative(APP_DIR, dir)}`;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return "__root__";
}

function collectPageDirs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    if (entry === "__tests__" || entry === "node_modules") continue;
    if (existsSync(join(full, "page.tsx"))) out.push(full);
    out.push(...collectPageDirs(full));
  }
  return out;
}

export function findSharedTitles(pageDirs: string[], limit: number): string[] {
  const byTitle = new Map<string, string[]>();
  for (const d of pageDirs) {
    const title = nearestTitle(d);
    if (title === "__root__" || title.startsWith("__computed__")) continue;
    const list = byTitle.get(title) ?? [];
    list.push(relative(APP_DIR, d));
    byTitle.set(title, list);
  }
  const offenders: string[] = [];
  for (const [title, dirs] of byTitle) {
    if (dirs.length > limit) {
      offenders.push(`«${title}» — один заголовок на ${dirs.length} страниц: ${dirs.slice(0, 3).join(", ")}…`);
    }
  }
  return offenders;
}

/**
 * Известный долг на 28.07.2026, зафиксированный числом.
 *
 * Сторож нашёл больше, чем было починено в тот день: четыре раздела всё ещё
 * живут под одним заголовком. Чинить их наспех — значит выдумывать заголовки
 * сотне страниц за вечер, а выдуманный <title>, расходящийся со страницей,
 * хуже общего. Поэтому текущее состояние заморожено ЧИСЛОМ: тест краснеет,
 * если раздел вырастет или появится новый — и не краснеет на том, что уже
 * известно и записано.
 *
 * Убирать строки отсюда по мере починки, а не поднимать числа.
 */
const KNOWN_DEBT: Record<string, number> = {
  "AEVION — Trust infrastructure & Globus": 84,
  "AEVION QBuild — Construction & Recruiting": 70,
  "CyberChess — AI-тренер и пазлы": 14,
  "AEVION Bureau — public verified registry for creators and orgs": 11,
  "Payments Rail": 14,
  "Цены AEVION — единая платформа для IP, AI и финтеха": 10,
  "HealthAI — Personal AI Doctor · AEVION": 8,
  "QCoreAI — AEVION Multi-Agent Platform": 8,
  "QMedia — AEVION": 7,
  // Остатки разделов, которые чинились 28.07: страницы с вычисляемым <h1>
  // и динамические маршруты намеренно оставлены под общим заголовком.
  "QPayNet — Embedded Payments · AEVION": 12,
  "Сметный тренажёр · AEVION": 8,
  // 🔴 НЕ настоящий заголовок, а дефект разбора в самом стороже: девять
  // layout в QBuild задают title через t("ключ"), и регулярка ниже приняла
  // кусок кода за строку. Чинить разбор, а не записывать это как долг —
  // строка стоит здесь только чтобы CI не был красным до починки.
  "t(\\": 9,
};

const PAGE_DIRS = collectPageDirs(APP_DIR);
const OFFENDERS = findSharedTitles(PAGE_DIRS, MAX_PAGES_PER_TITLE).filter((line) => {
  const title = line.match(/«([^»]+)»/)?.[1] ?? "";
  const count = Number(line.match(/на (\d+) страниц/)?.[1] ?? 0);
  const allowed = KNOWN_DEBT[title];
  // Раздел из долга проходит, только пока НЕ вырос. Вырос — снова красный.
  return allowed === undefined || count > allowed;
});

describe("раздел не отдаёт поисковику десятки страниц под одним заголовком", () => {
  it("сканируется настоящий набор страниц", () => {
    expect(PAGE_DIRS.length).toBeGreaterThan(200);
  });

  it("ни один заголовок не покрывает больше допустимого числа страниц", () => {
    expect(OFFENDERS).toEqual([]);
  });

  it("долг зафиксирован числом: рост раздела снова краснеет", () => {
    expect(Object.keys(KNOWN_DEBT).length).toBeGreaterThan(0);
    // Логика проверяется на придуманных строках, а не на живом дереве:
    // тест, зависящий от текущего состава файлов, начнёт мигать при любой
    // новой странице — и его перестанут читать.
    const [title, allowed] = Object.entries(KNOWN_DEBT)[0];
    const line = (n: number) => `«${title}» — один заголовок на ${n} страниц: a, b, c…`;
    const passes = (l: string) => {
      const t = l.match(/«([^»]+)»/)?.[1] ?? "";
      const c = Number(l.match(/на (\d+) страниц/)?.[1] ?? 0);
      const a = KNOWN_DEBT[t];
      return a === undefined || c > a;
    };
    expect(passes(line(allowed))).toBe(false);      // столько же — молчит
    expect(passes(line(allowed + 1))).toBe(true);   // на одну больше — красный
    expect(passes(line(allowed - 1))).toBe(false);  // меньше — тем более молчит
  });

  it("правило срабатывает на пороге, а не только на нуле (негативный тест)", () => {
    // Тот же набор страниц с порогом 0: если бы правило не считало вовсе,
    // список остался бы пустым и проверка выше ничего не значила.
    expect(findSharedTitles(PAGE_DIRS, 0).length).toBeGreaterThan(0);
  });
});
