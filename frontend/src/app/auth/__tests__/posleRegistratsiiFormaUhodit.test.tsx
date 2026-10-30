import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor, fireEvent, screen } from "@testing-library/react";
import { ToastProvider } from "@/components/ToastProvider";

/**
 * 🔴 После регистрации на /auth (без next) форма не остаётся под карточкой «вы вошли».
 *
 * Замер прода 30.10.2026: человек зарегистрировался, над формой появилась карточка
 * вошедшего, а полная форма «Создать аккаунт» ниже осталась — с введёнными почтой
 * и паролем (пароль жил в DOM). Выглядело как «ничего не произошло».
 * Теперь: есть сессия (токен + ответ /me) → ни формы, ни полей пароля, ни вкладок;
 * карточка со следующими шагами остаётся. Параметр next (returnTo.ts) не тронут.
 */

vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@/components/PipelineSteps", () => ({ PipelineSteps: () => null }));
vi.mock("@/components/ProductPageShell", () => ({
  ProductPageShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// eslint-disable-next-line import/first
import AuthPage from "../page";

const ПОЛЬЗОВАТЕЛЬ = { id: "u1", name: "Анна Тест", email: "anna@example.com", role: "USER" };

function stubFetch() {
  return vi.fn(async (url: string) => {
    const u = String(url);
    const body = u.includes("/api/auth/register")
      ? { token: "aaa.bbb.ccc" }
      : u.includes("/api/auth/me")
        ? { user: ПОЛЬЗОВАТЕЛЬ }
        : { providers: [] };
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* пусто */ }
});

describe("/auth после успешной регистрации", () => {
  it("🔴 форма и пароль убраны, карточка вошедшего осталась", async () => {
    vi.stubGlobal("fetch", stubFetch());
    Object.defineProperty(window, "location", {
      value: new URL("https://aevion.app/auth") as unknown as Location,
      writable: true,
    });
    const { container } = render(
      <ToastProvider>
        <AuthPage />
      </ToastProvider>,
    );

    // контроль прибора: до входа форма есть
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Анна Тест" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "anna@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Str0ng-Passw0rd!" } });
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(container.textContent ?? "").toContain("anna@example.com · USER"));
    expect(container.querySelector('input[type="password"]'), "поле пароля после входа").toBeNull();
    expect(screen.queryByRole("button", { name: "Create account" }), "кнопка регистрации").toBeNull();
    expect(screen.queryByLabelText("Email"), "поле почты").toBeNull();
    expect(container.innerHTML).not.toContain("Str0ng-Passw0rd!");
  });
});
