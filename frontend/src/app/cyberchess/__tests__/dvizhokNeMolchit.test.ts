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

    // 06.09.2026 обработка падения вынесена из onerror в метод onDead(): и
    // onerror, и провал незавершённого запроса ведут в одно место. Бережём
    // то же самое — что при смерти движка гасится флаг и запоминается причина,
    // — но теперь ищем это в onDead(), а не в теле onerror.
    const nachalo = s.indexOf("private onDead(");
    const konec = s.indexOf("init(){if(this.w)return;", nachalo);
    expect(nachalo).toBeGreaterThan(0);
    expect(konec).toBeGreaterThan(nachalo);
    const obrabotchik = s.slice(nachalo, konec);
    expect(obrabotchik).toContain("this.ok=false");
    expect(obrabotchik).toContain("this.oshibka=");
    // onerror обязан вести в onDead, а не гасить молча.
    const oe = s.slice(s.indexOf("this.w.onerror="), s.indexOf("this.w.onmessage="));
    expect(oe).toContain("this.onDead(");
  });

  it("мёртвый движок пересоздаётся, а не остаётся дохлым до перезагрузки", () => {
    // 🔴 Замер на проде 06.09.2026: после смены партии/задачи Stockfish иногда
    // падает («e.trim is not a function» в lite-сборке), и раньше init() уже не
    // мог его поднять (`if(this.w)return` при непустом дохлом воркере), а
    // ensureSF — тем более (`if(sfR.current)return`). Сила движка падала на
    // запасной расчёт до КОНЦА сессии, лечила только перезагрузка страницы.
    // Теперь onDead убивает воркер, обнуляет this.w и переинициализирует с
    // ограничением попыток; счётчик обнуляется при удачном uciok.
    const s = KOD();
    const nachalo = s.indexOf("private onDead(");
    const konec = s.indexOf("init(){if(this.w)return;", nachalo);
    const od = s.slice(nachalo, konec);
    expect(od).toContain("this.w?.terminate()");
    expect(od).toContain("this.w=null");
    expect(od).toContain("this.init()");
    expect(od).toContain("this.retries");
    // ограничение попыток есть и оно осмысленное
    expect(s).toMatch(/MAX_RETRIES\s*=\s*[1-9]/);
    // счётчик обнуляется при удачном старте, иначе долгая партия исчерпает бюджет
    const uciok = s.slice(s.indexOf('if(l==="uciok"){'), s.indexOf('this.w!.postMessage("isready")'));
    expect(uciok).toContain("this.retries=0");
    // провал незавершённого запроса, чтобы ход соперника не повис
    expect(od).toContain('cb?.("","")');
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
