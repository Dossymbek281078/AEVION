/**
 * Что показать игроку про ЕГО собственный серверный кошелёк на странице
 * Chessy-таблицы.
 *
 * Зачем отдельный модуль: решение здесь неочевидное, и почти каждый его исход
 * можно тихо испортить. «Спросить не удалось» нельзя показывать как ноль —
 * получится утверждение «вы ничего не заработали», которого никто не проверял.
 * «Заработал, но не в таблице» — нормальный случай (в таблице первые сто), и
 * он требует своих слов, иначе человек читает пустое место как поломку.
 * Отрисовка такие развилки прячет, а чистая функция — нет.
 */

export interface WalletFacts {
  balance: number;
  earnedTotal: number;
}

export interface WalletRankRow {
  userId: string;
  rank: number;
}

export interface MyWalletInput {
  /** Номер игрока на этом устройстве; пустая строка — игрок не опознан. */
  userId: string;
  loading: boolean;
  /** Запрос не удался. Отдельно от wallet === null — это разные вещи. */
  failed: boolean;
  /** Ответ сервера или null, если ответа нет. */
  wallet: WalletFacts | null;
  /** Строки видимой таблицы — из них берётся место, если игрок в неё попал. */
  rows: WalletRankRow[];
  /**
   * Загрузилась ли сама таблица. Без этого признака пустой список означал бы
   * «вас в таблице нет», хотя таблицы могло не прийти вовсе — то же враньё
   * пустотой, только на другом экране.
   */
  rowsAvailable: boolean;
}

export type MyWalletView =
  /** Игрока не опознали — честнее не говорить ничего, чем говорить «0». */
  | { kind: "hidden" }
  | { kind: "loading" }
  /** Спросили и не получили ответа. Ноль тут был бы враньём. */
  | { kind: "unavailable" }
  /** Ответ получен: в реальных матчах не заработано ничего. */
  | { kind: "empty" }
  | {
      kind: "earned";
      balance: number;
      earnedTotal: number;
      /** Место в таблице; null — игрока в ней нет. Смотреть вместе с rankKnown. */
      rank: number | null;
      /** false — про место сказать нечего: таблица не загрузилась. */
      rankKnown: boolean;
    };

export function summariseMyWallet(input: MyWalletInput): MyWalletView {
  if (!input.userId) return { kind: "hidden" };
  if (input.loading) return { kind: "loading" };
  if (input.failed || !input.wallet) return { kind: "unavailable" };

  const balance = Number(input.wallet.balance);
  const earnedTotal = Number(input.wallet.earnedTotal);
  if (!Number.isFinite(balance) || !Number.isFinite(earnedTotal)) {
    // Ответ пришёл, но в нём не числа. Это тоже «спросить не удалось», а не ноль.
    return { kind: "unavailable" };
  }
  if (balance <= 0 && earnedTotal <= 0) return { kind: "empty" };

  // Место — только если игрок реально виден в таблице. Иначе null: он вне
  // первой сотни, и выдумывать ему номер нельзя. А если таблицы нет вовсе, про
  // место нельзя сказать даже «вас в ней нет».
  const mine = input.rows.find((r) => r.userId === input.userId);
  const rank = mine && Number.isFinite(Number(mine.rank)) ? Number(mine.rank) : null;

  return { kind: "earned", balance, earnedTotal, rank, rankKnown: input.rowsAvailable };
}
