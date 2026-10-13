// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";

/*
 * 🔴 Провайдер языка помечает своё решение на <html>: data-lang-src="provider".
 * Это метка, по которой инлайн-скрипт корневого layout (язык по доле кириллицы)
 * уступает и НЕ переписывает lang. Повод 13.10.2026: /cyberchess у гостя en-US —
 * провайдер ставил en, скрипт через 0,4 с переписывал в ru.
 */
describe("провайдер помечает своё решение языка", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-lang-src");
    try { localStorage.clear(); } catch {}
    window.history.pushState({}, "", "/cyberchess");
  });

  it("🔴 после определения языка на <html> стоит data-lang-src=provider и lang совпадает с решением", async () => {
    localStorage.setItem("aevion_lang_v1", "en");
    render(<I18nProvider><div /></I18nProvider>);
    await waitFor(() => expect(document.documentElement.getAttribute("data-lang-src")).toBe("provider"));
    expect(document.documentElement.lang).toBe("en");
  });

  it("КОНТРОЛЬ: до рендера провайдера метки нет", () => {
    expect(document.documentElement.getAttribute("data-lang-src")).toBeNull();
  });
});
