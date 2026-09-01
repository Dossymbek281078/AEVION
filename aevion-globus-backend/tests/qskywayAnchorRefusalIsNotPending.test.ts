import { describe, test, expect } from "vitest";
import { verifyAnchoredTrustScore } from "../src/lib/trustAnchor";
import { verifyAnchoredAirspace } from "../src/routes/qskyway.airspace.anchor";
import { ANCHOR_STATUS_MEANING } from "../src/lib/opentimestamps/anchor";

/**
 * Отказ не имеет права выглядеть ожиданием.
 *
 * ПОВОД. 29.08.2026, замер на ПРОДЕ: `POST /airspace/anchor/verify` с пустым
 * телом отвечал 200 и `"status":"pending"`. В OpenTimestamps `pending` значит
 * «доказательство подано, ждём подтверждения Bitcoin» — а здесь не подавали
 * ничего. Тихого успеха не было (`verified:false`, `fullyProven:false`), но
 * потребитель, читающий одно поле `status`, показал бы человеку «ожидает
 * подтверждения» там, где верный ответ — «вы не прислали доказательство».
 *
 * Причина была в одной строке: у `otsFail` — пути ОТКАЗА — значением по
 * умолчанию стоял `"pending"`. То есть все три отказа докладывали ожидание.
 *
 * Для продукта, который продаёт доказуемость, это дороже обычной неточности:
 * поле состояния врёт правдоподобно и именно в ту сторону, которая выгодна нам.
 */
describe("проверка якоря: отказ называет себя отказом", () => {
  const BAD_INPUTS: Array<[string, unknown]> = [
    ["пустое тело", {}],
    ["доказательства нет вовсе", { snapshot: { attestation: { contentHash: "ab".repeat(32) } } }],
    // ⚠️ Вход подобран так, чтобы РАЗЛИЧАТЬ пути. Первая версия брала
    // "!!!не base64!!!" — он декодируется в ноль байт и попадает в соседнюю
    // проверку «декодировалось в ничто», дающую тот же статус. Мутация это
    // показала: выключение проверки формата ничего не меняло, то есть тест
    // охранял не её. Здесь символы годные ЕСТЬ, поэтому без проверки формата
    // мусор уехал бы вглубь и получил "invalid" вместо честного отказа.
    ["не base64, но декодируемое", { otsProofB64: "AAAA!!!!", snapshot: { attestation: { contentHash: "ab".repeat(32) } } }],
    ["у снимка нет хеша", { otsProofB64: "AAAA", snapshot: { attestation: {} } }],
  ];

  for (const [name, body] of BAD_INPUTS) {
    test(name + " -> статус НЕ pending", async () => {
      const r = await verifyAnchoredTrustScore(body);
      // Главное утверждение: ожиданием это называть нельзя.
      expect(r.ots.status, "отказ доложен как ожидание подтверждения").not.toBe("pending");
      expect(r.ots.status).toBe("not-submitted");
      // И отказ обязан остаться отказом по существу.
      expect(r.ots.verified).toBe(false);
      expect(r.fullyProven).toBe(false);
      // Причина должна быть названа, иначе статус бесполезен.
      expect(typeof r.ots.error === "string" && r.ots.error.length > 0,
        "отказ без названной причины").toBe(true);
    });
  }

  test("доказательство ПРАВИЛЬНОГО формата, но негодное -> invalid, а не pending", async () => {
    // Самый дорогой случай, и мои первые входы его НЕ доставали: они отсекались
    // раньше, до самой проверки. Здесь base64 настоящий и декодируется в байты,
    // просто это не .ots-доказательство. Раньше статус считался ТОЛЬКО по высоте
    // блока — высоты нет, значит "pending", то есть «ждём подтверждения Bitcoin»
    // про доказательство, которое проверку провалило.
    const notAProof = Buffer.from("это не .ots, но base64 честный").toString("base64");
    const r = await verifyAnchoredTrustScore({
      otsProofB64: notAProof,
      snapshot: { attestation: { contentHash: "ab".repeat(32) } },
    });
    expect(r.ots.verified).toBe(false);
    expect(r.ots.status, "провал проверки доложен как ожидание подтверждения").not.toBe("pending");
    expect(r.ots.status).toBe("invalid");
    expect(r.fullyProven).toBe(false);
    // Пояснение проверяем ИМЕННО здесь: пустое тело уходит в помощник отказа,
    // где оно зашито строкой, и мутацию «одно пояснение на всех» не ловит.
    expect(r.ots.statusMeaning).toEqual(ANCHOR_STATUS_MEANING.invalid);
    expect(r.ots.statusMeaning).not.toEqual(ANCHOR_STATUS_MEANING.pending);
  });

  test("ни один негодный вход не даёт bitcoin-confirmed", async () => {
    // Отдельно от предыдущего: там проверяется «не ожидание», здесь — что
    // отказ не выдаёт себя за ДОКАЗАННОЕ. Это разные ошибки и разная цена.
    for (const [, body] of BAD_INPUTS) {
      const r = await verifyAnchoredTrustScore(body);
      expect(r.ots.status).not.toBe("bitcoin-confirmed");
      expect(r.ots.bitcoinBlockHeight).toBeNull();
    }
  });
});

