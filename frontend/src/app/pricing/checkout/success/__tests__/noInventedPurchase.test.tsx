import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * Экран после оплаты не выдумывает, ЧТО человек купил.
 *
 * Замер 31.08.2026 в браузере: на голом адресе страница писала «Pro
 * активирован!» и предлагала «Открыть QRight →». Проверено по коду всех
 * четырёх касс — параметр appId не кладёт НИ ОДНА, то есть ссылку на QRight
 * видел каждый покупатель, включая заплативших за QSign или QLearn. Тариф
 * теряется реже: у PayBox в адрес возврата уходит ref, и покупатель Lite из
 * Казахстана читал «Pro активирован».
 *
 * Это продолжение соседнего сторожа про имя платёжного сервиса: выдуманное имя
 * хуже отсутствующего. Тот закрыл провайдера, этот — тариф и продукт.
 */

let params = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => params,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/pricing/checkout/success",
}));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (k: string) => k }) }));
vi.mock("@/lib/track", () => ({ track: vi.fn() }));

// eslint-disable-next-line import/first
import Success from "../page";

function screenAt(query: string) {
  params = new URLSearchParams(query);
  document.body.innerHTML = "";
  const { container } = render(<Success />);
  return {
    текст: container.textContent || "",
    ссылки: [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") || ""),
  };
}

describe("после оплаты не выдумываем покупку", () => {
  test("без тарифа — не называем тариф", () => {
    const { текст } = screenAt("");

    // Сравнение по подстроке тут не годится: NoTier СОДЕРЖИТ titleActivated.
    // Спрашиваем именно ту форму, что должна отсутствовать.
    expect(текст).toContain("titleActivatedNoTier");
    expect(текст, "назван тариф, которого мы не знаем").not.toContain("subtitleActivated\"");
  });

  test("без продукта — ведём в каталог, а не в случайный модуль", () => {
    const { текст, ссылки } = screenAt("tier=lite");

    expect(текст, "назван продукт, которого мы не знаем").toContain("openAppNoName");
    expect(ссылки, "ссылка ведёт в конкретный модуль вместо каталога").toContain("/apps");
    expect(ссылки).not.toContain("/qright");
  });

  test("продукт известен — называем его", () => {
    const { текст, ссылки } = screenAt("tier=lite&appId=qlearn");

    expect(текст).toContain("openApp");
    expect(текст).not.toContain("openAppNoName");
    expect(ссылки).toContain("/qlearn");
  });

  test("тариф известен — называем его", () => {
    const { текст } = screenAt("tier=lite");

    expect(текст).toContain("titleActivated");
    expect(текст, "тариф известен, а страница говорит обезличенно").not.toContain("NoTier");
  });
});
