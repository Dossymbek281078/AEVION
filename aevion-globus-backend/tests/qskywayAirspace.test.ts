import { describe, test, expect } from "vitest";

import {
  AIRSPACE,
  airspaceContentHash,
  ceilingAt,
  ceilingField,
  signablePayload,
  NO_CEILING,
} from "../src/routes/qskyway.airspace";
import { compareSnapshot, type LiveCell } from "../src/routes/qskyway.airspace.freshness";
import { PERMISSION, permissionSummary } from "../src/routes/qskyway.permission";
import { CITY_NYC } from "../src/routes/qskyway.city.nyc";
import { CITY as CITY_ASTANA } from "../src/routes/qskyway.city";
import { NOFLY } from "../src/routes/qskyway.zones";

/**
 * QSkyway had 112 smoke assertions and ZERO tests in the CI job: the smoke needs
 * a running server, so `npm test` — the thing the Backend check actually runs —
 * covered none of this module. A regression in the ceiling rasterizer or in the
 * bytes the Ed25519 signature covers would have shipped green.
 *
 * These exercise the pure layer against the REAL committed data (no fixtures,
 * no synthetic grids), so they fail if the data is regenerated into a different
 * shape as well as if the logic breaks.
 */

describe("qskyway airspace — ceiling rasterization over the real NYC twin", () => {
  const field = ceilingField("nyc", CITY_NYC);

  test("the committed FAA snapshot rasterizes onto the twin grid", () => {
    expect(field).not.toBeNull();
    expect(field!.cols).toBe(CITY_NYC.grid.cols);
    expect(field!.rows).toBe(CITY_NYC.grid.rows);
  });

  test("coverage and ceiling range match what the regulator publishes", () => {
    // 9 UASFM cells over Midtown, ceilings 0 and 400 ft (0 and 122 m).
    expect(field!.coverage).toBeGreaterThan(0.9);
    expect(field!.minCeilingM).toBe(0);
    expect(field!.maxCeilingM).toBe(122);
  });

  test("zero-ceiling cells are a real minority, not the whole grid or none of it", () => {
    // Guards both failure directions: a broken point-in-rect test would give 0
    // or everything, and either would silently change what routing may do.
    expect(field!.zeroCeilingCells).toBeGreaterThan(0);
    expect(field!.zeroCeilingCells).toBeLessThan(field!.cols * field!.rows);
  });

  test("cells outside the grid report no constraint rather than a low ceiling", () => {
    // Returning 0 here would read as "nothing authorized" and quietly forbid
    // every edge that touches the border.
    expect(ceilingAt(field, -1, 0)).toBe(NO_CEILING);
    expect(ceilingAt(field, field!.cols, 0)).toBe(NO_CEILING);
    expect(ceilingAt(field, 0, field!.rows)).toBe(NO_CEILING);
  });

  test("a city with no published ceilings has no field at all", () => {
    expect(ceilingField("astana", CITY_ASTANA)).toBeNull();
    expect(ceilingAt(null, 0, 0)).toBe(NO_CEILING);
  });
});

describe("qskyway airspace — what the signature actually covers", () => {
  const src = AIRSPACE.nyc;

  test("the signed payload is pure ASCII", () => {
    // Non-ASCII in the signed bytes broke verification through a proxy once
    // already (#712); this is the guard that keeps prose out of it.
    expect(signablePayload(src)).toMatch(/^[\x20-\x7e]*$/);
  });

  test("it carries the ceilings and the edition, not the prose", () => {
    const payload = signablePayload(src);
    expect(payload).toContain(src.effective);
    expect(payload).toContain(String(src.cells[0].ceilingFt));
    expect(payload).not.toContain("Реальные");
  });

  test("the content hash ignores feed ordering", () => {
    const reversed = { ...src, cells: [...src.cells].reverse() };
    expect(airspaceContentHash(reversed)).toBe(airspaceContentHash(src));
  });

  test("the content hash changes when a ceiling is tampered with", () => {
    const tampered = {
      ...src,
      cells: src.cells.map((c, i) => (i === 0 ? { ...c, ceilingFt: c.ceilingFt + 100 } : c)),
    };
    expect(airspaceContentHash(tampered)).not.toBe(airspaceContentHash(src));
  });
});

