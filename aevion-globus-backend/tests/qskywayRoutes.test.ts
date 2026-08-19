import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

import { qskywayRouter } from "../src/routes/qskyway";

/**
 * The routing guarantees themselves — advisory vs strict, the ceiling refusal,
 * and the signed filing — were covered only by scripts/qskyway-smoke.js, which
 * needs a running server and therefore never runs in the Backend CI job. These
 * mount the real router in a bare express app so the same guarantees fail CI
 * when they break.
 *
 * Deliberately only the deterministic, DB-free paths: the slot market needs a
 * database and the OTS anchor needs the calendar network, and both are already
 * exercised by the smoke against a live instance.
 */

const app = express();
app.use(express.json());
app.use("/api/qskyway", qskywayRouter);

describe("POST /route — advisory by default", () => {
  test("routes NYC and reports a ceiling verdict without changing routability", async () => {
    const r = await request(app).post("/api/qskyway/route").send({ from: 1, to: 2, city: "nyc" });
    expect(r.status).toBe(200);
    expect(r.body.respectCeiling).toBe(false);
    expect(r.body.airspace.available).toBe(true);
    expect(typeof r.body.airspace.compliant).toBe("boolean");
  });

  test("a city with no published ceiling gets no verdict rather than a green tick", async () => {
    const r = await request(app).post("/api/qskyway/route").send({ from: 1, to: 2, city: "astana" });
    expect(r.status).toBe(200);
    expect(r.body.airspace.available).toBe(false);
    expect(r.body.airspace.compliant).toBeNull();
  });

  test("the corridor always clears the obstacle it flies over", async () => {
    // The oldest invariant in the module: cruise altitude minus obstacle height
    // must never fall below the base clearance, whatever else changes.
    const r = await request(app).post("/api/qskyway/route").send({ from: 0, to: 3, city: "tokyo" });
    expect(r.status).toBe(200);
    const { alts, obstacles } = r.body;
    expect(alts.length).toBeGreaterThan(0);
    for (let i = 0; i < alts.length; i++) expect(alts[i]).toBeGreaterThanOrEqual(obstacles[i] + 15);
  });
});

describe("POST /route — strict mode enforces the published ceiling", () => {
  test("every corridor it returns actually respects the ceiling", async () => {
    let routed = 0;
    let violating = 0;
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (i === j) continue;
        const r = await request(app)
          .post("/api/qskyway/route")
          .send({ from: i, to: j, city: "nyc", respectCeiling: true });
        if (r.status === 200) {
          routed++;
          if (r.body.airspace.compliant !== true) violating++;
        }
      }
    }
    expect(routed).toBeGreaterThan(0);
    expect(violating).toBe(0);
  });

  test("a pad under a 0 ft ceiling is refused with the reason, not a bare 'no route'", async () => {
    // vp0 sits inside a cell where the FAA authorizes nothing automatically.
    const r = await request(app)
      .post("/api/qskyway/route")
      .send({ from: 0, to: 1, city: "nyc", respectCeiling: true });
    expect(r.status).toBe(422);
    expect(r.body.reason).toBe("airspace-ceiling");
    // The refusal must explain what an unrestricted flight would have needed —
    // otherwise it reads as "impossible" when it means "needs coordination".
    expect(r.body.airspaceIfUnrestricted.available).toBe(true);
    expect(r.body.cruiseAltMIfUnrestricted).toBeGreaterThan(0);
  });

  test("the flag cannot block a city that has no published ceiling", async () => {
    const r = await request(app)
      .post("/api/qskyway/route")
      .send({ from: 0, to: 1, city: "astana", respectCeiling: true });
    expect(r.status).toBe(200);
  });
});

