import { describe, it, expect } from "vitest";
import { anchorBadge } from "../anchorBadge";

// 29.10.2026: на /en/bureau подсказка якоря шла по-русски («Хеш работы закреплён в блоке Bitcoin №…»).
describe("подсказка якоря Bitcoin — на языке страницы", () => {
  const все = [{ status: "bitcoin-confirmed", bitcoinBlockHeight: 970001 }, { status: "bitcoin-confirmed" }, { status: "pending" }, { status: "failed" }, { status: "not_stamped" }, { status: "странное" }];
  it("en: ни одной кириллической подсказки (кроме эха неизвестного статуса)", () => {
    for (const a of все.slice(0, 5)) {
      const b = anchorBadge(a, "en");
      if (b) expect(b.title, a.status).not.toMatch(/[А-Яа-яЁё]/);
    }
    expect(anchorBadge({ status: "bitcoin-confirmed", bitcoinBlockHeight: 970001 }, "en")?.title).toContain("#970001");
  });
  it("ru и без языка — прежний русский текст", () => {
    expect(anchorBadge({ status: "bitcoin-confirmed", bitcoinBlockHeight: 970001 })?.title).toContain("блоке Bitcoin №970001");
    expect(anchorBadge({ status: "pending" }, "ru")?.title).toMatch(/^Штамп отправлен/);
  });
  it("поля нет — по-прежнему ничего не рисуем", () => {
    expect(anchorBadge(undefined, "en")).toBeNull();
  });
});
