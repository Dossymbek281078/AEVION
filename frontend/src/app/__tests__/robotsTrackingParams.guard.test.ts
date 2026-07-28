import { describe, it, expect } from "vitest";
import robots from "../robots";

/**
 * Метка канала не должна плодить дубли страниц в поисковой выдаче.
 *
 * Ссылки с меткой (`/go?c=fb` → `/compare?c=fb` → `/qsign?c=fb`) нужны, чтобы
 * знать, какая реклама доводит человека до продукта. Но для поисковика
 * `/qsign` и `/qsign?c=fb` — разные адреса с одинаковым содержимым, если на
 * странице нет canonical. А его на 28.07.2026 задают 24 страницы модулей из
 * 35, и корневой layout умолчания не даёт.
 *
 * Пока это так, параметр закрыт в robots. Когда canonical появится везде,
 * правило можно снять — но снимать его надо осознанно, поэтому тест здесь.
 */

describe("robots закрывает метки рекламных каналов", () => {
  const rules = Array.isArray(robots().rules) ? robots().rules : [robots().rules];

  it("правило для всех агентов существует", () => {
    // Без этой проверки исчезнувшее правило дало бы пустой список disallow и
    // зелёный тест на пустом месте.
    const all = (rules as { userAgent?: string | string[] }[]).find((r) =>
      Array.isArray(r.userAgent) ? r.userAgent.includes("*") : r.userAgent === "*",
    );
    expect(all, "нет правила для userAgent: *").toBeTruthy();
  });

  it("параметр метки канала закрыт от индексации", () => {
    const disallow = (rules as { disallow?: string | string[] }[]).flatMap((r) =>
      typeof r.disallow === "string" ? [r.disallow] : (r.disallow ?? []),
    );
    expect(disallow.length, "список disallow пуст").toBeGreaterThan(5);
    expect(
      disallow.some((d) => d.includes("?c=")),
      "Метка канала ?c= открыта для индексации: одна страница попадёт в выдачу " +
        "столько раз, сколько у неё рекламных меток. Либо верните правило, либо " +
        "сначала проставьте canonical на всех страницах модулей.",
    ).toBe(true);
  });

  it("служебные разделы остаются закрытыми", () => {
    // Заодно страхуем то, что было закрыто до меня: правка списка disallow —
    // самое лёгкое место, где можно снести чужое одной строкой.
    const disallow = (rules as { disallow?: string | string[] }[]).flatMap((r) =>
      typeof r.disallow === "string" ? [r.disallow] : (r.disallow ?? []),
    );
    for (const must of ["/admin/", "/api/", "/account/", "/pay/"]) {
      expect(disallow, `из robots пропал ${must}`).toContain(must);
    }
  });
});
