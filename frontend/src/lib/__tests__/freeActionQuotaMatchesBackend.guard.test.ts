import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FREE_ACTIONS_PER_MONTH, moduleHasFreeQuota } from "../freeActionQuota";

/**
 * Число «бесплатно в месяц» на витрине равно умолчанию бэкенда.
 *
 * Снаружи бэкенд это число не отдаёт (проверено 30.10.2026: /health → paywall.paidActions
 * без нормы, /api/paywall/policy → только requiredTiers), поэтому сверяем с исходником
 * aevion-globus-backend/src/lib/freeActionQuota.ts в этом же репозитории:
 *   export function бесплатноВМесяц(действие) { … ? n : 3; }
 * Поменяют умолчание там — плашка бюро и QRight обязана поменяться здесь, иначе
 * обещает одно число, а 402 называет другое.
 *
 * ГРАНИЦА. Переменные окружения FREE_<ДЕЙСТВИЕ>_PER_MONTH на проде отсюда не видны:
 * сторож стережёт умолчание, а не значение переменной.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const BACKEND = join(HERE, "../../../../aevion-globus-backend/src/lib/freeActionQuota.ts");

describe("freeActionQuota: витрина = умолчание бэкенда", () => {
  it("умолчание бесплатноВМесяц в бэкенде равно FREE_ACTIONS_PER_MONTH", () => {
    const src = readFileSync(BACKEND, "utf8");
    const начало = src.indexOf("export function бесплатноВМесяц");
    expect(начало, "в бэкенде нет функции бесплатноВМесяц — сторож слеп").toBeGreaterThan(-1);
    const тело = src.slice(начало, src.indexOf("}", начало));
    const m = тело.match(/\?\s*n\s*:\s*(\d+)\s*;/);
    expect(m, "не нашёл умолчание «? n : <число>» в бесплатноВМесяц").not.toBeNull();
    expect(Number(m![1])).toBe(FREE_ACTIONS_PER_MONTH);
  });

  it("норму называют ровно bureau и qright — действия bureau_verify и qright_register бэкенда", () => {
    expect(moduleHasFreeQuota("bureau")).toBe(true);
    expect(moduleHasFreeQuota("qright")).toBe(true);
    expect(moduleHasFreeQuota("qlearn")).toBe(false);
    expect(moduleHasFreeQuota("cyberchess")).toBe(false);
  });
});
