import { describe, it, expect } from "vitest";
import { проверитьПодписанныйАкт } from "../src/routes/qpaynet";

/**
 * Выплата возможна только по подписанному акту.
 *
 * Прямая задача основателя 03.09.2026, критерий приёмки его же словами:
 * проба выплаты БЕЗ подписи → отказ с человеческим текстом, а не 500 и не
 * тихое «ок». Контроль: та же выплата с подписью проходит.
 *
 * Это тот же класс, что я весь день чинил на витрине, но с обратной стороны:
 * там молчаливый ОТКАЗ выглядел успехом (человек не получал письма), здесь
 * молчаливое СОГЛАСИЕ выглядело бы выплатой — и уходили бы деньги.
 *
 * ⚠️ Проверка стоит в коде ДО списания. Ниже по обработчику баланс
 * уменьшается первой же операцией, и отказ после неё означал бы снятые
 * деньги без выплаты.
 */

/** Поддельная база: отдаёт заданные строки или падает. */
function базаС(rows: Array<Record<string, unknown>>, падать = false) {
  return {
    query: async () => {
      if (падать) throw new Error("база недоступна");
      return { rows };
    },
  };
}

const МОЙ = "user-1";

describe("без подписанного акта выплаты нет", () => {
  it("основание не названо → отказ ЧЕЛОВЕЧЕСКИМ текстом, а не кодом", async () => {
    const r = await проверитьПодписанныйАкт(базаС([]), "", МОЙ, "kto@to.example");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status, "нет основания — это ответ о запросе, а не наша поломка").toBe(422);
    expect(r.code).toBe("act_signature_required");
    // Человеческий текст: без кодов, без адресов серверов, со следующим шагом.
    expect(r.message).toContain("подписанному акту");
    expect(r.message).toContain("QSign");
    expect(r.message, "в тексте для человека оказался технический код").not.toContain("act_signature");
  });

  it("подпись выдумана → отказ, а не пропуск", async () => {
    const r = await проверитьПодписанныйАкт(базаС([]), "sig-нет-такой", МОЙ, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("act_signature_not_found");
  });

  it("подпись отозвана → отказ: отозванная равна отсутствующей", async () => {
    const row = { id: "s1", issuerUserId: МОЙ, revokedAt: "2026-09-01T00:00:00Z", signatureDilithium: "x" };
    const r = await проверитьПодписанныйАкт(базаС([row]), "s1", МОЙ, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("act_signature_revoked");
  });

  it("подпись ЧУЖАЯ → отказ: чужое основание не годится", async () => {
    const row = { id: "s1", issuerUserId: "кто-то-другой", issuerEmail: "other@example.com", revokedAt: null };
    const r = await проверитьПодписанныйАкт(базаС([row]), "s1", МОЙ, "kto@to.example");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status, "чужое основание — это про права, а не про запрос").toBe(403);
  });

  it("КОНТРОЛЬ: с годной подписью выплата проходит", async () => {
    // Без этого контроля все проверки выше проходили бы и в случае, когда
    // функция ВСЕГДА отказывает — то есть охраняла бы закрытую дверь.
    const row = { id: "s1", issuerUserId: МОЙ, revokedAt: null, signatureDilithium: "подпись" };
    const r = await проверитьПодписанныйАкт(базаС([row]), "s1", МОЙ, null);
    expect(r.ok, "годная подпись не пропущена — выплатить нельзя никому").toBe(true);
    if (r.ok) expect(r.mode).toBe("full");
  });

  it("подпись по ПОЧТЕ тоже своя — вход бывает без user id", async () => {
    const row = { id: "s1", issuerUserId: null, issuerEmail: "KTO@to.example", revokedAt: null };
    const r = await проверитьПодписанныйАкт(базаС([row]), "s1", МОЙ, "kto@to.example");
    expect(r.ok, "своя подпись отвергнута из-за регистра почты").toBe(true);
  });

  it("режим ПРЕДВАРИТЕЛЬНЫЙ виден, а не схлопнут в «подписано»", async () => {
    // Ключ платформы на проде не задан (`qsign.mode = "preview"`). Пока это
    // так, «подписано» было бы обещанием доказуемости, которой нет.
    const row = { id: "s1", issuerUserId: МОЙ, revokedAt: null, signatureDilithium: null };
    const r = await проверитьПодписанныйАкт(базаС([row]), "s1", МОЙ, null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mode, "предварительная подпись выдана за полную").toBe("preview");
  });

  it("база не прочиталась → 503 и честный текст, а не «подписи нет»", async () => {
    const r = await проверитьПодписанныйАкт(базаС([], true), "s1", МОЙ, null);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status, "наша поломка подана как ответ про основание").toBe(503);
    expect(r.message, "человеку не сказано, что деньги целы").toContain("не списаны");
  });
});
