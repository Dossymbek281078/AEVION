"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.АЛГОРИТМ_ДЕМО = exports.АЛГОРИТМ = exports.ПЕРЕМЕННАЯ_КЛЮЧА = void 0;
exports.razobratKlyuch = razobratKlyuch;
exports.sostoyanieKlyucha = sostoyanieKlyucha;
exports.podpisat = podpisat;
exports.proverit = proverit;
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
const node_crypto_1 = __importDefault(require("node:crypto"));
exports.ПЕРЕМЕННАЯ_КЛЮЧА = "BUREAU_NOTARY_SIGNING_KEY";
exports.АЛГОРИТМ = "ed25519";
exports.АЛГОРИТМ_ДЕМО = "demo-hmac-sha256";
/**
 * Разбирает PEM ОДИН раз и говорит, что из него вышло.
 *
 * ⚠️ Три исхода, а не два (правило §14): переменной нет → честный демо-режим;
 * переменная есть и разобралась → ed25519; переменная есть и НЕ разобралась →
 * «сломан». Третий случай нельзя молча свести к демо: это значит, что человек
 * ключ задать ХОТЕЛ, а мы тихо подписываем демонстрационным HMAC и называем
 * это в сертификате — выглядит как работающая настройка.
 */
function razobratKlyuch(pem) {
    const сырое = typeof pem === "string" ? pem.trim() : "";
    if (!сырое) {
        return { режим: "demo", otkrytyKlyuchPem: null, idKlyucha: null, pochemu: null };
    }
    try {
        const закрытый = node_crypto_1.default.createPrivateKey(сырое);
        if (закрытый.asymmetricKeyType !== "ed25519") {
            return {
                режим: "сломан",
                otkrytyKlyuchPem: null,
                idKlyucha: null,
                pochemu: `ключ не ed25519, а ${закрытый.asymmetricKeyType ?? "неизвестно"}`,
            };
        }
        const открытый = node_crypto_1.default.createPublicKey(закрытый);
        const pemОткрытого = открытый.export({ type: "spki", format: "pem" }).toString();
        const der = открытый.export({ type: "spki", format: "der" });
        const id = node_crypto_1.default.createHash("sha256").update(der).digest("hex").slice(0, 16);
        return { режим: "ed25519", otkrytyKlyuchPem: pemОткрытого, idKlyucha: id, pochemu: null };
    }
    catch (e) {
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
function sostoyanieKlyucha() {
    return razobratKlyuch(process.env[exports.ПЕРЕМЕННАЯ_КЛЮЧА]);
}
/**
 * Подписывает полезную нагрузку. Возвращает и опознаватель ключа: без него
 * проверка не переживёт смену ключа — старые подписи станут «неверными», хотя
 * они верны своим ключом.
 */
function podpisat(payload) {
    const с = sostoyanieKlyucha();
    if (с.режим === "ed25519") {
        const закрытый = node_crypto_1.default.createPrivateKey(String(process.env[exports.ПЕРЕМЕННАЯ_КЛЮЧА]).trim());
        const signature = node_crypto_1.default.sign(null, Buffer.from(payload, "utf8"), закрытый).toString("base64");
        return { signature, algorithm: exports.АЛГОРИТМ, keyId: с.idKlyucha };
    }
    // Демо и «сломан» подписывают одинаково, но НАЗЫВАЮТСЯ по-разному нигде:
    // алгоритм в обоих случаях демонстрационный, и сертификат это напишет.
    // Отличие видно в ручке состояния — там «сломан» назван своей причиной.
    const signature = node_crypto_1.default.createHmac("sha256", "demo-key").update(payload).digest("hex");
    return { signature, algorithm: exports.АЛГОРИТМ_ДЕМО, keyId: null };
}
/**
 * Проверяет подпись ОТКРЫТЫМ ключом — ровно то, что сделает третья сторона.
 *
 * Демонстрационные подписи здесь всегда `false`, и это не придирка: HMAC
 * проверяется знанием секрета, то есть «проверить» его может только тот, кто
 * может его и подделать. Называть это проверкой — обман.
 */
function proverit(opts) {
    if (opts.algorithm !== exports.АЛГОРИТМ) {
        return { ok: false, pochemu: `подпись ${opts.algorithm} не проверяется открытым ключом` };
    }
    if (!opts.otkrytyKlyuchPem)
        return { ok: false, pochemu: "открытый ключ не задан" };
    try {
        const ok = node_crypto_1.default.verify(null, Buffer.from(opts.payload, "utf8"), node_crypto_1.default.createPublicKey(opts.otkrytyKlyuchPem), Buffer.from(opts.signature, "base64"));
        return { ok, pochemu: ok ? null : "подпись не сходится" };
    }
    catch (e) {
        return { ok: false, pochemu: e instanceof Error ? e.message.slice(0, 120) : "проверка не выполнилась" };
    }
}
