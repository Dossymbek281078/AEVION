import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

// Смоук, которого никто не зовёт, ничего не стережёт.
//
// 20.08.2026: на диске 114 смоук-скриптов, и 13 из них не упомянуты НИГДЕ —
// ни в scripts/all-smokes.js, ни в package.json, ни в одном из 13 workflow.
// Среди них checkout-rails-prod-smoke (путь оплаты) и auth-smoke.
//
// Сторож на этот класс уже был — qskywaySmokesWired — но он проверял ТРИ
// заранее названных смоука. Список рос реактивно: туда попадало то, что уже
// успело сломаться. Здесь умолчание обратное: проверяются ВСЕ смоуки, а
// известные несмонтированные перечислены поимённо.
//
// Направление проверки выбрано так, чтобы она не наказывала за прогресс:
// смонтировали смоук — тест остаётся зелёным (набор только сузился);
// добавили новый несмонтированный — краснеет. Понижать список руками не
// обязательно, но полезно: он и есть список долгов.

const SCRIPTS = path.join(__dirname, "..", "scripts");
const WORKFLOWS = path.join(__dirname, "..", "..", ".github", "workflows");

function callSites(): string[] {
  const out: string[] = [];
  for (const p of [path.join(SCRIPTS, "all-smokes.js"), path.join(__dirname, "..", "package.json")]) {
    if (existsSync(p)) out.push(readFileSync(p, "utf8"));
  }
  if (existsSync(WORKFLOWS)) {
    for (const f of readdirSync(WORKFLOWS)) out.push(readFileSync(path.join(WORKFLOWS, f), "utf8"));
  }
  return out;
}

const smokes = readdirSync(SCRIPTS).filter(
  (f) => f.includes("smoke") && /\.(ts|js|mjs)$/.test(f) && f !== "all-smokes.js",
);

// Зафиксировано 20.08.2026. Смонтируете смоук — можно убрать строку отсюда,
// тест от этого не покраснеет.
const KNOWN_UNWIRED = new Set([
  "auth-smoke.mjs",
  "checkout-rails-prod-smoke.js",
  "devhub-smoke.js",
  "fintech-all-smoke.js",
  "longevity-smoke.js",
  "ownerless-mvp-smoke.js",
  "planning-waitlist-smoke.js",
  "qcoreai-quota-policy-smoke.js",
  "qrenew-smoke.js",
  "qright-e2e-smoke.js",
  "qsocial-smoke.js",
  "qtradeoffline-smoke.js",
  "qventure-smoke.js",
]);

describe("каждый смоук кем-то запускается", () => {
  const sites = callSites();

  test("контроль прибора: смоуки и места вызова найдены", () => {
    // Пустой любой из двух наборов дал бы зелёный ответ «по нулю».
    expect(smokes.length).toBeGreaterThan(50);
    expect(sites.length).toBeGreaterThan(3);
    // И место вызова должно РЕАЛЬНО содержать хоть один известный смоук —
    // иначе мы читаем не те файлы.
    expect(sites.some((s) => s.includes("ots-smoke") || s.includes("smoke"))).toBe(true);
  });

  const unwired = smokes.filter((f) => !sites.some((s) => s.includes(f)));

  test("новых несмонтированных смоуков не появилось", () => {
    const fresh = unwired.filter((f) => !KNOWN_UNWIRED.has(f));
    expect(fresh).toEqual([]);
  });

  test("список известных долгов не выдуман — все файлы существуют", () => {
    const ghosts = [...KNOWN_UNWIRED].filter((f) => !smokes.includes(f));
    expect(ghosts).toEqual([]);
  });
});
