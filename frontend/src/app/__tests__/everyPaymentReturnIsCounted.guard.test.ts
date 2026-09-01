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
      // Значение — вызов функции: путь внутри неё.
      const call = /:\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(line);
      if (!call) continue;
      const body = functionBody(text, call[1]);
      const viaFn = body ? pathIn(body) : null;
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
  return text.includes("checkout_success") || text.includes("PurchaseReturnTracker");
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
  const KNOWN_INLINE = ["pricing/checkout/success/page.tsx"];

  /**
   * Инлайновая отметка: событие названо прямо в КОДЕ страницы.
   *
   * ⚠️ Комментарии срезаются, и это не педантизм — на них сторож уже ошибся.
   * Соседнее окно, починив страницу успеха, объяснило в комментарии, ПОЧЕМУ не
   * ставит сюда общий `PurchaseReturnTracker` (он не нёс тариф, сумму и
   * период). Первая редакция этой функции искала имя компонента без разбора и
   * приняла объяснение за использование: страница стала выглядеть «уже
   * переведённой», храповик потребовал убрать её из списка и покраснел бы в их
   * сборке по неверной причине.
   *
   * Тот же класс ловил меня накануне в этом же файле — свой комментарий,
   * называющий механизм, прочитался как сам механизм. Второй раз подряд, и оба
   * раза лечится одной строкой: сперва срезать комментарии, потом искать.
   */
  function firesInline(file: string): boolean {
    const text = readFileSync(file, "utf8")
      .split(String.fromCharCode(10))
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join(String.fromCharCode(10));
    // Компонент ставит отметку сам — его использование инлайном не считается.
    if (text.includes("<PurchaseReturnTracker")) return false;
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

    // Третья проба — на ней признак 01.09.2026 и ошибся. Страница может
    // ОБЪЯСНЯТЬ в комментарии, почему не ставит общий компонент (у соседнего
    // окна ровно так: их событие несёт тариф, сумму и период). Признак,
    // ищущий имя без разбора, принимал объяснение за использование: страница
    // выглядела «уже переведённой», храповик требовал убрать её из списка и
    // краснел в чужой сборке по неверной причине.
    const explainedSample =
      "// Общий PurchaseReturnTracker сюда не ставлю намеренно: он не несёт тариф." +
      String.fromCharCode(10) +
      'useEffect(() => { if (!provider) return; track({ type: "checkout_success", tier }); }, []);';
    writeFileSync(tmp, explainedSample, "utf8");
    expect(
      firesInline(tmp),
      "признак принял КОММЕНТАРИЙ об общем компоненте за его использование",
    ).toBe(true);
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
