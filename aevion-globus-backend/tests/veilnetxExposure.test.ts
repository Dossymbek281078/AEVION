import { describe, test, expect } from "vitest";
import { scoreExposure, gradeFor, type ExposureInput } from "../src/lib/veilnetxExposure";

// Шкала раскрытости VeilNetX. Главное здесь — не отдельные числа, а то, что
// КАЖДАЯ оценка достижима реальным набором заголовков. Недостижимая крайняя
// категория создаёт впечатление, будто инструмент различает состояния, хотя он
// их не различает: до issue #785 лучшая оценка A не выдавалась никому, потому
// что три находки срабатывали у любого браузера — включая штраф за выключенный
// по умолчанию Do-Not-Track.

/** Человек сделал всё, что можно сделать в браузере: Tor + прокси. */
const IDEAL: ExposureInput = {
  proxyDetected: true,
  geoLeaked: false,
  geoLabel: "",
  uaRaw: "Mozilla/5.0 (Windows NT 10.0; rv:115.0) Gecko/20100101 Firefox/115.0",
  uaBrowser: "Firefox",
  uaOs: "Windows",
  clientHintsLeaked: false,
  clientHintsLabel: "",
  primaryLanguage: "en-US",
  refererPresent: false,
  cookiePresent: false,
  dnt: true,
};

const with_ = (patch: Partial<ExposureInput>): ExposureInput => ({ ...IDEAL, ...patch });

describe("достижимость оценок", () => {
  test("A — Tor с прокси, ничего управляемого не раскрыто", () => {
    const r = scoreExposure(IDEAL);
    expect(r.exposureScore).toBe(0);
    expect(r.grade).toBe("A");
    expect(r.level).toBe("green");
  });

  test("B — VPN, но браузер шлёт Client Hints и cookie", () => {
    const r = scoreExposure(with_({ clientHintsLeaked: true, cookiePresent: true }));
    expect(r.grade).toBe("B");
  });

  test("C — без прокси, гео скрыто, Client Hints идут", () => {
    const r = scoreExposure(with_({ proxyDetected: false, clientHintsLeaked: true }));
    expect(r.grade).toBe("C");
  });

  test("D — без прокси, гео определяется по IP", () => {
    const r = scoreExposure(with_({ proxyDetected: false, geoLeaked: true, geoLabel: "KZ, Almaty" }));
    expect(r.grade).toBe("D");
  });

  test("F — обычный браузер без всякой защиты", () => {
    const r = scoreExposure(
      with_({
        proxyDetected: false,
        geoLeaked: true,
        geoLabel: "KZ, Almaty",
        clientHintsLeaked: true,
        refererPresent: true,
        cookiePresent: true,
        dnt: false,
      }),
    );
    expect(r.grade).toBe("F");
    expect(r.level).toBe("red");
  });

  test("все пять оценок достижимы — ни одна не пропущена", () => {
    const grades = new Set([
      scoreExposure(IDEAL).grade,
      scoreExposure(with_({ clientHintsLeaked: true, cookiePresent: true })).grade,
      scoreExposure(with_({ proxyDetected: false, clientHintsLeaked: true })).grade,
      scoreExposure(with_({ proxyDetected: false, geoLeaked: true })).grade,
      scoreExposure(with_({ proxyDetected: false, geoLeaked: true, clientHintsLeaked: true })).grade,
    ]);
    expect(grades).toEqual(new Set(["A", "B", "C", "D", "F"]));
  });
});

describe("не наказываем за то, чего человек не выбирал", () => {
  test("выключенный Do-Not-Track не ухудшает оценку", () => {
    const on = scoreExposure(with_({ dnt: true }));
    const off = scoreExposure(with_({ dnt: false }));
    expect(off.exposureScore).toBe(on.exposureScore);
    expect(off.grade).toBe(on.grade);
  });

  test("DNT при этом остаётся видимым в отчёте", () => {
    const off = scoreExposure(with_({ dnt: false }));
    const dnt = off.findings.find((f) => f.id === "dnt");
    expect(dnt?.exposed).toBe(true);
    expect(dnt?.counted).toBe(false);
  });

  test("User-Agent и Accept-Language видны, но не идут в счёт", () => {
    const r = scoreExposure(IDEAL);
    for (const id of ["user-agent", "language"]) {
      const f = r.findings.find((x) => x.id === id);
      expect(f?.exposed, `${id} должен быть виден в отчёте`).toBe(true);
      expect(f?.counted, `${id} неизбежен для браузера — не должен идти в счёт`).toBe(false);
    }
    expect(r.exposureScore).toBe(0);
  });
});

