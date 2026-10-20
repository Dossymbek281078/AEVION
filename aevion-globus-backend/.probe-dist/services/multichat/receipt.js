"use strict";
// Мультичат — чек за ответ.
//
// Ставка: по мере роста базовых моделей ценность самой оркестрации падает —
// то, что в 2023-м требовало спора пяти агентов, сегодня одиночная модель
// делает лучше и дешевле. Не обесценивается другое: возможность ответить на
// вопрос «на каком основании это решено, сколько стоило и можно ли повторить».
// Рой, который спорит, — коммодити. Решение с квитанцией — нет.
//
// Чек фиксирует состав панели, промт, ответы, карту разногласий и стоимость в
// канонической форме RFC8785 и считает от неё sha256. Любой может пересчитать
// хеш и убедиться, что артефакт не подменён.
//
// Подпись берётся из СУЩЕСТВУЮЩЕГО реестра ключей QSign v2 — своих ключей
// модуль не заводит. Если ключи не настроены, чек честно отдаётся неподписанным
// (`signature: null`) вместо тихой выдачи чего-то похожего на подпись.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReceipt = buildReceipt;
exports.signReceipt = signReceipt;
exports.verifyReceiptHash = verifyReceiptHash;
exports.verifyReceipt = verifyReceipt;
const node_crypto_1 = __importDefault(require("node:crypto"));
const canonicalize_1 = require("../../lib/qsignV2/canonicalize");
const keyRegistry_1 = require("../../lib/qsignV2/keyRegistry");
const sha = (s) => node_crypto_1.default.createHash("sha256").update(s, "utf8").digest("hex");
/** Сборка чека. Чистая функция: одинаковый вход даёт одинаковый хеш, иначе
 *  «воспроизводимость» была бы обещанием без покрытия. */
function buildReceipt(input) {
    const panel = input.answers.map((a) => ({
        agentId: a.agentId,
        role: a.role,
        provider: a.provider,
        model: a.model,
        ok: a.ok,
        replyHash: a.ok && a.reply ? sha(a.reply) : null,
        replyChars: a.reply ? a.reply.length : 0,
    }));
    return {
        version: 1,
        conversationId: input.conversationId,
        askedAt: input.askedAt,
        promptHash: sha(input.prompt),
        promptChars: input.prompt.length,
        panel,
        dissent: {
            verdict: input.dissent.verdict,
            agreement: input.dissent.agreement,
            numericConflicts: input.dissent.numericConflicts.length,
            outlier: input.dissent.outlier?.agentId ?? null,
            hedged: input.dissent.hedges.map((h) => h.agentId),
            checks: (input.dissent.checks || []).map((c) => ({
                kind: c.kind,
                weight: c.weight,
                textHash: sha(c.text),
            })),
        },
        cost: {
            calls: input.answers.length,
            answered: input.answers.filter((a) => a.ok).length,
            failed: input.answers.filter((a) => !a.ok).length,
        },
        canonicalization: canonicalize_1.CANONICALIZATION_SPEC,
    };
}
/** Подпись через реестр QSign v2. Ключей нет — отдаём чек без подписи и прямо
 *  говорим почему: «похожая на подпись» строка хуже её отсутствия. */
async function signReceipt(receipt) {
    // Канонизация считается один раз: она обходит весь объект, и вызывать её
    // дважды ради хеша и подписи — лишняя работа на каждом ответе.
    const { hash, canonical } = (0, canonicalize_1.canonicalHash)(receipt);
    try {
        const key = await (0, keyRegistry_1.getActiveEd25519)();
        if (!key?.privateKey || !key?.kid) {
            return { receipt, hash, signature: null, signatureNote: "активный ed25519-ключ не настроен — чек без подписи" };
        }
        const value = node_crypto_1.default.sign(null, Buffer.from(canonical, "utf8"), key.privateKey).toString("hex");
        return { receipt, hash, signature: { algo: "ed25519", kid: key.kid, value }, signatureNote: null };
    }
    catch (e) {
        // Наружу — только факт, без деталей. Реестр ключей ходит в БД, и её ошибки
        // («SASL: SCRAM-SERVER-FIRST-MESSAGE…») содержат сведения об инфраструктуре,
        // которым в публичном ответе не место. Подробность уходит в лог сервера.
        console.error("[multichat/receipt] подпись недоступна:", e instanceof Error ? e.message : e);
        return {
            receipt,
            hash,
            signature: null,
            signatureNote: "реестр ключей недоступен — чек без подписи, но с проверяемым хешем",
        };
    }
}
/** Пересчёт хеша по готовому чеку — то, чем проверяющий убеждается, что
 *  артефакт не подменён. Выделено отдельно, чтобы это можно было вызвать и с
 *  клиента, и из теста. */
function verifyReceiptHash(receipt, expectedHash) {
    return (0, canonicalize_1.canonicalHash)(receipt).hash === expectedHash;
}
/** Проверка чека: пересчёт хеша тем же кодом, что его считал, плюс проверка
 *  подписи, если она есть и ключ разрешается. Хеш проверяется ВСЕГДА — даже
 *  когда реестр ключей недоступен, подмена содержимого будет видна. */
async function verifyReceipt(input) {
    const { hash: computedHash, canonical } = (0, canonicalize_1.canonicalHash)(input.receipt);
    const hashMatches = typeof input.hash === "string" ? input.hash === computedHash : null;
    const spec = { canonicalization: canonicalize_1.CANONICALIZATION_SPEC, digest: "sha256", signature: "ed25519" };
    if (!input.signature) {
        return {
            hashMatches,
            computedHash,
            signature: "absent",
            signatureNote: hashMatches === null
                ? "чек не подписан, и хеш к нему не приложен — сверьте пересчитанный сами"
                : "чек не подписан — проверен только хеш",
            spec,
        };
    }
    if (input.signature.algo !== "ed25519") {
        return { hashMatches, computedHash, signature: "unverifiable", signatureNote: `неизвестный алгоритм подписи: ${String(input.signature.algo).slice(0, 32)}`, spec };
    }
    try {
        const key = await (0, keyRegistry_1.resolveEd25519)(input.signature.kid);
        const pub = node_crypto_1.default.createPublicKey({
            key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(key.publicKeyHex, "hex")]),
            format: "der",
            type: "spki",
        });
        const valid = node_crypto_1.default.verify(null, Buffer.from(canonical, "utf8"), pub, Buffer.from(input.signature.value, "hex"));
        return { hashMatches, computedHash, signature: valid ? "valid" : "invalid", signatureNote: null, spec };
    }
    catch (e) {
        // Наружу — без деталей реестра/БД, как и при подписи.
        console.error("[multichat/receipt] проверка подписи не выполнена:", e instanceof Error ? e.message : e);
        return { hashMatches, computedHash, signature: "unverifiable", signatureNote: "ключ подписи не разрешается — хеш проверен, подпись нет", spec };
    }
}
