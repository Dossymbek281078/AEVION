import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor, fireEvent, screen } from "@testing-library/react";
import { ToastProvider } from "@/components/ToastProvider";
import { translations } from "@/lib/i18n-all";

/**
 * Согласие на письма (4.11.2026): галочка «Присылать новости и предложения AEVION»
 * при регистрации — по умолчанию ВЫКЛЮЧЕНА, в запрос уходит строго булево значение;
 * подпись есть на ru/en/kk; в кабинете есть выключатель с теми же языками.
 */

vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@/components/PipelineSteps", () => ({ PipelineSteps: () => null }));
vi.mock("@/components/ProductPageShell", () => ({
  ProductPageShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// eslint-disable-next-line import/first
import AuthPage from "../page";

const bodies: unknown[] = [];

function stubFetch() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/api/auth/register")) bodies.push(JSON.parse(String(init?.body ?? "{}")));
    const body = u.includes("/api/auth/register")
      ? { token: "aaa.bbb.ccc" }
      : u.includes("/api/auth/me")
        ? { user: { id: "u1", name: "Анна", email: "anna@example.com", role: "USER" } }
        : { providers: [] };
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  bodies.length = 0;
  try { localStorage.clear(); } catch { /* пусто */ }
});

function открыть() {
  vi.stubGlobal("fetch", stubFetch());
  Object.defineProperty(window, "location", { value: new URL("https://aevion.app/auth") as unknown as Location, writable: true });
  render(<ToastProvider><AuthPage /></ToastProvider>);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Анна" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "anna@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Str0ng-Passw0rd!" } });
}

describe("/auth: галочка согласия на письма", () => {
  it("по умолчанию выключена, регистрация шлёт marketingConsent=false", async () => {
    открыть();
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(bodies.length).toBe(1));
    expect((bodies[0] as { marketingConsent: unknown }).marketingConsent).toBe(false);
  });

  it("поставил галочку — marketingConsent=true", async () => {
    открыть();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(bodies.length).toBe(1));
    expect((bodies[0] as { marketingConsent: unknown }).marketingConsent).toBe(true);
  });
});

describe("тексты согласия на ru/en/kk", () => {
  const ключи = [
    "auth.form.marketingConsent",
    "account.marketing.title",
    "account.marketing.desc",
    "account.marketing.on",
    "account.marketing.off",
    "account.marketing.fail",
  ];
  for (const lang of ["ru", "en", "kk"] as const) {
    it(`${lang}: все ключи заполнены`, () => {
      const d = translations[lang] as Record<string, string>;
      for (const k of ключи) expect(d[k], `${lang}:${k}`).toBeTruthy();
    });
  }

  it("в ru подпись галочки — как в задаче", () => {
    expect((translations.ru as Record<string, string>)["auth.form.marketingConsent"]).toBe("Присылать новости и предложения AEVION");
  });
});
