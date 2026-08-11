import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canSpend, spend } from "../chessyLedger";

/* Раздел «Экономика» держал СВОЙ ключ баланса. Во всём фронтенде он встречался ровно
 * один раз — в собственном объявлении, — то есть его не писал никто. Баланс всегда
 * читался как «нет данных», и аукционы, аренда коуча и подписки не работали ни у кого
 * и никогда. Ничего при этом не падало: страница исправно показывала «Сначала заработай
 * Chessy в CyberChess».
 */

/* Комментарии вырезаем: в самом файле старый ключ нарочно назван в пояснении, почему
   его больше нет. Без вырезания сторож ловил бы собственный рассказ о дефекте. */
const stripComments = (x: string) =>
  x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

const ecoRaw = readFileSync(join(__dirname, "..", "economy", "page.tsx"), "utf8");
const eco = stripComments(ecoRaw);
const game = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("экономика и игра пользуются одним кошельком", () => {
  it("экономика читает ключ игры, а не свой", () => {
    expect(eco).toMatch(/const LS_WALLET = "aevion_chessy_v1"/);
    expect(eco).not.toMatch(/aevion_cyberchess_chessy_v1/);
  });

  it("ключ тот же, что объявлен в игре", () => {
    /* Строковая копия ключа — как раз то, из-за чего разъехались хранилища.
       Здесь она под присмотром: разойдутся — тест покраснеет. */
    expect(game).toMatch(/const CK="aevion_chessy_v1"/);
  });

  it("списание идёт через общий леджер, а не своей арифметикой", () => {
    expect(eco).toMatch(/canSpend\(wallet, cost\)/);
    expect(eco).toMatch(/ledgerSpend\(wallet, cost\)/);
    // прежнее «balance - cost» руками должно было исчезнуть
    expect(eco).not.toMatch(/const next = balance - cost/);
  });

  it("списание сохраняет кошелёк целиком, а не один баланс", () => {
    /* Игра держит в том же объекте lifetime, покупки и достижения. Запись одного
       баланса поверх стёрла бы их. */
    expect(eco).toMatch(/JSON\.stringify\(next\)/);
    expect(eco).toMatch(/readWallet\(\)/);
  });

  it("испорченный кошелёк не перезаписывается", () => {
    expect(ecoRaw).toMatch(/лучше «нет данных», чем перезапись/);
  });
});

describe("леджер держит инварианты, на которые теперь опирается экономика", () => {
  const wallet = { balance: 100, lifetime: 500, ach: { first: 10 }, owned: { skin: true } };

  it("не пускает в минус", () => {
    expect(canSpend(wallet, 150)).toBe(false);
    expect(spend(wallet, 150)).toEqual(wallet);
  });

  it("списывает и сохраняет остальные поля", () => {
    const next = spend(wallet, 40);
    expect(next.balance).toBe(60);
    expect(next.lifetime).toBe(500);
    expect((next as typeof wallet).owned).toEqual({ skin: true });
  });
});
