import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import IdeaMarket from "../IdeaMarket";

/**
 * Форма подачи идеи в венчурный маркет не имеет права показывать успех и
 * очищать поля, когда идея сохранена только в памяти процесса.
 *
 * Опасность здесь выше обычной: запасной ответ ручки несёт не только
 * `storage: "memory"`, но и `note: "Идея принята — попадёт на маркет после
 * проверки"`. Форма показывала ИМЕННО ЭТУ фразу как подтверждение и стирала
 * набранное — то есть сервер сам поставлял успокаивающий текст для пути,
 * который теряет идею при ближайшем перезапуске.
 *
 * Проверяем ПОВЕДЕНИЕ: что видит человек и остался ли его текст.
 */

function reply(body: object) {
  return vi.fn().mockImplementation((url: string) => {
    // список идей формой запрашивается отдельно — отдаём пустой
    if (typeof url === "string" && !url.includes("/submit")) {
      return Promise.resolve({ ok: true, json: async () => ({ ideas: [] }) } as unknown as Response);
    }
    return Promise.resolve({ ok: true, status: 201, json: async () => body } as unknown as Response);
  });
}

const payload = (storage: string) => ({
  ok: true, id: "v1", status: "pending",
  note: "Идея принята — попадёт на маркет после проверки.",
  storage,
});

async function submitIdea() {
  const boxes = screen.getAllByRole("textbox");
  fireEvent.change(boxes[0], { target: { value: "Моя венчурная идея" } });
  const btns = screen.getAllByRole("button");
  fireEvent.click(btns[btns.length - 1]);
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("венчурный маркет: успех только при постоянном сохранении", () => {
  it("контроль прибора: при сохранении в базу показывается подтверждение", async () => {
    vi.stubGlobal("fetch", reply(payload("db")));
    render(<IdeaMarket />);
    await submitIdea();
    await waitFor(() => {
      expect(document.body.textContent ?? "").toContain("Идея принята");
    });
  });

  it("при сохранении в память НЕ показывает «Идея принята» и не стирает текст", async () => {
    vi.stubGlobal("fetch", reply(payload("memory")));
    render(<IdeaMarket />);
    await submitIdea();
    await waitFor(() => {
      const t = document.body.textContent ?? "";
      expect(t, "форма показала успокаивающую фразу сервера").not.toContain("попадёт на маркет");
      expect(t, "человеку не сказали повторить").toContain("ещё раз");
    });
    expect(
      (screen.getAllByRole("textbox")[0] as HTMLInputElement).value,
      "текст идеи стёрт, хотя сохранить не удалось",
    ).toBe("Моя венчурная идея");
  });
});