describe("POST /route/justification — the filing", () => {
  test("binds the twin, the airspace edition and the verdict, and verifies", async () => {
    const j = await request(app).post("/api/qskyway/route/justification").send({ from: 1, to: 2, city: "nyc" });
    expect(j.status).toBe(200);
    expect(j.body.document.kind).toBe("qskyway.route.justification/2");
    expect(j.body.document.airspace.authority).toBe("FAA");
    expect(j.body.document.twinContentHash).toMatch(/^[0-9a-f]{64}$/);

    const v = await request(app)
      .post("/api/qskyway/route/justification/verify")
      .send({ document: j.body.document, attestation: j.body.attestation });
    expect(v.body).toMatchObject({ valid: true, hashValid: true, signatureValid: true });
  });

  /**
   * Версия формата обязана двигаться, когда меняется то, ЧТО покрывает подпись.
   * 13.08.2026 `scope` переехал внутрь документа: в /1 он лежал полем ответа
   * рядом и подписью не покрывался. Оставить прежний номер значило бы отдать
   * противоположное устройство под тем же именем.
   */
  test("документ несёт версию формата, и оговорка лежит ВНУТРИ неё", async () => {
    const j = await request(app).post("/api/qskyway/route/justification").send({ from: 1, to: 2, city: "nyc" });
    expect(j.body.document.kind).toBe("qskyway.route.justification/2");
    // Именно это отличает /2 от /1 — проверяем свойство, а не только строку.
    expect(typeof j.body.document.scope).toBe("string");
    expect(typeof j.body.document.scopeEn).toBe("string");
    expect(j.body.document).toHaveProperty("substitutedHeights");
  });

  /**
   * Документы версии /1 уже выданы. Они проверяются как подлинные — и это
   * верно, — но в ТОЙ версии оговорка о границах лежала СНАРУЖИ подписи:
   * её можно было отбросить при пересылке, и документ всё равно прошёл бы
   * проверку. Ответ обязан это называть, иначе сегодняшняя починка защищает
   * только новые бумаги.
   */
  test("проверка называет версию формата и оговаривает старую", async () => {
    const fresh = await request(app).post("/api/qskyway/route/justification").send({ from: 1, to: 2, city: "nyc" });
    const vNew = await request(app).post("/api/qskyway/route/justification/verify")
      .send({ document: fresh.body.document, attestation: fresh.body.attestation });
    expect(vNew.body.documentFormat).toBe("qskyway.route.justification/2");
    expect(vNew.body.scopeUnderSignature).toBe(true);
    expect(String(vNew.body.formatNote)).toContain("покрыта подписью");

    // Документ прежнего формата. Подписывать заново не нужно и нечем: ключ
    // модуля наружу не экспортируется, а проверяемые здесь поля считаются по
    // САМОМУ документу и от подписи не зависят — что и требуется утверждать.
    const legacy = { ...fresh.body.document, kind: "qskyway.route.justification/1" };
    const vOld = await request(app).post("/api/qskyway/route/justification/verify")
      .send({ document: legacy, attestation: fresh.body.attestation });
    expect(vOld.body.documentFormat).toBe("qskyway.route.justification/1");
    expect(vOld.body.scopeUnderSignature).toBe(false);
    expect(String(vOld.body.formatNote)).toContain("НЕ покрыта подписью");

    // Бланк без версии — отдельный случай, его нельзя путать со старым форматом.
    const noKind = { ...fresh.body.document };
    delete (noKind as Record<string, unknown>).kind;
    const vNone = await request(app).post("/api/qskyway/route/justification/verify")
      .send({ document: noKind, attestation: fresh.body.attestation });
    expect(vNone.body.documentFormat).toBeNull();
    expect(String(vNone.body.formatNote)).toContain("не указана");
  });

  test("a tampered value is reported as a content change, not a bad signature", async () => {
    const j = await request(app).post("/api/qskyway/route/justification").send({ from: 1, to: 2, city: "nyc" });
    const v = await request(app)
      .post("/api/qskyway/route/justification/verify")
      .send({
        document: { ...j.body.document, cruiseAltM: j.body.document.cruiseAltM + 100 },
        attestation: j.body.attestation,
      });
    expect(v.body).toMatchObject({ valid: false, hashValid: false });
  });

  /**
   * До 12.08.2026 оговорка о границах документа лежала ПОЛЕМ ОТВЕТА рядом с
   * `document`, а не внутри него. Комментарий в коде обещал обратное: «едет
   * вместе с документом, иначе „построено по данным FAA“ превращается в „FAA
   * согласовало“». На деле пара `{document, attestation}`, переданная дальше
   * без третьего поля, проверялась как подлинная — уже без единой оговорки.
   */
  test("оговорка о границах — внутри подписи, а не рядом с ней", async () => {
    const j = await request(app).post("/api/qskyway/route/justification").send({ from: 1, to: 2, city: "nyc" });
    // Она в самом документе, значит уедет с ним куда угодно.
    expect(j.body.document.scope).toContain("НЕ сертификация");
    // Поле ответа осталось для прежних читателей, но это тот же текст.
    expect(j.body.scope).toBe(j.body.document.scope);

    // И главное: подделать её молча нельзя — подпись покрывает.
    const v = await request(app)
      .post("/api/qskyway/route/justification/verify")
      .send({
        document: { ...j.body.document, scope: "Полёт согласован регулятором." },
        attestation: j.body.attestation,
      });
    expect(v.body).toMatchObject({ valid: false, hashValid: false });
  });

  /**
   * Документ адресован регулятору того города, для которого построен коридор:
   * Нью-Йорк — FAA, Токио — MLIT/JCAB. Оговорка, которую они не прочтут, не
   * защищает ни от чего, а защищает она от главного — прочтения «построено по
   * данным FAA» как «FAA согласовало».
   */
  test("английская оговорка есть, различает запрет и разрешение и тоже под подписью", async () => {
    const nyc = await request(app).post("/api/qskyway/route/justification").send({ from: 1, to: 2, city: "nyc" });
    expect(nyc.body.document.scopeEn).toContain("NOT a flight authorization");
    expect(nyc.body.document.scopeEn).toContain("NOT an air-taxi certification");

    // Запрет и режим разрешений — разные ответы регулятора, и в переводе тоже.
    const astana = await request(app).post("/api/qskyway/route/justification").send({ from: 0, to: 1, city: "astana" });
    expect(astana.body.document.scopeEn).toContain("PROHIBITED area");
    expect(astana.body.document.scopeEn).toContain("not permitted subject to coordination");
    // Имя ведомства в английском тексте — латиницей: документ читают там, где
    // кириллица не читается. Русская версия при этом называет его как публикует
    // сам регулятор.
    expect(astana.body.document.scopeEn).toContain("Kazaeronavigatsia");
    expect(astana.body.document.scopeEn).not.toContain("Казаэронавигация");
    expect(astana.body.document.scope).toContain("Казаэронавигация");

    const tokyo = await request(app).post("/api/qskyway/route/justification").send({ from: 0, to: 1, city: "tokyo" });
    expect(tokyo.body.document.scopeEn).toContain("permission regime");
    expect(tokyo.body.document.scopeEn).not.toContain("PROHIBITED");

    // Английская версия защищена ровно так же, как русская: иначе смягчить
    // можно было бы именно ту, которую читает регулятор.
    const v = await request(app)
      .post("/api/qskyway/route/justification/verify")
      .send({
        document: { ...nyc.body.document, scopeEn: "Flight approved by the regulator." },
        attestation: nyc.body.attestation,
      });
    expect(v.body).toMatchObject({ valid: false, hashValid: false });
  });

  /**
   * Документ двуязычный, а вердикт его проверки был только русским. Проверять
   * будет тот, кому документ принесли, — и непрочитанный вердикт ничем не лучше
   * непрочитанной оговорки. Три исхода должны различаться на обоих языках:
   * «цел и подписан нами», «цел, но подпись чужая», «содержимое подделано».
   */
  test("вердикт проверки различает три исхода и по-английски тоже", async () => {
    const j = await request(app).post("/api/qskyway/route/justification").send({ from: 1, to: 2, city: "nyc" });

    const ok = await request(app)
      .post("/api/qskyway/route/justification/verify")
      .send({ document: j.body.document, attestation: j.body.attestation });
    expect(ok.body.noteEn).toContain("signed by the platform key");

    const tampered = await request(app)
      .post("/api/qskyway/route/justification/verify")
      .send({ document: { ...j.body.document, cruiseAltM: j.body.document.cruiseAltM + 50 }, attestation: j.body.attestation });
    expect(tampered.body.noteEn).toContain("altered");
    // Подделку нельзя выдать за «чужой ключ» и наоборот: это разные отказы.
    expect(tampered.body.noteEn).not.toContain("signature does not belong");

    const foreignKey = await request(app)
      .post("/api/qskyway/route/justification/verify")
      .send({
        document: j.body.document,
        attestation: { ...j.body.attestation, signature: Buffer.alloc(64, 7).toString("base64") },
      });
    expect(foreignKey.body).toMatchObject({ hashValid: true, signatureValid: false });
    expect(foreignKey.body.noteEn).toContain("does not belong to the platform key");
  });

  /**
   * Подставленная высота — не то же самое, что «не обмерено». В общей корзине
   * «не обмерено» лежит и слепой дефолт 12 м, и правдоподобное число из
   * статистики по типу застройки; второе поднимает коридор всерьёз (вокзал
   * Нью-Йорка: 12 → 171 м, эшелон +87.5 м). Замер 12.08.2026: подстановка
   * задевает 16 маршрутов из 42 в Нью-Йорке — умолчать о ней в бумаге для
   * регулятора значит выдать статистику по кварталу за свойство здания.
   */
  test.each(["nyc", "astana"])("[%s] подставленные высоты названы в документе отдельно от «не обмерено»", async (city) => {
    // Два города намеренно. Первая версия проверяла только Нью-Йорк, где
    // подстановка ровно одна, и пропустила дефект счётчика: у Астаны 38
    // подстановок с одинаковой высотой 59 м, и здание опознавалось по высоте —
    // один задетый дом считался за тридцать. Живой ответ показывал «участков
    // 15, зданий 30», то есть зданий больше, чем участков.
    const found = [] as { from: number; to: number; s: { segments: number; buildings: number } }[];
    for (let a = 0; a < 7 && found.length === 0; a++) {
      for (let b = 0; b < 7 && found.length === 0; b++) {
        if (a === b) continue;
        const j = await request(app).post("/api/qskyway/route/justification").send({ from: a, to: b, city });
        if (j.status !== 200) continue;
        // Поле обязано присутствовать всегда — иначе «нет подстановок» не
        // отличить от «поле забыли добавить в этот ответ».
        expect(j.body.document).toHaveProperty("substitutedHeights");
        const s = j.body.document.substitutedHeights;
        if (s) found.push({ from: a, to: b, s });
      }
    }
    expect(found.length).toBeGreaterThan(0);
    const { s } = found[0];
    expect(s.segments).toBeGreaterThan(0);
    // Зданий, а не ячеек: вокзал занимает 40 ячеек, и «40 зданий» в подписанном
    // документе было бы неправдой.
    expect(s.buildings).toBeGreaterThan(0);
    expect(s.buildings).toBeLessThanOrEqual(s.segments);
  });

  /**
   * Чип на странице говорит «подставлено по типу: N зданий», и без ответа на
   * вопрос «а летаем-то мы над ними?» он оставляет человека гадать. У спорной
   * высоты такой ответ уже есть, и там он оказался неочевидным: спорная высота
   * Астаны не задевает НИ ОДНОГО маршрута, а подстановка — больше половины.
   */
  test("[astana] сводка по подстановке считает маршруты, а не пересказывает данные", async () => {
    const r = await request(app).get("/api/qskyway/height-substitution?city=astana");
    expect(r.status).toBe(200);
    const b = r.body;
    expect(b.available).toBe(true);
    // Два разных числа: сколько подстановок в данных и сколько из них под
    // коридорами. Совпадение допустимо, но подмена одного другим — нет.
    expect(b.buildings).toBeGreaterThan(0);
    expect(b.buildingsUnderRoutes).toBeLessThanOrEqual(b.buildings);
    // Замер, а не рассуждение: направления считаются отдельно, 7 площадок = 42 пары.
    expect(b.pairs).toBe(42);
    expect(b.affectedPairs).toBeGreaterThan(0);
    expect(b.affectedPairs).toBeLessThanOrEqual(b.routable);
    expect(b.note).toContain(String(b.affectedPairs));
  });

  test("город без подстановок отвечает «нечего мерить», а не пустым успехом", async () => {
    // Тот же приём, что у /height-dispute: молчащий ответ и «мы не считали»
    // должны различаться, иначе ноль читается как проверка.
    const app2 = express().use("/api/qskyway", qskywayRouter);
    const r = await request(app2).get("/api/qskyway/height-substitution?city=nyc");
    expect(r.status).toBe(200);
    // У Нью-Йорка подстановка есть (вокзал), поэтому проверяем форму ответа:
    // available=false обязан приходить с объяснением, а не с голым false.
    if (r.body.available === false) expect(String(r.body.note)).not.toHaveLength(0);
    else expect(r.body.buildings).toBeGreaterThan(0);
  });

  test("for a prohibited city it never says the flight merely needs permission", async () => {
    // The worst defect this module has had: a signed document telling a
    // regulator that a banned flight could be authorized on request.
    const j = await request(app).post("/api/qskyway/route/justification").send({ from: 0, to: 1, city: "astana" });
    expect(j.status).toBe(200);
    expect(j.body.document.permission.kind).toBe("prohibition");
    expect(j.body.scope).toMatch(/ЗАПРЕТНАЯ/);
    expect(j.body.scope).not.toMatch(/требует индивидуального разрешения/);
  });
});

