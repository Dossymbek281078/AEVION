// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";

/*
 * 🔴 /proof — страница для англоязычных писем: целиком en при любой локали и сохранённом
 * выборе, html lang=en. Повод 13.10.2026 (bd, 2 кадра ru-RU): шапка «Доверие · IP · Globus»
 * и «$490 … in 7 дней» — провайдер брал ru, живой слой переводил фрагменты. Правило в
 * языкИзЗапроса (i18n.tsx): путь /proof → en, без записи в хранилище.
 */
describe("/proof всегда по-английски", () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} document.documentElement.removeAttribute("data-lang-src"); document.documentElement.lang = ""; });

  it("🔴 на /proof при сохранённом ru провайдер ставит en и помечает решение", async () => {
    localStorage.setItem("aevion_lang_v1", "ru");
    window.history.pushState({}, "", "/proof?c=probe-user-99");
    render(<I18nProvider><div /></I18nProvider>);
    await waitFor(() => expect(document.documentElement.lang).toBe("en"));
    expect(document.documentElement.getAttribute("data-lang-src")).toBe("provider");
    expect(localStorage.getItem("aevion_lang_v1"), "выбор посетителя не переписан").toBe("ru");
  });

  it("КОНТРОЛЬ: на /devhub при сохранённом ru остаётся ru", async () => {
    localStorage.setItem("aevion_lang_v1", "ru");
    window.history.pushState({}, "", "/devhub?c=probe-user-99");
    render(<I18nProvider><div /></I18nProvider>);
    await waitFor(() => expect(document.documentElement.lang).toBe("ru"));
  });
});
