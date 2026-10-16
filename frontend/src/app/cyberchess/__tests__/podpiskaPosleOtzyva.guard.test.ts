// 🔴 16.10.2026: после партии первым идёт отзыв, окно подписки на запуск — после «Отправить»
// или после закрытия плашки. Решение оркестратора по данным: за 7 дней окно после партии
// дало 0 живых адресов (waitlist_submit source=cyberchess-game-over — 0; живых концов партии 1 из 26).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { podpiskaPora } from "../podpiskaPosleOtzyva";

const СТРАНИЦА = readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");

describe("окно подписки ждёт отзыв", () => {
  it("🔴 плашка открыта, отзыв не отправлен — окна нет; отправлен — окно; плашка закрыта — окно", () => {
    expect(podpiskaPora({ ждёт: true, otzyvOtpravlen: false, plashkaOtkryta: true })).toBe(false);
    expect(podpiskaPora({ ждёт: true, otzyvOtpravlen: true, plashkaOtkryta: true })).toBe(true);
    expect(podpiskaPora({ ждёт: true, otzyvOtpravlen: false, plashkaOtkryta: false })).toBe(true);
  });

  it("не ждёт (уже показывали / повод не game-over) — окна нет ни при каких условиях", () => {
    expect(podpiskaPora({ ждёт: false, otzyvOtpravlen: true, plashkaOtkryta: true })).toBe(false);
    expect(podpiskaPora({ ждёт: false, otzyvOtpravlen: false, plashkaOtkryta: false })).toBe(false);
  });

  it("🔴 страница: таймера 2,2 с после конца партии больше нет, ожидание ставится в ref", () => {
    expect(СТРАНИЦА).not.toContain('sShowWaitlist(true);try{localStorage.setItem("aevion_chess_waitlist_seen","1")}catch{}},2200)');
    expect(СТРАНИЦА).toContain("подпискаЖдётОтзываRef.current=true;\n  },[over]);");
  });

  it("страница: показ — один раз (ref сбрасывается) и с отметкой «один раз на устройство»", () => {
    const i = СТРАНИЦА.indexOf("const показатьПодпискуПослеОтзыва=()=>{");
    expect(i).toBeGreaterThan(0);
    const тело = СТРАНИЦА.slice(i, СТРАНИЦА.indexOf("\n", i));
    expect(тело).toContain("if(!подпискаЖдётОтзываRef.current)return;подпискаЖдётОтзываRef.current=false;");
    expect(тело).toContain('sПоводПодписки("game-over");sShowWaitlist(true);');
    expect(тело).toContain('localStorage.setItem("aevion_chess_waitlist_seen","1")');
  });

  it("страница: плашка закрыта — условие то же, что у самой плашки; отправка отзыва зовёт показ", () => {
    expect(СТРАНИЦА).toContain('podpiskaPora({ждёт:подпискаЖдётОтзываRef.current,otzyvOtpravlen:false,plashkaOtkryta:!!over&&!setup&&tab==="play"&&!showGameOver})');
    expect(СТРАНИЦА).toContain('{over&&!setup&&tab==="play"&&!showGameOver&&(()=>{'); // условие плашки
    expect(СТРАНИЦА.split("onSent={показатьПодпискуПослеОтзыва}").length - 1).toBe(2);
  });
});
