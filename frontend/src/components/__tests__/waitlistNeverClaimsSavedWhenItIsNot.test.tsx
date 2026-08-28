import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WaitlistCapture } from "../WaitlistCapture";

/**
 * Форма приёма адресов не имеет права говорить «записан», когда адрес НЕ
 * сохранён насовсем.
 *
 * Ручка подписки честна: при отказе базы она пишет в журнал, шлёт событие в
 * Sentry и возвращает поле `storage` ("postgres" либо запасное хранилище в
 * памяти процесса). Но правда останавливалась на границе API — форма читала
 * только `r.ok` и в обоих случаях показывала «Готово — адрес записан».
 *
 * Цена именно для запуска: запись в памяти не переживает перезапуск, письмо в
 * день старта такому адресу не уйдёт, а человек ушёл уверенным, что он в
 * списке. Снаружи это неотличимо от успеха.
 *
 * Проверяем ПОВЕДЕНИЕ, а не текст исходника: первая версия этого сторожа
 * искала слово «storage» рядом с веткой успеха и пережила мутацию
 * `if (false)` — то есть охраняла форму, а не способность отказать.
 */

function answer(body: object, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 201 : 500,
    json: async () => body,
  } as unknown as Response);
}

async function submit() {
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "human@example.com" } });
  fireEvent.click(screen.getByRole("button"));
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("приём адресов: «записан» только когда действительно записан", () => {
  it("контроль прибора: при сохранении в базу подтверждение показывается", async () => {
    vi.stubGlobal("fetch", answer({ ok: true, storage: "postgres" }));
    render(<WaitlistCapture source="test" />);
    await submit();
    await waitFor(() => {
      expect(document.body.textContent ?? "").toContain("Готово");
    });
  });

  it("при непостоянном хранении НЕ говорит, что адрес записан", async () => {
    vi.stubGlobal("fetch", answer({ ok: true, storage: "memory" }));
    render(<WaitlistCapture source="test" />);
    await submit();
    await waitFor(() => {
      const t = document.body.textContent ?? "";
      expect(t, "форма сказала «Готово», хотя адрес не сохранён").not.toContain("Готово");
      expect(t, "человеку не сказали, что надо повторить").toContain("ещё раз");
    });
  });
});
