import { describe, test, expect } from "vitest";
import { planSendBatch } from "../src/lib/launchAnnounce";

/**
 * Кому слать рассылку ПРЯМО СЕЙЧАС.
 *
 * Отправка — единственное необратимое действие платформы: письмо ушло живым
 * людям, «уже» не отменяется. Поэтому решение отделено от отправки и
 * проверяется здесь, без единого настоящего письма.
 *
 * Проверяются три правила и их края: повтор после обрыва, жёсткий суточный
 * потолок Brevo (300 на нашем плане) и честный остаток на завтра.
 */

const cap = 300;

describe("отбор получателей для захода", () => {
  test("получивший раньше не получает второй раз", () => {
    const b = planSendBatch({
      recipients: ["a@x.test", "b@x.test", "c@x.test"],
      alreadySent: ["b@x.test"],
      usedToday: 0,
      dailyCap: cap,
    });

    expect(b.toSend).toEqual(["a@x.test", "c@x.test"]);
    expect(b.alreadySent).toBe(1);
    expect(b.postponed).toBe(0);
  });

  test("адрес узнаётся в другом регистре и с пробелами", () => {
    // Иначе повтор рассылки шлёт второе письмо тому же человеку.
    // Грязный вид проверяется с ОБЕИХ сторон: мутация показала, что проверка
    // с грязным только у получателя проходит и на коде, где список уже
    // отправленных к общему виду не приводится.
    const b = planSendBatch({
      recipients: ["  Kto@Primer.RU "],
      alreadySent: ["kto@primer.ru"],
      usedToday: 0,
      dailyCap: cap,
    });

    expect(b.toSend).toEqual([]);
    expect(b.alreadySent).toBe(1);

    const обратно = planSendBatch({
      recipients: ["kto@primer.ru"],
      alreadySent: ["  KTO@Primer.RU "],
      usedToday: 0,
      dailyCap: cap,
    });

    expect(обратно.toSend, "адрес в списке отправленных не узнан").toEqual([]);
    expect(обратно.alreadySent).toBe(1);
  });

  test("потолок суток учитывает письма, ушедшие сегодня другими каналами", () => {
    // Подтверждения подписки уходят через того же провайдера и тот же потолок.
    const b = planSendBatch({
      recipients: ["a@x.test", "b@x.test", "c@x.test"],
      alreadySent: [],
      usedToday: 298,
      dailyCap: cap,
    });

    expect(b.toSend).toHaveLength(2);
    expect(b.postponed, "остаток на завтра посчитан неверно").toBe(1);
  });

  test("потолок исчерпан — не шлём ничего и говорим, сколько осталось", () => {
    const b = planSendBatch({
      recipients: ["a@x.test", "b@x.test"],
      alreadySent: [],
      usedToday: 300,
      dailyCap: cap,
    });

    expect(b.toSend).toEqual([]);
    expect(b.postponed).toBe(2);
  });

  test("перерасход за сутки не делает остаток отрицательным", () => {
    const b = planSendBatch({
      recipients: ["a@x.test"],
      alreadySent: [],
      usedToday: 350,
      dailyCap: cap,
    });

    expect(b.toSend).toEqual([]);
    expect(b.postponed).toBe(1);
  });

  test("пустой список — не ошибка и не отправка", () => {
    const b = planSendBatch({ recipients: [], alreadySent: [], usedToday: 0, dailyCap: cap });

    expect(b).toEqual({ toSend: [], alreadySent: 0, postponed: 0 });
  });
});
