// 🔴 16.10.2026: после партии и после зачтённой задачи дня первым идёт отзыв, окно подписки на
// запуск — после «Отправить» или после закрытия плашки/панели. Решение оркестратора по данным
// (скан журнала событий за 7 дней): waitlist_submit source=cyberchess-game-over — 0, source=…-daily-solved — 0;
// живых концов партии 1 из 26, живых зачётов задачи дня 0 из 1 (остальное — пробы).
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

  it("не ждёт (уже показывали / повод не наш) — окна нет ни при каких условиях", () => {
    expect(podpiskaPora({ ждёт: false, otzyvOtpravlen: true, plashkaOtkryta: true })).toBe(false);
    expect(podpiskaPora({ ждёт: false, otzyvOtpravlen: false, plashkaOtkryta: false })).toBe(false);
  });

  it("🔴 страница: таймеров 2,2 с (партия) и 1,4 с (задача дня) больше нет, повод ждёт в ref", () => {
    expect(СТРАНИЦА).not.toContain('sShowWaitlist(true);try{localStorage.setItem("aevion_chess_waitlist_seen","1")}catch{}},2200)');
    expect(СТРАНИЦА).not.toContain('sShowWaitlist(true);try{localStorage.setItem("aevion_chess_waitlist_seen","1")}catch{}},1400)');
    expect(СТРАНИЦА).toContain('подпискаЖдётОтзываRef.current="game-over";sПодпискаТик(t=>t+1);\n  },[over]);');
    expect(СТРАНИЦА).toContain('подпискаЖдётОтзываRef.current="daily-solved";sПодпискаТик(t=>t+1);');
  });

  it("страница: показ — один раз (ref сбрасывается), повод из ref, отметка «один раз на устройство»", () => {
    const i = СТРАНИЦА.indexOf("const показатьПодпискуПослеОтзыва=()=>{");
    expect(i).toBeGreaterThan(0);
    const тело = СТРАНИЦА.slice(i, СТРАНИЦА.indexOf("\n", i));
    expect(тело).toContain("const повод=подпискаЖдётОтзываRef.current;if(!повод)return;подпискаЖдётОтзываRef.current=null;sПоводПодписки(повод);sShowWaitlist(true);");
    expect(тело).toContain('localStorage.setItem("aevion_chess_waitlist_seen","1")');
  });

  it("страница: «плашка открыта» — те же условия, что у плашки после партии и у панели «Решено!»; отправка отзыва зовёт показ в трёх местах", () => {
    expect(СТРАНИЦА).toContain('const плашкаСОтзывомОткрыта=(!!over&&!setup&&tab==="play"&&!showGameOver)||((зашёлЗаЗадачей||этоЗадачаДня)&&pzAttempt==="correct"&&!!pzCurrent&&pzMode!=="rush");');
    expect(СТРАНИЦА).toContain("podpiskaPora({ждёт:!!подпискаЖдётОтзываRef.current,otzyvOtpravlen:false,plashkaOtkryta:плашкаСОтзывомОткрыта})");
    expect(СТРАНИЦА).toContain('{over&&!setup&&tab==="play"&&!showGameOver&&(()=>{'); // условие плашки
    // панель «Решено!» — и по ссылке, и для задачи дня из монолита (замер 16.10: на пути задачи дня не было ни панели, ни поля)
    expect(СТРАНИЦА).toContain('{(зашёлЗаЗадачей||этоЗадачаДня)&&pzAttempt==="correct"&&pzCurrent&&pzMode!=="rush"&&<div data-cc-resheno="1"'); // условие панели
    expect(СТРАНИЦА.split("onSent={показатьПодпискуПослеОтзыва}").length - 1).toBe(3); // плашка, окно «Итог», панель «Решено!»
    // автоперехода после задачи дня нет — иначе панель живёт 1,1 с и доска уже показывает другую задачу
    const a = СТРАНИЦА.indexOf('if((зашёлЗаЗадачей||этоЗадачаДня)&&pzMode!=="rush")return;');
    expect(a, "автопереход выключен и для задачи дня").toBeGreaterThan(0);
    expect(СТРАНИЦА.slice(a, a + 200)).toContain('const delay=pzMode==="rush"?550');
  });
});
