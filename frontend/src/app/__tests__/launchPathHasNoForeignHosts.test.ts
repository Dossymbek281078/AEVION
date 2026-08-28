import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Путь запуска не обращается к чужим хостам.
 *
 * ЗАМЕР 28.08.2026, браузером как у посетителя: четыре ключевые страницы
 * (шахматы, страница запуска, вход, цены) сделали 359 запросов — ВСЕ до одного
 * к `aevion.app`. Ни внешних шрифтов, ни счётчиков, ни сторонних библиотек.
 *
 * ЗАЧЕМ ЭТО БЕРЕЧЬ. Наши люди сидят в Казахстане и России, где часть чужих CDN
 * недоступна. Страница, которая тянет шрифт или счётчик со стороны, у них
 * собирается наполовину — и выглядит это как «сайт сломался», а не как
 * «заблокирован сторонний хост». Один внешний адрес, добавленный между делом,
 * стоит дороже, чем кажется.
 *
 * ЧТО ЭТО НЕ ЗАПРЕЩАЕТ. Встраивания видео и ссылки на сторонние сервисы —
 * законные функции других страниц, и там чужие хосты уместны. Сторож смотрит
 * ТОЛЬКО на файлы пути запуска: страница запуска, экран входа и форма сбора
 * адресов. Именно по ним 30 августа пойдут люди из письма.
 */

const LAUNCH_PATH_FILES = [
  join(SRC, "app", "cyberchess", "launch", "page.tsx"),
  join(SRC, "app", "auth", "page.tsx"),
  join(SRC, "components", "WaitlistCapture.tsx"),
];

/** Свои и «бумажные» адреса: schema.org в разметке данных не загружается. */
const ALLOWED = ["aevion.app", "schema.org", "localhost", "127.0.0.1"];

function foreignHosts(text: string): string[] {
  const out = new Set<string>();
  const re = /https?:[/][/]([a-zA-Z0-9.-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const host = m[1].toLowerCase();
    const ours = ALLOWED.some((a) => host === a || host.endsWith("." + a));
    if (!ours) out.add(host);
  }
  return [...out];
}

describe("путь запуска не тянет чужие хосты", () => {
  test("контроль прибора: чужой адрес в тексте находится, свой — нет", () => {
    // Без этого тест был бы зелёным и на сломанном определителе.
    expect(foreignHosts('const a = "https://fonts.googleapis.com/css";')).toEqual(["fonts.googleapis.com"]);
    expect(foreignHosts('const a = "https://aevion.app/go";')).toEqual([]);
    expect(foreignHosts('const a = "https://api.aevion.app/health";')).toEqual([]);
  });

  test.each(LAUNCH_PATH_FILES)("%s", (file) => {
    expect(existsSync(file), "файл пути запуска не найден — проверь список").toBe(true);
    const found = foreignHosts(readFileSync(file, "utf8"));
    expect(
      found,
      "на пути запуска появился чужой хост: у людей в наших странах страница может собраться наполовину",
    ).toEqual([]);
  });
});
