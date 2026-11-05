import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COACH_PANEL_SLOVA } from "../p/coachPanelSlova";
import { tFor } from "../i18n";
import { detectPhase, PHASE_TIPS } from "../coachPhase";
import { VARIANTS } from "../variants";

/*
 * 4.11.2026: на английской /cyberchess панели тренера, анализа и «Дневных целей» были русскими
 * литералами (живой скан прода: 77 + 23 + 15 строк). Теперь всё через словарь cpn.* (p/coachPanelSlova.ts).
 * Сторож: у каждой вынесенной строки есть en и kk без кириллицы в en, а в коде компонентов русского литерала нет.
 */
const КОРЕНЬ = join(process.cwd(), "src/app/cyberchess");
const читать = (f: string) => readFileSync(join(КОРЕНЬ, f), "utf8");
const КИР = /[А-Яа-яЁё]/;

// Русские строки живого скана (видимый текст), которые вынесены в словарь. Многоточия скана — обрезка, берём целые из словаря.
const ВЫНЕСЕНО: Array<[string, string]> = [
  ["cpn.ai.label", "ИИ-коуч:"], ["cpn.off", "выкл"], ["cpn.rep.title", "Мой дебютный репертуар"],
  ["cpn.rep.empty", "Сохрани свои дебютные линии — Коуч будет подсказывать «в дебюте / вне дебюта» во время игры."],
  ["cpn.rep.open", "📖 Открыть репертуар (R)"], ["cpn.chat.title", "Спроси тренера — разговор с ИИ-тренером"],
  ["cpn.q.0", "Что в этой позиции? Объясни сильные и слабые стороны."], ["cpn.q.1", "Какой план мне сейчас играть?"],
  ["cpn.q.2", "Где моя последняя ошибка и как её надо было сыграть?"], ["cpn.q.3", "Какой дебют я играю и какие типичные планы в нём?"],
  ["cpn.q.4", "Объясни последний ход соперника — почему он его сделал?"], ["cpn.q.5", "Какие тактические возможности есть в позиции?"],
  ["cpn.q.6", "Как улучшить мою активность фигур?"], ["cpn.q.7", "Чему меня учит эта партия?"], ["cpn.chat.ask", "Спросить"],
  ["cpn.chat.hint", "💡 Тренер видит вашу позицию, последние ходы и оценку — спрашивайте про план, ошибку или дебют, ответ будет про эту партию, а не общими словами. Отвечает за несколько секунд."],
  ["cpn.how", "🎓 Как учимся"], ["cpn.mode.ai", "Против ИИ"], ["cpn.mode.ai.sub", "играй с ботом, тренер комментирует"],
  ["cpn.mode.both", "За обоих"], ["cpn.mode.both.sub", "двигай сам обе стороны"], ["cpn.mode.import", "Импорт"],
  ["cpn.mode.import.sub", "PGN / FEN / расстановка"], ["cpn.mode.puz", "Из задач"], ["cpn.mode.puz.sub", "активная задача"],
  ["cpn.mode.lib", "Библиотека"], ["cpn.mode.lib.sub", "твои партии"], ["cpn.mode.end", "Эндшпили"],
  ["cpn.load", "📥 Загрузить позицию"], ["cpn.start", "🆕 Начальная"], ["cpn.last", "📜 Последняя партия"],
  ["cpn.curpz", "🧩 Текущая задача"], ["cpn.pgnfile", "📁 PGN файл"], ["cpn.manual", "✏️ Расставить вручную"],
  ["cpn.kb", "📚 База знаний"], ["cpn.flash", "🃏 Флеш-карточки"], ["cpn.cmode", "Режим тренера:"],
  ["cpn.cmode.review", "🤖 ИИ-разбор"], ["cpn.cmode.free", "✏️ Свободно"], ["cpn.editor.setup", "Расстановка фигур"],
  ["cpn.editor.open", "✏️ Открыть"], ["cpn.phase.title", "Фаза партии"], ["cpn.phase.opening", "Дебют"],
  ["cpn.reason.openingN", "ход {n}, фигуры ещё развиваются"], ["cpn.principles", "▾ Принципы для этой стадии ({n})"],
  ["cpn.tip.opening.0.t", "Контролируй центр"], ["cpn.tip.opening.1.t", "Развивай фигуры"],
  ["cpn.tip.opening.2.t", "Рокируй как можно раньше"], ["cpn.tip.opening.3.t", "Не выводи ферзя рано"],
  ["cpn.tip.opening.4.t", "Не хапай пешки центральными фигурами"], ["cpn.tip.opening.5.t", "Соединяй ладьи"],
  ["cpn.pip.on", "Включить"], ["cpn.banner.title", "Проекты АЕВИОН"], ["cpn.banner.bureau", "Патентное Бюро"],
  ["cpn.banner.bureau.tag", "IP · Патенты"], ["cpn.banner.build.tag", "Строительство"], ["cpn.banner.qright.tag", "Авторские права"],
  ["cpn.banner.shield", "Крайт / QShield"], ["cpn.banner.shield.tag", "Кибербезопасность"], ["cpn.banner.qsign", "Ксайн / QSign"],
  ["cpn.banner.qsign.tag", "Электр. подписи"], ["cpn.banner.sub", "CyberChess подписка"], ["cpn.banner.plans", "Все тарифы →"],
  // вкладка «Анализ»
  ["cpn.book.title", "📚 Дебютная база · мастера"], ["cpn.hide", "скрыть"],
  ["cpn.book.orig", "Позиция оригинальная — в мастерской базе нет партий."],
  ["cpn.an.empty", "Загрузи PGN/FEN или введи ходы"], ["cpn.src", "📥 Источник позиции"], ["cpn.archive", "📚 Архив ({n})"],
  ["cpn.randpz", "🎲 Случайная задача"], ["cpn.daily", "☀ Задача дня"], ["cpn.randend", "🏰 Случайный этюд"],
  ["cpn.randop", "♞ Случайный дебют"], ["cpn.pgntext", "📋 PGN текст"], ["cpn.pos", "✎ Позиция"],
  ["cpn.engine", "⚡ Анализ движком"], ["cpn.engine.loading", "загружается"],
  // вкладка «Задачи»
  ["cpn.dm.title", "Дневные цели"], ["cpn.dm.earn", "Сегодня можно заработать +{n} Chessy"], ["cpn.dm.m.puzzles3", "Реши 3 задачи"],
  ["cpn.dm.c.puzzles3", "К задачам"], ["cpn.dm.m.game1", "Сыграй партию"], ["cpn.dm.c.game1", "Играть"],
  ["cpn.dm.m.daily", "Реши задачу дня"], ["cpn.dm.c.daily", "Открыть"], ["cpn.dm.m.coach", "Спроси тренера"],
  ["cpn.dm.c.coach", "К тренеру"], ["cpn.sess.streak", "Серия"], ["cpn.diff.hard", "Сложная"],
  ["cpn.pip.ask", "Включить стрим любимого стримера к варианту дня?"], ["cpn.var.kingofthehill", "Царь горы"],
];

