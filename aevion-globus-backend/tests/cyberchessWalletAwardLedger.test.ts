import { describe, test, expect, beforeEach, vi } from "vitest";

// Выплата за партию, которая не прошла с первого раза. 2026-08-12.
//
// Продолжение истории cyberchessMatchFinalizeIdempotency.test.ts. Там порядок
// был исправлен так, что партия помечается закрытой ДО начислений — это убрало
// двойную выплату. Но у той же правки есть обратная сторона: замок закрывает и
// повтор тоже. Значит один обычный отказ БД на самом начислении означал, что
// игрок не получит ничего и НИКОГДА: следующий отчёт о конце партии видел
// закрытую строку и уходил, ничего не заплатив.
//
// Следа при этом не оставалось. Каждый запрос идёт через обёртку, которая ловит
// ошибку, пишет warning и возвращает пустой массив, — то есть провал выплаты
// выглядел ровно как успех, и await над ним возвращался как ни в чём не бывало.
//
// Починка: ведомость выплат `CyberWalletAward` — одна строка на (партия,
// игрок), которая пишется ТЕМ ЖЕ запросом, что и изменение баланса. Она делает
// начисление идемпотентным само по себе, поэтому повтор можно (и нужно) звать
// снова: он либо не делает ничего, либо доплачивает пропущенное.
//
// Магазин ходит в Postgres через одну тонкую обёртку, поэтому тесты подменяют
// драйвер и смотрят, что реально уходит в базу.

const { queries, failOn, state } = vi.hoisted(() => ({
  queries: [] as { text: string; params: unknown[] }[],
  failOn: { pattern: null as RegExp | null },
  state: {
    ended: false,
    result: "white" as string,
    ledger: new Set<string>(),
    wallet: new Map<string, number>(),
    unpaid: 0,
  },
}));

vi.mock("pg", () => {
  class Pool {
    async query(text: string, params: unknown[] = []) {
      queries.push({ text, params });
      if (failOn.pattern && failOn.pattern.test(text)) {
        throw new Error("connection reset by peer");
      }

      // Выплата: внешняя вставка в ведомость служит замком, кошелёк меняется
      // только если замок отдал строку. Первичный ключ — (matchId, userId).
      if (/INSERT INTO "CyberWalletAward"/i.test(text)) {
        const [matchId, userId, , , amount] = params as [string, string, number, unknown, number];
        const key = `${matchId}|${userId}`;
        if (state.ledger.has(key)) return { rows: [{ credited: 0 }] };
        state.ledger.add(key);
        state.wallet.set(userId, (state.wallet.get(userId) ?? 0) + Number(amount));
        return { rows: [{ credited: 1 }] };
      }

      // Начисление БЕЗ ведомости — форма, которая была до этой правки. Подделка
      // знает её нарочно: иначе тесты падали бы на старом коде просто потому,
      // что подделка его не понимает, а не потому, что он теряет выплату.
      if (/INSERT INTO "CyberWallet"/i.test(text)) {
        const [userId, , amount] = params as [string, unknown, number];
        state.wallet.set(userId, (state.wallet.get(userId) ?? 0) + Number(amount));
        return { rows: [] };
      }

      if (/count\(\*\)[\s\S]*FROM "CyberMatch" m/i.test(text)) {
        return { rows: [{ n: state.unpaid }] };
      }

      if (/SELECT\s+"status"/i.test(text)) {
        return {
          rows: [
            {
              status: state.ended ? "ended" : "live",
              result: state.result,
              whiteUserId: "white-player",
              blackUserId: "black-player",
              whiteName: "White",
              blackName: "Black",
              whiteRatingBefore: 1500,
              blackRatingBefore: 1500,
              whiteRatingAfter: 1510,
              blackRatingAfter: 1490,
            },
          ],
        };
      }

      if (/UPDATE\s+"CyberMatch"/i.test(text) && /"status"\s*=\s*'ended'/i.test(text)) {
        const conditional = /"status"\s*<>\s*'ended'/i.test(text);
        if (conditional && state.ended) return { rows: [], rowCount: 0 };
        state.ended = true;
        state.result = String((params as unknown[])[1] ?? state.result);
        return { rows: [{ id: "claimed" }], rowCount: 1 };
      }

      return { rows: [] };
    }
    on() {}
  }
  return { default: { Pool }, Pool };
});

import { finalizeMatch, awardMatchChessy, countUnpaidAwards } from "../src/routes/cyberchessMatchStore";

const INFO = {
  whiteUserId: "white-player",
  blackUserId: "black-player",
  whiteName: "White",
  blackName: "Black",
  timeControl: "300+5",
  result: "white" as const,
  termination: "checkmate",
};

const AWARD = /INSERT INTO "CyberWalletAward"/i;
// Впрыск отказа целится в НАЧИСЛЕНИЕ, а не в конкретную его форму: шаблон
// покрывает и выплату через ведомость, и прежнюю вставку прямо в кошелёк.
// Иначе на старом коде отказ просто не наступал бы, и «красный» тест доказывал
// бы лишь то, что новой функции там нет.
const CREDIT = /INSERT INTO "CyberWallet/i;
const creditQueries = () => queries.filter((q) => CREDIT.test(q.text));

