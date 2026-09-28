import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DEVHUB_DICT } from "../i18n";

/**
 * Согласие на удаление покрывает то, что удаляется на самом деле.
 *
 * Замер 28.08.2026. Диалог спрашивал «Удалить проект и все его файлы?» — про
 * файлы. А сервер при удалении проекта СНАЧАЛА сносит выданную ему базу
 * Postgres со всеми данными приложения (и отказывается удалять проект, если
 * снести базу не удалось, чтобы не оставить схему сиротой).
 *
 * То есть человек соглашался потерять файлы, а терял ещё и данные — то, что
 * для работающего приложения дороже файлов. Действие необратимое, переспросить
 * потом не у кого.
 *
 * Сторож связывает ДВЕ стороны: пока в удалении на сервере есть снос базы,
 * текст согласия обязан её называть. Уберут снос — правило само перестанет
 * требовать упоминания, и это правильно: тогда согласие не должно пугать тем,
 * чего не происходит.
 */

const BACKEND = path.join(
  __dirname, "..", "..", "..", "..", "..",
  "aevion-globus-backend", "src", "routes", "devhub.ts",
);

/** Сносит ли серверное удаление проекта его базу. */
function deleteDropsDatabase(): boolean {
  const src = fs.readFileSync(BACKEND, "utf8");
  const start = src.indexOf('devhubRouter.delete("/projects/:id"');
  expect(start, "обработчик удаления не найден — сторож смотрит не туда").toBeGreaterThan(-1);
  const body = src.slice(start, start + 3000);
  return /deprovision|dropDatabase|databaseDropped/.test(body);
}

/** Слова, которыми в каждом языке названа база данных. */
const DB_WORDS: Record<string, string[]> = {
  en: ["database"],
  ru: ["база", "базу", "базы"],
  kk: ["дерекқор"],
};

describe("удаление: согласие честно называет потерю", () => {
  test("прибор работает: обработчик найден и словарь прочитан", () => {
    expect(fs.existsSync(BACKEND), "исходник бэкенда не найден — сверять не с чем").toBe(true);
    for (const lang of Object.keys(DB_WORDS)) {
      expect(DEVHUB_DICT[lang]?.["proj.confirmDelete"], `нет текста согласия для ${lang}`).toBeTruthy();
    }
  });

  test("сервер действительно сносит базу — иначе правило ни к чему", () => {
    // Проверка направления: если снос уберут, этот тест покраснеет и правило
    // ниже нужно будет снять, а не наоборот.
    expect(deleteDropsDatabase(), "снос базы исчез — требование к тексту пора пересмотреть").toBe(true);
  });

  test("во всех трёх языках согласие называет базу", () => {
    const bad: string[] = [];
    for (const [lang, words] of Object.entries(DB_WORDS)) {
      const text = String(DEVHUB_DICT[lang]?.["proj.confirmDelete"] ?? "").toLowerCase();
      if (!words.some((w) => text.includes(w.toLowerCase()))) bad.push(`${lang}: «${text}»`);
    }
    expect(bad, "согласие не называет базу, а сервер её сносит").toEqual([]);
  });

  test("и говорит, что вернуть нельзя", () => {
    // «Удалить?» без «безвозвратно» человек читает как обратимое действие.
    const marks: Record<string, string[]> = {
      en: ["for good", "permanently", "cannot be undone"],
      ru: ["нельзя", "безвозврат"],
      kk: ["қайтарымсыз"],
    };
    const bad: string[] = [];
    for (const [lang, words] of Object.entries(marks)) {
      const text = String(DEVHUB_DICT[lang]?.["proj.confirmDelete"] ?? "").toLowerCase();
      if (!words.some((w) => text.includes(w))) bad.push(lang);
    }
    expect(bad, "согласие не говорит о необратимости").toEqual([]);
  });
  /*
   * 28.09.2026: уборка появилась — и сторож сработал ровно как задумывал автор.
   * Раньше согласие обязано было ОГОВАРИВАТЬ, что сайт остаётся жить (уборки не
   * было вовсе). Теперь удаление проекта снимает и Pages-проект, поэтому та
   * оговорка стала бы ложью. Проверка осталась двусторонней: она смотрит на КОД
   * бэкенда и требует тот текст, который ему соответствует. Уберут уборку —
   * покраснеет снова и потребует вернуть оговорку.
   */
  const убираетСайтНаСервере = () => {
    const бэкенд = fs.readFileSync(BACKEND, "utf8");
    return /pages\/projects\/[^`"']*`?,\s*\{\s*method:\s*"DELETE"/.test(бэкенд)
      || /deletePagesProject/.test(бэкенд)
      || /pagesRemoved/.test(бэкенд);
  };

  test("текст про сайт соответствует тому, что делает сервер", () => {
    const убирает = убираетСайтНаСервере();
    const обещаетСнятие: Record<string, RegExp> = {
      ru: /опубликованный сайт|публичный адрес перестанет/i,
      en: /site you published|published address stops/i,
      kk: /жарияланған сайт/i,
    };
    const обещаетСохранение: Record<string, RegExp> = {
      ru: /сайт[^.]*остаётся/i,
      en: /stays live/i,
      kk: /қолжетімді болып қала береді/i,
    };
    const ожидаемые = убирает ? обещаетСнятие : обещаетСохранение;
    const запрещённые = убирает ? обещаетСохранение : обещаетСнятие;
    for (const [lang, re] of Object.entries(ожидаемые)) {
      const текст = DEVHUB_DICT[lang]?.["proj.confirmDelete"] ?? "";
      expect(
        re.test(текст),
        убирает
          ? `сервер снимает сайт, а согласие на ${lang} об этом молчит: ${текст.slice(0, 140)}`
          : `сервер сайт НЕ снимает, а согласие на ${lang} не оговаривает это: ${текст.slice(0, 140)}`,
      ).toBe(true);
    }
    for (const [lang, re] of Object.entries(запрещённые)) {
      const текст = DEVHUB_DICT[lang]?.["proj.confirmDelete"] ?? "";
      expect(re.test(текст), `согласие на ${lang} говорит обратное тому, что делает сервер`).toBe(false);
    }
  });

  test("прибор двусторонний: на сегодня сервер сайт СНИМАЕТ", () => {
    // Контроль направления. Если однажды ответ станет false, предыдущий тест
    // начнёт требовать оговорку «сайт остаётся» — и это правильно.
    expect(убираетСайтНаСервере()).toBe(true);
  });
});
