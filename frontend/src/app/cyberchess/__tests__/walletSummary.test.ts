import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { stripComments } from "./_stripComments";
import { summariseMyWallet, type MyWalletInput } from "../leaderboard/walletSummary";

/* Собственный баланс на странице Chessy-таблицы.
 *
 * В таблице показаны первые сто. Игрок за её пределами не получал о себе
 * никакого ответа: своей строки нет, объяснения нет — пустое место читается
 * как поломка. При этом ручка /matchmaking/wallet?userId= существовала и не
 * вызывалась ни одним экраном.
 *
 * Опасность тут не в вёрстке, а в исходах, которые легко перепутать:
 *   * «спросить не удалось» показать нулём — это утверждение о деньгах,
 *     которого никто не проверял;
 *   * «заработал, но вне сотни» показать пустотой — тот же обрыв, что и был;
 *   * место в таблице выдумать для того, кого в ней нет.
 */

const base: MyWalletInput = {
  userId: "player-7",
  loading: false,
  failed: false,
  wallet: { balance: 42, earnedTotal: 96 },
  rows: [],
  rowsAvailable: true,
};

describe("что показать игроку про его кошелёк", () => {
  it("без опознанного игрока не говорим ничего", () => {
    // Ноль незнакомцу — это утверждение о его деньгах.
    expect(summariseMyWallet({ ...base, userId: "" }).kind).toBe("hidden");
  });

  it("пока идёт запрос — это состояние загрузки, а не ноль", () => {
    expect(summariseMyWallet({ ...base, loading: true }).kind).toBe("loading");
  });

  it("неудачный запрос не превращается в ноль", () => {
    // Главный случай. «0 Chessy» и «мы не смогли спросить» — разные сообщения,
    // и второе нельзя показывать первым.
    expect(summariseMyWallet({ ...base, failed: true, wallet: null }).kind).toBe("unavailable");
  });

  it("ответ без чисел — тоже «не удалось», а не ноль", () => {
    const broken = { balance: NaN, earnedTotal: NaN };
    expect(summariseMyWallet({ ...base, wallet: broken }).kind).toBe("unavailable");
  });

  it("честный ноль от сервера показывается как ноль", () => {
    expect(summariseMyWallet({ ...base, wallet: { balance: 0, earnedTotal: 0 } }).kind).toBe("empty");
  });

  it("потраченный баланс при заработанном не считается пустым", () => {
    // Заработал 30, потратил всё. Это не «пока ничего нет» — человеку есть что
    // сказать, и предлагать ему «сыграть первую партию» неверно.
    const v = summariseMyWallet({ ...base, wallet: { balance: 0, earnedTotal: 30 } });
    expect(v.kind).toBe("earned");
    if (v.kind === "earned") expect(v.earnedTotal).toBe(30);
  });

  it("место берётся из таблицы, когда игрок в ней есть", () => {
    const v = summariseMyWallet({ ...base, rows: [{ userId: "player-7", rank: 12 }] });
    expect(v.kind === "earned" && v.rank).toBe(12);
  });

  it("места нет — значит null, а не выдуманный номер", () => {
    const v = summariseMyWallet({ ...base, rows: [{ userId: "somebody-else", rank: 1 }] });
    expect(v.kind === "earned" && v.rank).toBe(null);
    expect(v.kind === "earned" && v.rankKnown).toBe(true);
  });

  it("не загруженная таблица — не повод сказать «вас в ней нет»", () => {
    // Пустой список и отсутствующий список выглядят одинаково. Первое значит
    // «вы вне сотни», второе не значит ничего, и говорить про место нельзя.
    const v = summariseMyWallet({ ...base, rows: [], rowsAvailable: false });
    expect(v.kind === "earned" && v.rankKnown).toBe(false);
  });
});

describe("страница действительно показывает эти состояния", () => {
  /* Чистая функция может быть правильной и не подключённой — тогда игрок
     по-прежнему не видит ничего. */
  const src = stripComments(readFileSync("src/app/cyberchess/leaderboard/page.tsx", "utf8"));

  it("страница зовёт ручку кошелька по своему игроку", () => {
    expect(src).toMatch(/matchmaking\/wallet\?userId=/);
  });

  it("страница считает состояние через summariseMyWallet", () => {
    expect(src).toMatch(/summariseMyWallet\(/);
  });

  it("у неудачного запроса свои слова, а не ноль", () => {
    expect(src).toMatch(/не удалось запросить/i);
    expect(src).toMatch(/не значит, что он нулевой/i);
  });

  it("про место говорят только когда таблица загружена", () => {
    // Признак должен доехать до вёрстки: правильная функция и неподключённый
    // признак дают на экране ровно ту фразу, которую он должен был запретить.
    expect(src).toMatch(/rowsAvailable:/);
    expect(src).toMatch(/rankKnown\s*&&/);
  });

  it("пустому счёту объясняют, где остальные Chessy", () => {
    // Иначе человек с 4000 Chessy за пазлы видит ноль и считает это ошибкой.
    expect(src).toMatch(/только на этом\s+устройстве/i);
  });
});