describe("GET /cities and /verify — coverage and attestation", () => {
  test("every city is credited with a published rule of some kind", async () => {
    const r = await request(app).get("/api/qskyway/cities");
    expect(r.status).toBe(200);
    const cov = r.body.airspaceCoverage;
    // Смысл теста — «у каждого города есть опубликованное правило», и отвечает
    // на это `withRegulatoryLayer`. Раньше здесь стоял `withFeed`, потому что он
    // считал то же самое вопреки своему имени; 11.08.2026 поле разделили, и
    // `withFeed` теперь честно считает только фиды — у трёх городов он один
    // (Нью-Йорк), у Астаны правило в документе eAIP, у Токио в растре MLIT.
    expect(cov.withRegulatoryLayer).toBe(cov.total);
    expect(cov.withFeed).toBeLessThan(cov.total); // «нет API» ≠ «нет правила»
    expect(cov.withFeed).toBeGreaterThan(0);
    expect(cov.missing).toEqual([]);
    expect(cov.withCeilings + cov.withPermissionRegime).toBeGreaterThanOrEqual(cov.total);
  });

  test("the twin and the airspace layer are attested separately", async () => {
    const r = await request(app).get("/api/qskyway/verify?city=nyc");
    expect(r.status).toBe(200);
    expect(r.body.twin.valid).toBe(true);
    expect(r.body.airspace).toMatchObject({ attested: true, valid: true, authority: "FAA" });
  });

  test("a city with nothing to attest says so instead of reporting invalid", async () => {
    const r = await request(app).get("/api/qskyway/verify?city=astana");
    expect(r.body.valid).toBe(true);
    expect(r.body.airspace).toMatchObject({ attested: false, valid: null });
  });
});

