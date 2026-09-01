import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

/**
 * ЭКРАН ПОДКЛЮЧЕНИЯ ПОКУПКИ ГОВОРИТ ПРАВДУ ОБ ИСХОДЕ.
 *
 * Рядом живёт guestPurchaseLinkIsReachable — он читает ИСХОДНИК и убеждается,
 * что в файле есть нужные строки. Такой сторож пройдёт и на экране, который
 * при отказе сервера показывает «письмо отправлено»: строки-то на месте.
 *
 * А именно этот исход и опаснее всего. Человек, оплативший доступ, прочитает
 * «письмо отправлено», уйдёт ждать и не вернётся — жалобы не будет, потому
 * что снаружи всё выглядело удачно. Тихий отказ на денежном пути дороже
 * громкого.
 *
 * Утверждения намеренно про КЛЮЧИ словаря, а не про русские фразы: иначе
 * тест краснел бы при любой правке формулировок, а проверяет он не слова.
 */

vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));
// Словарь подменяем на тождество: ключ и есть ожидаемый текст.
vi.mock("../../i18n", () => ({ useDevhubT: () => (k: string) => k }));

import DevHubLinkPage from "../page";

function otvet(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe("экран подключения покупки", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/devhub/link");
  });
  afterEach(() => vi.unstubAllGlobals());

  test("нейтральный ответ показывается как есть", async () => {
    vi.stubGlobal("fetch", otvet(200, { ok: true, message: "нейтрально" }));
    render(<DevHubLinkPage />);
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "kupil@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "link.send" }));
    await waitFor(() => expect(screen.getByText("нейтрально")).toBeTruthy());
  });

  test("отказ сервера НЕ выдаётся за отправленное письмо", async () => {
    // Главная проверка файла. 503 приходит, когда письмо не ушло.
    vi.stubGlobal("fetch", otvet(503, { ok: false, error: "link_unavailable" }));
    render(<DevHubLinkPage />);
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "kupil@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "link.send" }));

    await waitFor(() => expect(screen.getByText("link.requestFailed")).toBeTruthy());
    expect(
      screen.queryByText("link.sent"),
      "при отказе сервера экран говорит, что письмо отправлено",
    ).toBeNull();
  });

  test("негодная ссылка из письма: сказано прямо", async () => {
    window.history.replaceState({}, "", "/devhub/link?id=abc&token=xyz");
    vi.stubGlobal("fetch", otvet(400, { ok: false, error: "link_invalid" }));
    render(<DevHubLinkPage />);
    await waitFor(() => expect(screen.getByText("link.confirmFailed")).toBeTruthy());
    expect(screen.queryByText("link.confirmed"), "негодная ссылка показана как удачная").toBeNull();
  });

  test("годная ссылка подключает покупку (положительный контроль)", async () => {
    // Без него три проверки выше прошли бы и на экране, который отказывает
    // ВСЕГДА, — то есть на сломанном.
    window.history.replaceState({}, "", "/devhub/link?id=abc&token=xyz");
    vi.stubGlobal("fetch", otvet(200, { ok: true }));
    render(<DevHubLinkPage />);
    await waitFor(() => expect(screen.getByText("link.confirmed")).toBeTruthy());
  });
});
