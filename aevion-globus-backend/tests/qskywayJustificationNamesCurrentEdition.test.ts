import { describe, test, expect, vi, afterEach } from "vitest";
import express from "express";
import request from "supertest";

import { qskywayRouter } from "../src/routes/qskyway";
import { AIRSPACE } from "../src/routes/qskyway.airspace";
import { checkAirspaceFreshnessNow } from "../src/routes/qskyway.airspace.freshness";

/**
 * Подписанный документ обоснования называет не только снимок, но и издание,
 * которое регулятор публикует сейчас.
 *
 * ПОВОД. 14.09.2026 прод: FAA публикует UAS Facility Maps от 9/3/2026, наш
 * снимок — 7/9/2026, потолки совпадают ячейка в ячейку. Страница это
 * объясняла подсказкой, а документ, который человек уносит проверяющему,
 * называл одно 7/9/2026 — то есть «маршрут по устаревшему изданию».
 *
 * Живой фид нельзя заставить разойтись с нами по требованию, поэтому ответ
 * FAA подменяется: сначала теми же потолками с новой датой, затем с одним
 * изменённым потолком (контроль — прибор обязан различать).
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

const NYC = AIRSPACE.nyc;

function stubFaa(edition: string, bumpFirstCeiling = 0) {
  const features = NYC.cells.map((c, i) => ({
    attributes: { CEILING: c.ceilingFt + (i === 0 ? bumpFirstCeiling : 0), MAP_EFF: edition, APT1_ICAO: c.airportIcao },
    geometry: {
      rings: [[[c.minLon, c.minLat], [c.maxLon, c.minLat], [c.maxLon, c.maxLat], [c.minLon, c.maxLat], [c.minLon, c.minLat]]],
    },
  }));
  vi.stubGlobal("fetch", vi.fn(async (url: unknown) => {
    if (String(url).includes("FAA_UAS_FacilityMap")) {
      return new Response(JSON.stringify({ features }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("offline in tests", { status: 503 });
  }));
}

async function justify() {
  const res = await request(app()).post("/api/qskyway/route/justification").send({ from: 0, to: 1, city: "nyc" });
  expect(res.status).toBe(200);
  return res.body;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("документ обоснования называет текущее издание регулятора", () => {
  // Порядок важен: первая проверка идёт ДО любой сверки в этом процессе.
  test("до сверки поле честно пустое, а не «актуально»", async () => {
    const body = await justify();
    expect(body.document.airspace.effective).toBe(NYC.effective);
    expect(body.document.airspace).toHaveProperty("currentEdition");
    expect(body.document.airspace.currentEdition).toBeNull();
  });

  test("регулятор переиздал карту без изменения потолков — документ это говорит, подпись в силе", async () => {
    stubFaa("9/3/2026");
    await checkAirspaceFreshnessNow();
    const body = await justify();
    const ce = body.document.airspace.currentEdition;
    expect(ce, "сверка прошла, а документ о ней молчит").toBeTruthy();
    expect(ce.publishedEffective).toBe("9/3/2026");
    expect(ce.ceilingsMatch).toBe(true);
    expect(typeof ce.checkedAt).toBe("string");
    // Снимок по-прежнему назван своим именем — новое поле его не подменяет.
    expect(body.document.airspace.effective).toBe(NYC.effective);

    // Поле внутри подписанного: сверка документа целиком проходит.
    const v = await request(app())
      .post("/api/qskyway/route/justification/verify")
      .send({ document: body.document, attestation: body.attestation });
    expect(v.status).toBe(200);
    expect(v.body.valid, "документ с новым полем не проходит собственную сверку").toBe(true);
  });

  test("контроль: изменился один потолок — документ не называет потолки совпадающими", async () => {
    stubFaa("9/3/2026", 100);
    await checkAirspaceFreshnessNow();
    const body = await justify();
    expect(body.document.airspace.currentEdition?.ceilingsMatch).toBe(false);
  });
});
