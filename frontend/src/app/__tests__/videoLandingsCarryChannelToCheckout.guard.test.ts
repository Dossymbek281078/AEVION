import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/*
 * Посадочные под ролики доводят метку канала до КАССЫ.
 *
 * Найдено 30.08.2026. Про /qrenew и /qmelanin в памяти прямо записано: ролики
 * на YouTube ведут именно сюда. При этом обе страницы уводили в кассу сырой
 * ссылкой — без метки. Обработчик оплаты метку читает и кладёт в запись о
 * покупке, то есть терялась она у нас, на последнем шаге.
 *
 * Цена потери здесь выше, чем где-либо: это единственные страницы, про которые
 * известно, что на них приходит платный трафик с роликов.
 *
 * Сторож смотрит на ССЫЛКУ, а не на наличие слова: withChannel в файле может
 * стоять для соседней ссылки, и проверка «слово есть» была бы зелена на
 * сломанном коде.
 */

const APP = join(process.cwd(), "src/app");

/** Страницы, про которые известно, что на них ведут ролики. */
const VIDEO_LANDINGS = ["qrenew/_client.tsx", "qmelanin/_client.tsx"];

function src(rel: string): string {
  const p = join(APP, rel);
  if (!existsSync(p)) throw new Error(`посадочная страница исчезла: ${rel}`);
  return readFileSync(p, "utf8");
}

/** Ссылки в кассу: и прямые адреса Gumroad, и href из каталога товаров. */
function checkoutLinks(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/href=\{?[^\n]*/g)) {
    const line = m[0];
    if (line.includes("gumroad.com") || line.includes("p.href")) out.push(line);
  }
  return out;
}

describe("посадочные под ролики не теряют метку канала у кассы", () => {
  it("такие страницы на месте — иначе сторож проверяет пустоту", () => {
    expect(VIDEO_LANDINGS.length).toBeGreaterThanOrEqual(2);
    for (const rel of VIDEO_LANDINGS) expect(src(rel).length).toBeGreaterThan(500);
  });

  it("каждая ссылка в кассу обёрнута withChannel", () => {
    const bare: string[] = [];
    for (const rel of VIDEO_LANDINGS) {
      const links = checkoutLinks(src(rel));
      expect(links.length, `в ${rel} не нашлось ни одной ссылки в кассу`).toBeGreaterThan(0);
      for (const l of links) if (!l.includes("withChannel(")) bare.push(`${rel}: ${l.trim()}`);
    }
    expect(bare, "ссылка уводит в кассу без метки канала — покупка придёт ниоткуда").toEqual([]);
  });

  it("метка берётся из адреса, а не выдумывается", () => {
    for (const rel of VIDEO_LANDINGS) {
      const s = src(rel);
      expect(s, `${rel} не читает метку из адреса`).toContain('get("c")');
      // channelFrom сверяет метку со списком известных каналов: без него в
      // отчёт уехало бы любое ?c= из чужой ссылки.
      expect(s, `${rel} не сверяет метку со списком каналов`).toContain("channelFrom(");
    }
  });
});

/* ВЕСЬ КЛАСС, а не только две посадочные.
 *
 * Свип 30.08.2026 по всей разметке: прямых ссылок в кассу четыре. Две — на
 * посадочных выше, обе починены. Одна — сама реализация withChannel, не ссылка.
 * Остаётся одна, и она в долге ниже.
 *
 * Ссылки, которые строятся из каталога товаров, проверяет соседний сторож
 * канала на внутренних переходах. Здесь именно ПРЯМЫЕ адреса касс: их легко
 * написать заново, не вспомнив про метку, — так и появились обе починенные.
 *
 * Строки сравниваются по вхождению, без регулярок: собранная из строки
 * регулярка на этой машине теряет обратные слэши и молча перестаёт совпадать —
 * сторож остался бы зелёным, ничего не проверяя.
 */
const RAW_CHECKOUT_DEBT = new Map([
  [
    "constitution/page.tsx",
    "Моя копия файла от 18.08, а четыре чужие ветки новее — одна сегодняшняя. " +
      "Правка поверх отстающей копии переносит к себе чужие уже исправленные " +
      "дефекты (правило 7в). Чинить должен тот, у кого файл свежий: обернуть " +
      "адрес в withChannel, как сделано в qmelanin.",
  ],
]);

function isCheckoutLink(line: string): boolean {
  if (!line.includes("href")) return false;
  return line.includes("gumroad.com/l/") || line.includes("lemonsqueezy.com");
}

function everyFileUnderApp(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "__tests__" || e.name === "node_modules") continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) out.push(full);
    }
  };
  walk(APP);
  return out;
}

describe("прямые ссылки в кассу несут метку канала", () => {
  const files = everyFileUnderApp();

  it("обход видит весь сайт — иначе пустой список читается как чистота", () => {
    expect(files.length).toBeGreaterThanOrEqual(300);
  });

  it("ни одной новой ссылки без метки", () => {
    const bare: string[] = [];
    for (const f of files) {
      const rel = relative(APP, f).split(sep).join("/");
      if (RAW_CHECKOUT_DEBT.has(rel)) continue;
      for (const line of readFileSync(f, "utf8").split("\n")) {
        if (isCheckoutLink(line) && !line.includes("withChannel")) {
          bare.push(rel + ": " + line.trim().slice(0, 60));
        }
      }
    }
    expect(bare, "ссылка ведёт в кассу без метки — покупка придёт в отчёт ниоткуда").toEqual([]);
  });

  it("долг не протух: перечисленное всё ещё без метки", () => {
    // Без этой проверки строка долга становится вечным прощением: файл починят,
    // а следующая сырая ссылка в нём пройдёт молча.
    for (const [rel] of RAW_CHECKOUT_DEBT) {
      const stillBare = readFileSync(join(APP, rel), "utf8")
        .split("\n")
        .some((l) => isCheckoutLink(l) && !l.includes("withChannel"));
      expect(stillBare, rel + " уже несёт метку — вычеркните строку из долга").toBe(true);
    }
  });
});
