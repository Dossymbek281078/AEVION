import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { feature as topoFeature } from "topojson-client";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import countriesData from "world-atlas/countries-110m.json";
import { bboxCenterLon, lonWidth, wrapAwareLonRange } from "../globusLonRange";

/**
 * Замер на проде 28.10.2026 (globus-klik25.mjs, ae6d4759c): нажатие в центр глобуса после
 * /?country=<страна> открывало панель 20/25 и касанием, и мышью — Россия «НЕТ» на всех 5 парах
 * окон. Рамка страны считалась простыми min/max долготы: у России (Чукотка за 180°) выходило
 * −180..180, центр у 0° — Северное море, глобус поворачивался в море.
 */
const src = readFileSync(join(__dirname, "..", "Globus3D.tsx"), "utf8");

type Rings = number[][][];
function страна(name: string): Rings {
  const topo = countriesData as Parameters<typeof topoFeature>[0];
  const obj = (countriesData as { objects: { countries: Parameters<typeof topoFeature>[1] } }).objects.countries;
  const fc = topoFeature(topo, obj) as FeatureCollection;
  const f = fc.features.find((x) => (x.properties as { name?: string } | null)?.name === name);
  if (!f?.geometry) throw new Error(`нет страны ${name} в world-atlas`);
  const g = f.geometry as Polygon | MultiPolygon;
  return g.type === "Polygon" ? [g.coordinates[0]] : g.coordinates.map((p) => p[0]);
}
// Тот же расчёт, что в buildCountriesIfNeeded.
function рамка(rings: Rings): [number, number, number, number] {
  let w = 180, s = 90, e = -180, n = -90, w3 = 360, e3 = 0;
  for (const r of rings) for (const [lon, lat] of r) {
    w = Math.min(w, lon); e = Math.max(e, lon);
    const l3 = lon < 0 ? lon + 360 : lon;
    w3 = Math.min(w3, l3); e3 = Math.max(e3, l3);
    s = Math.min(s, lat); n = Math.max(n, lat);
  }
  [w, e] = wrapAwareLonRange(w, e, w3, e3);
  return [w, s, e, n];
}
function внутри(lon: number, lat: number, rings: Rings): boolean {
  return rings.some((ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  });
}

describe("глобус: центр страны через 180°", () => {
  it("центр рамки России лежит в России (не в море у 0°)", () => {
    const ru = страна("Russia");
    const [w, s, e, n] = рамка(ru);
    expect(w > e, "рамка России идёт через 180°").toBe(true);
    const lon = bboxCenterLon(w, e), lat = (s + n) / 2;
    expect(lon).toBeGreaterThan(60);
    expect(внутри(lon, lat, ru), `центр ${lat.toFixed(1)}, ${lon.toFixed(1)}`).toBe(true);
    expect(lonWidth(w, e)).toBeLessThan(200);
  });

  it("контроль: прежний расчёт min/max ставил центр России в море", () => {
    const ru = страна("Russia");
    const lons = ru.flat().map((p) => p[0]);
    const lats = ru.flat().map((p) => p[1]);
    const lon = (Math.min(...lons) + Math.max(...lons)) / 2;
    const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
    expect(Math.abs(lon)).toBeLessThan(5);
    expect(внутри(lon, lat, ru)).toBe(false);
  });

  it("страны прогона и не пересекающие 180° — рамка прежняя, центр внутри", () => {
    for (const name of ["Kazakhstan", "Brazil", "Australia", "Algeria"]) {
      const r = страна(name);
      const [w, s, e, n] = рамка(r);
      const lons = r.flat().map((p) => p[0]);
      expect([w, e], name).toEqual([Math.min(...lons), Math.max(...lons)]);
      expect(внутри(bboxCenterLon(w, e), (s + n) / 2, r), name).toBe(true);
    }
  });

  it("Фиджи: центр у 180°, а не у 0°", () => {
    const [w, , e] = рамка(страна("Fiji"));
    expect(Math.abs(bboxCenterLon(w, e))).toBeGreaterThan(170);
  });

  it("Globus3D считает рамку и облёт через эти функции", () => {
    expect(src).toMatch(/\[west, east\] = wrapAwareLonRange\(west, east, west360, east360\)/);
    expect(src).toMatch(/const centerLon = bboxCenterLon\(w, e\)/);
    expect(src).toMatch(/const lonRange = lonWidth\(w, e\)/);
  });
});
