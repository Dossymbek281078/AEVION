import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tQ, tQN, labelOf, saveErrorKey, genErrorKey, QMEDIA_KEYS, QMEDIA_DICT } from "../i18n";
import { безКомментариев, мимоСловаря } from "./qmediaTextRules";

/*
 * 29.10.2026 (окно «Приложения»). QMedia говорила смесью языков: на en upload/playlists/likes —
 * по-русски и без h1; на ru/kk витрина, музыка, видео и творческие инструменты — зашитым
 * английским (замер прода yazyk-qmedia-prod-981c-2910.log). Плитка «Music — Stream and create
 * music with AI» обещала то, чего нет: создавать музыку ИИ QMedia не умеет (есть только
 * добавление трека по ссылке и прослушивание). Добавление трека/видео гостем (401) молчало.
 * Здесь: (а) словарь полон на ru/en/kk; (б) в 8 файлах нет текста мимо словаря; (в) обещания
 * «создавать музыку ИИ» нет ни на одном языке; (г) отказ сохранения не молчит;
 * (д) у каждой страницы есть h1.
 */
const SRC = join(process.cwd(), "src");
const ФАЙЛЫ = [
  "app/qmedia/layout.tsx",
  "app/qmedia/page.tsx",
  "app/qmedia/music/page.tsx",
  "app/qmedia/videos/page.tsx",
  "app/qmedia/creative/page.tsx",
  "app/qmedia/upload/page.tsx",
  "app/qmedia/playlists/page.tsx",
  "app/qmedia/likes/page.tsx",
];
const кириллица = /[А-Яа-яЁё]/;

/** kk совпадает с ru намеренно: слово одинаково в обоих языках (термин, заимствование). */
const ОБЩИЕ_RU_KK = new Set<string>([
  "common.genre", // «Жанр»
  "genre.pop", // «Поп»
  "genre.rock", // «Рок»
  "genre.electronic", // «Электроника»
  "genre.jazz", // «Джаз»
  "genre.hip-hop", // «Хип-хоп»
  "genre.folk", // «Фолк»
  "genre.country", // «Кантри»
  "vcat.music-video", // «Клип»
  "type.track", // «трек»
  "hub.music.title", // «Музыка»
  "upload.track", // «🎵 Трек»
  "upload.catalog", // «Каталог»
  "pl.tracks.one", // «{n} трек»
]);

/**
 * Сервер языка страницы не знает: metadata макета остаётся английской (решение Оркестратора
 * 29.10). Это единственная разрешённая строка мимо словаря, и она обязана быть честной.
 */
