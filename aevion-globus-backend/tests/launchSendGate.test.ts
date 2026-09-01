import { describe, test, expect } from "vitest";
import { checkSendGate } from "../src/lib/launchAnnounce";

/**
 * Охрана отправки рассылки.
 *
 * Отправка необратима: письмо ушло живым людям, «уже» не отменяется. Написать
 * такую охрану и не прогнать её — значит поверить чтению. Здесь она проверяется
 * без единого настоящего письма.
 *
 * Три жеста нужны НЕЗАВИСИМЫЕ, иначе они не защищают: флаг, переменная и её
 * совпадение с модулем. Плюс условие, которое жестом не обойти, — день запуска
 * должен наступить.
 */

const база = { slug: "devhub", sendFlag: true, confirmEnv: "devhub", isLive: true };

describe("отправка не начнётся случайно", () => {
  test("все условия сошлись — можно", () => {
    expect(checkSendGate(база)).toEqual({ allowed: true });
  });

  test("без флага это сухой прогон, а не отказ", () => {
    // Различие важно: сухой прогон печатает план и выходит с нулём, отказ —
    // это ошибка запуска. Смешать их значит приучить читать «1» как норму.
    expect(checkSendGate({ ...база, sendFlag: false })).toEqual({ allowed: false, reason: "dry" });
  });

  test("флаг есть, подтверждения нет — не отправляем", () => {
    expect(checkSendGate({ ...база, confirmEnv: undefined }).allowed).toBe(false);
    expect(checkSendGate({ ...база, confirmEnv: "" }).allowed).toBe(false);
    expect(checkSendGate({ ...база, confirmEnv: "   " }), "пробелы приняты за подтверждение")
      .toEqual({ allowed: false, reason: "confirm-missing" });
  });

  test("подтверждение от ДРУГОГО модуля не годится", () => {
    // Это защита от «отправил не тем»: команду поднимают стрелкой вверх и
    // меняют один аргумент, а переменная остаётся от прошлого запуска.
    expect(checkSendGate({ ...база, confirmEnv: "multichat" }))
      .toEqual({ allowed: false, reason: "confirm-mismatch" });
  });

  test("день запуска не наступил — не отправляем даже со всеми жестами", () => {
    expect(checkSendGate({ ...база, isLive: false }))
      .toEqual({ allowed: false, reason: "not-live" });
  });

  test("причина называется точно, а не общим отказом", () => {
    // Человек, собравший все три жеста, должен узнать именно «день не
    // наступил»: общий отказ он прочитает как поломку и начнёт обходить.
    const r = checkSendGate({ ...база, isLive: false });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).not.toBe("confirm-missing");
  });
});
