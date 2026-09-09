import { describe, test, expect } from "vitest";
import { capabilityHint, indexCapabilities, isCapabilityBlocked } from "../devhubCapabilities";
import fs from "node:fs";
import path from "node:path";

/** Список возможностей берём у СЕРВЕРА: свой устареет молча. */
const BACKEND = path.resolve(
  __dirname, "..", "..", "..", "..",
  "aevion-globus-backend", "src", "routes", "devhub.ts",
);

/**
 * Подсказка о недоступной возможности живёт в ТОСТЕ, а тост — слепая зона
 * машинного доводчика по устройству: он не успевает за текстом, который
 * держится секунды. До 08.09.2026 подпись и объяснение были зашиты по-русски в
 * пятнадцати вызовах, то есть EN-посетитель, нажавший недоступную кнопку,
 * читал русскую фразу. На проде это не редкость: в день правки degraded были
 * перевод, github и озвучка, not_available — railway и домен.
 */
const caps = indexCapabilities([
  { id: "video", status: "live" },
  { id: "vercel", status: "needs_token" },
  { id: "translate", status: "degraded" },
  { id: "нечто", status: "not_available", name: "Имя от сервера" },
]);

describe("подсказка говорит на языке читателя", () => {
  test("русский — подпись и объяснение по-русски", () => {
    const h = capabilityHint(caps, "vercel", "ru");
    expect(h).toContain("Выкатка на Vercel");
    expect(h).toContain("не подключён");
  });

  test("английский — НИ ОДНОЙ кириллической буквы", () => {
    const h = capabilityHint(caps, "vercel", "en");
    expect(/[а-яё]/i.test(h), `в английской подсказке кириллица: ${h}`).toBe(false);
    expect(h).toContain("Vercel deploy");
    // Замена тоже переводится: без неё человек узнаёт, что нельзя, и не узнаёт
    // что можно.
    expect(h).toContain("Cloudflare Pages");
  });

  test("казахский — своя подпись, не английская и не русская", () => {
    const h = capabilityHint(caps, "video", "kk");
    expect(h).toBe("Бейне генерациясы");
  });

  test("живая возможность — только подпись, без объяснения отказа", () => {
    expect(capabilityHint(caps, "video", "ru")).toBe("Генерация видео");
  });

  test("незнакомый язык падает на английский, а не на пустоту", () => {
    const h = capabilityHint(caps, "vercel", "de");
    expect(h).toContain("Vercel deploy");
    expect(h.length).toBeGreaterThan(10);
  });

  test("незнакомый идентификатор берёт имя от сервера, а не молчит", () => {
    expect(capabilityHint(caps, "нечто", "en")).toContain("Имя от сервера");
    expect(capabilityHint(caps, "вовсе-нет", "en")).toContain("вовсе-нет");
  });

  test("перевод спрашивается наравне с остальными возможностями", () => {
    // Пробел охвата: пять кнопок спрашивали состояние, перевод — нет, и человек
    // узнавал о выжженной квоте DeepL только после нажатия.
    expect(isCapabilityBlocked(caps, "translate")).toBe(true);
    expect(capabilityHint(caps, "translate", "en")).toContain("Translation");
  });

  /**
   * Замер 08.09.2026: прогнал capabilityHint по ВСЕМ 17 возможностям, которые
   * прод отдаёт на /studio/capabilities, в трёх языках — и у ПЯТИ подписи не
   * было вовсе (code, domain, screenshot_code, sms, whatsapp). Вместо имени
   * человек читал идентификатор: «domain: канал пока не подключён на нашей
   * стороне». Один из них — domain — на проде именно в этом состоянии, то
   * есть жаргон был виден живьём.
   *
   * Проверка ведётся по СПИСКУ СЕРВЕРА (файл маршрутов), а не по списку
   * внутри теста: свой список устареет молча ровно тогда, когда добавят
   * новую возможность.
   */
  test("у КАЖДОЙ возможности сервера есть человеческое имя на трёх языках", () => {
    const src = fs.readFileSync(BACKEND, "utf8");
    const ids = new Set<string>();
    // Берём ТОЛЬКО строки построения возможностей: у них рядом стоит `name:`
    // и `status:`. Без этого сужения в список попадали id шаблонов проектов
    // (landing, dashboard, blog) — прибор давал три ложных находки на язык.
    for (const m of src.matchAll(/\{ id: "([a-z][a-z0-9_]{1,24})", name: "[^"]+", description:/g)) {
      ids.add(m[1]);
    }
    expect(ids.size, "идентификаторов не нашлось — дальше любой ноль был бы зелёным").toBeGreaterThan(8);
    expect([...ids], "контроль: заведомо существующая возможность").toContain("audio_tts");

    const bezImeni: string[] = [];
    for (const lang of ["ru", "en", "kk"]) {
      for (const id of ids) {
        const h = capabilityHint({ [id]: { status: "not_available" } } as never, id, lang);
        // Имя считается человеческим, если подсказка НЕ начинается с самого
        // идентификатора: именно так выглядит запасной путь «имя от сервера».
        if (h.startsWith(id + ":") || h.startsWith(id + " ")) bezImeni.push(`${lang}:${id}`);
      }
    }
    expect(bezImeni, "человек прочитает идентификатор вместо названия").toEqual([]);
  });
});
