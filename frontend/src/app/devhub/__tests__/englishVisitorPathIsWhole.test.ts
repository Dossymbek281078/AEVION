import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { языкИзЗаголовка } from "../layout";
import { языкИзАдреса } from "../../../lib/i18n";

/**
 * Путь посетителя с Product Hunt — английский, и он не должен рваться.
 *
 * Находки соседнего окна 29.09.2026, прочтением живого сайта:
 *   • страница /en/devhub перерисовывалась на РУССКИЙ через несколько секунд, если в
 *     этом браузере когда-то выбрали русский: сохранённый выбор побеждал явный адрес.
 *     Контроль, доказавший, что виноват не сервер: curl того же адреса отдаёт чистый
 *     английский, русских слов 0;
 *   • «Open it» уводило на /devhub, где заголовок вкладки был жёстко русским —
 *     человек делится ссылкой, а соцсети и поисковик берут русский заголовок;
 *   • /en/devhub/launch отвечал 404 — потерянный посетитель без следа в учёте.
 */
const i18n = readFileSync(join(__dirname, "..", "..", "..", "lib", "i18n.tsx"), "utf8");

describe("адрес сильнее сохранённого выбора языка", () => {
  it("язык берётся из адреса — проверка ПОВЕДЕНИЕМ, а не порядком строк", () => {
    expect(языкИзАдреса("/en/devhub")).toBe("en");
    expect(языкИзАдреса("/ru/devhub/launch")).toBe("ru");
    expect(языкИзАдреса("/kk")).toBe("kk");
  });

  it("без префикса и на чужом префиксе адрес языка не навязывает", () => {
    expect(языкИзАдреса("/devhub")).toBeNull();
    expect(языкИзАдреса("/")).toBeNull();
    expect(языкИзАдреса("/zz/devhub")).toBeNull();
    // «/energy» начинается с «en», но это не префикс языка
    expect(языкИзАдреса("/energy")).toBeNull();
    expect(языкИзАдреса(null)).toBeNull();
  });

  it("правило живёт в ОДНОМ месте, а не в двух копиях", () => {
    // Пока копий было две (ранняя догадка и эффект), они разошлись — и спор был
    // виден глазами: заголовок английский, текст через пару секунд русский.
    expect(i18n).toContain("export function языкИзАдреса");
    const вызовов = (i18n.match(/языкИзАдреса\(/g) ?? []).length;
    expect(вызовов, "правило снова размножено по копиям").toBeGreaterThanOrEqual(2);
    expect((i18n.match(/location\.pathname\)?\.match\(/g) ?? []).length, "regex пути снова вписан руками").toBe(0);
  });

  it("выбор не стирается: ушёл с /en — снова прежний язык", () => {
    // Мы НЕ трогаем STORAGE_KEY при заходе по /en: адрес побеждает только на этой
    // странице. Затирать чужой выбор — отдельная неприятность.
    const i = i18n.indexOf("языкИзПути");
    const блок = i18n.slice(i, i + 700);
    expect(блок).not.toContain("setItem(STORAGE_KEY");
    expect(блок).not.toContain("removeItem(STORAGE_KEY");
  });
});

describe("заголовок вкладки /devhub говорит на языке посетителя", () => {
  it("язык берётся первым по порядку из Accept-Language", () => {
    expect(языкИзЗаголовка("ru-RU,ru;q=0.9,en;q=0.8")).toBe("ru");
    expect(языкИзЗаголовка("en-US,en;q=0.9")).toBe("en");
    expect(языкИзЗаголовка("kk-KZ,kk;q=0.9")).toBe("kk");
  });

  it("незнание — английский: витрина по умолчанию английская", () => {
    expect(языкИзЗаголовка(null)).toBe("en");
    expect(языкИзЗаголовка("zz-ZZ")).toBe("en");
  });

  it("метаданные строит generateMetadata, а не жёсткая строка", () => {
    const layout = readFileSync(join(__dirname, "..", "layout.tsx"), "utf8");
    expect(layout).toContain("export async function generateMetadata");
    expect(layout).toContain("accept-language");
    expect(layout).toContain("describe an app, get a live address");
  });
});

describe("английские входы не ведут в 404", () => {
  it("/en/devhub/launch существует и переносит метку канала", () => {
    const p = join(__dirname, "..", "..", "en", "devhub", "launch", "page.tsx");
    expect(existsSync(p), "английский вход на страницу запуска отсутствует").toBe(true);
    const код = readFileSync(p, "utf8");
    expect(код).toContain("/devhub/launch");
    // метка обязана доехать, иначе переход уйдёт в «unattributed»
    expect(код).toContain("URLSearchParams");
    expect(код).toContain("searchParams");
  });
});