/**
 * ⚠️ ТА ЖЕ проверка для ручки, которую я мерил на проде.
 *
 * Первую починку я внёс в `lib/trustAnchor.ts` — аналог, а не то, что мерил.
 * Ручка `/airspace/anchor/verify` зовёт ДРУГУЮ функцию, в которой те же три
 * дефекта лежали дословно. Нашлось свипом по своему же модулю, не чтением.
 */
describe("воздушный якорь: отказ называет себя отказом", () => {
  const BAD: Array<[string, unknown]> = [
    ["пустое тело", {}],
    ["нет доказательства", { city: "nyc", contentHash: "ab".repeat(32) }],
    ["не base64, но декодируемое", { city: "nyc", contentHash: "ab".repeat(32), otsProofB64: "AAAA!!!!" }],
  ];
  for (const [name, body] of BAD) {
    test(name + " -> не pending и не доказано", async () => {
      const r = await verifyAnchoredAirspace(body);
      expect(r.ots.status, "отказ доложен как ожидание").not.toBe("pending");
      expect(r.ots.status).toBe("not-submitted");
      expect(r.fullyProven).toBe(false);
      // Пояснение НЕ имеет права утверждать доказанность.
      expect(String(r.note).includes("Доказано"), "отказ назван доказанным").toBe(false);
      expect(String(r.noteEn).toLowerCase().includes("proven"), "refusal called proven").toBe(false);
    });
  }
});

/**
 * Слово, которое получает третья сторона, обязано себя объяснять.
 *
 * ПОВОД. Мы завели `invalid` и `not-submitted`, потому что отказ прежде
 * докладывался как ожидание. Но продукт обещает «проверьте сами», а объяснить
 * новые слова было негде: ни в ответе, ни в рецепте. Различие «подождите»
 * против «ждать бессмысленно» — как раз то, ради чего всё правилось.
 *
 * Полноту карты держит ТИП (`Record<AnchorStatus, …>`): забыть новый статус
 * нельзя, сборка не пройдёт. Здесь проверяется другое — что пояснение в ответе
 * СООТВЕТСТВУЕТ статусу, а не приклеено одно на все случаи.
 */
