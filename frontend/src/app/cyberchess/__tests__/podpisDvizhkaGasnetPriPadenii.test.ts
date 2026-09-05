import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bezKommentariev } from "./bezKommentariev";

/**
 * Подпись «Движок: Stockfish 18 · d22» зависит от флага sfOk. Флаг включался
 * ОДИН раз — опросом `ready()` — и обратно не выключался никогда.
 *
 * Значит движок, умерший ПОСЛЕ старта (на телефоне это чаще всего нехватка
 * памяти под hash в 1024 МБ), оставлял на экране уверенное имя движка, пока
 * ход считал запасной расчёт. Это тот же класс, что зелёная точка «в эфире»
 * при оборванном потоке: индикатор переживает то, о чём сообщает.
 *
 * Здесь закрепляется СВЯЗЬ: падение воркера обязано доходить до экрана.
 */
const код = bezKommentariev(readFileSync(join(__dirname, "..", "page.tsx"), "utf8"));

describe("подпись движка гаснет, когда движок падает", () => {
  it("класс движка умеет сообщать наружу о смене состояния", () => {
    expect(код).toContain("naSostoyanie");
  });

  it("падение воркера сообщается наружу, а не только внутрь класса", () => {
    // важно именно СОСЕДСТВО: this.ok=false без вызова наружу — прежнее поведение
    expect(код).toContain("this.ok=false;this.naSostoyanie?.(false)");
  });

  it("удачный старт тоже сообщается — иначе подписка бесполезна", () => {
    expect(код).toContain("this.ok=true;this.naSostoyanie?.(true)");
  });

  it("страница подписывается на состояние ДО запуска движка", () => {
    const i = код.indexOf("s.naSostoyanie=");
    const j = код.indexOf("s.init()", i);
    expect(i).toBeGreaterThan(0);
    // init() идёт ПОСЛЕ подписки: иначе uciok может прийти раньше, чем мы слушаем
    expect(j).toBeGreaterThan(i);
  });

  it("подпись по-прежнему зависит от флага, а не от намерения", () => {
    expect(код).toContain("sfOk?\"Stockfish 18");
    expect(код).toContain("не запустился");
  });
});
