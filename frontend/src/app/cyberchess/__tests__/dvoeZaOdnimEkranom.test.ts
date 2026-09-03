import { describe, it, expect } from "vitest";
import { chuzhoyHod } from "../useBoardInput";

/**
 * Режим «Два игрока · один экран» стоит на первом экране модуля и не работал:
 * белые ходили, чёрные не отзывались ни мышью, ни с клавиатуры, а белые могли
 * сходить ВТОРОЙ раз подряд — очередь не переключалась вовсе.
 *
 * Причина: флаг hotseat приходил в модуль ввода доски с апреля 2026 и не
 * читался там ни разу. Все пять мест сравнивали очередь с цветом ОДНОГО
 * игрока — верно для партии с ИИ, неверно для игры вдвоём.
 *
 * Замер браузером 02.09.2026 после починки: дурацкий мат (1.f3 e5 2.g4 Qh4#)
 * доигрывается до конца, на экране «Мат — Чёрные победили» и карточка разбора.
 */

const доска = (turn: "w" | "b") => ({ turn: () => turn });

describe("чей сейчас ход", () => {
  it("вдвоём за одним экраном ходят ОБЕ стороны", () => {
    for (const очередь of ["w", "b"] as const) {
      expect(chuzhoyHod({ tab: "play", game: доска(очередь), pCol: "w", hotseat: true })).toBe(false);
      expect(chuzhoyHod({ tab: "play", game: доска(очередь), pCol: "b", hotseat: true })).toBe(false);
    }
  });

  it("в партии с ИИ ход соперника по-прежнему чужой", () => {
    // контроль: без него первая проверка прошла бы и на функции «всегда false»
    expect(chuzhoyHod({ tab: "play", game: доска("b"), pCol: "w", hotseat: false })).toBe(true);
    expect(chuzhoyHod({ tab: "play", game: доска("w"), pCol: "w", hotseat: false })).toBe(false);
  });

  it("в разборе ходят обе стороны независимо от режима", () => {
    expect(chuzhoyHod({ tab: "analysis", game: доска("b"), pCol: "w", hotseat: false })).toBe(false);
  });
});
