import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * 🔴 Замер 31.08.2026, воспроизведён НА ПРОДЕ: движок Stockfish не
 * инициализируется вовсе. В воркер уходит одно сообщение «uci», после чего он
 * падает с «e.trim is not a function» внутри собственного кода
 * (stockfish-18-lite.js:11). Контроль: чистый воркер на той же странице, без
 * нашей обёртки, падает точно так же — значит дело не в нашем коде; и вторая
 * сборка (stockfish-classic.js) падает тем же классом ошибки.
 *
 * Следствия, каждое проверено:
 *   ready() никогда не становится true;
 *   разбор партии после её конца не запускается — это блокер запуска;
 *   сильные уровни соперника молча играют запасным выбором.
 *
 * Починку самого движка здесь НЕ делаю: это переподключение сторонней
 * WASM-сборки, и мои опыты с фабрикой дошли до инициализации модуля, но не до
 * рабочего интерфейса. Здесь закрепляю ДРУГОЕ: провал перестал быть молчаливым.
 */

const KOD = () => readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");

describe("поломка движка видна, а не проглочена", () => {
  it("ошибка воркера пишется, а не гасится молча", () => {
    const s = KOD();
    expect(s.length).toBeGreaterThan(100000); // контроль: файл прочитан
    // Раньше было ровно: onerror = e => { e.preventDefault(); } и всё.
    expect(s).not.toContain("this.w.onerror=e=>{e.preventDefault();};");
    expect(s).toContain('console.warn("[CyberChess] движок Stockfish не поднялся:"');
  });

  it("состояние поломки где-то живёт, а не исчезает в обработчике", () => {
    const s = KOD();
    expect(s).toContain("oshibka:string|null=null;");
    expect(s).toContain("this.ok=false;this.oshibka=");
  });

  it("полоса состояния не называет движок, которого нет", () => {
    // Было useSF={useSF} — а useSF это УРОВЕНЬ соперника, не готовность.
    // Человеку писали «Stockfish думает…», пока ходил запасной выбор.
    const s = KOD();
    expect(s).toContain("useSF={useSF&&sfOk}");
    expect(s).not.toContain("useSF={useSF}");
  });

  it("сам текст про Stockfish в полосе остался — чинили признак, а не надпись", () => {
    // Если бы «починили» удалением слова, проверка выше проходила бы, а
    // человек лишился бы полезной информации в исправном случае.
    const s = KOD();
    expect(s).toContain("Stockfish думает");
  });
});
