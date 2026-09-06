import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Совет, который платформа даёт человеку, обязан быть безопасным для исполнения.
 *
 * Повод, а не гипотеза. `/api/health/channels` отдаёт список `missing` — то, чего
 * платформе не хватает. Замер на живом проде 31.08.2026:
 *
 *     missing: [
 *       "GOOGLE_OAUTH_CLIENT_ID+SECRET",
 *       "GITHUB_OAUTH_CLIENT_ID+SECRET",
 *       "GUMROAD_WEBHOOK_SECRET (оплата принимается без подписи)",
 *     ]
 *
 * Первые два безобидны: задал переменные — появился вход. Третий — ловушка.
 *
 * Задать `GUMROAD_WEBHOOK_SECRET` ТОЛЬКО у нас (в переменных сервиса) — значит
 * остановить выдачу ВСЕХ покупок Gumroad, молча. Наш код после этого начинает
 * требовать подпись (`gumroadPaymentProvider.parseWebhook`), а Gumroad
 * продолжает слать пинги без неё, пока ту же строку не задали в настройках
 * продукта на его стороне. Снаружи это выглядит так: люди платят, деньги
 * приходят, доступ не выдаётся никому, и ни одной ошибки нигде.
 *
 * То есть совет верный по смыслу и опасный по исполнению: он называет ПОЛОВИНУ
 * действия. Человек, который послушается, сделает хуже, чем было, — и не
 * узнает об этом, потому что отказ здесь тихий.
 *
 * ⚠️ Это ХРАПОВИК, а не запрет. Файл `routes/channelsHealth.ts` правят чужие
 * ветки (сборка трогала его 31.08), поэтому текст я не меняю. Сторож держит
 * известный случай и не даёт появиться новым советам того же рода: любая
 * подсказка про секрет вебхука обязана называть вторую половину действия.
 *
 * Как снять запись из списка: дописать в подсказку, что секрет задаётся
 * ОДНОВРЕМЕННО в настройках продукта у провайдера. После этого проверка ниже
 * потребует убрать её отсюда.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const CHANNELS = join(HERE, "..", "src", "routes", "channelsHealth.ts");

/** Известные подсказки без второй половины на 31.08.2026. Список обязан таять. */
const KNOWN_HALF_ADVICE: string[] = [];

/** Слова, которыми называется вторая половина действия. */
const SECOND_HALF = ["панел", "у провайдера", "одновременно", "на стороне", "в настройках продукта", "dashboard"];

/** Строки кода без комментариев: пояснение автора — не текст для человека. */
function codeOnly(text: string): string {
  return text
    .split(String.fromCharCode(10))
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join(String.fromCharCode(10));
}

/**
 * Подсказки про секреты вебхуков, которые платформа отдаёт наружу.
 *
 * Берём не строки файла, а САМИ СТРОКОВЫЕ ЛИТЕРАЛЫ, и только те, внутри
 * которых есть пробел. Первая редакция фильтровала строки файла по наличию
 * кавычек и слова `signed` — и принимала за подсказку объявление переменной
 * `const signedGumroad = set("GUMROAD_WEBHOOK_SECRET")`. Сторож упал на
 * собственном шаблоне, и это было правильно: имя переменной человеку не
 * показывают, а сообщение — показывают. Отличает их пробел внутри кавычек.
 */
function webhookSecretAdvice(code: string): string[] {
  return [...code.matchAll(/"([^"]*WEBHOOK_SECRET[^"]*)"/g)]
    .map((m) => m[1])
    .filter((s) => s.includes(" "));
}

describe("совет про секрет вебхука называет обе половины действия", () => {
  const code = codeOnly(readFileSync(CHANNELS, "utf8"));

  test("контроль: подсказки вообще найдены", () => {
    // Иначе «новых опасных советов нет» означало бы «я читаю не тот файл».
    expect(code.length, "файл пуст или не прочитан").toBeGreaterThan(500);
    const advice = webhookSecretAdvice(code);
    expect(advice.length, "подсказок про секреты вебхуков не найдено вовсе").toBeGreaterThanOrEqual(1);
  });

  test("контроль: признак второй половины умеет срабатывать", () => {
    // Проба с заранее известным ответом, а не наличие дефекта в репозитории:
    // иначе после починки контроль краснел бы именно потому, что чинить нечего.
    const half = '"GUMROAD_WEBHOOK_SECRET (оплата принимается без подписи)"';
    const full = '"GUMROAD_WEBHOOK_SECRET — задавать ОДНОВРЕМЕННО в настройках продукта у провайдера"';
    const names = (s: string) => SECOND_HALF.some((w) => s.toLowerCase().includes(w.toLowerCase()));
    expect(names(half), "признак видит вторую половину там, где её нет").toBe(false);
    expect(names(full), "признак не видит вторую половину там, где она есть").toBe(true);
  });

  test("новых советов-половинок не появилось", () => {
    const names = (s: string) => SECOND_HALF.some((w) => s.toLowerCase().includes(w.toLowerCase()));
    const half = webhookSecretAdvice(code)
      .filter((l) => !names(l))
      .map((l) => {
        const m = /([A-Z_]*WEBHOOK_SECRET)/.exec(l);
        return m ? m[1] : l.trim().slice(0, 40);
      });
    const fresh = half.filter((k) => !KNOWN_HALF_ADVICE.includes(k));
    expect(
      fresh,
      "платформа советует задать секрет вебхука и не называет вторую половину: " +
        "послушавшийся остановит выдачу покупок, и отказ будет тихим",
    ).toEqual([]);
  });

  test("храповик не протух: известная подсказка всё ещё половинчатая", () => {
    const names = (s: string) => SECOND_HALF.some((w) => s.toLowerCase().includes(w.toLowerCase()));
    const half = new Set(
      webhookSecretAdvice(code)
        .filter((l) => !names(l))
        .map((l) => {
          const m = /([A-Z_]*WEBHOOK_SECRET)/.exec(l);
          return m ? m[1] : "";
        }),
    );
    const stale = KNOWN_HALF_ADVICE.filter((k) => !half.has(k));
    expect(stale, `подсказка уже полная, убрать из списка: ${stale.join(", ")}`).toEqual([]);
  });
});
