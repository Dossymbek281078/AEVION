import { describe, test, expect, vi, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";

/**
 * 🔴 19.10.2026: переход с /verify «Для бюро и патентных поверенных» нёс
 * topic=bureau, а форма его не читала (замер Продаж 23:25 на проде: текст той же
 * длины с параметром и без, отрасль «— select —»). Путь «увидел доказательство →
 * написал нам» приходил безликим. Теперь тема даёт свой заголовок и предвыбранную
 * отрасль «Патентные бюро и поверенные»; контроль — другая тема ничего из этого
 * не получает.
 */
let ПАРАМЕТРЫ = new URLSearchParams("topic=bureau&app=ip_bureau&tier=lite&c=mail-plis01");

vi.mock("next/navigation", () => ({
  useSearchParams: () => ПАРАМЕТРЫ,
}));

// eslint-disable-next-line import/first
import { I18nProvider } from "@/lib/i18n";

async function отрисовать() {
  const { default: Страница } = await import("../page");
  const { container } = render(
    <I18nProvider>
      <Страница />
    </I18nProvider>,
  );
  await waitFor(() => expect(container.querySelectorAll("select").length).toBeGreaterThan(0), { timeout: 15000 });
  return container;
}

afterEach(() => cleanup());

describe("форма связи читает тему «бюро»", () => {
  test("topic=bureau: заголовок про бюро, отрасль предвыбрана, тариф из адреса сохранён", async () => {
    const c = await отрисовать();
    const h1 = c.querySelector("h1")?.textContent ?? "";
    expect(h1.toLowerCase(), `заголовок: ${h1}`).toMatch(/бюро|bureau/);
    const отрасль = [...c.querySelectorAll("select")].find((s) => [...s.options].some((o) => /Патентные бюро/.test(o.textContent ?? "") || /Patent bureaus/.test(o.textContent ?? "")));
    expect(отрасль, "в списке отраслей нет пункта про патентные бюро").toBeTruthy();
    await waitFor(() => expect((отрасль as HTMLSelectElement).value).toBe("Патентные бюро и поверенные"), { timeout: 5000 });
    const тариф = [...c.querySelectorAll("select")].find((s) => s !== отрасль && [...s.options].some((o) => o.value === "lite"));
    expect((тариф as HTMLSelectElement | undefined)?.value, "tier=lite из адреса").toBe("lite");
  });

  test("КОНТРОЛЬ: другая тема — общий заголовок и пустая отрасль", async () => {
    ПАРАМЕТРЫ = new URLSearchParams("topic=refund");
    const c = await отрисовать();
    const h1 = c.querySelector("h1")?.textContent ?? "";
    expect(h1.toLowerCase()).not.toMatch(/бюро|bureau/);
    const отрасль = [...c.querySelectorAll("select")].find((s) => [...s.options].some((o) => /Патентные бюро|Patent bureaus/.test(o.textContent ?? "")));
    expect((отрасль as HTMLSelectElement).value).toBe("");
  });
});
