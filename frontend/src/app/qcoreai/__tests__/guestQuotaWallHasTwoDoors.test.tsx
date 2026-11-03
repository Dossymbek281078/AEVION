import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { GuestQuotaWall, guestWallFrom, PRICING_HREF } from "../multi/GuestQuotaWall";

/**
 * Гость /qcoreai/multi после квоты видит две двери — вход и тарифы, а не
 * адрес сырым текстом в красной плашке (замер прода 3.11.2026, путь из
 * Shorts 4.11: 200, 200, 402 → «…sign in to continue. /auth?next=…»
 * текстом, ссылок к оплате на странице ноль).
 */

describe("стена гостя: из ответа сервера", () => {
  const тело = { error: "guest_quota_exhausted", loginUrl: "/auth?next=/qcoreai/multi" };

  test("402 guest_quota_exhausted → вход на ТОТ ЖЕ адрес с меткой ролика и тарифы", () => {
    const w = guestWallFrom(402, тело, "/qcoreai/multi?c=yt-0411-2");
    expect(w).not.toBeNull();
    expect(decodeURIComponent(w!.loginHref)).toBe("/auth?next=/qcoreai/multi?c=yt-0411-2");
    expect(w!.pricingHref).toBe("/pricing?app=multichat");
  });

  test("другая 402 и другие коды — не стена гостя", () => {
    expect(guestWallFrom(402, { error: "upgrade_required" }, "/qcoreai/multi")).toBeNull();
    expect(guestWallFrom(429, тело, "/qcoreai/multi")).toBeNull();
    expect(guestWallFrom(500, null, "/qcoreai/multi")).toBeNull();
  });

  test("чужой адрес в next не пропускается", () => {
    const w = guestWallFrom(402, тело, "//evil.example/x");
    expect(decodeURIComponent(w!.loginHref)).toBe("/auth?next=/qcoreai/multi");
  });
});

describe("стена гостя: на экране", () => {
  test("две ссылки — вход и тарифы, адреса не текстом", () => {
    const w = guestWallFrom(402, { error: "guest_quota_exhausted" }, "/qcoreai/multi?c=yt-0411-2")!;
    const { container } = render(<GuestQuotaWall wall={w} />);
    const вход = container.querySelector("a[data-guest-wall-login]") as HTMLAnchorElement;
    const тарифы = container.querySelector("a[data-guest-wall-pricing]") as HTMLAnchorElement;
    expect(вход.getAttribute("href")).toBe(w.loginHref);
    expect(тарифы.getAttribute("href")).toBe(PRICING_HREF);
    expect(screen.getByRole("alert").textContent).not.toMatch(/\/auth\?next=/);
  });
});

describe("страница подключает стену и не пугает гостя 401", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "../multi/page.tsx"), "utf-8");

  test("ответ запуска проходит через guestWallFrom, а стена стоит в разметке", () => {
    expect(src).toMatch(/guestWallFrom\(res\.status, err,/);
    expect(src).toMatch(/\{guestWall && <GuestQuotaWall wall=\{guestWall\} \/>\}/);
  });

  test("адрес входа больше не приклеивается к тексту ошибки стены гостя", () => {
    expect(src).toMatch(/const signIn = !wall &&/);
  });

  test("401 личных персон и шаблонов у гостя — не «часть данных не загрузилась»", () => {
    expect(src).toMatch(/if \(!pRes\.ok && pRes\.status !== 401\) setPartial/);
    expect(src).toMatch(/if \(!tmplRes\.ok && tmplRes\.status !== 401\) setPartial/);
  });
});
