import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import { render, waitFor, cleanup, act } from "@testing-library/react";

/**
 * QSign, ворота 5: вернувшийся вошедший видит СВОИ подписи.
 * Замер прода 30.10.2026: регистрация → подпись → выход → вход — подписи на
 * /qsign не найти. Ручка своих (/api/qsign/v2/audit, Bearer) уже была.
 * Токен — только из хранилища входа (не из поля «Токен доступа», которое правят
 * руками: вычитка Продукта 30.10 — каждое нажатие давало запрос и 401).
 * Отказ — отказом: упавший запрос показывает ошибку, а не «вы ничего не подписали».
 */
vi.mock("@/lib/i18n", () => ({ useI18nOptional: () => ({ lang: "ru" }) }));

// eslint-disable-next-line import/first
import { MoiPodpisi } from "../MoiPodpisi";

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

function ответ(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: status < 400, status, json: async () => body })));
}

describe("Мои подписи на /qsign", () => {
  test("вошедший: подпись и отзыв видны со ссылкой на проверку, запрос с Bearer из хранилища", async () => {
    window.localStorage.setItem("aevion_auth_token_v1", "tok123");
    ответ(200, { items: [
      { event: "revoke", signatureId: "ed1a6952-2345-4db0-a702-2c19fedb519d", at: "2026-10-30T13:30:00.000Z", publicUrl: "/qsign/verify/ed1a6952-2345-4db0-a702-2c19fedb519d" },
      { event: "sign", signatureId: "ed1a6952-2345-4db0-a702-2c19fedb519d", at: "2026-10-30T13:29:00.000Z", publicUrl: "/qsign/verify/ed1a6952-2345-4db0-a702-2c19fedb519d" },
    ] });
    const { container } = render(<MoiPodpisi />);
    await waitFor(() => expect(container.textContent).toContain("ed1a6952"));
    expect(container.textContent).toContain("Мои подписи");
    expect(container.textContent).toContain("подписано");
    expect(container.textContent).toContain("отозвано");
    expect(container.querySelectorAll('a[href="/qsign/verify/ed1a6952-2345-4db0-a702-2c19fedb519d"]').length).toBe(2);
    const [url, init] = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toContain("/api/qsign/v2/audit");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok123");
  });

  test("перерисовки страницы (ввод в поле токена) не шлют новых запросов", async () => {
    window.localStorage.setItem("aevion_auth_token_v1", "tok123");
    ответ(200, { items: [] });
    const { rerender } = render(<MoiPodpisi />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    for (let i = 0; i < 5; i++) await act(async () => { rerender(<MoiPodpisi />); });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("пусто — честное «пока ничего»", async () => {
    window.localStorage.setItem("aevion_auth_token_v1", "tok123");
    ответ(200, { items: [] });
    const { container } = render(<MoiPodpisi />);
    await waitFor(() => expect(container.textContent).toContain("Вы пока ничего не подписали"));
  });

  test("отказ сервера — текст ошибки, НЕ «пусто»", async () => {
    window.localStorage.setItem("aevion_auth_token_v1", "tok123");
    ответ(500, { error: "x" });
    const { container } = render(<MoiPodpisi />);
    await waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain("Не удалось загрузить"));
    expect(container.textContent).not.toContain("Вы пока ничего не подписали");
  });

  test("гость без входа — блока нет и запроса нет", async () => {
    ответ(200, { items: [] });
    const { container } = render(<MoiPodpisi />);
    await act(async () => {});
    expect(container.querySelector("[data-qsign-mine]")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