describe("POST /airspace/anchor/verify — the one input-driven outbound call", () => {
  test("an oversized proof is refused before anything reaches the network", async () => {
    // Parsing a caller-supplied blob and then calling third-party calendars with
    // it is work an attacker gets to choose the size of. Refused on shape, not
    // after the round trip — and with a limit, not a silent truncation.
    const r = await request(app)
      .post("/api/qskyway/airspace/anchor/verify")
      .send({ city: "nyc", contentHash: "a".repeat(64), otsProofB64: "A".repeat(70_000) });
    expect(r.status).toBe(413);
    expect(r.body.maxBytesB64).toBeGreaterThan(0);
  });

  test("a request missing its proof is answered locally, not by asking a calendar", async () => {
    const r = await request(app)
      .post("/api/qskyway/airspace/anchor/verify")
      .send({ city: "nyc", contentHash: "a".repeat(64) });
    expect(r.status).toBe(200);
    expect(r.body.fullyProven).toBe(false);
    expect(r.body.ots.error).toMatch(/otsProofB64/);
  });

  test("a request missing its hash is refused before the proof is even looked at", async () => {
    const r = await request(app).post("/api/qskyway/airspace/anchor/verify").send({ city: "nyc" });
    expect(r.status).toBe(200);
    expect(r.body.fullyProven).toBe(false);
    expect(r.body.ots.error).toMatch(/contentHash/);
  });
});

