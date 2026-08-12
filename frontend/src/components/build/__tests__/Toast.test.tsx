import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "../Toast";

function Trigger() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.error("Сервис сейчас недоступен.")}>та же</button>
      <button onClick={() => toast.error("Другая беда.")}>другая</button>
      <button onClick={() => toast.success("Сервис сейчас недоступен.")}>тот же текст, успех</button>
    </div>
  );
}

function mount() {
  return render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  );
}

describe("build ToastProvider", () => {
  it("не показывает две одинаковых плашки подряд", async () => {
    // Живой прогон /build/video 12.08: страница грузит несколько источников,
    // все падают об один недоступный сервис, и «Build init failed» вставало
    // дважды — на телефоне это закрывает собой содержимое.
    mount();
    const btn = screen.getByRole("button", { name: "та же" });

    await userEvent.click(btn);
    await userEvent.click(btn);
    await userEvent.click(btn);

    await waitFor(() =>
      expect(screen.getAllByText("Сервис сейчас недоступен.")).toHaveLength(1),
    );
  });

  it("разные сообщения по-прежнему складываются", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: "та же" }));
    await userEvent.click(screen.getByRole("button", { name: "другая" }));

    await waitFor(() => expect(screen.getByText("Другая беда.")).toBeTruthy());
    expect(screen.getByText("Сервис сейчас недоступен.")).toBeTruthy();
  });

  it("одинаковый текст с другим тоном — это другое сообщение", async () => {
    // Успех и ошибка с одним текстом означают разное; схлопывать их нельзя.
    mount();
    await userEvent.click(screen.getByRole("button", { name: "та же" }));
    await userEvent.click(screen.getByRole("button", { name: "тот же текст, успех" }));

    await waitFor(() =>
      expect(screen.getAllByText("Сервис сейчас недоступен.")).toHaveLength(2),
    );
  });
});
