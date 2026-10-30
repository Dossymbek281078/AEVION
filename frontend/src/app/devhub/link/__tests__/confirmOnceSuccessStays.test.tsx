import { describe, test, expect, vi, afterEach } from "vitest";
import { render, waitFor, act, cleanup } from "@testing-library/react";

/**
 * Ссылка из письма «Подключить покупку» подтверждается ОДИН раз, и успех не
 * перетирается поздним отказом.
 *
 * Замер прода 30.10.2026: на одну загрузку /devhub/link?id=…&token=… уходило
 * два POST /guest/link-confirm — эффект зависел от t, а t менялся, когда язык
 * догружался (en → ru). На настоящей ссылке первый вызов подключал покупку,
 * второй получал 400 «уже использована» и ставил на экран «Ссылка не подошла».
 */

let язык = "en";
vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));
// t меняет ссылку при смене языка — как настоящий useDevhubT
vi.mock("../../i18n", () => ({
  useDevhubT: () => {
    const l = язык;
    return (k: string) => `${l}:${k}`;
  },
}));

// eslint-disable-next-line import/first
import DevHubLinkPage from "../page";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); язык = "en"; window.history.replaceState(null, "", "/"); });

describe("/devhub/link: подтверждение один раз, успех стоит", () => {
  test("смена языка после монтирования не шлёт второй confirm и не стирает успех", async () => {
    window.history.replaceState(null, "", "/devhub/link?id=abc&token=tok");
    let вызовов = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("link-confirm")) {
        вызовов += 1;
        // первый — успех, любой следующий — «уже использована»
        return вызовов === 1
          ? { ok: true, status: 200, json: async () => ({ ok: true }) }
          : { ok: false, status: 400, json: async () => ({ ok: false, error: "link_invalid" }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }));
    const { container, rerender } = render(<DevHubLinkPage />);
    await waitFor(() => expect(container.textContent).toContain("link.confirmed"));
    // язык догрузился — новый t, перерисовка
    язык = "ru";
    await act(async () => { rerender(<DevHubLinkPage />); });
    await new Promise((r) => setTimeout(r, 50));
    expect(вызовов).toBe(1);
    expect(container.textContent).toContain("link.confirmed");
    expect(container.textContent).not.toContain("link.confirmFailed");
  });

  test("контроль: настоящий отказ показывается отказом", async () => {
    window.history.replaceState(null, "", "/devhub/link?id=abc&token=bad");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ ok: false }) })));
    const { container } = render(<DevHubLinkPage />);
    await waitFor(() => expect(container.textContent).toContain("link.confirmFailed"));
  });
});