describe("статус объясняет сам себя", () => {
  test("у каждого значения есть обе половины и совет", () => {
    for (const [status, m] of Object.entries(ANCHOR_STATUS_MEANING)) {
      for (const [field, value] of Object.entries(m)) {
        expect(typeof value, status + "." + field + " не строка").toBe("string");
        expect(String(value).length, status + "." + field + " пустое").toBeGreaterThan(10);
      }
    }
  });

  test("советы у ожидания и у негодного доказательства РАЗНЫЕ", () => {
    // Ровно то различие, ради которого заводились новые значения. Если советы
    // совпали — значит карта заполнена формально и пользы от неё нет.
    expect(ANCHOR_STATUS_MEANING.pending.nextRu)
      .not.toBe(ANCHOR_STATUS_MEANING.invalid.nextRu);
    expect(ANCHOR_STATUS_MEANING.pending.nextEn)
      .not.toBe(ANCHOR_STATUS_MEANING.invalid.nextEn);
  });

  test("в ответе пояснение СООТВЕТСТВУЕТ статусу, а не приклеено одно на всех", async () => {
    const r = await verifyAnchoredAirspace({});
    expect(r.ots.status).toBe("not-submitted");
    expect(r.ots.statusMeaning).toEqual(ANCHOR_STATUS_MEANING["not-submitted"]);

    const r2 = await verifyAnchoredTrustScore({});
    expect(r2.ots.statusMeaning).toEqual(ANCHOR_STATUS_MEANING[r2.ots.status]);
  });

  test("и на ГЛАВНОМ пути возврата тоже, а не только в помощнике отказа", async () => {
    // ⚠️ Первая версия этого файла проверяла только пустое тело — а оно уходит
    // в помощник отказа, где пояснение зашито строкой. Мутация «приклеить одно
    // пояснение на все случаи» её пережила: главный возврат не проверялся
    // вовсе. Нужен вход, который проходит ВСЕ ранние проверки и падает уже на
    // сверке: base64 настоящий, байты есть, но это не .ots-доказательство.
    const notAProof = Buffer.from("это не .ots, но base64 честный").toString("base64");
    const r = await verifyAnchoredAirspace({
      city: "nyc",
      contentHash: "ab".repeat(32),
      otsProofB64: notAProof,
    });
    expect(r.ots.status, "не дошли до главного возврата — вход отсекся раньше").toBe("invalid");
    expect(r.ots.statusMeaning).toEqual(ANCHOR_STATUS_MEANING.invalid);
    expect(r.ots.statusMeaning).not.toEqual(ANCHOR_STATUS_MEANING.pending);
  });
});

/**
 * URL-safe base64 принимается так же, как стандартный.
 *
 * ПОВОД — регрессия, которую я внёс сам в этом же окне. Заменяя мёртвый
 * try/catch на строгий шаблон, я не спросил, что принимал слой НИЖЕ:
 * `Buffer.from(x, "base64")` в Node принимает `-` и `_` и декодирует
 * идентично стандартному (проверено опытом). До шаблона такие доказательства
 * проверялись успешно, после — стали получать «не является корректным
 * base64»: ответ формально верный и бесполезный для третьей стороны, которую
 * мы сами зовём проверять нас.
 *
 * Проверяем не «не отвергнуто», а РАВЕНСТВО результатов: иначе тест пройдёт и
 * тогда, когда обе кодировки одинаково сломаны.
 */
describe("две кодировки одного доказательства дают один ответ", () => {
  // ⚠️ Байты подобраны так, чтобы в base64 БЫЛИ и `+`, и `/` — иначе подмены
  // не происходит и сравнение ниже становится сравнением строки с собой.
  // Первая версия брала осмысленный текст, у которого этих символов не
  // оказалось, и контрольная проверка это поймала. Она за тем и стоит.
  const raw = Buffer.from([0xfb, 0xff, 0xbe, 0xfa, 0xef, 0xbf, 0x3e, 0xd2, 0x7c]);
  const std = raw.toString("base64");
  const urlSafe = std.replace(/\+/g, "-").replace(/\//g, "_");

  test("контроль: кодировки РАЗНЫЕ (иначе тест ничего не проверяет)", () => {
    // Если у этой строки не окажется символов + и /, подмены не произойдёт и
    // сравнение ниже станет сравнением строки с самой собой.
    expect(urlSafe).not.toBe(std);
  });

  test("воздушный якорь: ответ одинаков", async () => {
    const body = { city: "nyc", contentHash: "ab".repeat(32) };
    const a = await verifyAnchoredAirspace({ ...body, otsProofB64: std });
    const b = await verifyAnchoredAirspace({ ...body, otsProofB64: urlSafe });
    expect(b.ots.status, "URL-safe отвергнут как негодный формат").not.toBe("not-submitted");
    expect(b.ots.status).toBe(a.ots.status);
    expect(b.ots.verified).toBe(a.ots.verified);
    expect(b.fullyProven).toBe(a.fullyProven);
  });

  test("якорь доверия: ответ одинаков", async () => {
    const snapshot = { attestation: { contentHash: "ab".repeat(32) } };
    const a = await verifyAnchoredTrustScore({ snapshot, otsProofB64: std });
    const b = await verifyAnchoredTrustScore({ snapshot, otsProofB64: urlSafe });
    expect(b.ots.status, "URL-safe отвергнут как негодный формат").not.toBe("not-submitted");
    expect(b.ots.status).toBe(a.ots.status);
  });
});
