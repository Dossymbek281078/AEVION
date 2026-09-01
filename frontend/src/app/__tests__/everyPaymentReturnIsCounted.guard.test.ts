import { describe, expect, test } from "vitest";
import { existsSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Куда провайдер вернул человека после оплаты — там покупка обязана считаться.
 *
 * Замер 29.08.2026 (находка соседней вкладки, проверена здесь заново). Адрес
 * возврата задаётся у КАЖДОГО провайдера свой, и лишь часть ведёт на
 * `/pricing/checkout/success`, где отметка стояла с самого начала:
 *
 *   PayBox   → /pricing/checkout/success   ✅ считалось
 *   PayPal   → /pricing/checkout/success   ✅ считалось
 *   Stripe   → /bureau?paid=1              🔴 не считалось
 *   QPayNet  → /qpaynet/deposit/success    🔴 не считалось
 *
 * Деньги при этом не терялись: вебхуки пишут покупку в базу независимо от
 * страницы. Терялась СВЯЗЬ оплаты с каналом, из которого пришёл человек — без
 * неё реклама, ролик и рассылка выглядят одинаково, и вопрос «что окупилось»
 * остаётся без ответа. Молчаливая потеря: воронка при этом рисуется и выглядит
 * правдоподобно, просто часть продаж в неё не попадает.
 *
 * Сторож идёт от ПРОВАЙДЕРА, а не от списка страниц: список страниц пришлось бы
 * вести руками, и новый провайдер в него просто не попал бы. Адреса берутся из
 * кода бэкенда, поэтому добавление пятой кассы с новым адресом возврата красит
 * сборку сразу.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");
const SRC = resolve(APP, "..");
const REPO = resolve(SRC, "..", "..");
const BACKEND = join(REPO, "aevion-globus-backend", "src");

/** Файлы бэкенда, где задаётся адрес возврата после оплаты. */
function providerFiles(): string[] {
  const out: string[] = [];
  const payment = join(BACKEND, "lib", "payment");
  if (existsSync(payment)) {
    for (const f of readdirSync(payment)) {
      if (f.endsWith(".ts")) out.push(join(payment, f));
    }
  }
  for (const f of ["qpaynet.ts", "checkout.ts"]) {
    const p = join(BACKEND, "routes", f);
    if (existsSync(p)) out.push(p);
  }
  return out;
}

const RETURN_FIELD = /success_url|successUrl|return_url|returnUrl|redirect_url|redirectUrl/;

/** Путь после подстановки базового адреса: ${base}/… или ${FRONTEND}/… */
function pathIn(text: string): string | null {
  const m = /\$\{[A-Za-z_]+\}(\/[A-Za-z0-9/_-]+)/.exec(text);
  return m ? m[1] : null;
}

/**
 * Тело функции по имени — грубо, от объявления до следующего объявления
 * верхнего уровня. Точный разбор тут не нужен: путь стоит в `return`.
 */
/**
 * Путь по ЦЕПОЧКЕ вызовов, включая переход в соседний файл.
 *
 * Глубина ограничена тремя шагами намеренно: этого хватает на нашу цепочку с
 * запасом, а неограниченный обход по всему каталогу начал бы притаскивать
 * посторонние пути и превратил бы находку в шум. Пройденные имена помним —
 * иначе взаимный вызов зациклил бы разбор.
 */
function pathViaCalls(line: string, ownText: string, depth = 3, seen = new Set<string>()): string | null {
  const call = /:?\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(line);
  if (!call || depth <= 0) return null;
  const name = call[1];
  if (seen.has(name)) return null;
  seen.add(name);

  // Сперва свой файл, потом остальные файлы платежей: помощник мог переехать.
  const texts = [ownText, ...providerFiles().map((f) => readFileSync(f, "utf8"))];
  for (const t of texts) {
    const body = functionBody(t, name);
    if (!body) continue;
    const here = pathIn(body);
    if (here) return here;
    // Путь глубже: тело зовёт следующий помощник.
    for (const l of body.split("\n")) {
      if (!/return\s|=\s/.test(l)) continue;
      const deeper = pathViaCalls(l, t, depth - 1, seen);
      if (deeper) return deeper;
    }
  }
  return null;
}

function functionBody(text: string, name: string): string | null {
  const at = text.indexOf(`function ${name}(`);
  if (at < 0) return null;
  const rest = text.slice(at + 10);
  const next = rest.search(/\nexport (async )?function |\nfunction |\nconst [A-Z]/);
  return next < 0 ? rest : rest.slice(0, next);
}

/**
 * Пути возврата, вытащенные из кода. Берём только то, что стоит в поле адреса
 * успеха: просто «строка, похожая на путь» притащила бы половину маршрутов.
 *
 * ⚠️ Адрес не всегда стоит в самой строке поля. У LemonSqueezy — главного
 * провайдера подписок — он собирается функцией:
 *
 *     redirect_url: successRedirectUrl(base, intentId, input)
 *
 * Косой черты в этой строке нет вовсе, и первая версия этого разбора пропускала
 * её МОЛЧА: список выглядел полным, а самой дорогой кассы в нём не было.
 * Нашлось не глазами, а знаменателем — независимый разбор соседней вкладки дал
 * больше адресов, чем мой. Поэтому: если в строке поля пути нет, но есть вызов
 * функции — идём в её тело.
 */
function returnPaths(): Array<{ path: string; file: string }> {
  // Ключ — ПАРА «путь + провайдер», а не путь.
  //
  // Сперва ключом был один путь, и это съело ровно ту кассу, ради которой
  // разбор и расширяли: PayBox и LemonSqueezy возвращают на один и тот же
  // /pricing/checkout/success, обход идёт по алфавиту, и paybox затирал
  // lemonsqueezy. Проверка «каждая страница считает» при этом оставалась
  // зелёной — терялась не строка, а ЗНАНИЕ О ТОМ, ЧЬЯ она.
  const found = new Map<string, { path: string; file: string }>();
  for (const file of providerFiles()) {
    const text = readFileSync(file, "utf8");
    const short = file.split(/[\\/]/).pop()!;
    const add = (path: string) => found.set(`${path}::${short}`, { path, file: short });
    for (const line of text.split("\n")) {
      if (!RETURN_FIELD.test(line)) continue;
      const direct = pathIn(line);
      if (direct) {
        add(direct);
        continue;
      }
      // Значение — вызов функции: идём по ЦЕПОЧКЕ вызовов, а не на один шаг.
      //
      // ⚠️ Расширено 31.08.2026. Прежняя версия шла на ОДИН уровень и только в
      // том же файле, и этого хватало ровно до консолидации 30.08: адрес
      // возврата лежал в ТРЁХ копиях, их свели в общий `buildSuccessUrl`
      // (lib/payment/successUrl.ts). После этого цепочка стала такой:
      //
      //     redirect_url: successRedirectUrl(...)      ← поле есть, пути нет
      //       -> successRedirectUrl = buildSuccessUrl(...)   ← и здесь нет
      //         -> `${base}/pricing/checkout/success`        ← путь ЗДЕСЬ, в другом файле
      //
      // Ни одна строка не проходит оба условия сразу, поэтому разбор потерял
      // самую дорогую кассу. Заметил это не глаз и не тип, а КОНТРОЛЬ ОХВАТА
      // рядом с проверкой: «адреса возврата вообще найдены». Без него
      // консолидация прошла бы молча, а покрытие исчезло бы — проверка
      // «каждая страница считает возврат» осталась бы зелёной на пустом списке.
      const viaFn = pathViaCalls(line, text);
      if (viaFn) add(viaFn);
    }
  }
  return [...found.values()];
}

/** Файлы провайдеров, в которых вообще задаётся адрес возврата. */
function filesDeclaringReturn(): string[] {
  return providerFiles()
    .filter((f) => readFileSync(f, "utf8").split("\n").some((l) => RETURN_FIELD.test(l)))
    .map((f) => f.split(/[\\/]/).pop()!);
}

/** Файл страницы, отвечающей за путь приложения (Next App Router). */
function pageFileFor(path: string): string | null {
  const dir = join(APP, ...path.split("/").filter(Boolean));
  for (const name of ["page.tsx", "page.ts"]) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
}

/** Считает ли страница покупку — сама или через общий компонент отметки. */
function countsPurchase(pageFile: string): boolean {
  const text = readFileSync(pageFile, "utf8");
  /*
   * ⚠️ 31.08.2026: искали ПОДСТРОКУ, и она нашлась внутри более длинного имени.
   *
   * Мутация переименовала компонент в `<PurchaseReturnTrackerX` — сломанная
   * отрисовка, которой в React не существует. Проверка осталась зелёной:
   * подстрока `PurchaseReturnTracker` в новом имени присутствует.
   *
   * То есть сторож охранял НАПИСАНИЕ, а не использование. Любая опечатка в
   * имени компонента — и страница перестаёт считать покупки, а он молчит.
   *
   * Граница берётся угловой скобкой слева и разделителем справа: после имени
   * в отрисовке всегда идёт пробел, косая черта или закрывающая скобка, и ни
   * один из них не может оказаться буквой продолжения имени.
   */
  const рисуетКомпонент = ["<PurchaseReturnTracker ", "<PurchaseReturnTracker/", "<PurchaseReturnTracker>", "<PurchaseReturnTracker
"]
    .some((форма) => text.includes(форма));
  return text.includes("checkout_success") || рисуетКомпонент;
}

describe("возврат после оплаты отмечается на каждой кассе", () => {
  const paths = returnPaths();

  test("контроль: адреса возврата вообще найдены", () => {
    // Пустой список сделал бы проверку ниже зелёной при любом состоянии кода —
    // и именно так выглядел бы отказ разбора после переименования полей.
    expect(paths.length, `найдено: ${paths.map((p) => p.path).join(", ")}`).toBeGreaterThanOrEqual(3);
  });

  test("контроль охвата: ни один провайдер не выпал из разбора", () => {
    // Именно этой проверки не хватало: LemonSqueezy собирает адрес функцией, в
    // строке поля нет косой черты, и он пропадал из списка молча. Список
    // выглядел полным — а самой дорогой кассы в нём не было. Поимённо, а не
    // числом: «адресов стало больше» не отвечает на вопрос, ЧЬИХ.
    const declared = filesDeclaringReturn();
    const parsed = new Set(paths.map((p) => p.file));
    const lost = declared.filter((f) => !parsed.has(f));
    expect(
      lost,
      `провайдер задаёт адрес возврата, а разбор его не увидел: ${lost.join(", ")}`,
    ).toEqual([]);
    expect(
      declared,
      "главный провайдер подписок обязан быть среди разбираемых",
    ).toContain("lemonSqueezyProvider.ts");
  });

  test("контроль: страницы для этих адресов существуют", () => {
    const missing = paths.filter((p) => pageFileFor(p.path) === null);
    expect(
      missing.map((p) => `${p.path} (${p.file})`),
      "провайдер возвращает на адрес, которому не соответствует ни одна страница",
    ).toEqual([]);
  });

  test("контроль: способ различает считающие и не считающие страницы", () => {
    // Без этого контроля проверка ниже могла бы «подтверждать» отметку на любой
    // странице — например если бы признак совпадал с чем-то, что есть везде.
    const anyPage = join(APP, "shop", "page.tsx");
    expect(existsSync(anyPage), "страница витрины не найдена — контроль невозможен").toBe(true);
    expect(countsPurchase(anyPage), "витрина покупку НЕ отмечает, а способ говорит обратное").toBe(false);
  });

  test("каждая страница возврата отмечает покупку", () => {
    const silent = paths
      .filter((p) => {
        const file = pageFileFor(p.path);
        return file !== null && !countsPurchase(file);
      })
      .map((p) => `${p.path} ← ${p.file}`);
    expect(
      silent,
      "провайдер вернул человека сюда, а покупка не считается — продажа выпадает из воронки",
    ).toEqual([]);
  });

  /**
   * Отметку ставит ОБЩИЙ компонент, а не своя копия на каждой странице.
   *
   * Дыра в этом же стороже, найденная 31.08.2026. Проверки выше требуют, чтобы
   * страница возврата покупку СЧИТАЛА, и молчат о том, считает ли она только
   * НАСТОЯЩИЙ возврат. `/pricing/checkout/success` завела свою копию
   * `useEffect` + `track({ type: "checkout_success" })` без единого условия:
   * событие уходит при каждом открытии адреса. Итоговый шаг воронки считает
   * ЗАХОДЫ, а не покупки, и завышение попадает ровно в ту цифру, ради точности
   * которой отметка и делалась.
   *
   * Общий `PurchaseReturnTracker` этого не допускает: у него есть
   * `if (!isSuccess || fired.current) return`, то есть признак успеха и защита
   * от повторной отрисовки. Правило «не копировать его тело на страницы»
   * записано в самом компоненте — копия одного действия расходится молча.
   *
   * Поэтому инвариант формулируется просто и проверяется надёжно: инлайновых
   * вызовов `checkout_success` быть не должно, отметку ставит компонент.
   *
   * ⚠️ Это ХРАПОВИК. Страницу правят прямо сейчас две чужие ветки, поэтому
   * правку туда не несу — держу список известных, и он обязан только таять.
   */
  /*
   * ⚠️ Запись ОСТАЁТСЯ, и это осознанно (31.08.2026).
   *
   * Соблазн был убрать её: у страницы 31.08 появились ворота по признаку
   * возврата, и дефект, ради которого храповик заводили — «считаем заходы, а не
   * покупки», — закрыт. Но храповик стережёт не дефект, а КОПИЮ: пока отметка
   * живёт отдельным кодом на странице, она может разойтись с общей снова.
   * Копия на месте, значит и запись на месте.
   *
   * Почему копию не убрали: общий PurchaseReturnTracker не несёт тариф, сумму и
   * период, а в здешнем событии они есть. Замена ради единообразия стоила бы
   * трёх полей воронки.
   *
   * ЧЕГО НЕ НАДО ПУГАТЬСЯ, увидев эту строку: копия не беззащитна. У неё есть
   * свой сторож поведения — `successNeverClaimsUnverified.test.tsx`: с кассой в
   * адресе событие уходит, на голом адресе не уходит, мутация «снять ворота»
   * ловится. Убирать запись отсюда стоит вместе с копией, а не вместо неё.
   */
  /*
   * ✅ ПУСТ с 01.09.2026 — храповик растаял, и это правильный способ его снять.
   *
   * Запись держалась не из-за дефекта, а из-за копии учёта на странице. Копия
   * была там потому, что общий компонент не нёс тариф, сумму и период. Соседнее
   * окно инструмент починило — компонент принимает их с сегодня. Причина
   * исключения исчезла, значит исчезло и исключение.
   *
   * Убирать запись ВМЕСТЕ с копией, а не вместо неё: пока копия жива, храповик
   * стережёт именно её.
   */
  const KNOWN_INLINE: string[] = [];

  /** Инлайновая отметка: событие названо прямо в файле страницы. */
  function firesInline(file: string): boolean {
    const text = readFileSync(file, "utf8");
    // Компонент ставит отметку сам — его ИСПОЛЬЗОВАНИЕ инлайном не считается.
    //
    // ⚠️ 31.08.2026: искали голое ИМЯ, и признак поймал КОММЕНТАРИЙ. На странице
    // успеха написано, почему общий компонент туда не ставят (он не несёт тариф,
    // сумму и период) — одного упоминания хватило, чтобы сторож счёл отметку
    // переехавшей и объявил храповик протухшим.
    //
    // Ошибка тихая в обе стороны: страница с копией выглядела бы чистой, а
    // запись в списке — лишней. Ищем угловую скобку: это отрисовка, а не слово
    // в тексте. Комментарий про компонент теперь можно писать свободно.
    // ⚠️ 01.09.2026: границу я поставил в СОСЕДНЕЙ проверке и забыл про эту.
    // Нашло другое окно, померив мою же мутацию: `<PurchaseReturnTrackerX`
    // проходил здесь как «страница уже на общем компоненте», хотя отрисовки с
    // таким именем в React нет вовсе.
    //
    // Урок дороже правки: починив класс в одном месте, надо спросить, где ЕЩЁ
    // он живёт. Я знал про подстроку внутри длинного имени, назвал этот класс
    // вслух — и оставил его через двадцать строк от собственного объяснения.
    if (["<PurchaseReturnTracker ", "<PurchaseReturnTracker/", "<PurchaseReturnTracker>", "<PurchaseReturnTracker
"]
      .some((форма) => text.includes(форма))) return false;
    return /track\(\s*\{[\s\S]{0,200}?checkout_success/.test(text);
  }

  test("контроль: способ отличает инлайновую отметку от общего компонента", () => {
    // Обе стороны пробой, а не наличием дефекта: иначе после починки контроль
    // покраснел бы именно потому, что чинить больше нечего.
    const inlineSample = 'useEffect(() => { track({ type: "checkout_success", tier }); }, []);';
    const componentSample = '<PurchaseReturnTracker source="bureau" provider="stripe" successParam="paid" />';
    const tmp = join(APP, "__tests__", "__probe_inline__.tsx");
    writeFileSync(tmp, inlineSample, "utf8");
    expect(firesInline(tmp), "признак не видит инлайновую отметку").toBe(true);
    writeFileSync(tmp, componentSample, "utf8");
    expect(firesInline(tmp), "признак считает инлайном использование общего компонента").toBe(false);
    rmSync(tmp, { force: true });
  });

  test("новых страниц со своей копией отметки не появилось", () => {
    const inline = paths
      .map((p) => pageFileFor(p.path))
      .filter((f): f is string => f !== null)
      .filter((f) => firesInline(f))
      .map((f) => relative(APP, f).split(sep).join("/"));
    const fresh = inline.filter((f) => !KNOWN_INLINE.includes(f));
    expect(
      fresh,
      "страница возврата ставит отметку своей копией: без условия успеха событие " +
        "уходит при каждом открытии адреса, и воронка считает заходы вместо покупок",
    ).toEqual([]);
  });

  test("храповик не протух: всё, что в списке, всё ещё ставит отметку инлайном", () => {
    const inline = new Set(
      paths
        .map((p) => pageFileFor(p.path))
        .filter((f): f is string => f !== null)
        .filter((f) => firesInline(f))
        .map((f) => relative(APP, f).split(sep).join("/")),
    );
    const stale = KNOWN_INLINE.filter((f) => !inline.has(f));
    expect(stale, `уже через общий компонент, убрать из списка: ${stale.join(", ")}`).toEqual([]);
  });
});
