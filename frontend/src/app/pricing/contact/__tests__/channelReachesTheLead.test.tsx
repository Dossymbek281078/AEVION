/**
 * Заявка с /pricing/contact несёт метку канала ?c= (mail-pb340), чтобы её
 * можно было привязать к письму. Источник метки тот же, что у записи DevHub:
 * меткаЗаходаДляЗаписи.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";

const параметры = { объект: new URLSearchParams("") };
vi.mock("next/navigation", () => ({
  useSearchParams: () => параметры.объект,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/pricing/contact",
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
  try { sessionStorage.clear(); } catch {}
});

async function отправить(поиск: string) {
  параметры.объект = new URLSearchParams(поиск);
  window.history.replaceState({}, "", поиск ? `/pricing/contact?${поиск}` : "/pricing/contact");
  const запросы: Array<{ адрес: string; тело: string }> = [];
  vi.stubGlobal("fetch", async (адрес: unknown, настройки?: { body?: unknown }) => {
    запросы.push({ адрес: String(адрес), тело: String(настройки?.body ?? "") });
    return { ok: true, status: 200, json: async () => ({ id: "lead-1" }) };
  });
  const m = await import("@/app/pricing/contact/page");
  const Страница = m.default as () => import("react").JSX.Element;
  await act(async () => {
    render(<I18nProvider><Страница /></I18nProvider>);
  });
  const почта = document.querySelector('input[type="email"]') as HTMLInputElement;
  const имя = Array.from(document.querySelectorAll("input")).find((p) => p !== почта) as HTMLInputElement;
  fireEvent.change(имя, { target: { value: "Проверка" } });
  fireEvent.change(почта, { target: { value: "a@b.co" } });
  await act(async () => {
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
  });
  const лид = запросы.find((з) => з.адрес.includes("/api/pricing/lead"));
  expect(лид, "форма не отправила обращение").toBeTruthy();
  return JSON.parse(лид!.тело) as Record<string, unknown>;
}

describe("метка канала в заявке", () => {
  it("?c=mail-pb340 → channel в теле запроса", async () => {
    const тело = await отправить("topic=bureau&c=mail-pb340");
    expect(тело.channel).toBe("mail-pb340");
  }, 60000);

  it("без метки поле channel не уходит", async () => {
    const тело = await отправить("");
    expect("channel" in тело).toBe(false);
  }, 60000);
});
