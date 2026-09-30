import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { AgentDock } from "@/components/AgentDock";

/**
 * ПЛАВАЮЩАЯ КНОПКА ПОМОЩНИКА НЕ СЪЕДАЕТ НИЗ ТЕЛЕФОННОГО ЭКРАНА.
 *
 * Замер 30.09.2026 в рамке 390 px: «✦ AI Агент» — 113×46 в правом нижнем углу,
 * 20 px от низа, z-index 9998. Она висит над содержимым на любой прокрутке и
 * накрывает правый край нижней строки — включая кнопки покупки в карточках
 * приложений. На телефоне это прямая потеря: человек жмёт «Купить», попадает
 * в помощника.
 *
 * Решение: на узком экране подпись прячется, остаётся значок (46×46) — втрое
 * меньше площади. Доступное имя (aria-label) не меняется, поэтому для
 * скринридера ничего не теряется.
 *
 * Чего проверка НЕ делает: не меряет пиксели и перекрытия — стенд не
 * раскладывает страницу. Площадь меряется браузером на проде.
 */

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

afterEach(() => cleanup());

describe("кнопка помощника на телефоне", () => {
  it("подпись отделена классом, значок остаётся", () => {
    const { container } = render(<AgentDock />);
    const кнопка = container.querySelector("button.aev-agent-launcher");
    expect(кнопка, "у кнопки нет класса — её нечем сжать на телефоне").not.toBeNull();
    expect(
      кнопка!.querySelector(".aev-agent-label"),
      "подпись не отделена: спрятать её на телефоне нечем",
    ).not.toBeNull();
    expect(кнопка!.textContent, "значок пропал — кнопка станет пустой").toContain("✦");
  });

  it("доступное имя сохраняется — для скринридера ничего не меняется", () => {
    const { container } = render(<AgentDock />);
    const кнопка = container.querySelector("button.aev-agent-launcher")!;
    expect(кнопка.getAttribute("aria-label"), "без доступного имени значок станет немым").toBeTruthy();
  });

  it("правило скрытия подписи есть в стилях", () => {
    const { container } = render(<AgentDock />);
    const стиль = [...container.querySelectorAll("style")].map((s) => s.textContent || "").join(" ");
    expect(стиль, "нет медиазапроса — на телефоне кнопка останется широкой").toMatch(/max-width:\s*700px/);
    expect(стиль.replace(/\s+/g, ""), "подпись не прячется").toContain(".aev-agent-label{display:none");
  });

  it("КОНТРОЛЬ: на широком экране подпись остаётся в разметке", () => {
    // Прячем её медиазапросом, а не удаляем: на десктопе «AI Agent» словами
    // понятнее значка, и терять это ради телефона незачем.
    const { container } = render(<AgentDock />);
    expect(container.textContent).toContain("AI Agent");
  });
});
