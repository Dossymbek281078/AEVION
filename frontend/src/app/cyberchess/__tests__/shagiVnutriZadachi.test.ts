import { describe, test, expect, vi, beforeEach } from "vitest";

/*
 * Сторож на три новых шага внутри задачи и на ОПОЗНАВАТЕЛЬ задачи.
 *
 * Повод — замер 12.10.2026 живым заходом на прод (волна 46):
 *   открыл задачу        → page_view, feature_use
 *   НЕВЕРНЫЙ ход         → game_progress, waitlist_offer_shown, engaged
 *   подсказка            → НИ ОДНОГО события
 *   верный ход           → НИ ОДНОГО события
 *   довёл до мата        → НИ ОДНОГО события (решение не состоялось)
 * То есть «ткнул не туда и ушёл» был неотличим от «начал решать», а подсказка и
 * уход не наблюдались вовсе.
 *
 * И второй замер того же дня: `puzzle_solved` уезжал с `id: "нет id"` —
 * решение было видно, а КАКАЯ задача решена, нет.
 *
 * Здесь проверяется ПОВЕДЕНИЕ отправителей: подменяем `track` и смотрим, что
 * уходит, — не чтение исходника.
 */

const отправленное: Array<{ type: string; meta?: Record<string, unknown> }> = [];
vi.mock("@/lib/track", () => ({
  track: (p: { type: string; meta?: Record<string, unknown> }) => { отправленное.push(p); },
  trackOnce: () => {},
}));

import {
  soobschitONevernomHode,
  soobschitOPodskazke,
  soobschitORescheniiZadachi,
  nuzhnoLiSoobschitOUhodeIzZadachi,
} from "../page";

const задачаИзБанка = { id: "li_075iw", fen: "5r1k/p5pp/2p1Q3/1pq1p3/4P3/8/B4PPP/3R2K1 b - - 1 32", r: 1186, theme: "Мат на последней горизонтали" };
const задачаЗашитая = { fen: "8/8/8/8/8/8/8/K6k w - - 0 1", r: 900, theme: "Эндшпиль" };

beforeEach(() => { отправленное.length = 0; });

describe("шаги внутри задачи стали видимыми", () => {
  test("неверный ход шлёт puzzle_wrong_move с номером попытки", () => {
    soobschitONevernomHode(задачаИзБанка, 2);
    expect(отправленное).toHaveLength(1);
    expect(отправленное[0].type).toBe("puzzle_wrong_move");
    expect(отправленное[0].meta?.попытка).toBe(2);
    expect(отправленное[0].meta?.id).toBe("li_075iw");
  });

  test("подсказка шлёт puzzle_hint и число ошибок до неё", () => {
    soobschitOPodskazke(задачаИзБанка, 3);
    expect(отправленное[0].type).toBe("puzzle_hint");
    expect(отправленное[0].meta?.ошибокДоЭтого).toBe(3);
  });

  test("🔴 опознаватель задачи не «нет id»: fen едет всегда", () => {
    soobschitORescheniiZadachi(задачаЗашитая, false);
    const м = отправленное[0].meta ?? {};
    expect(отправленное[0].type).toBe("puzzle_solved");
    // Главное: прежнего вранья больше нет.
    expect(String(м.id)).not.toBe("нет id");
    // У зашитой задачи id нет — и тогда опознаёт fen, а не пустота.
    expect(String(м.fen)).toContain("K6k");
    expect(String(м.fen).length).toBeGreaterThan(10);
  });

  test("у задачи из банка едут и id, и fen", () => {
    soobschitORescheniiZadachi(задачаИзБанка, true);
    const м = отправленное[0].meta ?? {};
    expect(м.id).toBe("li_075iw");
    expect(String(м.fen)).toContain("5r1k");
    expect(м.daily).toBe(true);
  });

  test("все три новых отправителя несут опознаватель — ни один не уходит пустым", () => {
    soobschitONevernomHode(задачаИзБанка, 1);
    soobschitOPodskazke(задачаИзБанка, 0);
    soobschitORescheniiZadachi(задачаИзБанка, false);
    expect(отправленное).toHaveLength(3);
    for (const е of отправленное) {
      const м = е.meta ?? {};
      expect(String(м.id) + String(м.fen), `событие ${е.type} без опознавателя`).not.toBe("");
      expect(String(м.id).length + String(м.fen).length).toBeGreaterThan(10);
    }
  });
});

describe("уход из задачи", () => {
  const база = { задачаОткрыта: true, решена: false, былаПопытка: true, ужеСообщили: false };

  test("попытка была и ушёл не решив — сообщаем", () => {
    expect(nuzhnoLiSoobschitOUhodeIzZadachi(база)).toBe(true);
  });

  test("решил и ушёл — это успех, НЕ уход", () => {
    expect(nuzhnoLiSoobschitOUhodeIzZadachi({ ...база, решена: true })).toBe(false);
  });

  test("открыл и закрыл, ничего не тронув — просмотр, не уход", () => {
    expect(nuzhnoLiSoobschitOUhodeIzZadachi({ ...база, былаПопытка: false })).toBe(false);
  });

  test("задачи на экране нет — сообщать нечего", () => {
    expect(nuzhnoLiSoobschitOUhodeIzZadachi({ ...база, задачаОткрыта: false })).toBe(false);
  });

  test("один раз на сессию задачи", () => {
    expect(nuzhnoLiSoobschitOUhodeIzZadachi({ ...база, ужеСообщили: true })).toBe(false);
  });

  test("контроль прибора: предикат отвечает РАЗНОЕ на разные входы", () => {
    const ответы = [
      nuzhnoLiSoobschitOUhodeIzZadachi(база),
      nuzhnoLiSoobschitOUhodeIzZadachi({ ...база, решена: true }),
      nuzhnoLiSoobschitOUhodeIzZadachi({ ...база, былаПопытка: false }),
    ];
    expect(ответы).toEqual([true, false, false]);
  });
});
