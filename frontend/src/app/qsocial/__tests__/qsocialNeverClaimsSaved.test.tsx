import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import QSocialPage from "../page";
import { I18nProvider } from "@/lib/i18n";

/**
 * Ни пост, ни личное сообщение не должны выглядеть сохранёнными, если ручка
 * ответила `storage: "memory"`.
 *
 * Запасной путь qsocial отвечает 2xx с теми же полями, что и настоящий, —
 * различает их только `storage`. Экран об этом не предупреждает (в отличие от
 * формы сигналов mapReality, где написано «in-memory if DB unavailable»),
 * поэтому человек видит свой пост в ленте и считает его опубликованным, а
 * запись живёт до ближайшего перезапуска.
 *
 * Проверяем ПОВЕДЕНИЕ: что видит человек и остался ли его текст.
 */

function stubFetch(postStorage: string) {
  return vi.fn().mockImplementation((url: unknown, init?: { method?: string }) => {
    const u = String(url);
    const json = (body: object, ok = true, status = 200) =>
      Promise.resolve({ ok, status, json: async () => body } as unknown as Response);

    if (init?.method === "POST" && u.includes("/api/qsocial/posts")) {
      return json({ post: { id: "p1", content: "x", tags: [] }, storage: postStorage });
    }
    // всё остальное на монтировании — пустые ответы
    return json({ posts: [], stories: [], conversations: [], notifications: [], stats: {} });
  });
}

function renderPage() {
  return render(
    <I18nProvider>
      <QSocialPage />
    </I18nProvider>,
  );
}

// Лента показывается только вошедшему: currentUserId берётся из JWT в
// localStorage. Кладём поддельный токен — подпись здесь не проверяется,
// разбирается только payload.sub.
const FAKE_JWT =
  "h." + Buffer.from(JSON.stringify({ sub: "u1" })).toString("base64") + ".s";

beforeEach(() => {
  try { localStorage.setItem("aevion_auth_token_v1", FAKE_JWT); } catch {}
});

afterEach(() => {
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch {}
});

describe("qsocial: успех только при постоянном сохранении", () => {
  it("контроль прибора: страница рисуется и есть поле ввода поста", async () => {
    vi.stubGlobal("fetch", stubFetch("db"));
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
    });
  });

  it("при сохранении поста в память показывает отказ и не стирает текст", async () => {
    vi.stubGlobal("fetch", stubFetch("memory"));
    renderPage();
    const box = (await waitFor(() => screen.getAllByRole("textbox")))[0] as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "Мой пост" } });
    const btns = screen.getAllByRole("button");
    fireEvent.click(btns[btns.length - 1]);
    await waitFor(() => {
      expect(document.body.textContent ?? "", "человеку не сказали повторить")
        .toContain("отправьте ещё раз");
    });
    expect(box.value, "текст поста стёрт, хотя сохранить не удалось").toBe("Мой пост");
  });
});