describe("qskyway airspace — drift detection against the live feed", () => {
  const src = AIRSPACE.nyc;
  const asLive = (): LiveCell[] =>
    src.cells.map((c) => ({ id: c.id, ceilingFt: c.ceilingFt, effective: c.effective }));

  test("an identical feed is up to date", () => {
    const d = compareSnapshot(src, asLive());
    expect(d.upToDate).toBe(true);
    expect(d.cellsAdded + d.cellsRemoved + d.cellsChanged).toBe(0);
  });

  test("a changed ceiling counts as a change, not an add or a remove", () => {
    const live = asLive();
    live[0] = { ...live[0], ceilingFt: live[0].ceilingFt === 400 ? 300 : 400 };
    const d = compareSnapshot(src, live);
    expect(d).toMatchObject({ upToDate: false, cellsChanged: 1, cellsAdded: 0, cellsRemoved: 0 });
  });

  test("withdrawn and newly published cells are detected separately", () => {
    expect(compareSnapshot(src, asLive().slice(1))).toMatchObject({ cellsRemoved: 1, cellsAdded: 0 });
    expect(
      compareSnapshot(src, [...asLive(), { id: "faa-999999999", ceilingFt: 200, effective: src.effective }]),
    ).toMatchObject({ cellsAdded: 1, cellsRemoved: 0 });
  });

  test("a reissue with identical ceilings is NOT drift", () => {
    // Crying wolf on every republication trains everyone to ignore the warning,
    // which is worse than not having it.
    const d = compareSnapshot(src, asLive().map((c) => ({ ...c, effective: "9/3/2026" })));
    expect(d.upToDate).toBe(true);
    expect(d.publishedEffective).toBe("9/3/2026");
  });
});

describe("qskyway — a prohibition must never read as a permission", () => {
  test("Astana's published zone is modelled as a prohibition", () => {
    const p = permissionSummary("astana");
    expect(p.available).toBe(true);
    expect(p).toMatchObject({ kind: "prohibition", basis: "ingested", coveragePct: 100 });
    expect(p.available && p.note).toMatch(/ЗАПРЕТНОЙ/);
    expect(p.available && p.note).not.toMatch(/требует индивидуального разрешения/);
  });

  test("Tokyo's regime is a permission, and says it was raster-sampled", () => {
    const p = permissionSummary("tokyo");
    expect(p).toMatchObject({ kind: "permission", basis: "raster-sampled" });
    expect(p.available && p.provenanceNote).toMatch(/растровым тайлам/);
  });

  test("a city with no regime reports absence rather than a default", () => {
    expect(permissionSummary("nyc").available).toBe(false);
  });

  test("every registered regime declares its kind", () => {
    // The UI and the signed filing both branch on this field; a missing value
    // would silently downgrade a ban to "ask and you may".
    for (const [city, p] of Object.entries(PERMISSION)) {
      expect(["permission", "prohibition"], `${city} kind`).toContain(p.kind);
    }
  });
});

describe("qskyway — illustrative zones must not pass for published ones", () => {
  test("Astana's placeholder circle names itself a placeholder and points at the real zone", () => {
    const gov = (NOFLY.astana ?? []).find((z) => z.id === "nfz-gov");
    expect(gov).toBeDefined();
    expect(gov!.name).toMatch(/демо/i);
    expect(gov!.realityNote).toMatch(/UAP28/);
  });

  test("the placeholder is far smaller than the real zone it stands in for", () => {
    // The whole point of the note: 320 m vs a published 4.5 km radius.
    const gov = (NOFLY.astana ?? []).find((z) => z.id === "nfz-gov")!;
    expect(gov.radiusM).toBeLessThan(1000);
    expect(PERMISSION.astana.regime).toMatch(/UAP28/);
  });
});
