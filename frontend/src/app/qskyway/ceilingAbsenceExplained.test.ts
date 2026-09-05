import { describe, it, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { allTranslations } from "../__tests__/localeSource";

/**
 * Отсутствие чисел по потолкам объяснено на экране, а не только в API.
 *
 * ЗАМЕР 28.08.2026 на живой странице: у Токио ноль подсказок и ни одной строки
 * про потолки, у NYC — «6 из 42 маршрутов укладывается в потолок». Со стороны
 * это читается как «Токио не считали», хотя правда обратная: считали, просто
 * его регулятор публикует правило ДРУГОГО ВИДА (режим разрешений MLIT/JCAB,
 * у Астаны — запретная зона AIP KZ).
 *
 * Сервер это объяснял полем `note`, но оно оставалось в ДРУГОЙ ветке
 * `airspaceRegSource` — той, что срабатывает, когда нет ни потолков, ни
 * разрешительного режима. До экрана правда не доходила.
 *
 * Проверка по исходнику и словарю: живой ответ здесь не нужен, вопрос в том,
 * СОБИРАЕТСЯ ли объяснение в подсказку. Что оно там появляется, проверено
 * браузером в день правки.
 */
const SRC = readFileSync(path.join(__dirname, "_client.tsx"), "utf8");

function hasCyrillic(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x400 && c <= 0x4ff) return true;
  }
  return false;
}

describe("почему нет чисел по потолкам — сказано человеку", () => {
  test("ключ есть во всех трёх локалях и не пустой", () => {
    const dicts = allTranslations() as Record<string, Record<string, string>>;
    for (const lang of ["en", "ru", "kk"]) {
      const v = dicts[lang]?.["qskyway.reg.noCeilingGrid"];
      expect(v, "ключ отсутствует в " + lang).toBeTruthy();
      expect(v.length, "строка в " + lang + " слишком коротка, чтобы объяснить").toBeGreaterThan(40);
    }
  });

  test("английская версия не по-русски", () => {
    const dicts = allTranslations() as Record<string, Record<string, string>>;
    expect(hasCyrillic(dicts.en["qskyway.reg.noCeilingGrid"])).toBe(false);
  });

  test("объяснение попадает в ветку разрешительного режима", () => {
    // Ветка потолков в объяснении не нуждается: там числа есть. Значение
    // должно доехать в ту ветку, где их НЕТ.
    expect(SRC.includes("noGridNote"), "параметр исчез из функции").toBe(true);
    const branch = SRC.slice(SRC.indexOf("if (perm?.available)"), SRC.indexOf("return { tier: \"none\""));
    // ⚠️ Считаем ВХОЖДЕНИЯ, а не наличие. Первая версия требовала, чтобы слово
    // просто встречалось в ветке, — и мутация «убрать его из английского
    // массива» прошла молча: в русском оно осталось. Языковых веток две, и
    // объяснение обязано быть в обеих, иначе оно пропадёт ровно для тех, кому
    // и нужно объяснение на своём языке.
    const hits = branch.split("noGridNote").length - 1;
    expect(hits, "объяснение собирается не во всех языковых ветках (нашлось " + hits + ", нужно 2)").toBe(2);
  });

  test("вызов передаёт переведённую строку, а не забывает параметр", () => {
    expect(
      SRC.includes('airspaceRegSource(meta.airspace, lang === "ru", t("qskyway.reg.noCeilingGrid"))'),
      "вызов перестал передавать объяснение — параметр необязательный, и молчание было бы тихим",
    ).toBe(true);
  });

  test("отказ проверки называет ПРИЧИНУ, а не только факт", () => {
    // Бэкенд считает hashValid и signatureValid раздельно и прямо пишет, что
    // один вердикт скрыл бы, что случилось. Страница до 28.08.2026 читала
    // только сводный `valid` — то есть возвращала ровно тот единый вердикт.
    //
    // Действия у человека противоположные: документ изменён после подписи —
    // скачать заново; подпись не наша — кто-то выдаёт чужую бумагу за нашу.
    const dicts = allTranslations() as Record<string, Record<string, string>>;
    for (const lang of ["en", "ru", "kk"]) {
      for (const key of ["qskyway.just.tampered", "qskyway.just.forged"]) {
        const v = dicts[lang]?.[key];
        expect(v, key + " отсутствует в " + lang).toBeTruthy();
        expect(v.length, key + " в " + lang + " слишком коротко, чтобы объяснить").toBeGreaterThan(20);
      }
      // Две причины обязаны РАЗЛИЧАТЬСЯ: одинаковый текст вернул бы единый
      // вердикт под видом двух.
      expect(
        dicts[lang]["qskyway.just.tampered"],
        "в " + lang + " обе причины сказаны одинаково",
      ).not.toBe(dicts[lang]["qskyway.just.forged"]);
    }
    // И страница обязана РАЗЛИЧАТЬ их по ответу, а не показывать одну всегда.
    expect(SRC.includes("verifyReasonOf("), "страница не различает, ЧТО именно не сошлось").toBe(true);
  });
});

/**
 * Причина отказа, по которой ветвится страница, — та же строка, что шлёт бэкенд.
 *
 * ПОВОД. Страница показывает объяснение «маршрут упирается в потолок» только
 * если `j.reason === "airspace-ceiling"`. Это НЕТИПИЗИРОВАННАЯ строка, живущая
 * по обе стороны HTTP.
 *
 * Асимметрия, из-за которой пишется этот тест: бэкенд проверяет, что слово
 * ОТПРАВЛЯЕТСЯ, а что страница читает то же самое — не проверял никто.
 * Переименуют причину — тесты бэкенда покраснеют, их поправят, а страница
 * молча перестанет объяснять человеку, почему маршрут отклонён. Тихая потеря
 * объяснения хуже отказа: снаружи выглядит как «просто нет маршрута».
 *
 * Тест фронта читает файл бэкенда — граница пересечена НАМЕРЕННО, как и в
 * паре slotOrigin. Пока знание живёт в двух местах, связь лучше видимая.
 */
describe("причина отказа совпадает с той, что шлёт бэкенд", () => {
  const BACKEND = path.join(
    __dirname, "..", "..", "..", "..", "aevion-globus-backend", "src", "routes", "qskyway.ts",
  );

  it("файл бэкенда на месте — иначе связь надо переписать, а не удалять", () => {
    expect(existsSync(BACKEND), "не нашёл " + BACKEND + ": поправьте путь в этом тесте").toBe(true);
  });

  it("строка, по которой ветвится страница, ОТПРАВЛЯЕТСЯ бэкендом", () => {
    const page = readFileSync(path.join(__dirname, "_client.tsx"), "utf8");
    const m = page.match(/j\.reason === "([^"]+)"/);
    expect(m, "страница больше не ветвится по reason — проверку надо переписать").toBeTruthy();
    const compared = String(m![1]);
    const backend = readFileSync(BACKEND, "utf8");
    expect(
      backend.includes('reason: "' + compared + '"'),
      "страница ждёт reason=" + JSON.stringify(compared) + ", а бэкенд такого не шлёт",
    ).toBe(true);
  });
});
