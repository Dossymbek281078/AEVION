import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { InstallPrompt } from "../InstallPrompt";

/**
 * Плашка установки — предложение, а не элемент управления. Она перестала
 * появляться в первые секунды и поверх открытого окна.
 *
 * Повод (замер 27.08.2026, телефон 375 пикселей, CyberChess): плашка ложилась
 * на окно «Добро пожаловать» и ПЕРЕХВАТЫВАЛА нажатия — автоматический браузер
 * 30 секунд не мог нажать кнопку выбора и сам назвал виновника. То есть она не
 * мешала читать, а не давала выбрать. Тот же экран повторился ещё дважды: в
 * партии и в окне возврата на второй день.
 *
 * Прежняя версия этого файла закрепляла НЕМЕДЛЕННЫЙ показ, то есть охраняла
 * ровно то поведение, которое оказалось дефектом. Тесты держали дефект на
 * месте, и это отдельный повод их переписать, а не подправить.
 */

const ЗАДЕРЖКА_МС = 20_000;

function бросить(): void {
  const event: Event & {
    prompt?: () => Promise<void>;
    userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
  } = new Event("beforeinstallprompt", { cancelable: true });
  event.prompt = async () => {};
  event.userChoice = Promise.resolve({ outcome: "accepted" as const });
  act(() => {
    window.dispatchEvent(event);
  });
}

/** Промотать время так, чтобы плашка успела появиться. */
function подождать(мс = ЗАДЕРЖКА_МС + 1500): void {
  act(() => {
    vi.advanceTimersByTime(мс);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  try {
    localStorage.clear();
  } catch {}
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("плашка установки", () => {
  it("без события браузера не показывается вовсе", () => {
    const { container } = render(<InstallPrompt />);
    подождать();
    expect(container).toBeEmptyDOMElement();
  });

  it("НЕ появляется сразу — человеку дают осмотреться", () => {
    render(<InstallPrompt />);
    бросить();
    // Сразу после события — пусто. Это и есть предмет починки.
    expect(screen.queryByRole("button", { name: "Установить" })).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(
      screen.queryByRole("button", { name: "Установить" }),
      "плашка пришла в первые секунды — она закроет собой окно приветствия",
    ).not.toBeInTheDocument();
  });

  it("появляется, когда человек успел осмотреться", () => {
    render(<InstallPrompt />);
    бросить();
    подождать();
    expect(screen.getByText(/Установить AEVION/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Установить" })).toBeInTheDocument();
  });

  it("ждёт, пока на экране открыто модальное окно", () => {
    // Пока человек выбирает в диалоге, предлагать установку некуда.
    const dlg = document.createElement("div");
    dlg.setAttribute("role", "dialog");
    document.body.appendChild(dlg);

    render(<InstallPrompt />);
    бросить();
    подождать();
    expect(
      screen.queryByRole("button", { name: "Установить" }),
      "плашка легла поверх открытого окна",
    ).not.toBeInTheDocument();

    // Окно закрыли — предложение можно показать.
    dlg.remove();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByRole("button", { name: "Установить" })).toBeInTheDocument();
  });

  it("уходит сама, не требуя действий", () => {
    render(<InstallPrompt />);
    бросить();
    подождать();
    expect(screen.getByRole("button", { name: "Установить" })).toBeInTheDocument();
    // Отсчёт 12 секунд идёт от ПОКАЗА, а не от готовности браузера: иначе он
    // истёк бы, пока плашка ждала очереди, и человек её не увидел бы вовсе.
    act(() => {
      vi.advanceTimersByTime(12_500);
    });
    expect(screen.queryByRole("button", { name: "Установить" })).not.toBeInTheDocument();
  });

  it("не показывается, если её уже закрывали", () => {
    localStorage.setItem("aevion_install_dismissed_v1", "1");
    const { container } = render(<InstallPrompt />);
    бросить();
    подождать();
    expect(container).toBeEmptyDOMElement();
  });

  it("исчезает после установки приложения", () => {
    render(<InstallPrompt />);
    бросить();
    подождать();
    expect(screen.getByRole("button", { name: "Установить" })).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(screen.queryByRole("button", { name: "Установить" })).not.toBeInTheDocument();
  });

  it("говорит по-русски — и на экране, и для экранного диктора", () => {
    render(<InstallPrompt />);
    бросить();
    подождать();
    // Раньше кнопка называлась «Install», а диктор читал «Скрыть install
    // prompt» — внутренние слова, уехавшие к человеку.
    expect(screen.getByRole("button", { name: "Установить" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скрыть предложение установки" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Предложение установить приложение" })).toBeInTheDocument();
  });
});
