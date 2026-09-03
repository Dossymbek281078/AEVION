import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Английские подписи в атрибутах на РУССКОЯЗЫЧНЫХ страницах не растут.
 *
 * Парный сторож к attrI18n: тот ловит кириллицу в атрибутах на ПЕРЕВОДИМЫХ
 * страницах (там текст обязан идти через словарь). Здесь обратный вопрос и
 * другая половина сайта: страница одноязычная, говорит по-русски, а подсказка
 * поля, имя для читалки или всплывающий текст остались английскими.
 *
 * Почему это не косметика. Подсказка исчезает при вводе — поле становится
 * безымянным ровно тогда, когда в нём работают. Имя для читалки диктор
 * произносит вслух: 02.09.2026 в QVenture на экране стояло «Валовая маржа (%)»,
 * а диктору уходило «Gross margin (%)» — видимое и озвучиваемое РАСХОДИЛИСЬ.
 *
 * Замер 02.09.2026: 65 файлов, 381 случай. Ни один языковой сторож их не видел —
 * все читают текст МЕЖДУ тегами, то есть одну форму записи из четырёх. Нашлось
 * не ими, а утренним обходом доступности по проду.
 *
 * ПОЧЕМУ ХРАПОВИК, А НЕ ЗАПРЕТ. Свип по 65 чужим файлам создал бы конфликтов
 * больше, чем чинит, а сторож, красный с первого дня, перестают читать за
 * неделю. Здесь заморожено ровно сегодняшнее число по каждому файлу: новое
 * английское значение краснеет, старое ждёт хозяина модуля.
 *
 * 🔴 ЧЕМ ЧИНИТЬ — ЗАВИСИТ ОТ СТРАНИЦЫ, и подмена дорого стоит.
 *
 * Если файл переводится словарём (есть вызовы `t("` — проверять шаблоном С
 * ГРАНИЦЕЙ СЛОВА, иначе `format("` и `at("` дадут ложные десятки), то
 * английскую подпись надо заменить на `t("ключ")`, а НЕ на русский текст:
 * жёстко вписанный русский ломает остальные языки, и парный сторож attrI18n
 * справедливо покраснеет. На одноязычной странице наоборот — русский текст
 * прямо в коде и есть правильный ответ.
 *
 * Замер 02.09.2026 по devhub: рабочее окно и выкатка словаря НЕ используют
 * (0 вызовов), а витрина и страница ссылки используют (55 и 14). Один модуль,
 * два разных правильных ответа.
 *
 * База может только УМЕНЬШАТЬСЯ. Починили — уменьшите число; иначе сторож
 * навсегда останется слепым к тому, что вы уже исправили.
 */

const KOREN = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BAZA = join(dirname(fileURLToPath(import.meta.url)), "englishAttrs.baseline.json");

const ATRIBUTY = ["placeholder", "aria-label", "title", "alt"];

/**
 * Латиница по природе: адреса почты, домены, пути, имена переменных и
 * идентификаторы. Их «перевод» сделал бы интерфейс ХУЖЕ, а не лучше —
 * на этом я и споткнулся 02.09, чуть не переведя you@example.com.
 * Поэтому одного «нет кириллицы» мало: нужны латинские БУКВЫ и пробел
 * (то есть похоже на фразу, а не на идентификатор).
 */
// Термины, которые в русской речи НЕ переводят. Список короткий намеренно:
// длинный превращает сторожа в решето, а «перевод» термина делает текст хуже.
const TERMINY = new Set(["ARR (USD)", "LTV / CAC", "saveAs (path)"]);

function poPrirodeLatinica(v: string): boolean {
  if (v.includes("@")) return true;
  // Значение без пробела — идентификатор, а не фраза: welcome-v1, KEY, src/x.tsx.
  // Фраза для человека почти всегда содержит пробел, и это надёжнее списка форм.
  if (!v.includes(" ")) return true;
  return false;
}

// Третья форма той же подписи: значение приходит в атрибут ЧЕРЕЗ ОБЪЕКТ.
// `title={tag.title}` в разметке безупречен, а английский текст лежит рядом
// в `title: "..."`. Замер 02.09.2026: только в двух моих модулях так пряталось
// 33 строки. Храповик, считающий одни атрибуты, давал бы ложное спокойствие.
const SVOJSTVA = ["text", "title", "label", "hint", "note"];

