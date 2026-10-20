"use strict";
/**
 * Веерные скидки — лестницы, которые складываются друг с другом.
 *
 * ЗАЧЕМ. Одна плоская скидка либо мала и не двигает решение, либо велика и
 * обесценивает цену. Веер устроен иначе: каждая ступень награждает конкретное
 * поведение, которое нам выгодно, и все ступени видны покупателю по отдельности.
 * Человек понимает, ЗА ЧТО ему скидка, и видит, что даст следующий шаг.
 *
 * Что уже есть и здесь НЕ дублируется:
 *   - годовая оплата (−2 месяца на тариф) считается в buildQuote;
 *   - промо-код с потолком MAX_PROMO_DISCOUNT_RATIO — там же.
 * Веер применяется МЕЖДУ ними: после годовой, до промо-кода.
 *
 * Правило потолка. Сумма всех скидок, включая промо, ограничена
 * MAX_TOTAL_DISCOUNT_RATIO. Без него три ступени плюс промо-код давали бы
 * товар почти даром, и это невозможно было бы заметить: каждая ступень по
 * отдельности выглядит скромно.
 *
 * Правило прозрачности. Каждая применённая ступень возвращается отдельной
 * строкой с ярлыком и суммой. Скидка, которую нельзя показать построчно,
 * читается покупателем как случайная цифра.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMITMENT_LADDER = exports.SEAT_VOLUME_LADDER = exports.MODULE_VOLUME_LADDER = exports.MAX_TOTAL_DISCOUNT_RATIO = void 0;
exports.stepFor = stepFor;
exports.computeFan = computeFan;
exports.fanTotalUsd = fanTotalUsd;
exports.capTotalDiscount = capTotalDiscount;
/** Потолок на СУММУ всех скидок (веер + годовая + промо) от подытога. */
exports.MAX_TOTAL_DISCOUNT_RATIO = 0.5;
/**
 * Модули поштучно. Чем больше берут по отдельности, тем ближе к тому, чтобы
 * взять тариф — ступени сглаживают этот переход, а не наказывают за него.
 */
exports.MODULE_VOLUME_LADDER = [
    { from: 3, percent: 0.10 },
    { from: 5, percent: 0.15 },
    { from: 8, percent: 0.20 },
];
/** Места в команде. Второе место продаётся легче первого — ступени это признают. */
exports.SEAT_VOLUME_LADDER = [
    { from: 3, percent: 0.10 },
    { from: 10, percent: 0.20 },
    { from: 25, percent: 0.30 },
];
/**
 * Срок обязательства сверх годового. Годовая скидка (−2 месяца) уже учтена в
 * buildQuote; эта ступень — про 24 и 36 месяцев, где мы получаем деньги вперёд.
 */
exports.COMMITMENT_LADDER = [
    { from: 24, percent: 0.05 },
    { from: 36, percent: 0.10 },
];
/** Ступень, которая сработала для данного количества (последняя подходящая). */
function stepFor(ladder, qty) {
    let hit = null;
    for (const s of ladder)
        if (qty >= s.from)
            hit = s;
    return hit;
}
/**
 * Считает веер. Каждая ступень начисляется на СВОЮ часть подытога, а не на всё
 * подряд: скидка за объём модулей не должна удешевлять места, иначе цифра
 * перестаёт значить то, что написано на ярлыке.
 */
function computeFan(input) {
    const out = [];
    const mod = stepFor(exports.MODULE_VOLUME_LADDER, input.moduleCount);
    if (mod && input.modulesUsd > 0) {
        out.push({
            id: "modules_volume",
            label: `${input.moduleCount} модулей поштучно`,
            percent: mod.percent,
            baseUsd: input.modulesUsd,
            amountUsd: round2(input.modulesUsd * mod.percent),
        });
    }
    const seat = stepFor(exports.SEAT_VOLUME_LADDER, input.seatCount);
    if (seat && input.seatsUsd > 0) {
        out.push({
            id: "seats_volume",
            label: `${input.seatCount} мест в команде`,
            percent: seat.percent,
            baseUsd: input.seatsUsd,
            amountUsd: round2(input.seatsUsd * seat.percent),
        });
    }
    const months = input.commitmentMonths ?? 0;
    const commit = stepFor(exports.COMMITMENT_LADDER, months);
    if (commit && input.subtotalUsd > 0) {
        out.push({
            id: "commitment",
            label: `Обязательство ${months} мес.`,
            percent: commit.percent,
            baseUsd: input.subtotalUsd,
            amountUsd: round2(input.subtotalUsd * commit.percent),
        });
    }
    return out;
}
/** Сумма веера в деньгах. */
function fanTotalUsd(fans) {
    return round2(fans.reduce((s, f) => s + f.amountUsd, 0));
}
/**
 * Обрезает СУММУ всех скидок до потолка и говорит, сколько срезано.
 * Возвращает итоговую скидку, а не «сколько ещё можно» — вызывающему нужна
 * цифра, которую он поставит в счёт, а не остаток лимита.
 */
function capTotalDiscount(subtotalUsd, discountUsd) {
    const max = round2(subtotalUsd * exports.MAX_TOTAL_DISCOUNT_RATIO);
    if (discountUsd <= max)
        return { applied: round2(discountUsd), cappedBy: 0 };
    return { applied: max, cappedBy: round2(discountUsd - max) };
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
