import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { bankPuzzleToLocal } from "../daily/dailyPuzzleSource";
import { stripComments } from "./_stripComments";

/* Задача дня существовала в трёх экземплярах, и они расходились молча.
 *
 * 1. Страница `/cyberchess/daily` брала её из десяти зашитых позиций по формуле
 *    `POOL[номер_суток % длина_пула]`.
 * 2. Роутер `cyberchess-daily` брал её той же формулой из пула на 365 записей.
 * 3. Настоящая задача дня, которую показывает виджет на главной, приходит из банка
 *    (`/api/cyberchess-puzzles/daily`) и выбирается общей `pickDailyPuzzle`.
 *
 * Формулы совпадали, длины пулов — нет, поэтому 355 дней из 365 игрок решал одну
 * задачу, а сервер записывал результат против другой. Ничего не падало: обе стороны
 * отвечали успехом. Здесь закреплено, что у страницы остался ОДИН источник — банк,
 * а локальные позиции работают только как резерв.
 */

const PAGE = "src/app/cyberchess/daily/page.tsx";
const SOURCE_MODULE = "src/app/cyberchess/daily/dailyPuzzleSource.ts";
const BACKEND_DAILY = "../aevion-globus-backend/src/routes/cyberchessDaily.ts";

/* Комментарии вырезаем перед поиском: этот файл нарочно описывает прежние дефекты
   своими же словами, и без вырезания сторож ловил бы собственный рассказ о них.
   Проверено мутацией — см. тесты ниже, каждый падает на возвращённом коде. */
const pageSrc = () => stripComments(readFileSync(PAGE, "utf8"));
const sourceSrc = () => stripComments(readFileSync(SOURCE_MODULE, "utf8"));
const backendSrc = () => stripComments(readFileSync(BACKEND_DAILY, "utf8"));

describe("bankPuzzleToLocal", () => {
  const good = {
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1",
    sol: ["f3e5", "c6e5", "c4f7"],
    r: 1240.6,
    theme: "Fork",
  };

  it("переносит запись банка на доску, приводя рейтинг из `r`", () => {
    const p = bankPuzzleToLocal(good);
    expect(p).not.toBeNull();
    expect(p!.fen).toBe(good.fen);
    expect(p!.sol).toEqual(good.sol);
    expect(p!.theme).toBe("Fork");
    // банк хранит рейтинг в `r` и дробным — страница показывает целое
    expect(p!.rating).toBe(1241);
  });

  it("подставляет тему, когда банк её не указал, но не выдумывает рейтинг", () => {
    const p = bankPuzzleToLocal({ ...good, theme: undefined, r: undefined });
    expect(p).not.toBeNull();
    expect(p!.theme).toBe("Тактика");
    /* 0 — это «неизвестно», и страница рисует прочерк. Придумать сюда число значило бы
       показать учащемуся сложность, которой никто не измерял. */
    expect(p!.rating).toBe(0);
  });

  it("отбрасывает запись с непригодной позицией, а не роняет страницу", () => {
    expect(bankPuzzleToLocal({ ...good, fen: "это не FEN" })).toBeNull();
    expect(bankPuzzleToLocal({ ...good, fen: "" })).toBeNull();
    expect(bankPuzzleToLocal(null)).toBeNull();
    expect(bankPuzzleToLocal(undefined)).toBeNull();
  });

  it("отбрасывает запись с испорченным решением целиком", () => {
    expect(bankPuzzleToLocal({ ...good, sol: [] })).toBeNull();
    expect(bankPuzzleToLocal({ ...good, sol: "f3e5" })).toBeNull();
    /* Частично битое решение не «чиним» отбрасыванием плохих ходов: остаток — уже
       другая линия, и игрок получил бы «не тот ход» на правильном ходе. */
    expect(bankPuzzleToLocal({ ...good, sol: ["f3e5", 42, "c4f7"] })).toBeNull();
    expect(bankPuzzleToLocal({ ...good, sol: ["f3e5", "c6", "c4f7"] })).toBeNull();
  });
});

describe("у задачи дня один источник", () => {
  it("страница спрашивает задачу у банка", () => {
    expect(pageSrc()).toMatch(/fetch\(`\$\{API_BANK\}\/daily`\)/);
  });

  it("локальный пул зовётся резервным и выбирается только из него", () => {
    /* Ключевая проверка: единственный выбор «по остатку от номера суток» идёт по
       FALLBACK_POOL. Любой второй такой выбор — это снова два расходящихся ответа. */
    const modPicks = [...(pageSrc() + sourceSrc()).matchAll(
      /(\w+)\[dayIndex\(\)\s*%\s*\1\.length\]/g
    )].map((m) => m[1]);
    expect(modPicks).toEqual(["FALLBACK_POOL"]);
  });

  it("игрок видит, что показана резервная позиция, а не сегодняшняя", () => {
    const src = pageSrc();
    expect(src).toMatch(/puzzleSource === 'fallback'/);
    // и предупреждение — это текст на экране, а не console.warn
    expect(readFileSync(PAGE, "utf8")).toMatch(/Банк задач сейчас недоступен/);
  });
});

describe("на экране нет выдуманных людей и чисел", () => {
  it("страница не генерирует таблицу лидеров", () => {
    const src = pageSrc();
    expect(src).not.toMatch(/mockLeaderboard/);
    /* Math.random() в таблице лидеров означал ровно одно: строки придуманы на месте.
       Никакой другой надобности в случайности на этой странице нет. */
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Magnus|Hikaru|Carlsen/);
  });

  it("сервер не подсаживает выдуманных игроков в пустую таблицу", () => {
    const src = backendSrc();
    expect(src).not.toMatch(/Magnus|Hikaru|Carlsen/);
    expect(src).not.toMatch(/function seedLeaderboard/);
    // и старые посевные строки из файла на диске отбрасываются при чтении
    expect(src).toMatch(/isSeededEntry/);
  });

  it("сервер не раздаёт задачи со сгенерированными темой и рейтингом", () => {
    const src = backendSrc();
    /* 335 задач собирались из 10 позиций, а `theme` и `rating` брались из PRNG и
       приписывались позициям, которых не описывали. Учащемуся показывали «Мат в 2,
       рейтинг 2350» на итальянской партии. */
    expect(src).not.toMatch(/generateProcedural|mulberry32|TEMPLATE_BASES/);
  });
});

describe("решение на этой странице засчитывается", () => {
  it("отмечает выполненным задание «Реши пазл дня»", () => {
    /* Сюда ведут карточка раздела, палитра команд и push-уведомление, а отметку
       ставил только виджет на главной — задание висело невыполненным у того, кто
       пришёл по ссылке. */
    expect(pageSrc()).toMatch(/bumpDaily\(['"]daily-puzzle['"]\)/);
  });

  it("отправляет результат вместе с личностью игрока", () => {
    const src = pageSrc();
    const solve = src.slice(src.indexOf("${API_DAILY}/solve"));
    expect(solve).toMatch(/userId,/);
    /* Без userId бэкенд подставляет 'anonymous' и по собственному правилу
       (`if (uid !== 'anonymous')`) не пускает такую запись в таблицу: результаты
       уходили в общую безымянную кучу. Правило на бэкенде оставлено — проверяем,
       что клиент ему больше не противоречит. */
    expect(backendSrc()).toMatch(/uid !== 'anonymous'/);
    expect(sourceSrc()).toMatch(/localStorage\.getItem\('cyberchess\.userId'\)/);
  });
});
