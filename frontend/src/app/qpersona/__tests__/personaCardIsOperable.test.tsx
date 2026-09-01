import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PersonaCard from "../components/PersonaCard";

/**
 * Карточка витрины кликабельна — значит это орган управления. Замер прода
 * 31.08.2026: двадцать карточек подряд нажимались мышью и в обход Tab не
 * попадали вовсе.
 *
 * Проверяем СЛЕДСТВИЕ, а не наличие помощника: роль, фокус и то, что клавиша
 * действительно вызывает действие. И обратную сторону — некликабельная
 * карточка роли получать НЕ должна, иначе читалка обещает действие,
 * которого нет.
 */

// Поля именно такие, как в интерфейсе компонента: display_name, а не
// displayName. Мой первый образец был в другом регистре, компонент падал на
// undefined, и падали ВСЕ четыре проверки — включая отрицательную. Признак
// того, что дело в стенде, а не в предмете: красное всё разом.
const персона = {
  alias: "test-alias",
  display_name: "Тестовая персона",
  bio: "коротко о себе",
  avatar_prompt: "avatar",
  skills: ["сметы", "нормативы"],
  links: [],
  created_at: "2026-09-01T00:00:00Z",
};

describe("карточка персоны доступна с клавиатуры", () => {
  it("кликабельная карточка получает роль кнопки и принимает фокус", () => {
    render(<PersonaCard persona={персона} onClick={() => {}} />);
    const карточка = screen.getByRole("button");
    expect(карточка).toBeTruthy();
    карточка.focus();
    expect(document.activeElement).toBe(карточка);
  });

  it("Enter вызывает действие", () => {
    const жали = vi.fn();
    render(<PersonaCard persona={персона} onClick={жали} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(жали).toHaveBeenCalledTimes(1);
  });

  it("пробел вызывает действие — у настоящей кнопки он работает всегда", () => {
    const жали = vi.fn();
    render(<PersonaCard persona={персона} onClick={жали} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: " " });
    expect(жали).toHaveBeenCalledTimes(1);
  });

  it("НЕкликабельная карточка роли кнопки не получает", () => {
    const { container } = render(<PersonaCard persona={персона} />);
    expect(container.querySelector('[role="button"]')).toBeNull();
  });
});
