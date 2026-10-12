import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 🔴 КОРОТКИЕ АДРЕСА ДЛЯ ПОДПИСЕЙ РОЛИКОВ ВЕДУТ ТУДА, КУДА ОБЕЩАНО.
 *
 * 12.10.2026, просьба окна ИИ-блогера: в подписях TikTok/Instagram ссылки не
 * кликаются, человек набирает адрес руками. Без короткого адреса с меткой
 * переход ляжет в «прямые», и ролик станет неизмерим — как Product Hunt 29.09.
 * Ролики русские, поэтому цель — БЕЗ /en (в отличие от /sh).
 */
const ОЖИДАНИЕ: Array<[string, string, string]> = [
  ["dt", "/devhub", "tt-blogger-bio"],
  ["di", "/devhub", "ig-blogger-bio"],
  ["ct", "/cyberchess", "tt-blogger-bio"],
  ["ci", "/cyberchess", "ig-blogger-bio"],
];

describe("короткие адреса блогера", () => {
  it("🔴 все четыре существуют и ведут на русскую страницу с нужной меткой — знаменатель 4 из 4", () => {
    for (const [путь, цель, метка] of ОЖИДАНИЕ) {
      const ф = join(process.cwd(), "src/app", путь, "page.tsx");
      expect(existsSync(ф), `нет страницы /${путь}`).toBe(true);
      const код = readFileSync(ф, "utf8");
      expect(код, `/${путь}: своя метка не ${метка}`).toContain(`меткаДляПерехода((await searchParams).c, "${метка}")`);
      expect(код, `/${путь}: ведёт не на ${цель}`).toContain("redirect(`" + цель + "?c=${метка}`)");
      // Русская страница: /en в цели — ошибка (ролики Ави русские).
      expect(код, `/${путь}: ведёт на английскую версию`).not.toMatch(/redirect\(`\/en\//);
      // Закрыт от поисковика, как и все короткие адреса.
      expect(код).toContain("robots: { index: false, follow: true }");
    }
    expect(ОЖИДАНИЕ.length).toBe(4);
  });

  it("контроль: выдуманного короткого адреса нет", () => {
    expect(existsSync(join(process.cwd(), "src/app/zz/page.tsx"))).toBe(false);
  });

  it("метки известны проду: канал и пост разбираются", async () => {
    const { channelFrom, postFrom } = await import("@/lib/products");
    expect(channelFrom("tt-blogger-bio")).toBeTruthy();
    expect(channelFrom("ig-blogger-bio")).toBeTruthy();
    expect(postFrom("tt-blogger-bio")).toBe("blogger-bio");
    expect(postFrom("ig-blogger-bio")).toBe("blogger-bio");
  });
});
