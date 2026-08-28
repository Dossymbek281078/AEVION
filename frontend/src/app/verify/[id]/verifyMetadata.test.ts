import { describe, test, expect } from "vitest";
import { buildVerifyPreview, VERIFY_PREVIEW_FALLBACK } from "./verifyMetadata";

const CERT = {
  title: "Степной рассвет",
  kind: "photo",
  author: "Досымбек",
  protectedAt: "2026-08-01T10:00:00.000Z",
  bitcoinAnchor: { status: "bitcoin-confirmed", bitcoinBlockHeight: 912345 },
};

describe("карточка пересланной ссылки на сертификат", () => {
  test("названа работа, автор и дата", () => {
    const p = buildVerifyPreview(CERT);
    expect(p.title).toContain("Степной рассвет");
    expect(p.description).toContain("Досымбек");
    expect(p.description).toContain("2026-08-01");
  });

  test("подтверждённый якорь назван вместе с номером блока", () => {
    expect(buildVerifyPreview(CERT).description).toContain("912345");
  });

  test("🔴 без подтверждения якорь НЕ обещается", () => {
    // У пяти записей из семи якоря нет и не будет. Карточка ссылки — то, что
    // человек показывает другим; обещать там несуществующее нельзя.
    const p = buildVerifyPreview({ ...CERT, bitcoinAnchor: { status: "not_stamped", bitcoinBlockHeight: null } });
    expect(p.description).not.toMatch(/Anchored in Bitcoin/i);
    // Но и остальное не пропадает: работа и автор названы.
    expect(p.description).toContain("Досымбек");
  });

  test("«готовится» — сказано именно это, а не «закреплено»", () => {
    const p = buildVerifyPreview({ ...CERT, bitcoinAnchor: { status: "pending", bitcoinBlockHeight: null } });
    expect(p.description).toMatch(/in progress/i);
    expect(p.description).not.toMatch(/Anchored in Bitcoin block/i);
  });

  test("подтверждено без высоты — номер не выдумывается", () => {
    const p = buildVerifyPreview({ ...CERT, bitcoinAnchor: { status: "bitcoin-confirmed", bitcoinBlockHeight: null } });
    expect(p.description).toMatch(/Anchored in Bitcoin\./);
    expect(p.description).not.toMatch(/block (null|undefined|NaN)/i);
  });

  test("анонимный автор — не пишем «by Anonymous»", () => {
    const p = buildVerifyPreview({ ...CERT, author: "Anonymous" });
    expect(p.description).not.toMatch(/by Anonymous/i);
    expect(p.title).toContain("Степной рассвет");
  });

  test("спросить не удалось — общая карточка, ничего не выдумываем", () => {
    expect(buildVerifyPreview(null)).toEqual(VERIFY_PREVIEW_FALLBACK);
    expect(buildVerifyPreview({ title: "" })).toEqual(VERIFY_PREVIEW_FALLBACK);
  });

  test("мусор в дате не ломает карточку и не печатается", () => {
    const p = buildVerifyPreview({ ...CERT, protectedAt: "не дата" });
    expect(p.description).not.toMatch(/Invalid Date|NaN/);
    expect(p.description).toContain("Досымбек");
  });

  test("четыре состояния якоря дают три разных фразы", () => {
    const say = (s: string | null) =>
      buildVerifyPreview({ ...CERT, bitcoinAnchor: { status: s, bitcoinBlockHeight: 1 } }).description;
    const set = new Set([say("bitcoin-confirmed"), say("pending"), say("failed"), say(null)]);
    // failed и not_stamped/null молчат одинаково — это осознанно: карточка
    // ссылки не место для разбора причин, она не должна пугать получателя.
    expect(set.size).toBe(3);
  });
});
