import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import SuccessPage from "../checkout/success/page";

/**
 * Экран после оплаты не объявляет активацию, пока сервер её не подтвердил.
 *
 * Замер 31.08.2026: страница читала тариф из адреса (`?tier=pro`) и писала
 * «Pro активирован!», не сделав НИ ОДНОГО обращения к серверу — 305 строк,
 * ноль `fetch`. Любой, кто открыл ссылку, или вернулся кнопкой «назад», бросив
 * оплату, читал подтверждение покупки.
 *
 * Ни один тест этого не видел, и не мог: странице нечем было упасть. Она
 * уверенно отвечала успехом на любой вход — это и есть самый дорогой класс
 * дефекта, потому что снаружи он неотличим от исправной работы.
 *
 * ⚠️ Сторож проверяет ПОВЕДЕНИЕ: страница отрисовывается с подменённым
 * ответом сервера, и читается то, что увидит человек. Проверка «в файле есть
 * fetch» закрепила бы форму — обращение можно оставить и не читать его ответ.
 */

const t = (k: string) => k; // подписи не важны: сверяем КЛЮЧИ, они однозначны

vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t, lang: "ru" }) }));
vi.mock("@/lib/track", () => ({ track: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("tier=pro&provider=paybox"),
}));

function mockPlan(plan: string | null) {
  globalThis.fetch = vi.fn(async () =>
    plan === null
      ? ({ ok: false, json: async () => ({}) } as Response)
      : ({ ok: true, json: async () => ({ plan }) } as Response),
  ) as unknown as typeof fetch;
}

describe("экран после оплаты не обещает того, чего не проверил", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("контроль: страница вообще отрисовывается и спрашивает сервер", async () => {
    mockPlan("pro");
    render(<SuccessPage />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const url = String((globalThis.fetch as any).mock.calls[0][0]);
    expect(url, "спрашиваем не про доступ").toContain("entitlements");
  });

  it("сервер подтвердил тариф — говорим «активирован»", async () => {
    mockPlan("pro");
    render(<SuccessPage />);
    await waitFor(() =>
      expect(screen.getByText("pricing.checkoutSuccess.titleActivated")).toBeTruthy(),
    );
  });

  it("сервер видит free — НЕ говорим «активирован»", async () => {
    mockPlan("free");
    render(<SuccessPage />);
    await waitFor(() =>
      expect(screen.getByText("pricing.checkoutSuccess.titlePending")).toBeTruthy(),
    );
    expect(
      screen.queryByText("pricing.checkoutSuccess.titleActivated"),
      "человек не платил или выдача не прошла, а экран поздравляет с покупкой",
    ).toBeNull();
  });

  it("сервер не ответил — тоже НЕ говорим «активирован»", async () => {
    mockPlan(null);
    render(<SuccessPage />);
    await waitFor(() =>
      expect(screen.getByText("pricing.checkoutSuccess.titlePending")).toBeTruthy(),
    );
  });
});

/**
 * Учёт покупки не срабатывает на голом заходе.
 *
 * Замер 31.08.2026: событие уходило БЕЗУСЛОВНО, при каждом открытии адреса.
 * Итоговый шаг воронки считал ЗАХОДЫ, а не покупки — достаточно было вернуться
 * кнопкой «назад», бросив оплату. Ошибка не видна ни в одном отчёте: числа
 * просто больше настоящих, и «конверсия» выглядит лучше, чем она есть.
 */
describe("учёт покупки требует признака возврата", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("есть касса в адресе — событие уходит", async () => {
    mockPlan("pro");
    vi.doMock("next/navigation", () => ({
      useSearchParams: () => new URLSearchParams("tier=pro&provider=paybox"),
    }));
    const { track } = await import("@/lib/track");
    render(<SuccessPage />);
    await waitFor(() => expect(track).toHaveBeenCalled());
  });

  it("голый адрес без кассы — событие НЕ уходит", async () => {
    mockPlan("free");
    vi.resetModules();
    vi.doMock("next/navigation", () => ({
      useSearchParams: () => new URLSearchParams(""),
    }));
    const { track } = await import("@/lib/track");
    const Page = (await import("../checkout/success/page")).default;
    render(<Page />);
    await new Promise((r) => setTimeout(r, 10));
    expect(
      track,
      "человек просто открыл адрес, а воронка засчитала покупку",
    ).not.toHaveBeenCalled();
  });
});