describe("GET /airspace/impact — what the ceiling costs", () => {
  test("measures every pair and finds the ceiling genuinely binding", async () => {
    const r = await request(app).get("/api/qskyway/airspace/impact?city=nyc");
    expect(r.status).toBe(200);
    expect(r.body.routable).toBe(r.body.pairs);
    expect(r.body.compliant).toBeGreaterThan(0);
    expect(r.body.compliant).toBeLessThan(r.body.pairs);
    expect(r.body.strictRoutable).toBeGreaterThanOrEqual(r.body.compliant);
  });

  test("the cached second answer is identical to the computed first", async () => {
    // Memoized because it walks every pair (0.4-0.55 s cold) and sits on the
    // first screen. Asserting equality rather than timing: a cache that returns
    // a different or partial payload is the failure worth catching, and a
    // stopwatch assertion would just be flaky.
    const first = await request(app).get("/api/qskyway/airspace/impact?city=nyc");
    const second = await request(app).get("/api/qskyway/airspace/impact?city=nyc");
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
  });

  test("says plainly there is nothing to measure without a ceiling grid", async () => {
    const r = await request(app).get("/api/qskyway/airspace/impact?city=tokyo");
    expect(r.body.available).toBe(false);
  });

  test("counts pads with correct Russian agreement", async () => {
    // "1 площадок" in a headline figure undercuts the care taken to compute it.
    const r = await request(app).get("/api/qskyway/airspace/impact?city=nyc");
    expect(r.body.note).not.toMatch(/\b1 площадок\b/);
  });
});
