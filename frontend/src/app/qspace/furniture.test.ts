import { describe, expect, it } from "vitest";
import { CATALOG, groups, itemById } from "./furniture";

describe("каталог мебели", () => {
  it("идентификаторы уникальны — иначе выбор молча возьмёт не тот предмет", () => {
    const ids = CATALOG.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("имена уникальны — иначе кнопки в интерфейсе неразличимы", () => {
    const names = CATALOG.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("габариты правдоподобны: ничего меньше сантиметра и больше трёх метров", () => {
    for (const c of CATALOG) {
      const [w, d, h] = c.size;
      for (const [n, v] of [["ширина", w], ["глубина", d], ["высота", h]] as const) {
        expect(v, `${c.id}: ${n} = ${v} м`).toBeGreaterThanOrEqual(0.01);
        expect(v, `${c.id}: ${n} = ${v} м`).toBeLessThanOrEqual(3);
      }
    }
  });

  it("габариты совпадают с настоящим размером построенной модели", () => {
    // Это главная проверка каталога: подпись «1.6 × 2.0 м» должна описывать
    // ТО, что встанет в комнату, иначе человек рассчитает расстановку по
    // числу, которого нет в модели. Сравниваем с запасом на выступы
    // (изголовье, ножки, подлокотники) — но не более чем вдвое.
    for (const c of CATALOG) {
      const g = c.build();
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = -Infinity;
      g.traverse((o) => {
        const m = o as unknown as { geometry?: { parameters?: Record<string, number> }; position?: { x: number; y: number; z: number } };
        const p = m.geometry?.parameters;
        if (!p || !m.position) return;
        const w = p.width ?? (p.radiusTop !== undefined ? p.radiusTop * 2 : 0);
        const d = p.depth ?? (p.radiusTop !== undefined ? p.radiusTop * 2 : 0);
        const h = p.height ?? 0;
        if (w === 0 && d === 0 && h === 0) return;
        minX = Math.min(minX, m.position.x - w / 2);
        maxX = Math.max(maxX, m.position.x + w / 2);
        minZ = Math.min(minZ, m.position.z - d / 2);
        maxZ = Math.max(maxZ, m.position.z + d / 2);
        maxY = Math.max(maxY, m.position.y + h / 2);
      });
      if (!isFinite(minX)) continue; // предмет только из сфер — габарит так не измерить
      const realW = maxX - minX;
      const realD = maxZ - minZ;
      const [w, d] = c.size;
      expect(realW, `${c.id}: заявлена ширина ${w}, модель ${realW.toFixed(2)}`).toBeLessThanOrEqual(w * 2 + 0.1);
      expect(realD, `${c.id}: заявлена глубина ${d}, модель ${realD.toFixed(2)}`).toBeLessThanOrEqual(d * 2 + 0.1);
      // и не бывает предмета вдвое МЕНЬШЕ заявленного
      expect(realW, `${c.id}: модель ${realW.toFixed(2)} много меньше заявленных ${w}`).toBeGreaterThanOrEqual(w / 2 - 0.1);
    }
  });

  it("ничего не пробивает потолок 2.7 м", () => {
    for (const c of CATALOG) {
      expect(c.size[2], `${c.id}: высота ${c.size[2]} м`).toBeLessThanOrEqual(2.7);
    }
  });

  it("категории покрывают всё, что просил основатель", () => {
    const g = groups();
    for (const need of ["Гостиная", "Спальня", "Кухня", "Санузел", "Климат", "Декор"]) {
      expect(g, `нет категории ${need}`).toContain(need);
    }
    // в каждой категории не меньше четырёх позиций — иначе это не «выбор»
    for (const name of g) {
      const n = CATALOG.filter((c) => c.group === name).length;
      expect(n, `в категории «${name}» всего ${n} позиций`).toBeGreaterThanOrEqual(4);
    }
  });

  it("каждый предмет действительно строится и не пустой", () => {
    for (const c of CATALOG) {
      const g = c.build();
      expect(g.children.length, `${c.id}: пустая модель`).toBeGreaterThan(0);
    }
  });

  it("два вызова build дают РАЗНЫЕ объекты — предмет можно поставить дважды", () => {
    const a = CATALOG[0].build();
    const b = CATALOG[0].build();
    expect(a).not.toBe(b);
    expect(a.children[0]).not.toBe(b.children[0]);
  });

  it("поиск по id находит существующий и НЕ находит выдуманный", () => {
    expect(itemById("sofa")?.name).toBe("Диван");
    expect(itemById("net-takogo-predmeta-zzz")).toBeUndefined();
  });
});
