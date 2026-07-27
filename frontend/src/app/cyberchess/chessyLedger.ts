/* Чистые переходы состояния Chessy.
 *
 * Вынесены из page.tsx после двух дефектов в самих примитивах валюты:
 *
 * 1. spendChessy решал, прошла ли покупка, по флагу, который выставлялся ВНУТРИ
 *    апдейтера состояния (`let ok=false; sChessy(c=>{...ok=true...}); if(ok)`).
 *    React не обязан выполнять апдейтер в момент вызова, и когда он этого не делал,
 *    баланс списывался, а функция возвращала false — игрок платил и не получал товар.
 * 2. unlockAch планировал тост внутри апдейтера, а StrictMode вызывает апдейтер
 *    дважды с одним и тем же входом: награда начислялась раз, объявление — два.
 *
 * Общее у обоих: решение принималось там, где оно не имеет права приниматься.
 * Здесь функции чистые — вход состояние, выход состояние, никаких эффектов, — и
 * поэтому проверяемы напрямую.
 */

export type LedgerState = {
  balance: number;
  lifetime: number;
  ach: Record<string, number>;
};

/** Начисление. lifetime растёт вместе с балансом и никогда не уменьшается. */
export function award<T extends LedgerState>(c: T, n: number): T {
  if (n <= 0) return c;
  return { ...c, balance: c.balance + n, lifetime: c.lifetime + n };
}

/** Хватает ли на покупку. Решение принимается ЗДЕСЬ, а не внутри апдейтера. */
export function canSpend(c: LedgerState, n: number): boolean {
  return n > 0 && c.balance >= n;
}

/** Списание. Недостаток средств оставляет состояние нетронутым — баланс не уходит в минус. */
export function spend<T extends LedgerState>(c: T, n: number): T {
  if (!canSpend(c, n)) return c;
  return { ...c, balance: c.balance - n };
}

/** Выдача достижения. Повторная выдача того же ключа ничего не меняет. */
export function unlock<T extends LedgerState>(c: T, key: string, reward: number, at: number): T {
  if (Object.prototype.hasOwnProperty.call(c.ach, key)) return c;
  return {
    ...c,
    balance: c.balance + Math.max(0, reward),
    lifetime: c.lifetime + Math.max(0, reward),
    ach: { ...c.ach, [key]: at },
  };
}
