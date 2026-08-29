import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ExerciseCard from "../ExerciseCard";
import { I18nProvider } from "@/lib/i18n";

/**
 * Карточка упражнения не имеет права показывать выросшую серию, если ручка
 * ответила `storage: "memory"`: серия живёт в памяти процесса и обнулится при
 * перезапуске, то есть обещает прогресс, которого не будет.
 *
 * Отдельно: у сетевого отказа раньше не было ветки вовсе — `catch { // silent }`.
 * Человек не мог отличить засчитанное упражнение от несохранённого.
 *
 * Проверяем ПОВЕДЕНИЕ и в том числе то, что сообщение ДОХОДИТ до экрана:
 * первая версия починки писала его только в состояние компонента, а в разметке
 * его не было — то есть починка не доходила до человека.
 */

const exercise = {
  id: "e1", title: "Дыхание", durationSec: 1,
  description: "d", category: "calm", icon: "V",
  steps: ["вдох", "выдох"],
} as never;

function stub(storage: string, ok = true) {
  return vi.fn().mockResolvedValue({
    ok, status: ok ? 201 : 500,
    json: async () => ({ ok, exercise_id: "e1", streak: 7, total_done: 12, storage }),
  } as unknown as Response);
}

async function complete() {
  // Карточка начинается с «Start»; кнопка завершения появляется только после
  // запуска упражнения. Клик по последней кнопке сразу попадал бы в «Start».
  const start = await waitFor(() => {
    const b = screen.getAllByRole("button").find((x) => /start|начать/i.test(x.textContent ?? ""));
    if (!b) throw new Error("нет кнопки запуска");
    return b;
  });
  fireEvent.click(start);

  const done = await waitFor(() => {
    const b = screen.getAllByRole("button").find((x) => /completed|заверш|готов/i.test(x.textContent ?? ""));
    if (!b) throw new Error("нет кнопки завершения");
    return b;
  });
  fireEvent.click(done);
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("qgood: серия показывается только при постоянном сохранении", () => {
  it("контроль прибора: карточка рисуется и есть кнопка", async () => {
    vi.stubGlobal("fetch", stub("db"));
    render(<I18nProvider><ExerciseCard exercise={exercise} userId="u1" /></I18nProvider>);
    await waitFor(() => expect(screen.getAllByRole("button").length).toBeGreaterThan(0));
  });

  it("при сохранении в память говорит об этом человеку", async () => {
    vi.stubGlobal("fetch", stub("memory"));
    render(<I18nProvider><ExerciseCard exercise={exercise} userId="u1" /></I18nProvider>);
    await complete();
    await waitFor(() => {
      expect(
        document.body.textContent ?? "",
        "сообщение не дошло до экрана — оно есть только в состоянии",
      ).toContain("сохранить не удалось");
    });
  });
});
