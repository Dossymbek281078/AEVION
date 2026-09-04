import { describe, test, expect, vi, afterAll } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import request from "supertest";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Имена наших переменных окружения не должны уходить посетителю.
 *
 * ЧТО БЫЛО. Пояснение к ключу подписи говорило человеку:
 * «The signing key is stable (QSKYWAY_SIGN_SK)», а в одноразовом режиме —
 * «Provide QSKYWAY_SIGN_SK for a stable key», то есть посетитель читал
 * инструкцию оператору и узнавал, как называется переменная с ключом подписи.
 * Значение не утекало, но имя — это подсказка о нашем устройстве, и в тексте
 * для человека ей делать нечего.
 *
 * ПОЧЕМУ СЕРВЕР В ПРОЦЕССЕ, А НЕ ГРЕП ПО ИСХОДНИКУ. Греп отвечает «что я
 * проверил», а не «что увидит человек»: строка может собираться из кусков,
 * приходить из другого модуля или не попадать в ответ вовсе. Здесь читается
 * настоящее тело ответа.
 *
 * ГРАНИЦА, названная честно: проверяются только те ручки, что перечислены
 * ниже. Появится новая ручка с пояснением — сторож о ней не узнает.
 */

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

/** Форма имени переменной окружения: ДВА_СЛОВА_ЗАГЛАВНЫМИ через подчёркивание. */
function envNamesFromSource(): Set<string> {
  // НЕ форма, а НАСТОЯЩИЕ имена: всё, что модуль читает из окружения.
  // Прежняя редакция ловила форму ДВА_СЛОВА_ЗАГЛАВНЫМИ и покраснела на
  // внутренней константе SRC_CLEARANCE в серверной заметке о высотах —
  // это была клевета на исправный код. Список исключений не годится:
  // он молча стареет, и следующая константа даст ту же ложную тревогу.
  //
  // Разбор позиционный, без регулярок: собранный из строки класс символов
  // на этой машине уже терял слэши и молча совпадал ни с чем.
  const MARK = "process.env.";
  const isNameChar = (c: string) =>
    (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c === "_";
  const root = path.join(__dirname, "..", "src");
  const names = new Set<string>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(f);
        continue;
      }
      if (!e.name.endsWith(".ts")) continue;
      const txt = fs.readFileSync(f, "utf8");
      let i = txt.indexOf(MARK);
      while (i !== -1) {
        let j = i + MARK.length;
        let name = "";
        while (j < txt.length && isNameChar(txt[j])) {
          name += txt[j];
          j += 1;
        }
        if (name.length >= 3) names.add(name);
        i = txt.indexOf(MARK, j);
      }
    }
  };
  walk(root);
  return names;
}
const ENV_NAMES = envNamesFromSource();

/** Собрать ВСЕ строковые значения ответа: пояснение может лежать на любой глубине. */
function strings(v: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 6 || v == null) return out;
  if (typeof v === "string") {
    out.push(v);
    return out;
  }
  if (Array.isArray(v)) {
    for (const x of v) strings(x, out, depth + 1);
    return out;
  }
  if (typeof v === "object") {
    for (const x of Object.values(v as Record<string, unknown>)) strings(x, out, depth + 1);
  }
  return out;
}

/**
 * Все читающие ручки модуля, а не три. Прежняя версия смотрела на /verify,
 * /city и обоснование — но пояснения живут и в остальных ответах, и слепота
 * сторожа измеряется не тем, сколько он проверил, а тем, сколько пропустил.
 */
const GETS: Array<[string, Record<string, string>]> = [
  ["/api/qskyway/cities", {}],
  ["/api/qskyway/city", { city: "astana" }],
  ["/api/qskyway/vertiports", { city: "astana" }],
  ["/api/qskyway/slots", { city: "astana" }],
  ["/api/qskyway/verify", { city: "astana" }],
  ["/api/qskyway/health", {}],
  ["/api/qskyway/height-dispute", { city: "astana" }],
  ["/api/qskyway/height-substitution", { city: "astana" }],
  ["/api/qskyway/airspace/impact", { city: "astana" }],
  ["/api/qskyway/airspace/edition", { city: "astana" }],
  ["/api/qskyway/airspace/proof", { city: "astana" }],
];

