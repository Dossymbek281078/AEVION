// Состояние «ждём кассу» (intentId есть, /status ещё не ready) не утверждает, что деньги получены.
// 27.10.2026, замер прода: /pricing/checkout/success?intentId=<несуществующий> — сервер отвечает
// {"ready":false}, а экран писал «Оплата принята — проверяем доступ. Деньги получены…».
// Оплату утверждает только подтверждение сервера (titleActivated*), не адрес страницы.
import { describe, it, expect } from "vitest";
import ru from "@/lib/i18n-lang/ru";
import en from "@/lib/i18n-lang/en";
import kk from "@/lib/i18n-lang/kk";

const УТВЕРЖДЕНИЕ = /получен|принят|прошл|received|have your payment|payment went|қабылдан|алынды/i;
const СЛОВАРИ = { ru, en, kk } as Record<string, Record<string, string>>;

describe("ожидание подтверждения не называет оплату состоявшейся", () => {
  it("контроль прибора: старый текст был бы пойман", () => {
    expect(УТВЕРЖДЕНИЕ.test("Оплата принята — проверяем доступ")).toBe(true);
    expect(УТВЕРЖДЕНИЕ.test("We have your payment. Access opens…")).toBe(true);
    expect(УТВЕРЖДЕНИЕ.test("Төлем қабылданды")).toBe(true);
  });

  for (const [lang, d] of Object.entries(СЛОВАРИ)) {
    it(`${lang}: titlePending и subtitlePending без утверждения об оплате`, () => {
      for (const key of ["pricing.checkoutSuccess.titlePending", "pricing.checkoutSuccess.subtitlePending"]) {
        const текст = d[key];
        expect(текст, `${lang} ${key} есть`).toBeTruthy();
        expect(УТВЕРЖДЕНИЕ.test(текст), `${lang} ${key}: «${текст}»`).toBe(false);
      }
    });
  }
});