const РАЗРЕШЕНО_МИМО = [/^export const metadata: Metadata = \{ title: "QMedia", description: "[^"]+" \};$/];

/** Запасной текст латиницей в выражении JSX и описание плитки строкой — тоже мимо словаря. */
function запасноеМимо(l: string): boolean {
  return /(\|\||\?\?)\s*["'`][A-Za-z]{3}/.test(l) || /\b(desc|name):\s*["'`][^"'`]*[A-Za-zА-Яа-яЁё]{3}/.test(l);
}

function код(ф: string): string {
  return безКомментариев(readFileSync(join(SRC, ф), "utf8"));
}

/** Фраза о создании/генерации музыки ИИ на трёх языках. В JS \w — только латиница, для кириллицы — [а-яё]. */
const ОБЕЩАНИЕ_МУЗЫКИ_ИИ = [
  /create\s+music/i,
  /(generate|compose|make)\s+(your\s+own\s+)?music/i,
  /music\s+with\s+AI/i,
  /AI\s+music/i,
  /(созда[а-яё]*|сочин[а-яё]*|генер[а-яё]*)\s+(свою\s+)?музык[а-яё]*/i,
  /музык[а-яё]*\s+с\s+(ИИ|AI)/i,
  /ИИ[- ]музык/i,
  /музыка\s+(жасау|құру|шығару)/i,
  /(ЖИ|AI)\s+(арқылы\s+)?музыка/i,
];

describe("QMedia: ru/en/kk и честные обещания", () => {
  test("у трёх языков все ключи непустые; en без кириллицы; kk не копия ru; ru/kk не английский", () => {
    console.log(`знаменатель: ключей словаря ${QMEDIA_KEYS.length} × 3 языка; файлов ${ФАЙЛЫ.length}`);
    expect(QMEDIA_KEYS.length).toBeGreaterThan(150);
    for (const lang of ["ru", "en", "kk"]) for (const k of QMEDIA_KEYS) expect(QMEDIA_DICT[lang]![k].trim(), `${lang}:${k}`).not.toBe("");
    expect(QMEDIA_KEYS.filter((k) => кириллица.test(QMEDIA_DICT.en![k]))).toEqual([]);
    const копии = QMEDIA_KEYS.filter((k) => QMEDIA_DICT.kk![k] === QMEDIA_DICT.ru![k] && кириллица.test(QMEDIA_DICT.ru![k]));
    expect(копии.filter((k) => !ОБЩИЕ_RU_KK.has(k))).toEqual([]);
    const англ = (lang: string) => QMEDIA_KEYS.filter((k) => QMEDIA_DICT[lang]![k] === QMEDIA_DICT.en![k] && /[A-Za-z]{4,} [A-Za-z]{4,}/.test(QMEDIA_DICT.en![k]));
    expect(англ("ru")).toEqual([]);
    expect(англ("kk")).toEqual([]);
  });

  test("подстановки, множественное число, подписи значений; язык без словаря → en", () => {
    expect(tQ("de", "music.add")).toBe("+ Add track");
    expect(tQ("ru", "creative.copied", { x: "текст песни" })).toBe("Скопировано: текст песни");
    expect(tQN("ru", "pl.tracks", 1)).toBe("1 трек");
    expect(tQN("ru", "pl.tracks", 3)).toBe("3 трека");
    expect(tQN("ru", "pl.tracks", 11)).toBe("11 треков");
    expect(tQN("en", "hub.views", 1)).toBe("1 view");
    expect(tQN("en", "hub.views", 2)).toBe("2 views");
    expect(tQN("kk", "hub.views", 5)).toBe("5 қаралым");
    // подпись жанра переводится, значение — нет; неизвестное значение показывается как пришло
    expect(labelOf("ru", "genre", "hip-hop")).toBe("Хип-хоп");
    expect(labelOf("kk", "vcat", "documentary")).toBe("Деректі");
    expect(labelOf("ru", "mood", "melancholy")).toBe("Грустное");
    expect(labelOf("ru", "genre", "synthwave")).toBe("synthwave");
    // все значения, что страницы шлют на сервер, имеют подпись на трёх языках
    const жанры = ["pop", "rock", "electronic", "classical", "jazz", "hip-hop", "other", "folk", "rnb", "r&b", "country"];
    const категории = ["tutorial", "music-video", "short-film", "shortfilm", "documentary", "live", "other"];
    const настроения = ["upbeat", "melancholy", "romantic", "energetic", "calm", "dark", "hopeful", "happy", "sad"];
    for (const lang of ["ru", "kk"]) {
      for (const g of жанры) expect(labelOf(lang, "genre", g), `${lang}:${g}`).not.toBe(g);
      for (const c of категории) expect(labelOf(lang, "vcat", c), `${lang}:${c}`).toMatch(кириллица);
      for (const m of настроения) expect(labelOf(lang, "mood", m), `${lang}:${m}`).toMatch(кириллица);
    }
  });

  test("🔴 в 8 файлах нет текста мимо словаря (JSX-текст, placeholder, aria-label, title, alt, ошибки, запасной текст)", () => {
    const плохиеВсего: string[] = [];
    let строк = 0;
    for (const ф of ФАЙЛЫ) {
      const строки = код(ф).split(/\r?\n/);
      строк += строки.length;
      for (const l of строки) {
        if (РАЗРЕШЕНО_МИМО.some((r) => r.test(l.trim()))) continue;
        if (мимоСловаря(l) || запасноеМимо(l)) плохиеВсего.push(`${ф}: ${l.trim()}`);
      }
    }
    console.log(`знаменатель: файлов ${ФАЙЛЫ.length}, строк кода ${строк}, нарушений ${плохиеВсего.length}`);
    expect(плохиеВсего).toEqual([]);
  });

  test("прибор видит зашитый текст (контроль на известном ответе)", () => {
    expect(мимоСловаря(`          <p style={{ fontSize: 14 }}>Music, video and creative tools — all in one place.</p>`)).toBe(true);
    expect(мимоСловаря(`        <span className="text-sm font-semibold">Загрузить</span>`)).toBe(true);
    expect(мимоСловаря(`<input placeholder="Title *" />`)).toBe(true);
    expect(запасноеМимо(`{t.artist || "Unknown"} · {t.genre}`)).toBe(true);
    expect(запасноеМимо(`{ icon: "🎵", title: "Music", desc: "Stream and create music with AI" },`)).toBe(true);
    expect(мимоСловаря(`<p>{t("music.empty")}</p>`)).toBe(false);
  });

  test("🔴 нет обещания «создавать музыку ИИ» ни на одном языке — ни в словаре, ни в файлах", () => {
    const тексты = QMEDIA_KEYS.flatMap((k) => ["en", "ru", "kk"].map((lang) => `${lang}:${k}: ${QMEDIA_DICT[lang]![k]}`));
    const вФайлах = ФАЙЛЫ.map((ф) => `${ф}: ${код(ф)}`);
    console.log(`знаменатель: строк словаря ${тексты.length}, файлов ${вФайлах.length}, образцов ${ОБЕЩАНИЕ_МУЗЫКИ_ИИ.length}`);
    const найдено = [...тексты, ...вФайлах].filter((s) => ОБЕЩАНИЕ_МУЗЫКИ_ИИ.some((r) => r.test(s)));
    expect(найдено).toEqual([]);
    // контроль: образцы ловят прежнюю плитку
    expect(ОБЕЩАНИЕ_МУЗЫКИ_ИИ.some((r) => r.test("Stream and create music with AI"))).toBe(true);
    expect(ОБЕЩАНИЕ_МУЗЫКИ_ИИ.some((r) => r.test("Слушайте и создавайте музыку с ИИ"))).toBe(true);
    // плитка «Музыка» говорит правду: слушать и добавлять по ссылке
    expect(tQ("en", "hub.music.desc")).toMatch(/listen/i);
    expect(tQ("en", "hub.music.desc")).toMatch(/by link/i);
  });

  test("🔴 ошибка добавления трека/видео не молчит: ветка !r.ok и текст по статусу", () => {
    expect(saveErrorKey(401)).toBe("err.signIn");
    for (const s of [400, 403, 500, 503]) expect(saveErrorKey(s)).toBe("err.saveFailed");
    expect(tQ("ru", saveErrorKey(401))).toBe("Войдите, чтобы добавить");
    expect(tQ("ru", saveErrorKey(500))).toBe("Не удалось сохранить, попробуйте ещё раз");
    expect(tQ("kk", saveErrorKey(401))).toMatch(кириллица);
    expect(genErrorKey(429)).toBe("err.tooMany");
    expect(genErrorKey(500)).toBe("err.genFailed");
    for (const [ф, адрес] of [
      ["app/qmedia/music/page.tsx", "/api/qmedia/me/tracks"],
      ["app/qmedia/videos/page.tsx", "/api/qmedia/me/videos"],
    ] as const) {
      const s = код(ф);
      expect(s, ф).toContain(адрес);
      expect(s, ф).toMatch(/if \(!r\.ok\) \{ setAddError\(t\(saveErrorKey\(r\.status\)\)\); return; \}/);
      // ошибка видна человеку
      expect(s, ф).toMatch(/\{addError && <p role="alert"[^>]*>\{addError\}<\/p>\}/);
      // сырой ответ сервера человеку не выводится
      expect(s, ф).not.toMatch(/d\.error|e\.message/);
    }
    for (const ф of ["app/qmedia/upload/page.tsx", "app/qmedia/creative/page.tsx", "app/qmedia/playlists/page.tsx"]) {
      expect(код(ф), ф).not.toMatch(/d\.error|e\.message/);
    }
  });

  test("у каждой страницы есть h1 на языке страницы; файлы с хуками начинаются с \"use client\"", () => {
    for (const ф of ФАЙЛЫ.filter((f) => f.endsWith("page.tsx"))) {
      const s = readFileSync(join(SRC, ф), "utf8");
      expect(s, ф).toMatch(/<h1[\s>]/);
      expect(s.split(/\r?\n/)[0], ф).toBe(`"use client";`);
    }
    for (const [ф, ключ] of [
      ["app/qmedia/upload/page.tsx", "upload.h1"],
      ["app/qmedia/playlists/page.tsx", "pl.h1"],
      ["app/qmedia/likes/page.tsx", "likes.h1"],
    ] as const) {
      expect(код(ф), ф).toMatch(new RegExp(`<h1[^>]*>\\{t\\("${ключ.replace(".", "\\.")}"\\)\\}</h1>`));
    }
  });
});
