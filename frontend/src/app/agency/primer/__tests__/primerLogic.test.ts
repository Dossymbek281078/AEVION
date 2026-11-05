import { describe, it, expect } from "vitest";
import { parseInquiry, busyHours, formatTenge } from "../primerLogic";

describe("/agency/primer — разбор обращения", () => {
  it("стрижка с бородой, суббота после 6, Данияр, цена", () => {
    const r = parseInquiry("Здравствуйте! Сколько у вас стоит стрижка с бородой? Можно в субботу после 6? Меня зовут Данияр");
    expect(r.inquiry).toEqual({ service: "Стрижка + борода", day: "субботу", time: "после 18:00", name: "Данияр", asksPrice: true });
    expect(r.card[4]).toEqual(["Спрашивает цену", "да"]);
    expect(r.draft).toContain("Здравствуйте, Данияр!");
    expect(r.draft).toContain("Стрижка + борода у нас стоит 9 000 ₸");
    expect(r.draft).toContain("На субботу после 18:00 есть свободное время");
  });

  it("ребёнок, завтра утром", () => {
    const r = parseInquiry("Добрый день, сыну 7 лет, хотим подстричься завтра утром. Сколько стоит?");
    expect(r.inquiry.service).toBe("Детская стрижка");
    expect(r.inquiry.day).toBe("завтра");
    expect(r.inquiry.time).toBe("утром");
    expect(r.inquiry.name).toBe("");
    expect(r.draft).toContain("4 000 ₸");
  });

  it("только борода, сегодня вечером", () => {
    const r = parseInquiry("Здравствуйте, нужно только бороду поправить, есть время сегодня вечером?");
    expect(r.inquiry.service).toBe("Оформление бороды");
    expect(r.inquiry.day).toBe("сегодня");
    expect(r.inquiry.time).toBe("вечером");
    expect(r.inquiry.asksPrice).toBe(false);
  });

  it("без деталей — всё не названо, черновик просит уточнить услугу", () => {
    const r = parseInquiry("Здравствуйте, хочу к вам записаться");
    expect(r.card.slice(0, 3).map((p) => p[1])).toEqual([
      "не названа — уточнить",
      "не назван — уточнить",
      "не названо — уточнить",
    ]);
    expect(r.draft).toContain("какая услуга нужна");
    expect(r.draft).toContain("На какой день и время вас записать?");
  });
});

describe("/agency/primer — мелочи", () => {
  it("цена без неразрывного пробела", () => {
    expect(formatTenge(6000)).toBe("6 000 ₸");
    expect(formatTenge(6000)).not.toMatch(/[  ]/);
  });
  it("расписание детерминировано и не пусто на сегодня", () => {
    expect([...busyHours(0)]).toEqual([...busyHours(0)]);
    expect(busyHours(0).size).toBeLessThan(12);
  });
});
