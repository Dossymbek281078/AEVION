// Тариф «Verified» ($19 за сертификат) обещает проверку паспорта партнёром и
// был помечен «▲ available now» строкой в коде.
//
// ЗАМЕР НА ПРОДЕ 27.08.2026: `GET /api/bureau/kyc-stub/<любой>` отвечает 200 и
// отдаёт страницу «AEVION KYC (stub)». Переменной BUREAU_KYC_PROVIDER в
// окружении нет, а заглушка закрывается только её наличием — значит на проде
// живёт демонстрационный путь и паспорт не смотрит никто.
//
// Это тот же класс, что пометка «live» у пустого реестра нотариусов, только на
// ПЛАТНОМ тарифе: пометка не могла ошибиться заметно, потому что утверждала
// одно и то же при любом состоянии площадки.

import { describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import {
  bureauRouter,
  kycProviderMode,
  paymentProviderMode,
  notarySignatureMode,
} from "../src/routes/bureau";

describe("режим проверки личности определяется по окружению", () => {
  it("переменной нет — это заглушка, а не «настроено»", () => {
    // Главный случай: ровно так выглядит прод на 27.08.2026.
    expect(kycProviderMode({} as NodeJS.ProcessEnv)).toBe("stub");
  });

  const stubbish: Array<[string, string]> = [
    ["явное stub", "stub"],
    ["пустая строка", ""],
    ["пробелы", "   "],
  ];
  it.each(stubbish)("%s → stub", (_n, v) => {
    expect(kycProviderMode({ BUREAU_KYC_PROVIDER: v } as NodeJS.ProcessEnv)).toBe(
      "stub",
    );
  });

  const live: Array<[string, string]> = [
    ["sumsub", "sumsub"],
    ["veriff", "veriff"],
    ["любое другое имя", "some-partner"],
  ];
  it.each(live)("%s → live", (_n, v) => {
    expect(kycProviderMode({ BUREAU_KYC_PROVIDER: v } as NodeJS.ProcessEnv)).toBe(
      "live",
    );
  });

  it("решение совпадает с тем, как судит САМ обработчик заглушки", () => {
    // Обработчик /kyc-stub отдаёт 404 при `BUREAU_KYC_PROVIDER &&
    // !== "stub"`. Если эти два места разойдутся, витрина будет обещать одно,
    // а поток вести себя иначе — и заметить это будет нечем.
    const disabledByHandler = (v: string | undefined) =>
      Boolean(v && v !== "stub");
    for (const v of [undefined, "", "stub", "sumsub", "veriff"]) {
      const mine = kycProviderMode({
        ...(v === undefined ? {} : { BUREAU_KYC_PROVIDER: v }),
      } as NodeJS.ProcessEnv);
      expect(mine === "live", `значение ${JSON.stringify(v)}`).toBe(
        disabledByHandler(v),
      );
    }
  });
});

describe("ручка состояния отдаёт режим наружу", () => {
  const app = () => {
    const a = express();
    a.use(express.json());
    a.use("/api/bureau", bureauRouter);
    return a;
  };

  it("поле kyc есть в ответе /health", async () => {
    const r = await request(app()).get("/api/bureau/health");
    expect(r.status).toBe(200);
    // Без этого поля витрине неоткуда узнать правду, и она снова начнёт
    // утверждать «available now» строкой в коде.
    expect(["live", "stub"]).toContain(r.body.kyc);
  });

  it("контроль: ручка вообще отвечает по существу", async () => {
    const r = await request(app()).get("/api/bureau/health");
    expect(r.body.service).toBe("bureau");
    expect(r.body.status).toBe("ok");
  });
});

// ── Второй барьер: приём денег ────────────────────────────────────────
//
// Отметка «Verified Author» ставится только при одобренной проверке И
// подтверждённой оплате. Разобрав первый барьер (заглушка), я сказал, что
// второй держит — по коду. А getPayProvider() по умолчанию возвращает ту же
// заглушку: `BUREAU_PAYMENT_PROVIDER || "stub"`, и её parseWebhook тоже не
// смотрит заголовки. Держит барьер или нет — зависит от переменной, которую
// снаружи не видно. Значит она обязана быть видна.

describe("режим приёма денег виден снаружи", () => {
  it("переменной нет — это заглушка (так же решает getPayProvider)", () => {
    expect(paymentProviderMode({} as NodeJS.ProcessEnv)).toBe("stub");
  });

  it.each([["явное stub", "stub"], ["регистр не важен", "STUB"], ["пусто", ""]])(
    "%s → stub",
    (_n, v) => {
      expect(
        paymentProviderMode({ BUREAU_PAYMENT_PROVIDER: v } as NodeJS.ProcessEnv),
      ).toBe("stub");
    },
  );

  it.each([["stripe", "stripe"], ["lemonsqueezy", "lemonsqueezy"], ["gumroad", "gumroad"]])(
    "%s → live",
    (_n, v) => {
      expect(
        paymentProviderMode({ BUREAU_PAYMENT_PROVIDER: v } as NodeJS.ProcessEnv),
      ).toBe("live");
    },
  );

  it("оба режима отдаются в /health", async () => {
    const a = express();
    a.use(express.json());
    a.use("/api/bureau", bureauRouter);
    const r = await request(a).get("/api/bureau/health");
    expect(["live", "stub"]).toContain(r.body.kyc);
    expect(["live", "stub"]).toContain(r.body.payment);
  });

  it("оба барьера в режиме заглушки — это состояние, которое обязано быть заметным", () => {
    // Тест не запрещает такую настройку (в разработке она нужна), он
    // закрепляет, что её МОЖНО УВИДЕТЬ. Незаметное — самое дорогое.
    const env = {} as NodeJS.ProcessEnv;
    expect([kycProviderMode(env), paymentProviderMode(env)]).toEqual([
      "stub",
      "stub",
    ]);
  });
});

// ── Третий вопрос модуля: чем подписывает нотариус ──────────────────────
//
// Тариф Notarized (от $89) обещает подпись нотариуса Ed25519. В коде она
// становится настоящей только при заданном BUREAU_NOTARY_SIGNING_KEY, иначе
// это HMAC. Сам сертификат честно называет алгоритм — то есть покупателя не
// вводят в заблуждение. Не хватало другого: узнать состояние СНАРУЖИ, не
// выпуская сертификат.

describe("режим подписи нотариуса виден снаружи", () => {
  it("ключа нет — демонстрационный режим", () => {
    expect(notarySignatureMode({} as NodeJS.ProcessEnv)).toBe("demo");
  });

  it.each([["пустая строка", ""], ["пробелы", "   "]])(
    "%s → demo (условие совпадает с signNotarization: pem после trim)",
    (_n, v) => {
      expect(
        notarySignatureMode({ BUREAU_NOTARY_SIGNING_KEY: v } as NodeJS.ProcessEnv),
      ).toBe("demo");
    },
  );

  it("ключ задан — настоящая подпись", () => {
    expect(
      notarySignatureMode({
        BUREAU_NOTARY_SIGNING_KEY: "-----BEGIN PRIVATE KEY-----\nMC4C...\n-----END PRIVATE KEY-----",
      } as NodeJS.ProcessEnv),
    ).toBe("ed25519");
  });

  it("решение совпадает с тем, как судит сама подпись", () => {
    // signNotarization берёт pem?.trim() и проверяет на истинность. Разойдись
    // эти два места — состояние описывало бы не тот код, что подписывает.
    const asSigner = (v?: string) => Boolean(v?.trim());
    for (const v of [undefined, "", "   ", "key"]) {
      const mine = notarySignatureMode({
        ...(v === undefined ? {} : { BUREAU_NOTARY_SIGNING_KEY: v }),
      } as NodeJS.ProcessEnv);
      expect(mine === "ed25519", `значение ${JSON.stringify(v)}`).toBe(asSigner(v));
    }
  });

  it("все три вопроса модуля отвечаются одной ручкой", async () => {
    const a = express();
    a.use(express.json());
    a.use("/api/bureau", bureauRouter);
    const r = await request(a).get("/api/bureau/health");
    expect(["live", "stub"]).toContain(r.body.kyc);
    expect(["live", "stub"]).toContain(r.body.payment);
    expect(["ed25519", "demo"]).toContain(r.body.notarySignature);
  });
});
