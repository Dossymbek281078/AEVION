import { describe, it, expect } from "vitest";
import { DISALLOWED_PATHS } from "../robots";
import { isBlockedForCrawlers } from "../sitemap";

/**
 * Карта сайта не имеет права звать поисковика туда, куда его не пускает
 * robots.txt.
 *
 * Повод, а не гипотеза. Замер 21.08.2026 на живом sitemap.xml: из 782 адресов
 * 19 были запрещены в robots.txt — /admin/* (9), /qpaynet/admin/* (8),
 * /account и /constitution/admin. Ни один из двух файлов не был неправ сам по
 * себе; неправа была ПАРА: карта собирается обходом каталогов и про запреты
 * ничего не знала. Google на такое противоречие отвечает документированно —
 * адрес попадает в выдачу БЕЗ содержимого, то есть ссылка на админку видна.
 *
 * Проверяем ПРЕДИКАТ, а не вызов sitemap() целиком: карта тянет живые списки
 * вакансий и проектов, и тест, зовущий её, краснел бы при недоступном
 * бэкенде — то есть по чужой причине.
 */
describe("карта сайта не противоречит robots.txt", () => {
  it("список запретов не пуст и содержит админку", () => {
    // Без этого первый же тест ниже стал бы зелёным на ПУСТОМ списке —
    // «ничего не запрещено» читается как «нарушений нет».
    expect(DISALLOWED_PATHS.length).toBeGreaterThan(5);
    expect(DISALLOWED_PATHS).toContain("/admin/");
  });

  it("запрещённые адреса опознаются", () => {
    for (const p of ["/admin/awards", "/admin/ai-spend", "/qpaynet/admin", "/account", "/constitution/admin"]) {
      expect(isBlockedForCrawlers("https://aevion.app" + p), p).toBe(true);
    }
  });

  it("обычные страницы НЕ срезаются", () => {
    // /revenue взят намеренно: он едва не попал под правило "/r/", и именно
    // такая ошибка тише всего — страница просто исчезает из выдачи.
    for (const p of ["/", "/pricing", "/go", "/revenue", "/status", "/verify-offline", "/build/skill/svarshchik"]) {
      expect(isBlockedForCrawlers("https://aevion.app" + p), p).toBe(false);
    }
  });
});
