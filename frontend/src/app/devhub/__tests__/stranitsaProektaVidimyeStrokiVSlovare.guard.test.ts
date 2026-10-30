import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEVHUB_DICT } from "../i18n";

/**
 * 🔴 Страница проекта /devhub/[id] у гостя с английским браузером показывала русские строки
 * (замер 30.10.2026): «ZIP: заменять существующие», «🚀 Опубликовать на Cloudflare Pages»,
 * «ИСТОРИЯ», «Открыть живой сайт», «📎 Снимок экрана», «Фиксировать происхождение (QRight)»,
 * «Остановить», «Нажмите на любой текст…», тост «Агент: удалось шагов…».
 * Сторож: эти строки не стоят голым JSX/литералом в page.tsx, а идут через словарь (ru/en/kk).
 */
const SRC = readFileSync(join(__dirname, "..", "[id]", "page.tsx"), "utf8");

const КЛЮЧИ = [
  "proj.openLive", "proj.zipOverwrite", "proj.attachShot", "proj.provStamp", "proj.stop", "proj.history",
  "proj.visualPickHint", "proj.agentToast", "proj.cfFree", "proj.cfAddrPagesDev", "proj.cfPublish",
  "proj.cfRepublish", "proj.cfSubLead", "proj.cfDomLead", "proj.cfDomTail", "proj.depHistoryCaps",
  "proj.depAll", "proj.depLive", "proj.depFailed", "proj.depBuilding", "proj.depRecheck", "proj.depRechecking",
];

const ГОЛЫЕ = [
  "Открыть живой сайт", "ZIP: заменять существующие", "Снимок экрана", "Фиксировать происхождение (QRight)",
  "Остановить\n", "Нажмите на любой текст в превью", "Бесплатно · SSL сам", "Опубликовать на Cloudflare Pages",
  "Опубликовать заново", "Свой поддомен выдаётся", "пока не подтверждён — адрес", ">ИСТОРИЯ<", "Вся история и журналы сборки",
  "\"живой\"", "\"не удался\"", "\"собирается\"", "Проверить ещё раз", "Проверяю…", "} История", "Агент: удалось шагов",
];

describe("страница проекта: видимые строки идут через словарь", () => {
  test("перечисленные русские строки не стоят в page.tsx голым JSX/литералом", () => {
    for (const s of ГОЛЫЕ) expect(SRC.includes(s), `в page.tsx осталось: ${s.trim()}`).toBe(false);
  });

  test("у каждого ключа есть ru/en/kk, en без кириллицы, kk не русский", () => {
    for (const k of КЛЮЧИ) {
      expect(SRC.includes(`"${k}"`), `ключ не используется: ${k}`).toBe(true);
      for (const l of ["ru", "en", "kk"]) expect((DEVHUB_DICT[l] as Record<string, string>)[k], `${l}:${k}`).toBeTruthy();
      expect((DEVHUB_DICT.en as Record<string, string>)[k], k).not.toMatch(/\p{Script=Cyrillic}/u);
    }
  });

  test("ru дословно прежний текст", () => {
    const ru = DEVHUB_DICT.ru as Record<string, string>;
    expect(ru["proj.cfPublish"]).toBe("🚀 Опубликовать на Cloudflare Pages");
    expect(ru["proj.zipOverwrite"]).toBe("ZIP: заменять существующие");
    expect(ru["proj.depHistoryCaps"]).toBe("ИСТОРИЯ");
    expect(ru["proj.agentToast"]).toBe("Агент: удалось шагов {ok} из {total}");
  });
});
