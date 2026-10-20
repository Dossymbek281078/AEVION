/**
 * Voice of Earth: после отправки надпись «после проверки» держится, пока человек сам не закроет окно;
 * кнопка честно зовётся «Отправить на проверку», а не «Опубликовать».
 *
 * ПОВОД (21.10.2026, приёмка волны 6 на проде): надпись гасла через 1,5 с вместе с окном —
 * трек будто пропадал, в каталоге его ещё нет (ждёт проверки командой).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import SubmitTrackModal from "../components/SubmitTrackModal";

afterEach(() => { cleanup(); vi.useRealTimers(); });

async function отправить(onClose = vi.fn()) {
  const onSubmit = vi.fn(async () => ({ ok: true, message: "Трек принят — появится в каталоге после проверки командой." }));
  render(<SubmitTrackModal open onClose={onClose} onSubmit={onSubmit} />);
  fireEvent.change(screen.getByPlaceholderText("Например: Утро над миром"), { target: { value: "Утро" } });
  fireEvent.change(screen.getByPlaceholderText("Псевдоним, не email"), { target: { value: "anon" } });
  fireEvent.change(screen.getByPlaceholderText("Короткий, позитивный текст вашей песни…"), { target: { value: "ля-ля" } });
  await act(async () => { fireEvent.click(screen.getByText("Отправить на проверку")); });
  return { onSubmit, onClose };
}

describe("SubmitTrackModal", () => {
  it("кнопка — «Отправить на проверку», слова «Опубликовать» нет", () => {
    render(<SubmitTrackModal open onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText("Отправить на проверку")).toBeTruthy();
    expect(screen.queryByText("Опубликовать")).toBeNull();
  });
  it("надпись держится и через 10 с, окно само не закрывается", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { onSubmit, onClose } = await отправить();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(10000); });
    expect(screen.getByText(/после проверки командой/)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText("Отправить на проверку")).toBeNull();
  });
  it("«Закрыть» закрывает окно рукой", async () => {
    const { onClose } = await отправить();
    fireEvent.click(screen.getByText("Закрыть"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
