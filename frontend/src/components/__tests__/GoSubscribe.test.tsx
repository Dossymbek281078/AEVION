import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GoSubscribe } from "../GoSubscribe";

// Сбор почты на /go. До него страница предлагала только два исхода: купить
// сейчас или уйти навсегда — а первой карточкой там стоит бесплатный
// инструмент, поэтому оплаченный клик чаще заканчивался вторым.
//
// Главное, что проверяется: канал уезжает вместе с адресом. Подписчик без
// источника отвечает на вопрос «сколько их», но не на вопрос «какой канал их
// привёл», ради которого метки и заводились.

vi.setConfig({ testTimeout: 20_000 });

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ ok: true }) }) as never;
});
afterEach(() => vi.restoreAllMocks());

function submit(email = "reader@example.com") {
  fireEvent.change(screen.getByLabelText("Электронная почта"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: /Подписаться/ }));
}

describe("GoSubscribe", () => {
  it("отправляет адрес вместе с каналом", async () => {
    render(<GoSubscribe channel="instagram" />);
    submit();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse((global.fetch as unknown as { mock: { calls: [string, { body: string }][] } }).mock.calls[0][1].body);
    expect(body.email).toBe("reader@example.com");
    expect(body.source).toBe("go:instagram");
  });

  it("без канала источник всё равно осмысленный, а не пустой", async () => {
    render(<GoSubscribe channel={null} />);
    submit();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse((global.fetch as unknown as { mock: { calls: [string, { body: string }][] } }).mock.calls[0][1].body);
    expect(body.source).toBe("go");
  });

  it("после успеха показывает подтверждение, а не форму", async () => {
    render(<GoSubscribe channel="facebook" />);
    submit();
    expect(await screen.findByText(/адрес записан/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Подписаться/ })).toBeNull();
  });

  it("ошибку показывает честно, а не молчаливым спасибо", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network")) as never;
    render(<GoSubscribe channel="facebook" />);
    submit();
    // Человек оставил адрес и вправе знать, что он не дошёл.
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText(/адрес записан/i)).toBeNull();
  });

  it("ограничение по частоте объясняется как «позже», а не как ошибка адреса", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }) as never;
    render(<GoSubscribe channel="facebook" />);
    submit();
    expect((await screen.findByRole("alert")).textContent).toMatch(/через несколько минут/i);
  });

  it("отказ сервера по адресу объясняется как опечатка", async () => {
    // Форму с заведомо кривым адресом браузер не отправит сам — type=email
    // и required отсекают до fetch. Проверяем другой случай: адрес выглядит
    // правильно, но сервер его не принял (например, домен-однодневка).
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({}) }) as never;
    render(<GoSubscribe channel="facebook" />);
    submit("reader@example.com");
    expect((await screen.findByRole("alert")).textContent).toMatch(/опечатк/i);
  });

  it("повторное нажатие не отправляет второй раз", async () => {
    render(<GoSubscribe channel="facebook" />);
    fireEvent.change(screen.getByLabelText("Электронная почта"), { target: { value: "a@b.co" } });
    const btn = screen.getByRole("button", { name: /Подписаться/ });
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  });
});
