import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DEVHUB_DICT } from "../i18n";

const RU_DICT = DEVHUB_DICT.ru as Record<string, string>;

/**
 * Причина отключения возможности — словами человека, а не машинным токеном.
 *
 * Панель на витрине показывает подсказку при наведении на отключённую
 * возможность. Раньше в ней было `status === "needs_token" ? "не настроено на
 * сервере" : c.status` — то есть для любого ДРУГОГО состояния на экран уходил
 * сырой токен.
 *
 * 28.08.2026 это стало не теорией: домен aevion.build переведён в
 * "not_available" (зона не делегирована), и человек, наведя курсор, прочитал бы
 * ровно `not_available`. Дефект создала моя же правка соседнего слоя — потому
 * сторож и стоит рядом.
 */

const SRC = fs.readFileSync(
  path.resolve(__dirname, "..", "page.tsx"),
  "utf8",
);

/**
 * Код БЕЗ комментариев. Первая версия сторожа краснела на собственном
 * пояснении: комментарий к новому помощнику цитирует старую строку
 * `"не настроено на сервере" : c.status`, и проверка «сырой статус не уходит
 * в подсказку» находила её в тексте о том, как этого больше не делают.
 *
 * Ловушка записана в правилах и всё равно сработала — потому что комментарий
 * писался как объяснение, а не как код, и в голове он «не считается».
 */
const CODE = SRC
  .split("/*").map((part, i) => (i === 0 ? part : part.split("*/").slice(1).join("*/")))
  .join("")
  .split(String.fromCharCode(10))
  .filter((line) => !line.trim().startsWith("//"))
  .join(String.fromCharCode(10));

describe("причина отключения понятна человеку", () => {
  test("прибор исправен: файл прочитан", () => {
    expect(SRC.length).toBeGreaterThan(2000);
  });

  test("сырой статус не уходит в подсказку", () => {
    expect(
      CODE.includes('"не настроено на сервере" : c.status'),
      "машинный токен снова показывается человеку",
    ).toBe(false);
  });

  test("объяснение идёт через отдельный помощник", () => {
    expect(SRC).toContain("capabilityOffReason(c.status, c.offCode, t)");
    expect(SRC).toContain("function capabilityOffReason");
  });

  test("различаются «нет ключа» и «не сделано»", () => {
    // Человеку это разные новости: первое мы настроим, второго ещё нет.
    // 08.09.2026 тексты уехали в словарь — подсказка живёт в атрибуте title,
    // а атрибуты машинный доводчик не переводит. Поэтому проверяем СВЯЗКУ:
    // фразы есть в русской ветке словаря И страница берёт их через t().
    expect(RU_DICT["caps.off.needsToken"]).toContain("не настроено на сервере");
    expect(RU_DICT["caps.off.notAvailable"]).toContain("пока не сделано");
    expect(CODE).toContain('t("caps.off.needsToken")');
    expect(CODE).toContain('t("caps.off.notAvailable")');
  });

  test("сырой текст поставщика в подсказку не уходит", () => {
    // Замер прода 08.09.2026: ручка ПУБЛИЧНАЯ, и в lastError лежало сырое тело
    // ответа ElevenLabs с authentication_error, а также «провайдер-проба:
    // HTTP 401». Подсказка показывала это посетителю витрины — ворота §3.4
    // («тексты ошибок человеческие, без кодов и адресов») и утечка устройства.
    expect(
      CODE.includes("c.lastError"),
      "подсказка снова показывает текст поставщика вместо наших слов",
    ).toBe(false);
  });

  test("у каждого кода причины есть слова во ВСЕХ трёх языках", () => {
    // Незаведённая подпись не падает и не краснеет — она печатает жаргон.
    const codes = ["quota", "auth", "zone", "provider", "needsToken", "notAvailable", "unknown", "state"];
    for (const code of codes) {
      for (const [lang, dict] of Object.entries(DEVHUB_DICT)) {
        const value = (dict as Record<string, string>)[`caps.off.${code}`];
        expect(value, `caps.off.${code} пуст в языке ${lang}`).toBeTruthy();
      }
    }
  });

  test("незнакомое состояние показывается, а не прячется", () => {
    // Спрятать хуже: ни человек, ни мы не поймём, о чём речь.
    // Слово «состояние» с 08.09 берётся из словаря (подсказка в атрибуте, а их
    // доводчик не переводит), но САМО значение обязано доезжать до экрана.
    expect(CODE).toContain('${t("caps.off.state")}: ${status}');
    expect(RU_DICT["caps.off.state"]).toBe("состояние");
  });

  test("даты не форматируются американской локалью", () => {
    // Была зашита "en-US": на русской странице даты выглядели как «Aug 28,
    // 2026», при том что в двух других местах модуля локаль берётся от
    // браузера — один модуль показывал даты в двух форматах.
    const bad = CODE.split('toLocaleDateString("en-').length - 1
      + CODE.split('toLocaleString("en-').length - 1;
    expect(bad, "локаль зашита вместо браузерной").toBe(0);
  });
});
