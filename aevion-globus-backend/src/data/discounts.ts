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

/** Потолок на СУММУ всех скидок (веер + годовая + промо) от подытога. */
export const MAX_TOTAL_DISCOUNT_RATIO = 0.5;

export interface FanStep {
  /** Минимальное количество, с которого ступень включается. */
  from: number;
  /** Доля скидки: 0.1 = −10%. */
  percent: number;
}

export interface AppliedFan {
  id: string;
  label: string;
  /** Доля, которая сработала. */
  percent: number;
  /** На какую часть подытога начислено. */
  baseUsd: number;
  /** Сколько это в деньгах. */
  amountUsd: number;
}

/**
 * Модули поштучно. Чем больше берут по отдельности, тем ближе к тому, чтобы
 * взять тариф — ступени сглаживают этот переход, а не наказывают за него.
 */
export const MODULE_VOLUME_LADDER: FanStep[] = [
  { from: 3, percent: 0.10 },
  { from: 5, percent: 0.15 },
  { from: 8, percent: 0.20 },
];

/** Места в команде. Второе место продаётся легче первого — ступени это признают. */
export const SEAT_VOLUME_LADDER: FanStep[] = [
  { from: 3, percent: 0.10 },
  { from: 10, percent: 0.20 },
  { from: 25, percent: 0.30 },
];

/**
 * Срок обязательства сверх годового. Годовая скидка (−2 месяца) уже учтена в
 * buildQuote; эта ступень — про 24 и 36 месяцев, где мы получаем деньги вперёд.
 */
export const COMMITMENT_LADDER: FanStep[] = [
  { from: 24, percent: 0.05 },
  { from: 36, percent: 0.10 },
];

/** Ступень, которая сработала для данного количества (последняя подходящая). */
export function stepFor(ladder: FanStep[], qty: number): FanStep | null {
  let hit: FanStep | null = null;
  for (const s of ladder) if (qty >= s.from) hit = s;
  return hit;
}

export interface FanInput {
  /** Сумма строк по модулям, USD. */
  modulesUsd: number;
  /** Сколько модулей взято поштучно. */
  moduleCount: number;
  /** Сумма строк по дополнительным местам, USD. */
  seatsUsd: number;
  /** Сколько мест всего (включая базовое). */
  seatCount: number;
  /** Срок обязательства в месяцах (12 = обычный год). */
  commitmentMonths?: number;
  /** Подытог целиком — база для ступени срока. */
  subtotalUsd: number;
}

/**
 * Считает веер. Каждая ступень начисляется на СВОЮ часть подытога, а не на всё
 * подряд: скидка за объём модулей не должна удешевлять места, иначе цифра
 * перестаёт значить то, что написано на ярлыке.
 */
export function computeFan(input: FanInput): AppliedFan[] {
  const out: AppliedFan[] = [];

  const mod = stepFor(MODULE_VOLUME_LADDER, input.moduleCount);
  if (mod && input.modulesUsd > 0) {
    out.push({
      id: "modules_volume",
      label: `${input.moduleCount} модулей поштучно`,
      percent: mod.percent,
      baseUsd: input.modulesUsd,
      amountUsd: round2(input.modulesUsd * mod.percent),
    });
  }

  const seat = stepFor(SEAT_VOLUME_LADDER, input.seatCount);
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
  const commit = stepFor(COMMITMENT_LADDER, months);
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
export function fanTotalUsd(fans: AppliedFan[]): number {
  return round2(fans.reduce((s, f) => s + f.amountUsd, 0));
}

/**
 * Обрезает СУММУ всех скидок до потолка и говорит, сколько срезано.
 * Возвращает итоговую скидку, а не «сколько ещё можно» — вызывающему нужна
 * цифра, которую он поставит в счёт, а не остаток лимита.
 */
export function capTotalDiscount(subtotalUsd: number, discountUsd: number): {
  applied: number;
  cappedBy: number;
} {
  const max = round2(subtotalUsd * MAX_TOTAL_DISCOUNT_RATIO);
  if (discountUsd <= max) return { applied: round2(discountUsd), cappedBy: 0 };
  return { applied: max, cappedBy: round2(discountUsd - max) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
