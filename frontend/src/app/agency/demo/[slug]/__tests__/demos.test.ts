import { describe, it, expect } from "vitest";
import { DEMOS } from "../demos";
import { buildDraft } from "../demoLogic";

describe("/agency/demo — данные 5 компаний", () => {
  it("5 демо, номера 1..5, адреса разные", () => {
    expect(DEMOS.map((d) => d.n)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(DEMOS.map((d) => d.slug)).size).toBe(5);
  });
  it.each(DEMOS.map((d) => [d.slug, d] as const))("%s: пример находит услугу, цена дословно или без цены", (_s, d) => {
    const r = buildDraft(d.sample, d);
    expect(r.card[0][1]).not.toContain("уточнить");
    const svc = d.services.find((x) => x.name === r.card[0][1]);
    expect(svc).toBeTruthy();
    if (svc?.price) expect(r.draft).toContain(svc.price);
    else expect(r.draft).toContain("стоимость подскажет администратор");
  });
});
