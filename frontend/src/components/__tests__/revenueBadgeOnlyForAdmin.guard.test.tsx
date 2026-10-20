/**
 * Плашка цели выручки «$1M: …» — только админу, посетителю ноль.
 *
 * ПОВОД (20.10.2026, путь Мультичата на проде, кадр put-gost-1463x724-2): посетитель
 * /multichat-engine видел слева вверху «$1M: 0.00% · 73d» — внутреннюю отчётность.
 * Слово Оркестратора: только админу. Роль — из токена входа (lib/etoAdmin).
 * Проверяются ОБА компонента: общая шапка и оболочки приложений.
 */
import { describe, test, expect, vi, afterEach, beforeAll } from "vitest";
import { render, cleanup, act } from "@testing-library/react";

const { путь } = vi.hoisted(() => ({ путь: { значение: "/multichat-engine" } }));
vi.mock("next/navigation", () => ({ usePathname: () => путь.значение }));
vi.mock("@/lib/useRevenueGoal", () => ({
  useRevenueGoal: () => ({ goals: { millionUsd: 1_000_000 }, summary: { grossUsd: 0 }, pct: 0, days: 73 }),
}));
vi.mock("@/lib/i18n", () => ({ useI18nOptional: () => ({ lang: "ru" }) }));
vi.mock("@/lib/revenueTip", () => ({ revenueTip: () => "подсказка" }));

const { default: RevenueGoalBadge } = await import("../RevenueGoalBadge");
const { AppShellRevenueBadge } = await import("../AppShellRevenueBadge");
const { рольИзТокена } = await import("../../lib/etoAdmin");

const токен = (полезная: object) => `x.${btoa(JSON.stringify(полезная)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")}.y`;

beforeAll(() => {
  // широкий экран, чтобы плашку оболочки не прятала ширина
  window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as any;
});
afterEach(() => {
  cleanup();
  try { localStorage.clear(); } catch { /* jsdom */ }
});

async function нарисовать(el: React.ReactElement) {
  let c!: HTMLElement;
  await act(async () => { c = render(el).container; });
  return c.textContent ?? "";
}

describe("плашка цели: посетителю 0, админу видна", () => {
  for (const [имя, el] of [["шапка", <RevenueGoalBadge key="a" />], ["оболочка", <AppShellRevenueBadge key="b" />]] as const) {
    test(`${имя}: гость без токена — нет`, async () => {
      expect(await нарисовать(el)).not.toContain("$1M");
    });
    test(`${имя}: вошедший обычный пользователь — нет`, async () => {
      localStorage.setItem("aevion_auth_token_v1", токен({ sub: "u1", role: "user" }));
      expect(await нарисовать(el)).not.toContain("$1M");
    });
    test(`${имя}: КОНТРОЛЬ — админ видит`, async () => {
      localStorage.setItem("aevion_auth_token_v1", токен({ sub: "a1", role: "admin" }));
      expect(await нарисовать(el)).toContain("$1M");
    });
  }

  test("роль из токена: base64url, мусор и пустота — не админ", () => {
    expect(рольИзТокена(токен({ role: "admin", n: "ä>?" }))).toBe("admin");
    expect(рольИзТокена("мусор")).toBeNull();
    expect(рольИзТокена(null)).toBeNull();
  });
});
