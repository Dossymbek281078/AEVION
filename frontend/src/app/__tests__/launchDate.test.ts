/**
 * Проверка общего источника даты запуска платформы.
 *
 * Главное здесь — не формулировки, а ДВЕ вещи, которые молча расходятся:
 * число (PLATFORM_LAUNCH_UTC) и слова (PLATFORM_LAUNCH_HUMAN). Ровно так
 * протухла дата у шахмат до 01.09.2026: расчёт шёл от одной даты, подпись
 * называла другую, и ошибка ничем не проявлялась.
 */
import { describe, test, expect } from "vitest";
import {
  PLATFORM_LAUNCH_UTC,
  PLATFORM_LAUNCH_HUMAN,
  MONTHS_RU,
  launchHasPassed,
  launchKicker,
  launchTitle,
  launchHeadline,
  launchMetaTitle,
} from "../launchDate";

const MODULES = "DevHub, мультичат, QRight, QSign, бюро, биржа";

describe("дата запуска платформы", () => {
  test("слова и число называют один день", () => {
    const d = new Date(PLATFORM_LAUNCH_UTC);
    const ожидаем = `${d.getUTCDate()} ${MONTHS_RU[d.getUTCMonth()]}`;
    expect(
      PLATFORM_LAUNCH_HUMAN,
      "подпись и расчёт разошлись: страница скажет одно, посчитает другое",
    ).toBe(ожидаем);
  });

  test("до дня запуска — обещание в будущем времени", () => {
    const накануне = new Date(PLATFORM_LAUNCH_UTC - 24 * 3_600_000);
    expect(launchHasPassed(накануне)).toBe(false);
    expect(launchTitle(MODULES, накануне)).toContain("открываем");
  });

  test("В САМ день запуска ещё «открываем», а не «обещали»", () => {
    // Алматы впереди UTC на пять часов: в 20:00 UTC там уже 21-е. Берём
    // полдень UTC — это 17:00 в Алматы, то есть тот же день запуска.
    const вДень = new Date(PLATFORM_LAUNCH_UTC + 12 * 3_600_000);
    expect(launchHasPassed(вДень), "в день запуска страница не должна говорить о нём в прошедшем").toBe(false);
    expect(launchKicker(вДень)).toBe(`${PLATFORM_LAUNCH_HUMAN} · семь модулей`);
  });

  test("граница дня считается по поясу Алматы, а не по UTC сервера", () => {
    // Сервер живёт в UTC, запуск — в Алматы (UTC+5). 21 сентября в Алматы
    // начинается в 19:00 UTC 20-го. Без сдвига страница пять часов ночи
    // обещала бы «открываем 20 сентября» уже 21-го. Мутация «убрать сдвиг»
    // выживала: все проверки выше берут даты, где пояс ничего не меняет.
    const вечерВАлматы20 = new Date("2026-09-20T18:30:00Z"); // 23:30 20.09 по Алматы
    const ночьВАлматы21 = new Date("2026-09-20T19:30:00Z"); // 00:30 21.09 по Алматы
    expect(launchHasPassed(вечерВАлматы20), "в Алматы ещё 20-е — рано говорить «обещали»").toBe(false);
    expect(launchHasPassed(ночьВАлматы21), "в Алматы уже 21-е, а страница считает по UTC").toBe(true);
  });

  test("после дня запуска текст меняется САМ, без правки кода", () => {
    const назавтра = new Date(PLATFORM_LAUNCH_UTC + 36 * 3_600_000);
    expect(launchHasPassed(назавтра)).toBe(true);
    expect(launchKicker(назавтра)).toContain("Обещали");
    expect(launchTitle(MODULES, назавтра)).toContain("напишем, как только откроем");
  });

  test("после даты НЕ объявляем модули открытыми", () => {
    const через_неделю = new Date(PLATFORM_LAUNCH_UTC + 7 * 24 * 3_600_000);
    const текст = launchKicker(через_неделю) + " " + launchTitle(MODULES, через_неделю);
    // Календарь не доказывает, что модуль работает: 30.08.2026 такое письмо
    // позвало людей в запуск, которого не было.
    expect(текст.includes("уже открыт"), "календарь объявил открытым то, чего мы не проверяли").toBe(false);
    expect(текст.includes("Открыто"), "то же самое другими словами").toBe(false);
  });

  test("карточка и заголовок посадочной: до даты текст прежний, после — «обещали»", () => {
    const накануне = new Date(PLATFORM_LAUNCH_UTC - 86_400_000);
    // 10:00 UTC дня запуска — 15:00 в Алматы, тот же календарный день.
    const вДень = new Date(PLATFORM_LAUNCH_UTC + 10 * 3_600_000);
    const назавтра = new Date(PLATFORM_LAUNCH_UTC + 172_800_000);
    const ИМЯ = "AEVION IP Bureau";

    // До даты — буква в букву то, что стояло литералом: превью не меняется раньше времени.
    expect(launchHeadline(накануне)).toBe(`Открываем ${PLATFORM_LAUNCH_HUMAN}`);
    expect(launchMetaTitle(ИМЯ, накануне)).toBe(`${ИМЯ} — запуск ${PLATFORM_LAUNCH_HUMAN}`);
    expect(launchHeadline(вДень), "в сам день запуска ещё будущее время").toBe(`Открываем ${PLATFORM_LAUNCH_HUMAN}`);

    expect(launchHeadline(назавтра)).toBe(`Обещали ${PLATFORM_LAUNCH_HUMAN}`);
    expect(launchMetaTitle(ИМЯ, назавтра)).toBe(`${ИМЯ} — обещали ${PLATFORM_LAUNCH_HUMAN}`);
    for (const т of [launchHeadline(назавтра), launchMetaTitle(ИМЯ, назавтра)]) {
      expect(т.toLowerCase().includes("открыт"), "после даты объявили открытым: " + т).toBe(false);
    }
  });

  test("месяц в подписи всегда назван — иначе это не дата", () => {
    for (const когда of [new Date(PLATFORM_LAUNCH_UTC - 86_400_000), new Date(PLATFORM_LAUNCH_UTC + 172_800_000)]) {
      expect(MONTHS_RU.some((m) => launchKicker(когда).includes(m))).toBe(true);
    }
  });
});
