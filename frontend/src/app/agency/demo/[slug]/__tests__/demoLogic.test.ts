import { describe, it, expect } from "vitest";
import { buildDraft, findService, demoHref, type Demo } from "../demoLogic";

const demo: Demo = {
  slug: "t", n: 1, company: "Тест", city: "Алматы", niche: "вет", site: "https://t.kz", hours: null,
  services: [{ name: "Вакцинация собак", price: "5 000 ₸" }, { name: "Чистка зубов", price: null }],
  weakFact: "только звонок", firstOffer: "bot", sample: "",
};

describe("/agency/demo — черновик по данным компании", () => {
  it("цена есть — только дословно", () => {
    const r = buildDraft("Сколько стоит вакцинация? Завтра в 11. Меня зовут Данияр", demo);
    expect(r.draft).toContain("Вакцинация собак — 5 000 ₸.");
    expect(r.draft).toContain("Здравствуйте, Данияр!");
    expect(r.draft).toContain("завтра 11:00");
  });
  it("цена с точкой на конце — без второй точки", () => {
    const d = { ...demo, services: [{ name: "Чистка ушей", price: "7 000 тг." }] };
    expect(buildDraft("чистка ушей", d).draft).toContain("Чистка ушей — 7 000 тг.\n");
  });
  it("цены нет — не выдумывает", () => {
    const r = buildDraft("Нужна чистка зубов", demo);
    expect(r.draft).toContain("стоимость подскажет администратор");
    expect(r.draft).not.toMatch(/\d\s*₸/);
  });
  it("услуга не названа — спрашивает", () => {
    expect(findService("здравствуйте, хочу к вам", demo.services)).toBeNull();
    expect(buildDraft("здравствуйте, хочу к вам", demo).card[0][1]).toContain("уточнить");
  });
  it("в ссылке метка agency-demo-N", () => {
    expect(demoHref(demo)).toBe("https://aevion.app/agency/demo/t?c=agency-demo-1");
  });
});