function angliyskie(src: string): string[] {
  const out: string[] = [];
  for (const at of [...ATRIBUTY.map((x) => x + '="'), ...SVOJSTVA.map((x) => x + ': "')]) {
    const nachalo = at; // уже с разделителем: `x="` либо `x: "`
    let i = 0;
    for (;;) {
      i = src.indexOf(nachalo, i);
      if (i < 0) break;
      const j = src.indexOf('"', i + nachalo.length);
      if (j < 0) break;
      const v = src.slice(i + nachalo.length, j).trim();
      i = j + 1;
      if (!v) continue;
      // Обрамление «напр.: » оставляет английский образец промта намеренно:
      // модели ИИ работают с английским лучше, и русский пример увёл бы
      // человека к худшему результату. Интерфейс при этом говорит по-русски.
      if (v.startsWith("напр.: ")) continue;
      if (!/[A-Za-z]/.test(v) || /[А-ЯЁа-яё]/.test(v)) continue;
      // Цветовые коды — не текст: извлекатель принимал #fef3c7 за подпись.
      if (v.startsWith("#")) continue;
      if (TERMINY.has(v) || poPrirodeLatinica(v)) continue;
      out.push(v);
    }
  }
  return out;
}

/*
 * ВНУТРЕННИЕ ЭКРАНЫ ИСКЛЮЧЕНЫ НАМЕРЕННО.
 *
 * Замысел сторожа — про ПОСЕТИТЕЛЯ: русскоязычная страница, а подпись поля или
 * имя для читалки остались английскими. Админка и обозреватель API — не для
 * посетителя, там английские подписи норма, а не долг.
 *
 * Записано 03.09.2026 по решению автора сторожа. Не расширять охват «для
 * полноты»: тогда проверка станет вечно красной, и её отключат — а это хуже,
 * чем узкая, но живая.
 */
const ВНУТРЕННИЕ = new Set(["admin", "api-explorer"]);

function fajly(d: string, out: string[] = []): string[] {
  for (const e of readdirSync(d)) {
    if (e === "node_modules" || e === "__tests__") continue;
    if (ВНУТРЕННИЕ.has(e)) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) fajly(p, out);
    else if (p.endsWith(".tsx") || p.endsWith(".ts")) out.push(p);
  }
  return out;
}

function schitat(): Record<string, number> {
  const itog: Record<string, number> = {};
  for (const p of fajly(KOREN)) {
    const src = readFileSync(p, "utf8");
    // Страница считается русскоязычной по подписи между тегами. Грубо, но
    // осознанно: без этого условия в выборку попадут английские страницы,
    // где английский атрибут ПРАВИЛЕН, и сторож стал бы машиной лжи.
    if (!/>[^<]*[А-Яа-я]{4}/.test(src)) continue;
    const n = angliyskie(src).length;
    if (n) itog[relative(KOREN, p).split("\\").join("/")] = n;
  }
  return itog;
}

describe("английские подписи в атрибутах не растут", () => {
  it("прибор исправен: файлы найдены и разбор что-то видит", () => {
    const vsego = fajly(KOREN).length;
    expect(vsego, "исходники не найдены — сторож обнулился бы молча").toBeGreaterThan(200);
    // Положительный контроль на самом разборе: он ОБЯЗАН находить английское
    // и ОБЯЗАН пропускать русское и латиницу по природе. Без этой пары ноль
    // от свипа неотличим от «не умею искать».
    expect(angliyskie('placeholder="Short description"')).toEqual(["Short description"]);
    expect(angliyskie('placeholder="Краткое описание"')).toEqual([]);
    expect(angliyskie('placeholder="you@example.com"')).toEqual([]);
    expect(angliyskie('placeholder="напр.: A futuristic city"')).toEqual([]);
    // Контроль на КАЖДУЮ форму записи отдельно. У храповика уменьшение охвата
    // выглядит как прогресс: числа падают, проверка зелёная. Мутация «убрать
    // список свойств» проходила молча, пока этой строки не было.
    expect(angliyskie('title: "Describe the deal"')).toEqual(["Describe the deal"]);
    expect(angliyskie('text: "#fef3c7"')).toEqual([]);
  });

  it("ни в одном файле их не стало больше", () => {
    const sejchas = schitat();
    if (!existsSync(BAZA)) {
      writeFileSync(BAZA, JSON.stringify(sejchas, null, 2) + String.fromCharCode(10), "utf8");
      throw new Error("база создана — просмотрите englishAttrs.baseline.json и закоммитьте");
    }
    const baza: Record<string, number> = JSON.parse(readFileSync(BAZA, "utf8"));
    const vyrosli: string[] = [];
    for (const [f, n] of Object.entries(sejchas)) {
      const bylo = baza[f] ?? 0;
      if (n > bylo) vyrosli.push(f + ": было " + bylo + ", стало " + n);
    }
    expect(
      vyrosli,
      "новая английская подсказка на русском экране: она исчезнет при вводе, и поле останется без имени",
    ).toEqual([]);
  });
});
