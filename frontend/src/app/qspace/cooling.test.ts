import { describe, expect, it } from "vitest";
import { coolingPlan, totalPickedWatt, type SunLoad } from "./cooling";
import { peopleFrom } from "./CoolingPanel";
import type { Room } from "./rooms";

const room = (index: number, area: number): Room =>
  ({ index, area, perimeter: 4 * Math.sqrt(area), cx: 0, cy: 0 });

describe("подбор сплит-системы", () => {
  it("комната 18 м² в обычных условиях получает «девятку» или «двенашку»", () => {
    // 18 × 2.7 = 48.6 м³ × 35 = 1701 + 300 = 2001 Вт -> ближайший сверху 2100
    const r = coolingPlan([room(1, 18)]).rooms[0];
    expect(r.needWatt).toBe(2001);
    expect(r.pick?.btu).toBe(7000);
  });

  it("солнечная сторона требует БОЛЬШЕ, теневая меньше", () => {
    const need = (sun: SunLoad) =>
      coolingPlan([room(1, 25)], { sun: { 1: sun } }).rooms[0].needWatt;
    expect(need("sunny")).toBeGreaterThan(need("normal"));
    expect(need("normal")).toBeGreaterThan(need("shade"));
  });

  it("подобранный прибор НЕ слабее требуемого — округление только вверх", () => {
    // занижение здесь дороже завышения: слабый сплит работает без остановки
    for (const a of [8, 12, 15, 18, 22, 26, 30, 40, 55]) {
      const r = coolingPlan([room(1, a)]).rooms[0];
      if (r.pick) {
        expect(r.pick.watt, `для ${a} м² подобран прибор слабее нужного`)
          .toBeGreaterThanOrEqual(r.needWatt);
      }
    }
  });

  it("огромная комната честно говорит, что бытового прибора не хватит", () => {
    const res = coolingPlan([room(1, 120)]);
    expect(res.rooms[0].pick).toBeNull();
    expect(res.warnings.join(" ")).toMatch(/больше самого крупного|полупромышленн/);
  });

  it("люди и техника ДОБАВЛЯЮТ мощность, а не украшают формулу", () => {
    const a = coolingPlan([room(1, 20)], { people: { 1: 1 }, appliances: { 1: 1 } });
    const b = coolingPlan([room(1, 20)], { people: { 1: 4 }, appliances: { 1: 3 } });
    expect(b.rooms[0].needWatt - a.rooms[0].needWatt).toBe(3 * 100 + 2 * 200);
  });

  it("умолчание НЕ нулевое: пустая комната не считается холоднее жилой", () => {
    // ноль людей занизил бы мощность, а занижение здесь дороже
    const def = coolingPlan([room(1, 20)]).rooms[0].needWatt;
    const zero = coolingPlan([room(1, 20)], { people: { 1: 0 }, appliances: { 1: 0 } })
      .rooms[0].needWatt;
    expect(def).toBeGreaterThan(zero);
  });

  it("высота потолка влияет: выше потолок — больше объём", () => {
    const low = coolingPlan([room(1, 20)], { height: 2.5 }).rooms[0].needWatt;
    const high = coolingPlan([room(1, 20)], { height: 3.2 }).rooms[0].needWatt;
    expect(high).toBeGreaterThan(low);
  });

  it("объяснение показывает ЧИСЛА, а не общие слова", () => {
    const r = coolingPlan([room(1, 20)]).rooms[0];
    expect(r.how).toMatch(/20\.0 м²/);
    expect(r.how).toMatch(/Вт\/м³/);
  });

  it("граница названа прямо, а не спрятана", () => {
    const res = coolingPlan([room(1, 20)]);
    expect(res.notes.join(" ")).toMatch(/не теплотехнический расчёт/);
  });

  it("сумма по квартире складывается из подобранных, а не из требуемых", () => {
    const res = coolingPlan([room(1, 18), room(2, 12)]);
    expect(totalPickedWatt(res)).toBe(res.rooms.reduce((s, r) => s + (r.pick?.watt ?? 0), 0));
  });

  it("пустой список помещений не роняет и не выдумывает", () => {
    const res = coolingPlan([]);
    expect(res.rooms).toEqual([]);
    expect(totalPickedWatt(res)).toBe(0);
  });
});

describe("число людей из поля ввода", () => {
  it("пустое поле НЕ означает ноль людей", () => {
    // Number("") === 0, и мощность молча упала бы — занижение здесь опаснее
    expect(peopleFrom("")).toBe(1);
    expect(peopleFrom("   ")).toBe(1);
  });

  it("мусор откатывается к умолчанию, а не к нулю", () => {
    for (const v of ["abc", "--", "1e", "NaN"]) {
      expect(peopleFrom(v), `«${v}» дал не умолчание`).toBe(1);
    }
  });

  it("намеренный ноль уважается", () => {
    expect(peopleFrom("0")).toBe(0);
  });

  it("значение зажато сверху и снизу", () => {
    expect(peopleFrom("99")).toBe(10);
    expect(peopleFrom("-3")).toBe(0);
  });

  it("разница видна в мощности, а не только в числе", () => {
    // без этого проверка про поле ввода не связана с тем, ради чего она есть
    const need = (n: number) =>
      coolingPlan([{ index: 1, area: 20, perimeter: 18, cx: 0, cy: 0 }], { people: { 1: n } })
        .rooms[0].needWatt;
    expect(need(peopleFrom(""))).toBeGreaterThan(need(0));
  });
});
