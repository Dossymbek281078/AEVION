import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SubmitIdeaForm } from "../SubmitIdeaForm";

/**
 * Форма отправки идеи не имеет права показывать успех и СБРАСЫВАТЬ текст,
 * когда идея сохранена только в памяти процесса.
 *
 * Ручка честна: запасной путь помечен `storage: "memory"`. Признак завели
 * 19.08.2026, когда нашли, что такой ответ «неотличим от настоящего, включая
 * contentHash, по которому человек считает идею защищённой». Но форма его не
 * читала: показывала успех, вызывала onSubmitted и очищала поля — человек
 * терял набранный текст, а запись жила до ближайшего перезапуска.
 *
 * Проверяем ПОВЕДЕНИЕ, а не текст исходника.
 */

function answer(body: object) {
  return vi.fn().mockResolvedValue({
    ok: true, status: 201, json: async () => body,
  } as unknown as Response);
}

const payload = (storage: string) => ({
  success: true,
  data: { id: "i1", qrightProtected: false, contentHash: "abc", storage },
});

async function fill() {
  const boxes = screen.getAllByRole("textbox");
  fireEvent.change(boxes[0], { target: { value: "Моя идея" } });
  if (boxes[1]) fireEvent.change(boxes[1], { target: { value: "Описание идеи подробно" } });
  fireEvent.click(screen.getByRole("button", { name: /.+/ }));
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("отправка идеи: успех только при постоянном сохранении", () => {
  it("контроль прибора: при сохранении в базу вызывается onSubmitted", async () => {
    vi.stubGlobal("fetch", answer(payload("db")));
    const onSubmitted = vi.fn();
    render(<SubmitIdeaForm onSubmitted={onSubmitted} />);
    await fill();
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
  });

  it("при сохранении в память НЕ показывает успех и не теряет текст", async () => {
    vi.stubGlobal("fetch", answer(payload("memory")));
    const onSubmitted = vi.fn();
    render(<SubmitIdeaForm onSubmitted={onSubmitted} />);
    await fill();
    await waitFor(() => {
      expect(onSubmitted, "форма приняла временное сохранение за успех").not.toHaveBeenCalled();
      expect(document.body.textContent ?? "").toContain("ещё раз");
    });
    expect(
      (screen.getAllByRole("textbox")[0] as HTMLInputElement).value,
      "текст идеи стёрт, хотя сохранить не удалось",
    ).toBe("Моя идея");
  });
});