const КОМПОНЕНТЫ = ["page.tsx", "coachPhase.ts", "DailyMission.tsx", "AevionProjectsBanner.tsx"];

describe("английская панель тренера/анализа/задач без кириллицы", () => {
  it("каждая вынесенная строка: ru как было, en/kk непустые, в en нет кириллицы", () => {
    for (const [k, ru] of ВЫНЕСЕНО) {
      expect(COACH_PANEL_SLOVA.ru[k], `ru ${k}`).toBe(ru);
      expect(COACH_PANEL_SLOVA.en[k]?.trim(), `en ${k}`).toBeTruthy();
      expect(COACH_PANEL_SLOVA.kk[k]?.trim(), `kk ${k}`).toBeTruthy();
      expect(COACH_PANEL_SLOVA.en[k], `en без кириллицы ${k}`).not.toMatch(КИР);
    }
  });

  it("наборы ключей ru/en/kk совпадают и все en без кириллицы", () => {
    const ru = Object.keys(COACH_PANEL_SLOVA.ru).sort();
    expect(Object.keys(COACH_PANEL_SLOVA.en).sort()).toEqual(ru);
    expect(Object.keys(COACH_PANEL_SLOVA.kk).sort()).toEqual(ru);
    expect(ru.length).toBeGreaterThan(150);
    for (const k of ru) expect(COACH_PANEL_SLOVA.en[k], k).not.toMatch(КИР);
  });

  it("словарь i18n отдаёт en-значения (подключён spread)", () => {
    expect(tFor("en", "cpn.how")).toBe(COACH_PANEL_SLOVA.en["cpn.how"]);
    expect(tFor("kk", "cpn.how")).toBe(COACH_PANEL_SLOVA.kk["cpn.how"]);
    expect(tFor("ru", "cpn.how")).toBe("🎓 Как учимся");
  });

  it("в коде компонентов вынесенных русских литералов нет", () => {
    const безКомм = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const исходники = КОМПОНЕНТЫ.map((f) => [f, безКомм(читать(f))] as const);
    const нашлись: string[] = [];
    // короткие слова, которые законно встречаются в других местах страницы (другие экраны, не вынесенные сюда)
    const ОБЩИЕ = new Set(["cpn.off", "cpn.phase.opening", "cpn.daily", "cpn.dm.m.game1", "cpn.dm.c.game1", "cpn.dm.c.daily", "cpn.sess.streak"]);
    for (const [k, ru] of ВЫНЕСЕНО) {
      if (ОБЩИЕ.has(k)) continue;
      // целый литерал: от кавычки/скобки тега до кавычки/тега — подстрока чужого текста (тост, комментарий) не считается
      const экр = ru.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const lit = new RegExp("([\"'`>]|\\n\\s*)" + экр + "([\"'`<]|\\s*\\n)");
      for (const [f, src] of исходники) if (lit.test(src)) нашлись.push(f + ": " + k);
    }
    expect(нашлись).toEqual([]);
  });

  it("coachPhase.ts: кириллицы вне комментариев нет", () => {
    const без = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(без(читать("coachPhase.ts"))).not.toMatch(КИР);
  });

  it("фазы: у каждой стадии есть ключи заголовка, вступления и всех принципов на en", () => {
    for (const ph of ["opening", "middlegame", "endgame"] as const) {
      expect(COACH_PANEL_SLOVA.en[`cpn.phase.${ph}`]).toBeTruthy();
      expect(COACH_PANEL_SLOVA.en[`cpn.intro.${ph}`]).toBeTruthy();
      PHASE_TIPS[ph].tips.forEach((_, i) => {
        expect(COACH_PANEL_SLOVA.en[`cpn.tip.${ph}.${i}.t`], `${ph} ${i} t`).toBeTruthy();
        expect(COACH_PANEL_SLOVA.en[`cpn.tip.${ph}.${i}.b`], `${ph} ${i} b`).toBeTruthy();
      });
    }
    const d = detectPhase("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", 2);
    expect(d.phase).toBe("opening");
    expect(COACH_PANEL_SLOVA.en[d.reasonKey]).toBeTruthy();
  });

  // Ключи, собираемые из частей (cpn.phase./intro./tip./var./dm.*): сторож everyCalledKeyExists их не видит — перебор здесь.
  it("собираемые ключи есть на всех трёх языках", () => {
    const ключи: string[] = [];
    for (const ph of ["opening", "middlegame", "endgame"] as const) {
      ключи.push(`cpn.phase.${ph}`, `cpn.intro.${ph}`);
      PHASE_TIPS[ph].tips.forEach((_, i) => ключи.push(`cpn.tip.${ph}.${i}.t`, `cpn.tip.${ph}.${i}.b`));
    }
    expect(VARIANTS.length, "варианты не прочитаны").toBeGreaterThan(5);
    for (const v of VARIANTS) ключи.push(`cpn.var.${v.id}`);
    for (const id of ["puzzles3", "game1", "daily", "coach"]) ключи.push(`cpn.dm.m.${id}`, `cpn.dm.c.${id}`);
    for (const я of ["ru", "en", "kk"] as const) {
      for (const k of ключи) expect(COACH_PANEL_SLOVA[я][k]?.trim(), `${я} ${k}`).toBeTruthy();
    }
  });

  it("новый словарь не импортируется из page.tsx напрямую (храповик размера)", () => {
    expect(читать("page.tsx")).not.toMatch(/from "\.\/p\/coachPanelSlova"/);
  });
});
