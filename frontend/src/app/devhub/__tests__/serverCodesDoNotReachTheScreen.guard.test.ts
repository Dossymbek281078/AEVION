import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { devhubServerError } from "@/lib/devhubServerError";

/**
 * Граница показа переводит тексты сервера на человеческий. Замер 08.09.2026:
 * прогнал ВСЕ 138 разных сообщений об ошибках из devhub.ts через саму функцию
 * (не глазами) — 126 переведены, 1 спрятан как техническое, 4 сервер уже
 * говорит по-русски, а СЕМЬ доезжали до экрана по-английски.
 *
 * Шесть из них — машинные коды вроде `no_guest_id`. Их не ловило ни одно
 * правило: они короткие, без пробелов, и признак «техническое» на них не
 * срабатывает — он ищет ИМЕНА_ПЕРЕМЕННЫХ и панели поставщиков. Человек
 * увидел бы «Не удалось… (no_guest_id)».
 *
 * Здесь закреплено следствие: код не доезжает до экрана. Отдельно —
 * что список кодов сервера не убежал вперёд правил.
 */
const BACKEND = path.resolve(
  __dirname, "..", "..", "..", "..", "..",
  "aevion-globus-backend", "src", "routes", "devhub.ts",
);
const FALLBACK = "Не удалось выполнить действие";

/** Машинный код: без пробелов, латиница с подчёркиваниями. */
function machinnyjKod(s: string): boolean {
  return /^[a-z][a-z0-9_]{3,}$/.test(s);
}

function kodySerwera(): string[] {
  const src = fs.readFileSync(BACKEND, "utf8");
  const found = new Set<string>();
  for (const m of src.matchAll(/error: ?"([^"]{3,60})"/g)) {
    if (machinnyjKod(m[1])) found.add(m[1]);
  }
  return [...found].sort();
}

describe("машинный код сервера не доезжает до экрана", () => {
  test("прибор работает: коды в бэкенде найдены", () => {
    const kody = kodySerwera();
    expect(kody.length, "кодов не нашлось — дальше любой ноль был бы зелёным").toBeGreaterThan(3);
    expect(kody, "контроль: заведомо существующий код").toContain("no_guest_id");
  });

  test("прибор различает код и фразу", () => {
    expect(machinnyjKod("no_guest_id")).toBe(true);
    expect(machinnyjKod("Monthly deploy limit reached"), "фразу нельзя считать кодом").toBe(false);
  });

  /**
   * Исключение ровно на два кода, и оно САМОПРОВЕРЯЕМОЕ: экран связи
   * показывает свой текст по коду ответа и поле `error` вообще не читает.
   * Дать им правило значило бы поселить один отказ в двух местах — а два
   * указателя на одно расходятся молча. Если экран когда-нибудь начнёт
   * показывать ответ сервера, проверка ниже это заметит и исключение
   * перестанет быть законным.
   */
  const RAZBIRAET_EKRAN_SVYAZI = ["link_invalid", "link_unavailable"];

  test("исключение законно: экран связи не показывает ответ сервера", () => {
    const stranica = fs.readFileSync(
      path.resolve(__dirname, "..", "link", "page.tsx"), "utf8",
    );
    expect(stranica, "экран связи должен показывать свой текст").toContain('t("link.confirmFailed")');
    expect(
      stranica,
      "экран связи начал показывать ответ сервера — этим двум кодам теперь нужен человеческий текст",
    ).not.toContain("devhubServerError");
  });

  test("ни один код сервера не показывается человеку как есть", () => {
    const dozhali: string[] = [];
    for (const kod of kodySerwera()) {
      if (RAZBIRAET_EKRAN_SVYAZI.includes(kod)) continue;
      const out = devhubServerError(kod, FALLBACK, "ru");
      if (out.includes(kod)) dozhali.push(kod);
    }
    expect(
      dozhali,
      "эти коды человек увидит в скобках после «Не удалось…» — им нужен человеческий текст в RULES",
    ).toEqual([]);
  });

  test("объяснение про хранилище названо своими словами, а не общей фразой", () => {
    const out = devhubServerError("no_guest_id", FALLBACK, "ru");
    expect(out, "человек должен понять, ЧТО ему сделать").toMatch(/хранилищ/);
    expect(out).not.toBe(FALLBACK);
  });

  test("перевод не съел обычные фразы: они по-прежнему переводятся", () => {
    const out = devhubServerError("Monthly deploy limit reached", FALLBACK, "ru");
    expect(out, "правило про пределы перестало работать").not.toBe(`${FALLBACK} (Monthly deploy limit reached)`);
    expect(out).toMatch(/[а-яё]/i);
  });
});
