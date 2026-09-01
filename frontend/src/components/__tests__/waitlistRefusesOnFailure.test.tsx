import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { WaitlistCapture } from "../WaitlistCapture";

/**
 * Форма подписки не говорит «адрес записан», если он не записан.
 *
 * Найдено мутационным свипом 01.09.2026: подмена `if (r.ok)` на `if (true)` —
 * то есть «объявляем успех, не глядя на ответ» — НЕ ловилась ни одним тестом.
 * Сторожей у формы шесть, и все проверяют её работу при УДАЧНОМ ответе.
 *
 * Цена ошибки здесь выше обычной: список раннего доступа — главный актив
 * воронки, и человек, увидевший «готово», больше не вернётся. Письма в день
 * запуска он не получит, и никто из нас об этом не узнает.
 *
 * Сам компонент написан бережно — он даже различает, легла подписка в базу или
 * во временное хранилище, и второе честно показывает отказом. Но эта
 * аккуратность НИЧЕМ не была закреплена: убери проверку ответа, и всё
 * заботливое ниже станет недостижимым.
 */

const ГОТОВО = "Готово";
const ПОЛЕ = /email|почт|адрес/i;

function ответ(init: { ok: boolean; status: number; body?: unknown }) {
  globalThis.fetch = vi.fn(async () => ({
    ok: init.ok,
    status: init.status,
    json: async () => init.body ?? {},
  })) as unknown as typeof fetch;
}

async function отправить(email = "chelovek@example.com") {
  const поле = screen.getByPlaceholderText(ПОЛЕ) as HTMLInputElement;
  fireEvent.change(поле, { target: { value: email } });
  fireEvent.submit(поле.closest("form")!);
}

describe("форма подписки не обещает того, чего не произошло", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("контроль: при удачном сохранении говорит «готово»", async () => {
    // Без этой стороны проверка «не говорит готово» была бы зелёной и на
    // форме, которая не работает вовсе.
    ответ({ ok: true, status: 200, body: { storage: "postgres" } });
    render(<WaitlistCapture source="test" />);
    await отправить();
    await waitFor(() => expect(screen.getByText(new RegExp(ГОТОВО))).toBeTruthy());
  });

  it("сервер ответил 500 — «готово» НЕ говорим", async () => {
    ответ({ ok: false, status: 500 });
    render(<WaitlistCapture source="test" />);
    await отправить();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(
      screen.queryByText(new RegExp(ГОТОВО)),
      "сервер отказал, а человек уверен, что он в списке — письма он не получит",
    ).toBeNull();
  });

  it("сохранено во ВРЕМЕННОЕ хранилище — тоже не «готово»", async () => {
    // Это свойство компонент уже имел; закрепляю, чтобы оно не исчезло вместе
    // с проверкой ответа: подписка, не пережившая перезапуск, потеряна так же.
    ответ({ ok: true, status: 200, body: { storage: "memory" } });
    render(<WaitlistCapture source="test" />);
    await отправить();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByText(new RegExp(ГОТОВО))).toBeNull();
  });

  it("сеть недоступна — «готово» НЕ говорим", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    render(<WaitlistCapture source="test" />);
    await отправить();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByText(new RegExp(ГОТОВО))).toBeNull();
  });
});
