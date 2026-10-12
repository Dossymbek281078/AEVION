/**
 * Ключ, которым бюро подписывает нотаризацию, и всё, что нужно для ПРОВЕРКИ.
 *
 * 🔴 ЗАЧЕМ ОТДЕЛЬНЫЙ МОДУЛЬ, А НЕ ОДНА СТРОКА В bureau.ts. Замер 12.10.2026:
 * переменная `BUREAU_NOTARY_SIGNING_KEY` упоминалась ровно четырежды, вся
 * внутри bureau.ts, и ни одно из упоминаний не ОТДАВАЛО открытый ключ наружу.
 * Проверяльщика подписи нотариуса не было вовсе (`crypto.verify` в репозитории
 * девять раз — все в других модулях). То есть включение ключа дало бы в
 * сертификате слово `ed25519`, которое не может проверить никто, включая нас:
 * честная слабость («demo-hmac-sha256», и сертификат сам это пишет) сменилась
 * бы правдоподобной. Бюро продаётся именно за доказуемость, поэтому здесь
 * подпись и проверка живут вместе и появляются одной волной.
 *
 * ГРАНИЦА, названная прямо: этот модуль доказывает «подписано ключом, чей
 * открытый ключ мы публикуем». Он НЕ доказывает, что ключ принадлежит
 * независимому нотариусу: подписывает платформа. Так и должно быть написано в
 * сертификате — иначе мы снова обещаем больше продукта.
 */
import crypto from "node:crypto";

export const ПЕРЕМЕННАЯ_КЛЮЧА = "BUREAU_NOTARY_SIGNING_KEY";
export const АЛГОРИТМ = "ed25519";
export const АЛГОРИТМ_ДЕМО = "demo-hmac-sha256";

export type РежимПодписи = "ed25519" | "demo" | "сломан";

export type СостояниеКлюча = {
  режим: РежимПодписи;
  /** Открытый ключ в PEM — его публикуем. null в демо-режиме и при поломке. */
  otkrytyKlyuchPem: string | null;
  /** Опознаватель ключа: первые 16 знаков sha256 от DER открытого ключа. */
  idKlyucha: string | null;
  /** Почему режим «сломан» — для журнала и для ручки состояния. */
  pochemu: string | null;
};

/**
 * Разбирает PEM ОДИН раз и говорит, что из него вышло.
 *
 * ⚠️ Три исхода, а не два (правило §14): переменной нет → честный демо-режим;
 * переменная есть и разобралась → ed25519; переменная есть и НЕ разобралась →
 * «сломан». Третий случай нельзя молча свести к демо: это значит, что человек
 * ключ задать ХОТЕЛ, а мы тихо подписываем демонстрационным HMAC и называем
 * это в сертификате — выглядит как работающая настройка.
 */
export function razobratKlyuch(pem: string | undefined | null): СостояниеКлюча {
  const сырое = typeof pem === "string" ? pem.trim() : "";
  if (!сырое) {
    return { режим: "demo", otkrytyKlyuchPem: null, idKlyucha: null, pochemu: null };
  }
  try {
    const закрытый = crypto.createPrivateKey(сырое);
    if (закрытый.asymmetricKeyType !== "ed25519") {
      return {
        режим: "сломан",
        otkrytyKlyuchPem: null,
        idKlyucha: null,
        pochemu: `ключ не ed25519, а ${закрытый.asymmetricKeyType ?? "неизвестно"}`,
      };
    }
    const открытый = crypto.createPublicKey(закрытый);
    const pemОткрытого = открытый.export({ type: "spki", format: "pem" }).toString();
    const der = открытый.export({ type: "spki", format: "der" }) as Buffer;
    const id = crypto.createHash("sha256").update(der).digest("hex").slice(0, 16);
    return { режим: "ed25519", otkrytyKlyuchPem: pemОткрытого, idKlyucha: id, pochemu: null };
  } catch (e) {
    return {
      режим: "сломан",
      otkrytyKlyuchPem: null,
      idKlyucha: null,
      // Текст ошибки безопасен: он про формат, а не про значение ключа.
      pochemu: e instanceof Error ? e.message.slice(0, 120) : "не разобрался",
    };
  }
}

/** Состояние ключа процесса. Читается при каждом вызове — переменную меняют на ходу. */
export function sostoyanieKlyucha(): СостояниеКлюча {
  return razobratKlyuch(process.env[ПЕРЕМЕННАЯ_КЛЮЧА]);
}

/**
 * Подписывает полезную нагрузку. Возвращает и опознаватель ключа: без него
 * проверка не переживёт смену ключа — старые подписи станут «неверными», хотя
 * они верны своим ключом.
 */
export function podpisat(payload: string): { signature: string; algorithm: string; keyId: string | null } {
  const с = sostoyanieKlyucha();
  if (с.режим === "ed25519") {
    const закрытый = crypto.createPrivateKey(String(process.env[ПЕРЕМЕННАЯ_КЛЮЧА]).trim());
    const signature = crypto.sign(null, Buffer.from(payload, "utf8"), закрытый).toString("base64");
    return { signature, algorithm: АЛГОРИТМ, keyId: с.idKlyucha };
  }
  // Демо и «сломан» подписывают одинаково, но НАЗЫВАЮТСЯ по-разному нигде:
  // алгоритм в обоих случаях демонстрационный, и сертификат это напишет.
  // Отличие видно в ручке состояния — там «сломан» назван своей причиной.
  const signature = crypto.createHmac("sha256", "demo-key").update(payload).digest("hex");
  return { signature, algorithm: АЛГОРИТМ_ДЕМО, keyId: null };
}

/**
 * Проверяет подпись ОТКРЫТЫМ ключом — ровно то, что сделает третья сторона.
 *
 * Демонстрационные подписи здесь всегда `false`, и это не придирка: HMAC
 * проверяется знанием секрета, то есть «проверить» его может только тот, кто
 * может его и подделать. Называть это проверкой — обман.
 */
export function proverit(opts: {
  payload: string;
  signature: string;
  algorithm: string;
  otkrytyKlyuchPem: string | null;
}): { ok: boolean; pochemu: string | null } {
  if (opts.algorithm !== АЛГОРИТМ) {
    return { ok: false, pochemu: `подпись ${opts.algorithm} не проверяется открытым ключом` };
  }
  if (!opts.otkrytyKlyuchPem) return { ok: false, pochemu: "открытый ключ не задан" };
  try {
    const ok = crypto.verify(
      null,
      Buffer.from(opts.payload, "utf8"),
      crypto.createPublicKey(opts.otkrytyKlyuchPem),
      Buffer.from(opts.signature, "base64"),
    );
    return { ok, pochemu: ok ? null : "подпись не сходится" };
  } catch (e) {
    return { ok: false, pochemu: e instanceof Error ? e.message.slice(0, 120) : "проверка не выполнилась" };
  }
}
