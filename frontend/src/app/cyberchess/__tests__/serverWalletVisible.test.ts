import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { stripComments } from "./_stripComments";

// Заработанное на сервере видно его владельцу. 19.08.2026.
//
// Chessy за рейтинговые партии начисляет СЕРВЕР в таблицу CyberWallet. Баланс на
// главной странице всё время брался из localStorage, а серверную ручку кошелька
// страница не звала НИ РАЗУ.
//
// Две суммы никогда не встречались, и получалось особенно обидно: заработанное
// в рейтинге видно ВСЕМ в таблице лидеров Chessy — и не видно самому игроку.
// Потратить его тоже нельзя: магазин работает с местным балансом.
//
// Суммы намеренно НЕ смешиваются: местная копится за пазлы в этом браузере,
// серверная — за рейтинговые партии, и объединение их продуктовое решение, а не
// правка экрана.

const SRC = path.join(__dirname, "..", "page.tsx");
const src = () => stripComments(fs.readFileSync(SRC, "utf-8")).replace(/\s+/g, " ");

describe("серверный счёт Chessy", () => {
  test("страница его запрашивает", () => {
    expect(src()).toMatch(/matchmaking\/wallet\?userId=/);
  });

  test("личность берётся из общего источника, а не своим чтением ключа", () => {
    // Иначе это пятое прямое обращение к ключу, и сторож единого источника
    // краснеет — он и покраснел, когда я сделал именно так.
    const s = src();
    const i = s.indexOf("matchmaking/wallet?userId=");
    expect(s.slice(Math.max(0, i - 500), i)).toMatch(/knownUserId\(\)/);
  });

  test("отказ и ноль различаются на экране", () => {
    // Сервер отвечает 503, когда не смог спросить базу. Превратить это в
    // «вы ничего не заработали» — та же ложь, что и выдуманные числа.
    const s = src();
    expect(s).toMatch(/chessy-server-balance/);
    expect(s).toMatch(/chessy-server-unknown/);
    expect(s).toMatch(/НЕ значит, что он пуст/);
    // Мало показать, что ветка отрисовки есть: надо, чтобы отказ до неё
    // ДОХОДИЛ. Первая редакция этого не проверяла — я подменил обработчик
    // отказа нулевым балансом, и тест остался зелёным.
    const i = s.indexOf("matchmaking/wallet?userId=");
    const блок = s.slice(i, i + 700);
    expect(блок, "неуспешный ответ обязан давать «не знаю»").toMatch(/ok!==true\)\{sSrvWallet\("failed"\)/);
    expect(блок, "сетевая ошибка обязана давать «не знаю»").toMatch(/catch\(\(\)=>\{if\(alive\)sSrvWallet\("failed"\)/);
  });

  test("суммы не смешиваются", () => {
    // Значок показывает серверный баланс отдельно; сложение с местным было бы
    // продуктовым решением, принятым молча.
    const s = src();
    const i = s.indexOf("chessy-server-balance");
    expect(s.slice(i, i + 400)).toMatch(/srvWallet\.balance/);
    expect(s.slice(i, i + 400)).not.toMatch(/chessy\.balance\s*\+|\+\s*chessy\.balance/);
  });
});
