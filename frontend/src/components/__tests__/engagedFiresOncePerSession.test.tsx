import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { PageTracking } from "../PageTracking";

/*
 * 🔴 Событие «похоже на чтение» уходит по ДВУМ условиям и РОВНО ОДИН раз.
 *
 * Повод 07.10.2026: за трое суток 515 живых просмотров и одно нажатие. Прежде
 * чем чинить первый экран, надо знать, люди ли это — обходчик ссылок исполняет
 * JS и в числах выглядел человеком.
 *
 * Проверяется поведением, а не чтением исходника: ни время, ни прокрутка не
 * видны в коде как «сработало». Время двигаем фальшивыми таймерами, прокрутку —
 * событием scroll с подменённой геометрией.
 */
const отправленные: Array<{ type: string; meta?: Record<string, unknown> }> = [];

vi.mock("@/lib/track", () => ({
  track: (payload: { type: string; meta?: Record<string, unknown> }) => {
    отправленные.push(payload);
  },
}));

vi.mock("@/lib/channelNow", () => ({ channelNow: () => "youtube" }));

function внимание() {
  return отправленные.filter((с) => с.type === "engaged");
}

beforeEach(() => {
  отправленные.length = 0;
  vi.useFakeTimers();
  try {
    window.sessionStorage.clear();
  } catch {
    // В окружении без хранилища защёлка живёт в памяти — это законный путь.
  }
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

/** Делает страницу прокручиваемой и ставит прокрутку на долю от высоты. */
function прокрутитьНа(доля: number) {
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: 2000,
  });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 1000 });
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value: Math.round(доля * (2000 - 1000)),
  });
  window.dispatchEvent(new Event("scroll"));
}

describe("признак чтения", () => {
  it("🔴 десять секунд видимой вкладки — событие уходит", () => {
    render(<PageTracking page="test" />);
    expect(внимание()).toHaveLength(0);

    vi.advanceTimersByTime(9_000);
    expect(внимание(), "ушло раньше порога").toHaveLength(0);

    vi.advanceTimersByTime(2_000);
    expect(внимание()).toHaveLength(1);
    expect(внимание()[0].meta?.причина).toBe("время");
  });

  it("🔴 прокрутка на четверть — событие уходит, не дожидаясь времени", () => {
    render(<PageTracking page="test" />);
    прокрутитьНа(0.3);
    expect(внимание()).toHaveLength(1);
    expect(внимание()[0].meta?.причина).toBe("прокрутка");
  });

  it("🔴 КОНТРОЛЬ: прокрутка на 10 % событие НЕ отправляет", () => {
    // Без этого контроля порог был бы декоративным: любое касание колеса
    // объявляло бы обходчика читателем.
    render(<PageTracking page="test" />);
    прокрутитьНа(0.1);
    expect(внимание()).toHaveLength(0);
  });

  it("🔴 ровно ОДИН раз: ни прокрутка, ни время не добавят второго", () => {
    render(<PageTracking page="test" />);
    прокрутитьНа(0.5);
    прокрутитьНа(0.9);
    vi.advanceTimersByTime(30_000);
    expect(внимание(), "событие ушло повторно — доля станет больше единицы").toHaveLength(1);
  });

  it("КОНТРОЛЬ: просмотр отправляется всегда, независимо от внимания", () => {
    // Внимание — ДОБАВОЧНЫЙ признак; если из-за него потеряется page_view,
    // мы лишимся самого числа визитов.
    render(<PageTracking page="test" />);
    expect(отправленные.filter((с) => с.type === "page_view")).toHaveLength(1);
  });

  it("короткая страница: прокручивать нечего, время всё равно работает", () => {
    // Страница короче экрана — требовать прокрутку значило бы считать
    // внимательными только тех, у кого длинный текст.
    render(<PageTracking page="test" />);
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 1000 });
    window.dispatchEvent(new Event("scroll"));
    expect(внимание()).toHaveLength(0);

    vi.advanceTimersByTime(11_000);
    expect(внимание()).toHaveLength(1);
  });
});
