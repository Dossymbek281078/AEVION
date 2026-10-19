/**
 * 🔴 19.10.2026 — DevHub «оплата → доступ» на проде: покупка плана делала tier pro (ручка
 * /studio/credits с Bearer: video 3→50, deploy без предела), а страница /devhub звала ту же
 * ручку БЕЗ Authorization — подписчик видел гостя: баннер «Оформить план» и гостевые нормы.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("запрос кредитов DevHub несёт вход", () => {
  it("/studio/credits зовётся с Authorization из getAuthToken", () => {
    const i = SRC.indexOf('fetch(apiUrl("/api/devhub/studio/credits")');
    expect(i).toBeGreaterThan(0);
    expect(SRC.slice(i, i + 200)).toContain('Authorization: "Bearer " + токен');
    expect(SRC.slice(Math.max(0, i - 400), i)).toContain("const токен = getAuthToken();");
    expect(SRC).toMatch(/import \{[^}]*getAuthToken[^}]*\} from "@\/lib\/auth";/);
  });
});
