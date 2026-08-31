import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OnboardingOverlay from "../OnboardingOverlay";

/**
 * Первый экран, который видит новичок, — модальное окно поверх всей страницы.
 * Замерено на БОЕВОЙ сборке 31.08.2026 (npx next start, playwright):
 *
 *   Escape окно не закрывал — ни с фокусом снаружи, ни изнутри
 *   фокус при открытии оставался на BODY
 *
 * Контроль тогда же: крестик закрывал исправно, то есть окно закрывается, и
 * дело именно в клавиатуре. Человек, который не пользуется мышью, упирался в
 * окно, перехватывающее все нажатия, на самом первом шаге.
 */

beforeEach(() => {
  try { localStorage.clear(); } catch { /* среда без хранилища — не важно */ }
});

describe("окно новичка слушается клавиатуры", () => {
  it("Escape закрывает так же, как крестик", () => {
    const skip = vi.fn();
    render(<OnboardingOverlay onComplete={vi.fn()} onSkip={skip} />);
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(skip).toHaveBeenCalledTimes(1);
  });

  it("фокус уезжает ВНУТРЬ окна при открытии", () => {
    render(<OnboardingOverlay onComplete={vi.fn()} onSkip={vi.fn()} />);
    const okno = screen.getByRole("dialog");
    // Раньше здесь оставался BODY: окно открыто, а человек за ним.
    expect(document.activeElement).not.toBe(document.body);
    expect(okno.contains(document.activeElement)).toBe(true);
  });

  it("Tab не выпускает из окна", () => {
    render(<OnboardingOverlay onComplete={vi.fn()} onSkip={vi.fn()} />);
    const okno = screen.getByRole("dialog");
    const knopki = Array.from(okno.querySelectorAll("button"));
    expect(knopki.length).toBeGreaterThan(2); // контроль: кнопки нашлись

    knopki[knopki.length - 1].focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(knopki[0]);

    knopki[0].focus();
    fireEvent.keyDown(document, { key: "Shift", shiftKey: true });
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(knopki[knopki.length - 1]);
  });

  it("другие клавиши окно не закрывают", () => {
    // Контроль в обратную сторону: если бы обработчик закрывал на что угодно,
    // проверка Escape выше проходила бы и на сломанном окне.
    const skip = vi.fn();
    render(<OnboardingOverlay onComplete={vi.fn()} onSkip={skip} />);
    fireEvent.keyDown(document, { key: "a" });
    fireEvent.keyDown(document, { key: "Enter" });
    expect(skip).not.toHaveBeenCalled();
  });
});
