import { describe, test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import NotFound from "../not-found";

/*
 * 30.10.2026, Sentry JAVASCRIPT-NEXTJS-3: POST /index с заголовком server action
 * рендерит not-found БЕЗ корневого I18nProvider. Страница 404 обязана
 * рисоваться и без провайдера (раньше useI18n бросал -> 500).
 */
describe("not-found без I18nProvider", () => {
  afterEach(cleanup);

  test("рендерится без броска и ведёт на главную", () => {
    render(<NotFound />);
    expect(screen.getByText("404")).toBeTruthy();
    const home = Array.from(document.querySelectorAll("a")).find((a) => a.getAttribute("href") === "/");
    expect(home).toBeTruthy();
  });
});