describe("шкала остаётся строгой", () => {
  test("максимум набирается и он ниже 100 — потолок не съедает различия", () => {
    const worst = scoreExposure(
      with_({
        proxyDetected: false,
        geoLeaked: true,
        clientHintsLeaked: true,
        refererPresent: true,
        cookiePresent: true,
      }),
    );
    expect(worst.exposureScore).toBe(worst.maxScore);
    expect(worst.maxScore).toBeLessThan(100);
    expect(worst.grade).toBe("F");
  });

  test("отсутствие прокси само по себе уже уводит из зелёного", () => {
    const r = scoreExposure(with_({ proxyDetected: false }));
    expect(r.exposureScore).toBe(26);
    expect(r.grade).not.toBe("A");
  });

  test("границы gradeFor не имеют дыр", () => {
    expect(gradeFor(12)).toBe("A");
    expect(gradeFor(13)).toBe("B");
    expect(gradeFor(28)).toBe("B");
    expect(gradeFor(29)).toBe("C");
    expect(gradeFor(45)).toBe("C");
    expect(gradeFor(46)).toBe("D");
    expect(gradeFor(65)).toBe("D");
    expect(gradeFor(66)).toBe("F");
  });
});

// ── Интеграция: маршрут действительно отдаёт эту оценку ─────────────────────
// Модульных тестов мало: они проверяют функцию, а не то, что маршрут её
// вызывает и кладёт результат в ответ. Без этого правка шкалы могла бы жить в
// библиотеке, никак не влияя на то, что видит пользователь.
describe("GET /inspect отдаёт оценку из общей шкалы", () => {
  test("запрос без cookie/referer через прокси получает A", async () => {
    const request = (await import("supertest")).default;
    const express = (await import("express")).default;
    const { veilnetxRouter } = await import("../src/routes/veilnetx");

    const app = express();
    app.use("/api/veilnetx", veilnetxRouter);

    const r = await request(app)
      .get("/api/veilnetx/inspect")
      .set("via", "1.1 proxy") // прокси виден → real-ip не раскрыт
      .set("user-agent", "Mozilla/5.0 (Windows NT 10.0; rv:115.0) Firefox/115.0")
      .set("accept-language", "en-US");

    expect(r.status).toBe(200);
    expect(r.body.exposure).toBeTruthy();
    expect(r.body.exposure.grade).toBe("A");
    expect(r.body.exposure.level).toBe("green");

    // User-Agent виден в отчёте, но не портит оценку — то, ради чего правка.
    const ua = r.body.exposure.findings.find((f: { id: string }) => f.id === "user-agent");
    expect(ua.exposed).toBe(true);
    expect(ua.counted).toBe(false);
  });

  test("тот же запрос без прокси и с cookie уходит из зелёного", async () => {
    const request = (await import("supertest")).default;
    const express = (await import("express")).default;
    const { veilnetxRouter } = await import("../src/routes/veilnetx");

    const app = express();
    app.use("/api/veilnetx", veilnetxRouter);

    const r = await request(app)
      .get("/api/veilnetx/inspect")
      .set("user-agent", "Mozilla/5.0 (Windows NT 10.0; rv:115.0) Firefox/115.0")
      .set("accept-language", "ru-RU,ru;q=0.9")
      .set("cookie", "sid=abc")
      .set("sec-ch-ua-platform", "\"Windows\"");

    expect(r.status).toBe(200);
    expect(r.body.exposure.grade).not.toBe("A");
    expect(r.body.exposure.score).toBeGreaterThan(12);
  });
});
