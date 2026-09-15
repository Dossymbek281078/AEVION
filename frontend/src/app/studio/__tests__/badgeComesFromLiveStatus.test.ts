import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { badgeFrom } from "../page";

/**
 * Бейдж карточки на /studio — из живого статуса, не из кода.
 *
 * До 15.09.2026 «NEEDS TOKEN» у Vercel, GitHub и ElevenLabs было зашито и
 * пережило день, когда все девять провайдеров ответили ok. Здесь закреплено:
 * каждому статусу свой бейдж, неизвестному — «—», и в исходнике не осталось
 * зашитых LIVE / NEEDS TOKEN у карточек с cap.
 */
const SRC = readFileSync(resolve(__dirname, "..", "page.tsx"), "utf8");

describe("бейдж /studio берётся из статуса возможности", () => {
  test("каждый статус даёт свой бейдж, неизвестный — «—»", () => {
    expect(badgeFrom("live").text).toBe("LIVE");
    expect(badgeFrom("needs_token").text).toBe("NEEDS TOKEN");
    expect(badgeFrom("degraded").text).toBe("DEGRADED");
    expect(badgeFrom("not_available").text).toBe("OFF");
    expect(badgeFrom(undefined).text).toBe("—");
    expect(badgeFrom("live").bg).not.toBe(badgeFrom("needs_token").bg);
  });

  test("у карточек с cap нет зашитого бейджа LIVE / NEEDS TOKEN", () => {
    const withCap = SRC.split("\n").filter((l) => l.includes("cap: \""));
    expect(withCap.length, "карточек с cap не найдено — сторож смотрит не туда").toBeGreaterThan(10);
    const hard = withCap.filter((l) => /badge: "(LIVE|NEEDS TOKEN)"/.test(l));
    expect(hard, "зашитый бейдж у карточки, у которой есть живой статус").toEqual([]);
  });

  test("домен назван по решению основателя — aevion.app, не aevion.build", () => {
    expect(SRC).toContain("Domain (aevion.app)");
    expect(SRC).not.toContain("aevion.build");
  });
});
