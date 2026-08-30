import { describe, test, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { stripComments } from "./helpers/sourceCode";
// eslint-disable-next-line import/first
import { successRedirectUrl } from "../src/lib/payment/lemonSqueezyProvider";

/**
 * Страница, куда провайдер возвращает покупателя, обязана зафиксировать покупку.
 *
 * Соседний сторож `paymentReturnUrlExists` спрашивает «есть ли такая страница».
 * Это необходимо и мало: страница может существовать, открываться и молчать.
 *
 * Замер 29.08.2026. Адрес возврата у каждого провайдера СВОЙ, и ведут они на
 * пять разных страниц:
 *
 *   PayBox, PayPal -> /pricing/checkout/success   считает
 *   Конституция    -> /constitution?upgrade=...   считает своей воронкой
 *   Stripe         -> /bureau?paid=1              НЕ считает
 *   QPayNet        -> /qpaynet/deposit/success    НЕ считает
 *
 * Деньги при этом не теряются: вебхуки пишут покупку в базу. Теряется КАНАЛ —
 * оплату нельзя связать с источником, из которого пришёл человек, то есть
 * нельзя посчитать конверсию рекламы, ролика и рассылки по отдельности.
 *
 * Храповик: сегодняшний долг перечислен поимённо, с владельцем зоны. Новый
 * провайдер, возвращающий на неизмеряемую страницу, уронит проверку.
 */

/**
 * СТОЛКНОВЕНИЕ ПРИ СВЕДЕНИИ — прочтите до того, как оставить оба.
 *
 * 29.08.2026 вечером вкладка платёжных ссылок независимо написала сторож той
 * же конструкции — `frontend/src/app/__tests__/everyPaymentReturnIsCounted.guard.test.ts`,
 * тоже идущий ОТ ПРОВАЙДЕРА, а не от списка страниц. Мы нашли одно и то же
 * порознь. Держать два сторожа с одним вопросом — значит однажды починить
 * один и не заметить, что второй остался красным.
 *
 * Разрешать в пользу ИХ: они починили сам продукт (замер на /bureau и
 * /qpaynet), а этой ветке те файлы недоступны — их правят чужие ветки.
 *
 * Но перед удалением этого файла перенесите в их сторож ОДНУ вещь, которой у
 * него, скорее всего, нет: путь возврата LemonSqueezy собирает ФУНКЦИЯ
 * `successRedirectUrl`, и в строке `redirect_url: successRedirectUrl(...)`
 * косой черты нет вовсе — разбор по исходнику пропускает её МОЛЧА. Это
 * главный провайдер подписок. См. ниже functionBuiltPaths() и контроль
 * «главный провайдер подписок в разбор ПОПАЛ».
 *
 * УЖЕ ПЕРЕНЕСЕНО (29.08, вечер): вкладка платёжных ссылок закрыла эту зону у
 * себя КЛАССОМ — если в строке поля пути нет, но есть вызов функции, разбор
 * идёт в её тело. Мутация «возврат LemonSqueezy на /explore» у них краснит.
 * Значит при сведении этот файл просто СНИМАЕТСЯ, переносить уже нечего.
 *
 * И они нашли там второй дефект, которого не видел никто: карта результатов
 * ключевалась ПУТЁМ, а PayBox и LemonSqueezy возвращают на один и тот же
 * адрес — обход по алфавиту затирал одного другим, оставаясь зелёным. Ключ
 * теперь пара «путь + провайдер». Урок общий: у свипа, чей результат —
 * множество, контроль охвата нужен ПОИМЁННО, число не отвечает «чьих».
 */

const BACKEND_SRC = join(__dirname, "..", "src");
const APP_DIR = resolve(__dirname, "../../frontend/src/app");
const NL = String.fromCharCode(10);

/** Поля, которыми задают адрес возврата. Ищем по коду, комментарии вырезаны. */
const URL_FIELDS = ["success_url", "return_url", "redirect_url", "pg_success_url"];

/**
 * Известный долг на 29.08.2026 — страницы возврата без замера покупки.
 * Убирать отсюда вместе с починкой, а не раньше. Файлы в чужих зонах: правит
 * их не эта ветка, поэтому здесь долг ЗАФИКСИРОВАН, а не исправлен.
 */
const KNOWN_UNMEASURED: Record<string, string> = {
  // ⚠️ ОБЕ записи — долг, и он УЖЕ ЗАКРЫТ в чужой ветке: владелец зоны
  // поставил один компонент PurchaseReturnTracker на обе страницы и
  // проверил мутациями. Условие исчезновения — мерж его ветки; после него
  // список обязан опустеть, и проверка «долг не растёт» это потребует.
  "/bureau": "возврат Stripe; закрыто в чужой ветке, убрать при мерже",
  "/qpaynet/deposit/success": "возврат QPayNet; закрыто там же, убрать при мерже",
};

/**
 * Не наши кассы. `/api/devhub/media/payment-link` создаёт ссылку на оплату
 * товара НАШЕГО КЛИЕНТА: возврат предназначен ЕГО покупателю и к нашей воронке
 * отношения не имеет. Признак — адрес возврата приходит из тела запроса.
 */
const NOT_OUR_CHECKOUT = new Set(["/devhub"]);

/** Чем страница может зафиксировать покупку. */
const PURCHASE_MARKERS = [
  'type: "checkout_success"',
  'type:"checkout_success"',
  'track("upgrade_complete"',
];

function backendFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      if (n === "node_modules") continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n.endsWith(".ts")) out.push(p);
    }
  };
  walk(BACKEND_SRC);
  return out;
}

