import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * 🔴 Замер на проде 06.09.2026: включив трансляцию партии зрителям БЕЗ входа
 * в аккаунт, аноним получал 403 на /cyberchess-spectator/publish на КАЖДЫЙ ход
 * (и следом на /voice-coach/broadcast) — консоль забивалась ошибками бесконечно,
 * а трансляция всё равно не шла. Публикация требует входа; фронт обязан гасить
 * тумблер при 401/403, а не долбить сервер отказами.
 *
 * Бережём: в обработчике ответа publish есть проверка статуса 401/403, и она
 * выключает spectatorPublish. Эффект «на выключении» ниже отзовёт стрим сам.
 */
const KOD = () => readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");

describe("трансляция гаснет, когда публиковать нельзя", () => {
  it("ответ publish 401/403 выключает трансляцию, а не молчит", () => {
    const s = KOD();
    const i = s.indexOf('fetch("/api-backend/api/cyberchess-spectator/publish"');
    expect(i).toBeGreaterThan(0);
    // окно одного вызова publish — до следующего fetch
    const okno = s.slice(i, s.indexOf("fetch(", i + 30));
    expect(okno).toMatch(/r\.status===401\|\|r\.status===403/);
    expect(okno).toContain("sSpectatorPublish(false)");
  });

  it("тумблер трансляции по умолчанию выключен — публикация не на пути по умолчанию", () => {
    const s = KOD();
    // spectatorPublish читается из localStorage и по умолчанию false
    expect(s).toContain('localStorage.getItem("cc_spectator_publish_v1")==="1"');
  });
});
