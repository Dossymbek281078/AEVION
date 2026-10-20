/**
 * QStore: у платных товаров вместо «Купить» — «Оплата скоро — оставьте почту»; счётчиков продаж нет.
 *
 * ПОВОД (20.10.2026, прод): купить нельзя ничего — вошедший получает 503 no_payment_provider
 * (Gumroad permalink не задан). Слово Оркестратора: форма почты в общий учёт лидов
 * (источник qstore-<товар>), подтверждение на экране; «0 продаж» убрать.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup, act } from "@testing-library/react";
import { QStoreNotify, QSTORE_NOTIFY_SOURCE } from "../QStoreNotify";

vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function отправить(ответ: { status: number; body: unknown }) {
  const fetchMock = vi.fn(async () => ({ ok: ответ.status < 400, status: ответ.status, json: async () => ответ.body }));
  vi.stubGlobal("fetch", fetchMock);
  render(<QStoreNotify productId="cdd5f4c1-458c-4f3a" productTitle="Prompt Course" />);
  fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "aliya@gmail.com" } });
  await act(async () => { fireEvent.click(screen.getByText("Notify me")); });
  return fetchMock;
}

describe("QStoreNotify", () => {
  it("почта уходит в общий учёт лидов с источником qstore-<товар>; подтверждение на экране", async () => {
    const f = await отправить({ status: 201, body: { ok: true, storage: "postgres" } });
    expect(f.mock.calls[0][0]).toBe("/api/constitution/waitlist/subscribe");
    const тело = JSON.parse((f.mock.calls[0][1] as any).body);
    expect(тело).toMatchObject({ email: "aliya@gmail.com", source: "qstore-cdd5f4c1-458c-4f3a", projectId: "cdd5f4c1-458c-4f3a" });
    expect(screen.getByRole("status").textContent).toContain("aliya@gmail.com");
  });
  it("хранилище в памяти — честно «сохранено временно», а не «готово»", async () => {
    await отправить({ status: 201, body: { ok: true, storage: "memory" } });
    expect(screen.getByRole("status").textContent).toMatch(/temporarily/i);
  });
  it("отказ сервера показывается его текстом", async () => {
    await отправить({ status: 400, body: { error: "invalid_email", message: "Bad email" } });
    expect(screen.getByRole("status").textContent).toContain("Bad email");
  });
  it("источник ограничен 40 символами id", () => {
    expect(QSTORE_NOTIFY_SOURCE("x".repeat(60))).toBe("qstore-" + "x".repeat(40));
  });
});

describe("поверхности магазина", () => {
  const D = join(__dirname, "..");
  const файлы = ["page.tsx", "[id]/page.tsx", "[id]/layout.tsx", "seller/[id]/page.tsx", "seller/[id]/layout.tsx"].map((f) => [f, readFileSync(join(D, f), "utf8")] as const);
  it("нигде не показывается число продаж", () => {
    for (const [f, s] of файлы) {
      expect(s, f).not.toMatch(/\{product\.salesCount\} sales|\{p\.salesCount\}|\{profile\.totalSales\}|\$\{product\.salesCount\} sales|\$\{profile\.totalSales\} total sales/);
    }
  });
  it("у платных товаров — форма почты на странице товара и метка в ленте", () => {
    expect(файлы[1][1]).toContain("<QStoreNotify productId={product.id} productTitle={product.title} />");
    expect(файлы[0][1]).toContain("Payment soon — leave your email");
  });
});
