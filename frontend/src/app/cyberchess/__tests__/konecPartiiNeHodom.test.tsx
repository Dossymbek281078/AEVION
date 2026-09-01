import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";
import PostGameCard from "../PostGameCard";

/**
 * Три дефекта, найденные ОДНОЙ сыгранной партией на боевой сборке 31.08.2026.
 * Я сдался в живой партии и посмотрел, что видит человек:
 *
 *  1. карточка навсегда осталась на «Разбираю партию… через пару секунд»;
 *  2. партия НЕ попала в историю — saveGame зовётся только из обработчика
 *     хода, а сдача, ничья по договорённости и падение флага идут мимо;
 *  3. ссылка на сохранённую партию жила от ПРЕДЫДУЩЕЙ игры, поэтому разбор
 *     новой партии перезаписал бы разбор старой.
 *
 * Ни один из 394 тестов модуля этого не видел: все они проверяют устройство
 * компонентов, а дефект жил в том, чего на пути сдачи НЕТ.
 */

const stranica = () => readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("карточка не обещает разбор бесконечно", () => {
  const dlinnaya = Array.from({ length: 12 }, () => "e4");

  it("сначала честно говорит, что считает", () => {
    render(<PostGameCard hist={dlinnaya} analysis={[]} pCol="w" schitaem />);
    expect(screen.getByText(/Разбираю партию/)).toBeTruthy();
  });

  it("если разбор так и не пришёл — говорит об этом, а не ждёт вечно", () => {
    render(<PostGameCard hist={dlinnaya} analysis={[]} pCol="w" schitaem />);
    act(() => { vi.advanceTimersByTime(13000); });
    expect(screen.getByTestId("post-game-card-net-razbora")).toBeTruthy();
    expect(screen.queryByText(/Разбираю партию/)).toBeNull();
    // И называет, что делать дальше, а не просто «не получилось».
    expect(screen.getByTestId("post-game-card-net-razbora").textContent).toContain("Анализ");
  });

  it("пришедший разбор отменяет ожидание", () => {
    const analysis = dlinnaya.map((_, move) => ({ move, cp: 0, mate: 0, quality: "good", cpLoss: 0 }));
    render(<PostGameCard hist={dlinnaya} analysis={analysis} pCol="w" schitaem />);
    act(() => { vi.advanceTimersByTime(13000); });
    expect(screen.queryByTestId("post-game-card-net-razbora")).toBeNull();
    expect(screen.getByTestId("post-game-card")).toBeTruthy();
  });
});

describe("партия сохраняется на ЛЮБОМ конце, не только ходом", () => {
  it("есть отдельный эффект сохранения по over", () => {
    const s = stranica();
    expect(s.length).toBeGreaterThan(100000); // контроль: файл прочитан
    expect(s).toContain("if(!over||!hist.length||!partiyaIgralasRef.current)return;");
    expect(s).toContain("saveGame(sg);lastSavedGameIdRef.current={id:sg.id,fp:gameStartTimeRef.current};");
  });

  it("сдача и ничья по договорённости существуют как отдельные концы", () => {
    // Если эти строки исчезнут, эффект выше станет не нужен — и тест обязан
    // покраснеть, чтобы никто не убрал его как лишний.
    const s = stranica();
    expect(s).toContain('sOver("You resigned")');
    expect(s).toContain('sOver("Draw agreed")');
  });

  it("загруженная для просмотра партия НЕ сохраняется как новая", () => {
    // 🔴 Поймано вычиткой собственного дифа, а не тестом: sOver(...) ставится
    // и когда партию ЗАГРУЖАЮТ для просмотра (пять мест — восстановление
    // последней, открытие из истории, разбор). Без признака «партия игралась»
    // эффект плодил бы дубль в истории при каждом открытии.
    const s = stranica();
    expect(s).toContain("!partiyaIgralasRef.current)return;");
    // Признак ставится там же, где начинается НАСТОЯЩАЯ партия…
    expect(s).toContain("partiyaIgralasRef.current=true;");
    // …и снимается сразу после записи, чтобы не сохранить дважды.
    expect(s).toContain("partiyaIgralasRef.current=false;");
    // Контроль: мест, где партию загружают под sOver, действительно несколько.
    const zagruzki = (s.match(/sOver\((?:g|last|sg)\.result\)/g) || []).length;
    expect(zagruzki).toBeGreaterThanOrEqual(4);
  });

  it("ссылка на сохранённую партию помнит, ЧЬЯ она", () => {
    const s = stranica();
    // Без отпечатка партии разбор новой игры лёг бы на строку предыдущей.
    expect(s).toContain("useRef<{id:string;fp:number}|null>(null)");
    const svеrok = (s.match(/zap\.fp===gameStartTimeRef\.current/g) || []).length;
    expect(svеrok).toBe(2); // перед сохранением И перед дозаписью разбора
  });
});
