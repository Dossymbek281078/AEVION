import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { I18nProvider, useI18n } from "../i18n";
import { ServerLangProvider } from "../serverLangContext";

/**
 * Обёртка серверного языка: lang следует языку кадра (после смены языка в клиенте не
 * устаревает), data-server-lang остаётся серверным (по нему curl-приёмка).
 */
let сменить: (l: "en" | "ru" | "kk") => void = () => {};
function Кнопка() {
  сменить = useI18n().setLang as typeof сменить;
  return null;
}

afterEach(() => { cleanup(); try { localStorage.clear(); } catch { /* пусто */ } });

describe("ServerLangProvider", () => {
  it("SSR: lang и data-server-lang равны серверному языку", () => {
    const html = renderToString(<I18nProvider><ServerLangProvider lang="ru"><i /></ServerLangProvider></I18nProvider>);
    expect(html).toContain('lang="ru"');
    expect(html).toContain('data-server-lang="ru"');
  });

  it("🔴 после смены языка в клиенте lang меняется, data-server-lang — нет", async () => {
    const { container } = render(
      <I18nProvider><ServerLangProvider lang="ru"><Кнопка /></ServerLangProvider></I18nProvider>,
    );
    await act(async () => { сменить("kk"); });
    const div = container.querySelector("[data-server-lang]")!;
    expect(div.getAttribute("lang")).toBe("kk");
    expect(div.getAttribute("data-server-lang")).toBe("ru");
  });

  it("без провайдера языка (тест одиночного компонента) — серверный язык", () => {
    const { container } = render(<ServerLangProvider lang="en"><i /></ServerLangProvider>);
    expect(container.querySelector("[data-server-lang]")!.getAttribute("lang")).toBe("en");
  });
});