async function bodies() {
  const out: Array<{ where: string; body: unknown }> = [];
  const a = app();

  for (const [path, q] of GETS) {
    const res = await request(a).get(path).query(q);
    // Ручка может законно не иметь данных для города (404 по РЕСУРСУ) —
    // это не повод краснеть. Считаем только те, что ответили.
    if (res.status === 200) out.push({ where: path, body: res.body });
  }

  const just = await request(a)
    .post("/api/qskyway/route/justification")
    .send({ city: "astana", from: 0, to: 1 });
  expect(just.status, "/route/justification должна отвечать").toBe(200);
  out.push({ where: "/route/justification", body: just.body });

  // Контроль охвата: если ответила горстка, сторож ослеп, а не модуль чист.
  expect(out.length, "ответивших ручек слишком мало — проверять нечего").toBeGreaterThanOrEqual(8);
  return out;
}

describe("тексты для посетителя не называют наши переменные окружения", () => {
  test("прибор умеет находить: подсаженное имя переменной ловится", () => {
    // Без этого контроля ноль неотличим от «не умею искать».
    expect(ENV_NAMES.size, "имён из кода не собрано — прибор слеп").toBeGreaterThan(3);
    expect(ENV_NAMES.has("QSKYWAY_SIGN_SK"), "имя ключа подписи обязано быть в списке").toBe(true);
    // Отрицательный контроль: внутренняя константа — НЕ переменная окружения.
    expect(ENV_NAMES.has("SRC_CLEARANCE")).toBe(false);
  });

  test("ни в одном ответе нет имени переменной окружения", async () => {
    const seen = await bodies();
    let scanned = 0;
    const bad: string[] = [];

    for (const { where, body } of seen) {
      for (const s of strings(body)) {
        scanned += 1;
        const hit = [...ENV_NAMES].find((n) => s.includes(n));
        if (hit) bad.push(where + "  «" + hit + "»  в: " + s.slice(0, 80));
      }
    }

    // Контроль охвата: ноль строк означал бы, что сторож ослеп, а не что чисто.
    expect(scanned, "строк не собрано вовсе — сторож ослеп").toBeGreaterThan(20);
    expect(bad, "имя переменной окружения в тексте для посетителя:\n" + bad.join("\n")).toEqual([]);
  });
});

/**
 * ВТОРАЯ ПОЛОВИНА ОХВАТА, и она важнее первой.
 *
 * Пояснение о ключе имеет ДВЕ ветки: «ключ одноразовый» и «ключ постоянный».
 * В тесте переменная не задана, значит проверяется только первая — а посетитель
 * прода видит ВТОРУЮ (`ephemeral: false`). Сторож, знающий одну ветку, зелен и
 * слеп ровно там, где смотрит человек.
 *
 * Ключ генерируется здесь же, одноразовый, никуда не печатается и живёт только
 * в памяти процесса теста. Модуль читает переменную при загрузке, поэтому
 * нужен `resetModules` и динамический импорт: присваивание после обычного
 * импорта опоздало бы.
 */
describe("тексты для посетителя: ветка ПОСТОЯННОГО ключа", () => {
  const saved = process.env.QSKYWAY_SIGN_SK;
  afterAll(() => {
    if (saved === undefined) delete process.env.QSKYWAY_SIGN_SK;
    else process.env.QSKYWAY_SIGN_SK = saved;
    vi.resetModules();
  });

  test("постоянный ключ: имени переменной в ответе нет", async () => {
    process.env.QSKYWAY_SIGN_SK = crypto
      .generateKeyPairSync("ed25519")
      .privateKey.export({ type: "pkcs8", format: "der" })
      .toString("base64");
    vi.resetModules();

    const mod = await import("../src/routes/qskyway");
    const a = express();
    a.use(express.json());
    a.use("/api/qskyway", mod.qskywayRouter);

    const res = await request(a).get("/api/qskyway/verify").query({ city: "astana" });
    expect(res.status).toBe(200);

    // Контроль: мы действительно в ДРУГОЙ ветке, иначе проверка повторяет первую.
    expect(res.body?.ephemeral, "ключ обязан быть постоянным — иначе ветка не та").toBe(false);

    const all = strings(res.body);
    expect(all.length, "строк не собрано — сторож ослеп").toBeGreaterThan(5);
    const bad = all.filter((x) => [...ENV_NAMES].some((n) => x.includes(n))).map((x) => x.slice(0, 90));
    expect(bad, "имя переменной в ветке постоянного ключа:\n" + bad.join("\n")).toEqual([]);
  });
});