/** Путь из значения поля: от первой косой черты до "?" или кавычки. */
function pathFromValue(value: string): string | null {
  const slash = value.indexOf("/");
  if (slash < 0) return null;
  let end = value.length;
  for (const stop of ["?", '"', "'", String.fromCharCode(96), " "]) {
    const at = value.indexOf(stop, slash);
    if (at >= 0 && at < end) end = at;
  }
  const p = value.slice(slash, end);
  // отбрасываем служебные и относительные обрывки
  if (p.length < 2 || p.startsWith("//")) return null;
  return p;
}

function returnPaths(): Array<{ file: string; path: string }> {
  const found: Array<{ file: string; path: string }> = [];
  for (const f of backendFiles()) {
    const src = stripComments(readFileSync(f, "utf8"));
    for (const field of URL_FIELDS) {
      let i = 0;
      for (;;) {
        i = src.indexOf(field + ":", i);
        if (i < 0) break;
        const nl = src.indexOf(NL, i);
        const line = src.slice(i + field.length + 1, nl < 0 ? src.length : nl);
        const p = pathFromValue(line);
        if (p) found.push({ file: f.replace(BACKEND_SRC, "src"), path: p });
        i += field.length;
      }
    }
  }
  return found;
}

/** Файл страницы Next.js для пути, если он есть. */
function pageFile(pathname: string): string | null {
  const segs = pathname.split("/").filter(Boolean);
  const dir = join(APP_DIR, ...segs);
  for (const n of ["page.tsx", "page.ts"]) {
    const p = join(dir, n);
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Слепая зона разбора по исходнику: у LemonSqueezy адрес СОБИРАЕТ функция,
 * и в строке `redirect_url: successRedirectUrl(...)` косой черты нет вовсе —
 * разбор пропускал её молча. Это главный провайдер подписок, то есть самая
 * дорогая из возможных пропаж. Зовём функцию, как соседний сторож.
 */
function functionBuiltPaths(): Array<{ file: string; path: string }> {
  const url = successRedirectUrl("https://aevion.app", "intent-guard", {
    reference: "tier_full_monthly",
    amountCents: 8900,
    currency: "USD",
    description: "guard probe",
    email: null,
  } as never);
  return [{ file: "src/lib/payment/lemonSqueezyProvider.ts", path: new URL(url).pathname }];
}

const PATHS = [...returnPaths(), ...functionBuiltPaths()];

describe("страница возврата после оплаты фиксирует покупку", () => {
  test("контроль: адреса возврата вообще найдены", () => {
    // Без этого пустой разбор выглядел бы как «нарушений нет».
    expect(PATHS.length, "разбор не нашёл ни одного адреса возврата — сторож пуст").toBeGreaterThan(4);
  });

  test("контроль: главный провайдер подписок в разбор ПОПАЛ", () => {
    // Разбор по исходнику его не видит: адрес собирает функция. Если эта
    // проверка покраснеет, значит сторож снова ослеп на самом дорогом пути.
    const ls = PATHS.filter((p) => p.file.includes("lemonSqueezy"));
    expect(ls.length, "путь возврата LemonSqueezy выпал из проверки").toBe(1);
    expect(ls[0].path.startsWith("/"), "разобран не путь, а что-то другое").toBe(true);
  });

  test("контроль: способ УМЕЕТ отличать считающую страницу", () => {
    const known = pageFile("/pricing/checkout/success");
    expect(known, "эталонная страница возврата исчезла").not.toBeNull();
    const src = readFileSync(known as string, "utf8");
    expect(
      PURCHASE_MARKERS.some((m) => src.includes(m)),
      "не вижу замер на странице, где он ТОЧНО есть — значит признак подобран неверно",
    ).toBe(true);
  });

  test("каждая наша страница возврата считает покупку либо числится в долге", () => {
    const silent: string[] = [];
    for (const { path } of PATHS) {
      if (NOT_OUR_CHECKOUT.has(path)) continue;
      if (KNOWN_UNMEASURED[path]) continue;
      const file = pageFile(path);
      if (!file) continue; // «страницы нет» — вопрос соседнего сторожа, не этого
      const src = readFileSync(file, "utf8");
      if (!PURCHASE_MARKERS.some((m) => src.includes(m))) silent.push(path);
    }
    expect(
      Array.from(new Set(silent)),
      "покупатель вернулся сюда после оплаты, а покупка не зафиксирована — " +
        "конверсию по каналу посчитать нельзя. Либо поставьте замер, либо внесите " +
        "в KNOWN_UNMEASURED с владельцем зоны.",
    ).toEqual([]);
  });

  test("долг не растёт: починенное убрано из списка", () => {
    const fixed = Object.keys(KNOWN_UNMEASURED).filter((p) => {
      const f = pageFile(p);
      if (!f) return false;
      return PURCHASE_MARKERS.some((m) => readFileSync(f, "utf8").includes(m));
    });
    expect(fixed, `замер появился — уберите из KNOWN_UNMEASURED: ${fixed.join(", ")}`).toEqual([]);
    expect(Object.keys(KNOWN_UNMEASURED).length, "долг разросся").toBeLessThan(4);
  });
});
