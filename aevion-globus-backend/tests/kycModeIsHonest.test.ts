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

  // Исходов три. Раньше их было два, и из-за этого «неизвестное имя» и
  // «имя с лишним пробелом» отвечали "live" — то есть состояние обещало
  // работающую проверку паспорта там, где фабрика getKycProvider() БРОСАЕТ
  // исключение и поток не работает вовсе. Эталон теперь берётся у самой
  // фабрики — см. providerModeMatchesFactory.test.ts.
  const stubbish: Array<[string, string]> = [
    ["явное stub", "stub"],
    ["пустая строка", ""],
    ["регистр не важен — фабрика приводит его сама", "STUB"],
  ];
  it.each(stubbish)("%s → stub", (_n, v) => {
    expect(kycProviderMode({ BUREAU_KYC_PROVIDER: v } as NodeJS.ProcessEnv)).toBe(
      "stub",
    );
  });

  const live: Array<[string, string]> = [
    ["sumsub", "sumsub"],
    ["регистр не важен", "SumSub"],
  ];
  it.each(live)("%s → live", (_n, v) => {
    expect(kycProviderMode({ BUREAU_KYC_PROVIDER: v } as NodeJS.ProcessEnv)).toBe(
      "live",
    );
  });

  // Эти три раньше давали "live" — самый дорогой вид ошибки на этом барьере:
  // обещать проверку личности, которой не будет. Пробелы фабрика НЕ обрезает,
  // поэтому " sumsub" для неё такое же неизвестное имя, как "veriff".
  const broken: Array<[string, string]> = [
    ["одни пробелы", "   "],
    ["неподдерживаемый поставщик", "veriff"],
    ["лишний пробел из панели окружения", " sumsub"],
  ];
  it.each(broken)("%s → misconfigured", (_n, v) => {
    expect(kycProviderMode({ BUREAU_KYC_PROVIDER: v } as NodeJS.ProcessEnv)).toBe(
      "misconfigured",
    );
  });

  // Раньше здесь лежала СВОЯ КОПИЯ правила обработчика («v && v !== "stub"»),
  // и сверялись две копии друг с другом — обработчик при этом не запускался ни
  // разу. Такая проверка зелена при любом расхождении. Теперь дёргаем сам
  // обработчик по HTTP: он либо отдаёт демо-страницу, либо закрывается.
  it.each([
    ["переменной нет — демо доступно", undefined, 200],
    ['"stub" — демо доступно', "stub", 200],
    ['"STUB" — фабрика даёт заглушку, значит демо тоже доступно', "STUB", 200],
    ['"sumsub" — настоящий поставщик, демо закрыто', "sumsub", 404],
  ] as Array<[string, string | undefined, number]>)(
    "%s",
    async (_n, v, expected) => {
      const had = Object.prototype.hasOwnProperty.call(
        process.env,
        "BUREAU_KYC_PROVIDER",
      );
      const prev = process.env.BUREAU_KYC_PROVIDER;
      if (v === undefined) delete process.env.BUREAU_KYC_PROVIDER;
      else process.env.BUREAU_KYC_PROVIDER = v;
      try {
        const a = express();
        a.use(express.json());
        a.use("/api/bureau", bureauRouter);
        const r = await request(a).get("/api/bureau/kyc-stub/demo-session");
        expect(r.status, `значение ${JSON.stringify(v)}`).toBe(expected);
      } finally {
        if (had) process.env.BUREAU_KYC_PROVIDER = prev;
        else delete process.env.BUREAU_KYC_PROVIDER;
      }
    },
  );
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
