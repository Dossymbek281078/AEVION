import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import OnboardingOverlay, { ONBOARDING_KEY, hasCompletedOnboarding } from "../OnboardingOverlay";

/*
 * 🔴 Первый экран магнита обязан САМ давать вход в игру.
 *
 * ПОВОД — замер на проде 08.10.2026 за 14 дней, числа со знаменателем:
 * на /cyberchess пришло 42 живых сессии (наши 0, они помечены probe-), «внимание»
 * дали 6, а задачу дня открыл НОЛЬ человек, партию не закончил никто, адрес не
 * оставил никто (daily_open 0, game_end 0, waitlist_submit 0 при page_view 3042 и
 * отсеянных роботах 2350).
 *
 * Отправка событий при этом ИСПРАВНА — проверено проходом пути человека с
 * перехватом отправки внутри страницы: daily_open ушёл и на сервере виден
 * (всего=1, наши=1). Мешало другое: до кнопки «☀ Задача дня» надо сперва убрать
 * это окно, и мой кликер — машина, которая не сомневается — не смог нажать её за
 * 8 секунд, пока явно не нажал «Пропустить».
 *
 * ⚠️ Чего ЭТИ проверки не доказывают, сказано прямо: что на живой странице человек
 * доходит до задачи дня. Это мерится только браузером на проде (daily_open уходит
 * при пустом хранилище и БЕЗ нажатия «Пропустить») и сторожем достижимости на
 * ширинах 390/540/768/1024. Здесь проверяется контракт компонента: есть ли вход,
 * исчезает ли он, когда вести некуда, и отмечается ли онбординг пройденным.
 */

describe("приветственное окно даёт вход в задачу дня", () => {
  beforeEach(() => {
    try { localStorage.removeItem(ONBOARDING_KEY); } catch { /* jsdom без хранилища */ }
  });

  test("кнопка задачи дня есть и видна человеку ТЕКСТОМ, а не только для скринридера", async () => {
    // Текст, а не aria-label: кнопка, подписанная только для скринридера, уже
    // однажды оказалась невидимой для человека (память про aria-label).
    render(<OnboardingOverlay onComplete={() => {}} onDaily={() => {}} />);
    const к = screen.getByRole("button", { name: /задачу дня/i });
    expect(к).toBeTruthy();
    expect(String(к.textContent || "")).toContain("Решить задачу дня");
  });

  test("нажатие ведёт в задачу дня И отмечает онбординг пройденным", async () => {
    const вызовы: string[] = [];
    render(<OnboardingOverlay onComplete={() => вызовы.push("complete")} onDaily={() => вызовы.push("daily")} />);
    await userEvent.click(screen.getByRole("button", { name: /задачу дня/i }));
    expect(вызовы).toEqual(["daily"]);
    // Без отметки окно встанет снова при следующем заходе — человек увидит его
    // поверх уже открытой задачи.
    expect(hasCompletedOnboarding()).toBe(true);
  });

  test("🔴 КОНТРОЛЬ: без обработчика кнопки НЕТ вовсе", () => {
    // Задача дня приходит с сервера. Пока её нет, кнопка закрыла бы окно и
    // сказала «ещё грузится», оставив человека на пустой доске: это хуже
    // отсутствия кнопки. Страница поэтому передаёт обработчик только когда
    // задача готова, и окно обязано это уважать.
    render(<OnboardingOverlay onComplete={() => {}} />);
    expect(screen.queryByRole("button", { name: /задачу дня/i })).toBeNull();
  });

  test("КОНТРОЛЬ: прежние пути никуда не делись — три плитки и «осмотрюсь» на месте", async () => {
    // Иначе «починка» первого экрана могла бы тихо унести выбор пути, и правка
    // выглядела бы удачной ровно до первой жалобы.
    const выбор: string[] = [];
    render(<OnboardingOverlay onComplete={(c) => выбор.push(c.intent)} onDaily={() => {}} />);
    for (const имя of ["Играть", "Учиться", "Задачи"]) {
      expect(screen.getByRole("button", { name: new RegExp(имя, "i") })).toBeTruthy();
    }
    await userEvent.click(screen.getByRole("button", { name: /осмотрюсь/i }));
    expect(выбор).toEqual(["play"]);
  });

  test("КОНТРОЛЬ прибора: эти проверки РАЗЛИЧАЮТ состояния, а не всегда зелёные", () => {
    // Один и тот же запрос к экрану даёт разный ответ при разных пропсах. Без
    // этого все четыре проверки прошли бы и у окна, которое рисует кнопку всегда.
    const { unmount } = render(<OnboardingOverlay onComplete={() => {}} onDaily={() => {}} />);
    const сОбработчиком = !!screen.queryByRole("button", { name: /задачу дня/i });
    unmount();
    render(<OnboardingOverlay onComplete={() => {}} />);
    const безОбработчика = !!screen.queryByRole("button", { name: /задачу дня/i });
    expect([сОбработчиком, безОбработчика]).toEqual([true, false]);
  });
});