beforeEach(() => {
  process.env.DATABASE_URL = "postgres://test/test";
  queries.length = 0;
  failOn.pattern = null;
  state.ended = false;
  state.result = "white";
  state.ledger.clear();
  state.wallet.clear();
  state.unpaid = 0;
});

describe("подмена драйвера действительно работает", () => {
  test("запросы доходят до подделки", async () => {
    // Сторож всего файла: под `require("pg")` подмена не включалась, и
    // утверждения ниже проходили бы, не выполнив ни одного запроса.
    await finalizeMatch("m-0", INFO);
    expect(queries.length).toBeGreaterThan(0);
  });
});

describe("неудавшаяся выплата не теряется", () => {
  test("отказ на начислении доплачивается обычным вторым отчётом", async () => {
    // Главный тест файла. Конец партии сообщают ОБА клиента — второй отчёт это
    // норма, а не редкость. На старом коде он уходил ни с чем, потому что
    // партия уже закрыта, и деньги пропадали навсегда.
    failOn.pattern = CREDIT;
    await finalizeMatch("m-1", INFO);
    expect(state.wallet.size).toBe(0);

    failOn.pattern = null;
    await finalizeMatch("m-1", INFO);

    expect(state.wallet.get("white-player")).toBe(10);
    expect(state.wallet.get("black-player")).toBe(1);
  });

  test("провал выплаты не оставляет строки в ведомости", async () => {
    // Ведомость и баланс живут или падают вместе — иначе ведомость утверждала
    // бы выплату, которой не было. Пустая ведомость у закрытой партии и есть
    // тот самый долговой след, которого раньше не существовало.
    failOn.pattern = CREDIT;
    await finalizeMatch("m-2", INFO);

    expect(creditQueries().length).toBeGreaterThan(0);
    expect(state.ledger.size).toBe(0);

    // Вторая половина обязательна: без неё утверждение «ведомость пуста»
    // проходит и на коде, где ведомости не существует вовсе, — то есть
    // доказывает пустоту, а не свойство.
    failOn.pattern = null;
    await finalizeMatch("m-2", INFO);
    expect(state.ledger.size).toBe(2);
  });

  test("второй отчёт не платит второй раз", async () => {
    await finalizeMatch("m-3", INFO);
    await finalizeMatch("m-3", INFO);

    expect(state.wallet.get("white-player")).toBe(10);
    expect(state.wallet.get("black-player")).toBe(1);
  });

  test("на доплате суммы берутся из строки, а не из повторного отчёта", async () => {
    // Второй отчёт присылает ДРУГОЙ клиент. Его версия исхода не должна решать,
    // кому сколько причитается, — иначе доплату можно перенаправить себе.
    failOn.pattern = CREDIT;
    await finalizeMatch("m-4", INFO);

    failOn.pattern = null;
    await finalizeMatch("m-4", { ...INFO, result: "black" });

    expect(state.wallet.get("white-player")).toBe(10);
    expect(state.wallet.get("black-player")).toBe(1);
  });

  test("ведомость и баланс меняются одним запросом", async () => {
    // Структурный сторож: как только выплату разложат на два запроса, между
    // ними снова появится состояние, в котором заплачено, но не записано.
    await finalizeMatch("m-5", INFO);

    const walletWrites = queries.filter((q) => /INSERT INTO "CyberWallet"/i.test(q.text));
    expect(walletWrites.length).toBeGreaterThan(0);
    for (const w of walletWrites) expect(w.text).toMatch(AWARD);
  });

  test("повторная выплата за ту же партию отличима от отказа", async () => {
    // Три исхода вместо двух: «уже заплачено» — это нормально, «не смогли» —
    // нет. Раньше и то и другое было просто завершившимся await.
    expect(await awardMatchChessy("m-6", "someone", 10, "Someone")).toBe("credited");
    expect(await awardMatchChessy("m-6", "someone", 10, "Someone")).toBe("already");

    failOn.pattern = CREDIT;
    expect(await awardMatchChessy("m-7", "someone", 10, "Someone")).toBe("failed");
  });
});

describe("счётчик зависших выплат", () => {
  test("упавший запрос даёт null, а не ноль", async () => {
    // Ноль означал бы «долгов нет», то есть докладывал бы о проверке, которой
    // не было. null означает «спросить не удалось».
    failOn.pattern = /FROM "CyberMatch" m/i;
    expect(await countUnpaidAwards()).toBeNull();
  });

  test("отдаёт число, которое посчитала база", async () => {
    state.unpaid = 3;
    expect(await countUnpaidAwards()).toBe(3);
  });

  test("счёт ограничен снизу первой выплатой в ведомости", async () => {
    // Проверка по тексту запроса — базы в этом каталоге нет. Смысл границы:
    // все партии, закрытые ДО появления таблицы, строк не имеют, и без неё
    // счётчик был бы навсегда красным. А показатель, который всегда красный,
    // перестают читать вместе с настоящей тревогой в нём.
    await countUnpaidAwards();
    const q = queries.find((x) => /FROM "CyberMatch" m/i.test(x.text));
    expect(q?.text).toMatch(/min\("paidAt"\)/i);
    expect(q?.text).toMatch(/COALESCE/i);
  });
});
