"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.warnIfStubInProduction = warnIfStubInProduction;
exports.providerStatus = providerStatus;
exports.bureauProvidersHealth = bureauProvidersHealth;
const bureau_1 = require("../routes/bureau");
/**
 * Один общий сторож на оба выбора провайдера (KYC и платежи).
 *
 * ЗАЧЕМ. 29.08.2026 замер показал: `BUREAU_KYC_PROVIDER` в проде НЕ задана, и
 * `|| "stub"` молча включал заглушку. Проверено пробой: `/api/bureau/kyc-stub/…`
 * отвечает 200 на боевом сервере, при том что тариф «Verified · $19» обещает
 * проверку личности по паспорту. У платежей то же значение по умолчанию, а их
 * заглушка САМА помечает платёж «оплачен» при первом чтении.
 *
 * Почему не бросаем исключение, хотя комментарий рядом обещал «fails loud»:
 * упасть — значит сломать бюро там, где оно сейчас хоть как-то работает
 * (113 верификаций в pending). Молчание лечится следом, а не поломкой
 * (правило «молчаливый отказ выглядит как успех»). Поэтому:
 *   - предупреждение в лог ОДИН раз на процесс, с именем переменной;
 *   - состояние наружу через providerStatus(), чтобы сторож мог спросить.
 *
 * Убирать это можно тогда, когда переменные заданы в проде, — не раньше.
 */
const warned = new Set();
function warnIfStubInProduction(envVar, chosen) {
    if (chosen !== "stub")
        return;
    if (process.env.NODE_ENV !== "production")
        return;
    if (warned.has(envVar))
        return;
    warned.add(envVar);
    console.error(`[bureau] ВНИМАНИЕ: ${envVar} не задана, работает ЗАГЛУШКА в production. ` +
        "Обещания тарифов (проверка личности / оплата) не выполняются. " +
        "Задайте переменную явно.");
}
/** Для сторожей и ручек состояния: что реально выбрано и заглушка ли это. */
function providerStatus(envVar) {
    const raw = process.env[envVar];
    const id = (raw || "stub").toLowerCase();
    return { id, isStub: id === "stub", configured: Boolean(raw) };
}
/**
 * Состояние провайдеров БЮРО для health — одной функцией, чтобы ручка и её
 * сторож смотрели на ОДИН И ТОТ ЖЕ код.
 *
 * 🔴 23.09.2026. Раньше health звал providerStatus() напрямую, а он считает
 * «настроено» = «переменная непустая». На проде BUREAU_PAYMENT_PROVIDER равен
 * "paddle" — интеграции, выведенной 22.07.2026 (маршруты удалены, вебхук
 * отдаёт 410). Общее health отвечало configured: true, ручка бюро на те же
 * данные — "misconfigured". Права была ручка бюро.
 *
 * Источник правды один — режимы из routes/bureau: там же лежат списки живых
 * провайдеров. Копия списков здесь разошлась бы при первой правке.
 */
function bureauProvidersHealth() {
    const kyc = (0, bureau_1.kycProviderMode)();
    const payment = (0, bureau_1.paymentProviderMode)();
    return {
        kyc: { ...providerStatus("BUREAU_KYC_PROVIDER"), mode: kyc, configured: kyc === "live" },
        payment: {
            ...providerStatus("BUREAU_PAYMENT_PROVIDER"),
            mode: payment,
            configured: payment === "live",
        },
    };
}
