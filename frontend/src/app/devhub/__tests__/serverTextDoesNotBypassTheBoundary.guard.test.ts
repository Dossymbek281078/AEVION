import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { devhubServerError } from "@/lib/devhubServerError";
import { DEVHUB_DICT } from "../i18n";

/**
 * Текст, пришедший от сервера, не показывается человеку в обход границы показа.
 *
 * У модуля есть продуманный механизм: `devhubServerError` переводит английские
 * тексты ручек на язык читателя и НЕ пропускает наружу технические — те, что
 * называют переменную окружения или панель поставщика. Тексты самих ручек при
 * этом намеренно остаются английскими: они контракт API, по ним написаны смоук
 * и чужие интеграции.
 *
 * Замер 08.09.2026 нашёл две дыры в этой границе, обе на деньгах:
 *
 *   1. IDE, отправка в GitHub. Ручка отвечает 200 с ok:false и полем `message`
 *      «Set GITHUB_TOKEN in project Env Vars or server env…» — инструкция
 *      ОПЕРАТОРУ, по-английски, в модуле за $149. Экран показывал её как есть:
 *      `setGithubMsg(d.message || "Push failed")`. Поле `message` мимо границы
 *      прошло потому, что граница ставилась на поле `error`.
 *
 *   2. Страница подключения покупки. Её ручки отвечают ПО-РУССКИ, и текст
 *      сервера ПОБЕЖДАЛ словарь (`typeof j.message === "string" ? j.message :
 *      t(...)`). Покупатель с английским интерфейсом читал русскую фразу ровно
 *      в момент подключения покупки.
 */
const IDE = fs.readFileSync(path.resolve(__dirname, "..", "[id]", "page.tsx"), "utf8");
const LINK = fs.readFileSync(path.resolve(__dirname, "..", "link", "page.tsx"), "utf8");

describe("серверный текст не минует границу показа", () => {
  test("прибор исправен: оба файла прочитаны", () => {
    expect(IDE.length).toBeGreaterThan(10000);
    expect(LINK.length).toBeGreaterThan(2000);
  });

  test("IDE: поле message ручки идёт через serverError", () => {
    expect(IDE, "сырое поле message снова показывается").not.toContain('setGithubMsg(d.message || "Push failed")');
    expect(IDE).toContain("setGithubMsg(serverError(d.message");
  });

  test("страница покупки берёт слова из словаря, а не из ответа сервера", () => {
    expect(LINK, "текст сервера снова побеждает словарь").not.toContain("typeof j.message === \"string\" ? j.message");
    expect(LINK, "то же на пути отказа").not.toContain("typeof j?.message === \"string\" ? j?.message");
    expect(LINK).toContain('t("link.confirmed")');
    expect(LINK).toContain('t("link.sent")');
  });

  test("частый повтор отличается от общей неудачи — у ограничителя свой предел", () => {
    // «Попробуйте позже» вместо «подождите десять минут» заставляет человека
    // долбиться в закрытую дверь.
    expect(LINK).toContain('r.status === 429 ? t("link.tooOften")');
    for (const [lang, dict] of Object.entries(DEVHUB_DICT)) {
      expect((dict as Record<string, string>)["link.tooOften"], `link.tooOften пуст в ${lang}`).toBeTruthy();
    }
  });

  test("граница действительно прячет инструкцию оператору (проверка следствия)", () => {
    // Не «вызов есть в файле», а что механизм ДЕЛАЕТ с настоящим текстом.
    const техническое = "Set GITHUB_TOKEN in project Env Vars or server env to enable GitHub integration";
    const показано = devhubServerError(техническое, "Отправить не удалось", "ru");
    expect(показано).not.toContain("GITHUB_TOKEN");
    expect(показано.length, "текст исчез совсем — человек остался без объяснения").toBeGreaterThan(10);
    // Контроль: обычный английский текст границей не съедается.
    const обычное = devhubServerError("Branch created but no files could be committed", "Не вышло", "ru");
    expect(обычное).toContain("Branch created");
  });
});
