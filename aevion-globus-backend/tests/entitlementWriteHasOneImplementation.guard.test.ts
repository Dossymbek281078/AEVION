import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Права после оплаты записываются ОДНОЙ реализацией на все кассы.
 *
 * Замер 29.08.2026. Копия `upsertAppSubscription` жила прямо в вебхуке Lemon
 * Squeezy, а Gumroad звал общую из `lib/appEntitlements`. Автор библиотеки
 * предупреждал об этом дословно — «копия в каждом вебхуке разошлась бы молча,
 * а расхождение видно только при сравнении, то есть там, куда никто не
 * смотрит». Так и вышло — разошлись в трёх местах.
 *
 * СЛЕДСТВИЯ, ПРОВЕРЕННЫЕ ПРОГОНОМ, а не выведенные из чтения кода:
 *
 *   • копия не звала создание таблицы. Если первой к `AppSubscription`
 *     обращается покупка, а не чтение, insert падает → 500 и вечные повторы
 *     доставки. Условное, но настоящее;
 *   • копия не сбрасывала кэш прав (TTL 60 с). Человек открыл платную
 *     страницу, получил отказ — пустой ответ осел в кэше, — заплатил и
 *     вернулся: до минуты его по-прежнему не пускает;
 *   • копия не приводила адрес к нижнему регистру. ❌ ПОСЛЕДСТВИЯ НЕТ.
 *     Я записал сюда «покупка с адресом Ivan@Mail.ru не находится никогда» и
 *     ошибся: оба вебхука нормализуют адрес НА ВХОДЕ
 *     (`lemonSqueezyWebhook.ts:230`, `gumroadWebhook.ts:290`), то есть в копию
 *     приходил уже приведённый адрес. Поймано прогоном на ДО-починочном коде:
 *     тест, написанный доказать дефект, остался зелёным.
 *
 * Урок дороже самой находки: «код отличается» и «поведение отличается» — разные
 * утверждения, и второе получают прогоном, а не чтением диффа.
 *
 * Объединение всё равно верное: одна реализация вместо двух, два настоящих
 * следствия закрыты. Но цена ошибки была бы велика — я успел назвать основателю
 * несуществующий денежный дефект как повод торопить выкатку.
 *
 * Поэтому сторож стережёт не текст, а РАСКЛАД: у записи прав ровно одна
 * реализация, и все кассы зовут её.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "..", "src");
const ROUTES = join(SRC, "routes");

/** Файлы касс: те, что принимают вебхук платёжного провайдера. */
function webhookFiles(): string[] {
  return readdirSync(ROUTES)
    .filter((f) => /Webhook\.ts$/.test(f))
    .map((f) => join(ROUTES, f));
}

function read(file: string): string {
  return readFileSync(file, "utf8");
}

/** Строки кода без комментариев: комментарий про копию — не копия. */
function codeOnly(text: string): string {
  return text
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");
}

describe("права после оплаты пишет одна реализация", () => {
  const files = webhookFiles();
  const names = files.map((f) => f.split(/[\\/]/).pop()!);

  test("контроль: файлы касс найдены", () => {
    // Пустой список сделал бы всё ниже зелёным при любом состоянии кода.
    expect(files.length, `найдено: ${names.join(", ")}`).toBeGreaterThanOrEqual(2);
  });

  test("общая реализация делает всё три, ради чего к ней и переходили", () => {
    // Переход на библиотеку теряет смысл, если она сама разучится делать то,
    // чего не умела копия. Тогда сторож остался бы зелёным, стережа пустое.
    //
    // ⚠️ Первая версия этой проверки искала признаки ПО ВСЕМУ ФАЙЛУ и пережила
    // мутацию: нормализацию убрали из записи, а признак нашёлся в чтении и в
    // сбросе кэша. Поэтому окно режется по СЛЕДУЮЩЕМУ объявлению — проверяется
    // тело именно записи.
    const lib = read(join(SRC, "lib", "appEntitlements.ts"));
    const at = lib.indexOf("export async function upsertAppSubscription");
    expect(at, "общей реализации записи прав нет вовсе").toBeGreaterThan(-1);
    const rest = lib.slice(at + 10);
    const nextDecl = rest.search(/\nexport (async )?function /);
    const body = nextDecl < 0 ? rest : rest.slice(0, nextDecl);

    expect(body, "запись прав не создаёт таблицу — первая покупка упрётся в 500")
      .toContain("ensureAppSubscriptionTable");
    expect(
      body,
      "запись кладёт адрес как пришёл, а чтение ищет в нижнем регистре — покупка не найдётся",
    ).toContain("email.trim().toLowerCase(), appSlug");
    expect(body, "после записи кэш прав не сбрасывается — заплативший до минуты получит отказ")
      .toContain("cache.delete");
  });

  test("ни одна касса не заводит свою копию записи прав", () => {
    const withCopy = files.filter((f) =>
      /(async\s+)?function\s+upsertAppSubscription\s*\(/.test(codeOnly(read(f))),
    );
    expect(
      withCopy.map((f) => f.split(/[\\/]/).pop()),
      "своя копия записи прав — расходится молча",
    ).toEqual([]);
  });

  test("кассы, которые выдают права, берут их из общей библиотеки", () => {
    const users = files.filter((f) => codeOnly(read(f)).includes("upsertAppSubscription("));
    // Контроль охвата: если ни одна касса прав не выдаёт, проверка ниже пуста.
    expect(users.length, `выдают права: ${users.length}`).toBeGreaterThanOrEqual(2);
    const wrong = users.filter((f) => !read(f).includes('from "../lib/appEntitlements"'));
    expect(
      wrong.map((f) => f.split(/[\\/]/).pop()),
      "зовёт запись прав, но не из общей библиотеки",
    ).toEqual([]);
  });
});
