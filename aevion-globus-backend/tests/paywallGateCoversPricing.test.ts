// Платный модуль без проводки шлюза — это переключатель, который молча не
// работает.
//
// НАЙДЕНО 28.08.2026 сверкой таблицы MODULE_GATE_PREFIXES из index.ts со
// списком платных модулей MODULES_PRICING. Три модуля были в прайсе с
// требуемыми тарифами, а их префиксов в таблице шлюзов не было:
//
//   revenue-hub   lite/medium/full/enterprise
//   qmelanin      medium/full/enterprise
//   qskyway       full/enterprise
//
// Ни один из трёх не был включён, поэтому ничего не ломалось. Опасность в
// другом: назови кто-нибудь их в PAYWALL_MODULES — переменная приняла бы имя,
// а стена не встала бы. Флаг, который лжёт, хуже отсутствующего флага: по
// отсутствующему задают вопрос, а по этому считают дело сделанным.
//
// Отдельно у qmelanin это не теория: POST /api/qmelanin/ai-plan зовёт платного
// поставщика (на проде anthropic configured:true, tier premium), не требуя ни
// входа, ни оплаты, ни предела.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MODULES_PRICING } from "../src/data/pricing";

const indexSrc = readFileSync(
  path.resolve(__dirname, "../src/index.ts"),
  "utf8",
);

/** Идентификаторы модулей из таблицы шлюзов index.ts. */
function gatedIds(): Set<string> {
  const out = new Set<string>();
  for (const m of indexSrc.matchAll(/\["(\/api\/[a-z0-9-]+)",\s*"([a-z0-9-]+)"\]/g)) {
    out.add(m[2]);
  }
  return out;
}

/**
 * Модули со СВОИМ механизмом доступа — их отсутствие в общей таблице
 * осознанно. Список повторяет комментарий над таблицей в index.ts; если он
 * начнёт расходиться с ним, это заметит человек, читающий один из двух.
 *
 * Пополнять его — решение, а не способ погасить красный тест: каждая строка
 * означает «у этого модуля доступ устроен иначе», и это надо уметь объяснить.
 */
const OWN_GATE = new Set([
  "globus", // бесплатный публичный портал
  "cyberchess",
  "cyberchess-addon",
  "smeta-trainer",
  "qbuild",
  "build",
  "constitution", // собственный гейт в lib/constitutionGate.ts
  "qcoreai", // подключается инлайном выше по файлу
  "multichat-engine", // там же
]);

describe("у каждого платного модуля есть проводка шлюза", () => {
  it("контроль: таблица шлюзов вообще прочиталась", () => {
    // Ноль от собственного разбора читался бы как «все модули без шлюза» —
    // и тест стал бы красным по причине, не имеющей отношения к делу.
    const ids = gatedIds();
    expect(ids.size).toBeGreaterThan(20);
    for (const known of ["qright", "aevion-ip-bureau", "qai"]) {
      expect(ids.has(known), `${known} обязан быть в таблице`).toBe(true);
    }
  });

  it("контроль: список цен вообще прочитался", () => {
    expect(MODULES_PRICING.length).toBeGreaterThan(20);
  });

  it("платный модуль либо в таблице шлюзов, либо в списке своих механизмов", () => {
    const ids = gatedIds();
    // Платный — тот, у кого есть ненулевая цена подписки: бесплатные модули
    // гейтить незачем, и требовать этого было бы вечно красным аудитом.
    const paid = MODULES_PRICING.filter(
      (m) => typeof m.addonMonthly === "number" && m.addonMonthly > 0,
    );
    expect(paid.length, "контроль: платные модули найдены").toBeGreaterThan(5);

    const gaps = paid
      .map((m) => m.id)
      .filter((id) => !ids.has(id) && !OWN_GATE.has(id));

    expect(
      gaps,
      `у этих платных модулей нет ни шлюза, ни записи в OWN_GATE: ${gaps.join(", ")}. ` +
        "Переменная PAYWALL_MODULES примет их имя и молча ничего не сделает.",
    ).toEqual([]);
  });

  it("три вчерашних пробела закрыты поимённо", () => {
    // Именно они и были найдены 28.08.2026. Проверяем адресно, чтобы правка
    // не «растворилась» в общем условии выше при будущих перестановках.
    const ids = gatedIds();
    for (const id of ["qmelanin", "revenue-hub", "qskyway"]) {
      expect(ids.has(id), `${id} должен быть в таблице шлюзов`).toBe(true);
    }
  });

  it("список своих механизмов не разросся молча", () => {
    // Исключение — самый дешёвый способ погасить этот тест, поэтому его размер
    // закреплён: добавили десятое — объясните почему.
    expect(OWN_GATE.size).toBeLessThanOrEqual(9);
  });
});
