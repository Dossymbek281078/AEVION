import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Покупателю сказано, от чего зависит его доступ.
 *
 * QVenture выходит 10.09.2026 за $39/мес. Доступ выдаётся так: planGate
 * спрашивает hasActiveAppSubscription(plan.email, "qventure"), а plan.email
 * приходит из токена входа. Модуль при этом работает и анонимно — значит
 * человек может заплатить и не связать покупку с собой.
 *
 * Сегодня это незаметно: платная стена включена у 6 модулей из 43 (замер
 * 31.08.2026 по /api/paywall/policy), QVenture среди них нет. Но включение
 * стены и есть то, что означает запуск, и в этот день молчание страницы
 * превратится в «заплатил и не пустили».
 *
 * Проверка про ТЕКСТ, а не про механизм: механизм закрыт 13.08 и живёт в
 * planGate. Здесь охраняется то, что человек об этом узнает.
 */
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, "$1"));
const PAGE = path.resolve(HERE, "..", "page.tsx");
const SRC = fs.readFileSync(PAGE, "utf8");

function withoutComments(src: string): string {
  // Объяснение ПОЧЕМУ живёт в комментарии теми же словами; без вырезания
  // проверка ловила бы собственное объяснение и была бы зелёной впустую.
  return src
    .replace(/[/][*][\s\S]*?[*][/]/g, "")
    .split(String.fromCharCode(10))
    .filter((l) => !l.trim().startsWith("//"))
    .join(String.fromCharCode(10));
}

describe("QVenture говорит, от чего зависит доступ", () => {
  it("контроль: страница прочитана и это она", () => {
    expect(SRC.length, "страница не прочитана").toBeGreaterThan(10000);
    expect(SRC, "читается не та страница").toContain("QVenture is an AI screening tool");
  });

  it("сказано, что доступ привязан к почте подписки", () => {
    const body = withoutComments(SRC);
    expect(
      body,
      "на странице не сказано, что доступ идёт по почте подписки: в день " +
        "включения платной стены заплативший $39/мес останется на бесплатном " +
        "тарифе и не поймёт почему",
    ).toMatch(/email on your subscription|почте подписки/i);
  });

  it("сказано, ЧТО делать, а не только как устроено", () => {
    const body = withoutComments(SRC);
    // Описание механизма без действия бесполезно человеку у кассы.
    expect(
      body,
      "нет прямого указания войти с той же почтой — человек прочитает про " +
        "привязку и не поймёт, что от него требуется",
    ).toMatch(/sign in with that\s+same email|войдите с той же/i);
  });
});
