import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import QNewsPage from "../page";
import { I18nProvider } from "@/lib/i18n";

/**
 * Форма подачи статьи не имеет права печатать «Статья опубликована!», если
 * ручка ответила `storage: "memory"`.
 *
 * Запасной путь `POST /api/qnews/articles` отвечает 201 с теми же полями, что
 * и настоящий, — различает их только `storage`. Экран об этом не
 * предупреждает (в отличие от формы сигналов mapReality, где написано
 * «in-memory if DB unavailable»), а слово «опубликована» — про публичность.
 * Форма закрывалась, поля очищались, и человек считал статью вышедшей, тогда
 * как запись жила до ближайшего перезапуска.
 */

const FAKE_JWT = "h." + Buffer.from(JSON.stringify({ sub: "u1" })).toString("base64") + ".s";

function stubFetch(storage: string) {
  return vi.fn().mockImplementation((url: unknown, init?: { method?: string }) => {
    const u = String(url);
    const json = (body: object, status = 200) =>
      Promise.resolve({ ok: status < 400, status, json: async () => body } as unknown as Response);
    if (init?.method === "POST" && u.includes("/qnews/articles")) {
      return json({ article: { id: "a1", title: "t" }, storage }, 201);
    }
    return json({ articles: [], stats: {}, digest: null });
  });
}

beforeEach(() => { try { localStorage.setItem("aevion_auth_token_v1", FAKE_JWT); } catch {} });
afterEach(() => { vi.unstubAllGlobals(); try { localStorage.clear(); } catch {} });

function openForm() {
  const btn = screen.getAllByRole("button").find((b) =>
    /предлож|добав|подать|submit|\+/i.test(b.textContent ?? ""));
  if (btn) fireEvent.click(btn);
  return btn;
}

describe("qnews: «опубликована» только когда статья сохранена", () => {
  it("контроль прибора: страница рисуется и есть кнопка подачи", async () => {
    vi.stubGlobal("fetch", stubFetch("db"));
    render(<I18nProvider><QNewsPage /></I18nProvider>);
    await waitFor(() => expect(screen.getAllByRole("button").length).toBeGreaterThan(0));
    expect(openForm(), "не нашёл кнопку открытия формы").toBeTruthy();
  });

  it("при сохранении в память НЕ печатает «опубликована»", async () => {
    vi.stubGlobal("fetch", stubFetch("memory"));
    render(<I18nProvider><QNewsPage /></I18nProvider>);
    await waitFor(() => expect(screen.getAllByRole("button").length).toBeGreaterThan(0));
    openForm();

    const boxes = await waitFor(() => {
      const found = screen.getAllByRole("textbox");
      if (!found.length) throw new Error("форма не открылась");
      return found;
    });
    // Форма требует несколько полей: заполняем все, иначе отправка не уйдёт.
    boxes.forEach((b, i) => {
      const v = i === 2 ? "https://example.com/a" : "Моя статья " + i;
      fireEvent.change(b, { target: { value: v } });
    });

    // Кнопок с этим словом ДВЕ: «+ Опубликовать» открывает форму, «Опубликовать»
    // отправляет. Первая по порядку — открывающая, и клик по ней форму закрыл бы.
    const send = screen.getAllByRole("button").find((b) => (b.textContent ?? "").trim() === "Опубликовать");
    expect(send, "не нашёл кнопку отправки").toBeTruthy();
    fireEvent.click(send!);

    await waitFor(() => {
      const t = document.body.textContent ?? "";
      expect(t, "статья объявлена опубликованной, хотя она в памяти").not.toContain("Статья опубликована");
      expect(t, "человеку не сказали повторить").toContain("ещё раз");
    });
  });
});
