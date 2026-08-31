import { describe, expect, it } from "vitest";

import { CHANNELS } from "@/lib/products";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Короткие адреса каналов ведут туда, куда обещают, И несут метку.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ ТЕСТ. Сторож живых страниц (`pages-live-smoke.js`) ходит с
 * `redirect: "follow"` и видит только итог: страница открылась, размер годный,
 * бренд на месте. Если короткий адрес однажды поведёт на `/go` БЕЗ метки —
 * он этого не заметит, потому что итоговая страница будет исправной.
 *
 * А цена ошибки тут ровно та, ради которой адреса и заведены: без метки
 * посетитель попадает в канал `direct`, и ноль в `tt` читается как «ролики не
 * сработали», хотя не сработала атрибуция.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");

/** Короткий адрес → куда обязан вести. Список ведётся руками намеренно: он и
 *  есть утверждение, которое проверяется. */
const ROUTES: Array<[string, string]> = [
  ["tt", "/go?c=tt"],
  ["ig", "/go?c=ig"],
  ["yt", "/go?c=yt"],
  ["dz", "/go?c=dz"],
  ["vk", "/go?c=vk"],
  ["tg", "/go?c=tg"],
  ["th", "/go?c=th"],
  ["fb", "/go?c=fb"],
  ["x", "/go?c=x"],
  ["qr", "/go?c=qr"],
  ["en/tt", "/en/go?c=tt"],
  ["en/ig", "/en/go?c=ig"],
  ["en/yt", "/en/go?c=yt"],
];

describe("реестр каналов и короткие входы — одна сущность", () => {
  // ЗАЧЕМ ОТДЕЛЬНАЯ ПРОВЕРКА. Список ROUTES выше ведётся руками, и это верно:
  // он утверждение о том, какие входы мы обещаем. Но сам по себе он не связан
  // с каталогом CHANNELS — можно завести метку канала и забыть про вход.
  //
  // Ровно это и было. Замер 30.08.2026: каталог знал ДЕСЯТЬ меток, коротких
  // входов существовало шесть. Метки при этом работали — /go?c=th и остальные
  // три доводили метку до кассы на живом проде, — а /th, /fb, /x, /qr
  // отвечали 404. То есть в подпись под постом было нечего поставить, и
  // человек приходил без метки, в канал direct.
  //
  // Проверка связывает две сущности: каждая метка каталога обязана иметь вход.
  it("у каждой метки каталога есть короткий вход", () => {
    const known = new Set(ROUTES.filter(([r]) => !r.startsWith("en/")).map(([r]) => r));
    const missing = Object.keys(CHANNELS).filter((c) => !known.has(c));
    expect(missing, "метка канала есть, а короткого адреса для подписи нет").toEqual([]);
  });

  it("каталог вообще не пуст — иначе проверка выше ничего не значит", () => {
    // Контроль охвата: переименуют CHANNELS или сломается импорт — список
    // станет пустым, и проверка «нет пропущенных» пройдёт, не проверив ничего.
    expect(Object.keys(CHANNELS).length).toBeGreaterThanOrEqual(8);
  });
});

describe("короткие адреса каналов", () => {
  it("каждый существует и ведёт по своему адресу с меткой", () => {
    for (const [route, target] of ROUTES) {
      const file = join(APP, ...route.split("/"), "page.tsx");
      expect(existsSync(file), `нет страницы для /${route}`).toBe(true);
      const src = readFileSync(file, "utf8");
      expect(src, `/${route}: нет redirect()`).toContain("redirect(");
      expect(src, `/${route}: ведёт не на ${target}`).toContain(`redirect("${target}")`);
    }
  });

  it("метка канала в цели совпадает с самим адресом", () => {
    // Ловит опечатку копипасты: страница /ig, а метка c=tt. Такую ошибку
    // невозможно увидеть по цифрам — канал просто окажется не тот.
    for (const [route, target] of ROUTES) {
      const channel = route.split("/").pop();
      expect(target, `/${route}: метка не совпадает с адресом`).toContain(`c=${channel}`);
    }
  });

  it("короткие адреса закрыты от поисковика", () => {
    // Иначе они соревнуются в выдаче с той страницей, на которую ведут.
    for (const [route] of ROUTES) {
      const src = readFileSync(join(APP, ...route.split("/"), "page.tsx"), "utf8");
      expect(src, `/${route}: нет metadata`).toContain("export const metadata");
      expect(src.replace(/\s+/g, ""), `/${route}: индексация не запрещена`).toContain("index:false");
    }
  });

  it("в них нет никакой логики, кроме перенаправления", () => {
    // Короткий адрес — вход, а не страница. Любое условие здесь означает, что
    // часть посетителей уедет не туда, и заметить это будет нечем.
    for (const [route] of ROUTES) {
      const src = readFileSync(join(APP, ...route.split("/"), "page.tsx"), "utf8");
      const code = src
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
        .join("\n");
      expect(code, `/${route}: появилось ветвление`).not.toMatch(/\bif\s*\(|\?\s*.+\s*:/);
      expect(code, `/${route}: появился запрос к сети`).not.toMatch(/fetch\(|await /);
    }
  });
});
