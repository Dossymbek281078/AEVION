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

/* ── Чтение кошелька с диска ────────────────────────────────────────────────
 *
 * Загрузчик отвергал всё, у чего `v` не равно 1, и возвращал ПУСТОЙ кошелёк.
 * То есть первый, кто добавит в состояние поле и поднимет версию, сотрёт всем
 * игрокам баланс, достижения и покупки — молча, без единой ошибки в консоли.
 * Сценарий не гипотетический: DailyState в этом же файле уже поднимали с v1 до
 * v2, и все сохранённые состояния тогда отбросились.
 *
 * Версия здесь больше ничего не отвергает: поля добавляются, а не переименовываются,
 * поэтому старое состояние читается новым кодом как есть. Отвергается только то,
 * что нельзя использовать — не объект, не число, отрицательный баланс.
 */

export type WalletState = LedgerState & {
  v: number;
  streak: number;
  welcome: boolean;
  lastDaily?: string;
  owned: Record<string, boolean>;
};

const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;

const dict = <V,>(v: unknown): Record<string, V> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, V>) : null;

/** Читает произвольный сохранённый объект в кошелёк, не теряя того, что пригодно. */
export function migrateWallet<T extends WalletState>(raw: unknown, fallback: T): T {
  const r = dict<unknown>(raw);
  if (!r) return { ...fallback };
  const balance = num(r.balance, fallback.balance);
  // Пожизненный счёт не может быть меньше текущего баланса — иначе статистика врёт.
  const lifetime = Math.max(balance, num(r.lifetime, fallback.lifetime));
  return {
    ...fallback,
    ...r,
    v: fallback.v,
    balance,
    lifetime,
    streak: num(r.streak, fallback.streak),
    welcome: typeof r.welcome === "boolean" ? r.welcome : fallback.welcome,
    lastDaily: typeof r.lastDaily === "string" ? r.lastDaily : undefined,
    owned: dict<boolean>(r.owned) || {},
    ach: dict<number>(r.ach) || {},
  };
}
