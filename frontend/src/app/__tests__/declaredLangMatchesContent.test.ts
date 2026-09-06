/**
 * @vitest-environment jsdom
 */
import { describe, test, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Объявленный язык страницы должен совпадать с тем, что на ней написано.
 *
 * Замер 23.08.2026 на проде, запрос с Accept-Language ru:
 *
 *   /cyberchess   кириллицы 246, латиницы в тексте 20   — под lang="en"
 *   /go           кириллицы 1318, латиницы 56           — под lang="en"
 *
 * Это две страницы, на которые ведут все ссылки к запуску 30.08. Chrome при
 * таком расхождении предлагает (а при включённой настройке молча делает)
 * машинный перевод НАШЕЙ страницы, и первое впечатление человек получает от
 * нашего же текста, пропущенного через переводчик.
 *
 * Проверяется ТА САМАЯ строка, которая уезжает в разметку: логика живёт внутри
 * инлайнового скрипта (он обязан выполниться до решения браузера о переводе),
 * и переписывать её в тест значило бы проверять копию, а не боевой код.
 */

const LAYOUT = join(dirname(fileURLToPath(import.meta.url)), "..", "layout.tsx");

/**
 * Достаёт оба инлайновых скрипта языка из разметки макета.
 *
 * Разбор индексами, а не регуляркой: шаблон для строкового литерала требует
 * обратных слэшей, а они на этой машине теряются на границе вызова — правка
 * приезжает уже испорченной, и тест падает разбором, а не по делу.
 */
function inlineScripts(src: string): string[] {
  const BACKSLASH = String.fromCharCode(92);
  const MARK = '__html: "';
  const out = [];
  let i = src.indexOf(MARK);
  while (i > -1) {
    const start = i + MARK.length;
    let j = start;
    while (j < src.length && !(src[j] === '"' && src[j - 1] !== BACKSLASH)) j++;
    out.push(src.slice(start, j));
    i = src.indexOf(MARK, j);
  }
  return out;
}

function langScripts(): { cookie: string; content: string } {
  const all = inlineScripts(readFileSync(LAYOUT, "utf8"));
  const cookie = all.find((s) => s.includes("aevion_lang_v1"));
  const content = all.find((s) => s.includes("data-lang-src") && !s.includes("aevion_lang_v1"));
  expect(cookie, "в макете нет скрипта выбора языка по куке").toBeTruthy();
  expect(content, "в макете нет скрипта определения языка по содержимому").toBeTruthy();
  return { cookie: cookie!, content: content! };
}

const RU_TEXT =
  "Шахматы с ИИ-коучем. Разбор партии, задачи дня, турниры. " +
  "Играйте бесплатно и получайте объяснение каждого хода на понятном языке. " +
  "Рейтинг, история партий и подсказки тренера AEVION CyberChess.";
const EN_TEXT =
  "AEVION raises a returnable advance to finish the platform. " +
  "Forty product nodes, one trust graph, bottom-up modelled ARR across three flagships.";

/**
 * Payload, который Next.js кладёт в <script> на каждой странице.
 *
 * Он здесь не для правдоподобия. Первая версия скрипта читала
 * `document.body.textContent`, а тот включает текст ВНУТРИ script — и на проде
 * порог не проходил НИ НА ОДНОЙ странице: у /cyberchess выходило кир 235 при
 * лат 9507. Прежний тест этого не видел, потому что клал чистый текст прямо в
 * textContent, то есть проверял форму входа, которой в жизни не бывает.
 */
const NEXT_PAYLOAD =
  'self.__next_f.push([1,"' +
  ("routerState modules chunk static prefetch segment layout template loading error " +
    "notFound forbidden unauthorized parallelRoutes buildId assetPrefix nextExport ").repeat(40) +
  '"])';

/** Разметка того же вида, что уезжает в браузер: видимый текст + payload. */
function render(visible: string, opts: { clientRendered?: boolean } = {}) {
  document.documentElement.removeAttribute("data-lang-src");
  document.documentElement.lang = "en";
  document.body.innerHTML = "";
  const holder = document.createElement("div");
  // Страница, которая рисуется на клиенте, в момент разбора тела почти пуста —
  // видимый текст появляется позже. Замер: у /cyberchess было 16 знаков.
  holder.textContent = opts.clientRendered ? "Загрузка" : visible;
  document.body.appendChild(holder);
  const script = document.createElement("script");
  // Тип нужен, чтобы jsdom не ПОПЫТАЛСЯ выполнить payload как код. Для самой
  // проверки это ничего не меняет: определитель смотрит на имя узла (SCRIPT),
  // а не на его тип, и в браузере пропустит и обычный <script>.
  script.type = "application/json";
  script.textContent = NEXT_PAYLOAD;
  document.body.appendChild(script);
  return holder;
}

/** Выполняет ТУ САМУЮ строку, которая уезжает в разметку. */
function runContentScript() {
  const { content } = langScripts();
  // eslint-disable-next-line no-new-func
  new Function(content)();
}

describe("объявленный язык совпадает с содержимым страницы", () => {
  beforeEach(() => {
    document.cookie = "aevion_lang_v1=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  test("русская страница объявляется как ru", () => {
    render(RU_TEXT);
    runContentScript();
    expect(document.documentElement.lang).toBe("ru");
  });

  test("payload Next.js в <script> не считается за латиницу", () => {
    // Отрицательный контроль к самому дефекту: на проде payload перевешивал
    // видимый текст в сорок раз, и скрипт молчал на всех страницах.
    const holder = render(RU_TEXT);
    const payloadLen = (document.body.textContent || "").length;
    expect(payloadLen, "payload не попал в разметку — контроль недействителен").toBeGreaterThan(
      (holder.textContent || "").length * 5,
    );
    runContentScript();
    expect(document.documentElement.lang).toBe("ru");
  });

  test("страница, нарисованная на клиенте, получает ru ПОСЛЕ отрисовки", () => {
    // При разборе тела видимого текста ещё нет; решение обязано быть
    // пересмотрено на DOMContentLoaded / load, иначе весь клиентский рендер
    // остаётся под неверным языком.
    const holder = render(RU_TEXT, { clientRendered: true });
    runContentScript();
    expect(document.documentElement.lang, "порог сработал на скелете загрузки").toBe("en");
    holder.textContent = RU_TEXT;
    window.dispatchEvent(new Event("load"));
    expect(document.documentElement.lang).toBe("ru");
  });

  test("английская страница остаётся en", () => {
    render(EN_TEXT);
    runContentScript();
    expect(document.documentElement.lang).toBe("en");
  });

  test("русский текст с латинскими названиями всё равно ru", () => {
    // У любой нашей русской страницы в тексте есть латиница: AEVION,
    // CyberChess, QRight. Порог «кириллицы больше латиницы» на них ломался бы.
    render(RU_TEXT + " AEVION CyberChess QRight QBuild QCoreAI Gumroad Railway Vercel");
    runContentScript();
    expect(document.documentElement.lang).toBe("ru");
  });

  test("почти пустая страница язык не меняет", () => {
    // Скелет загрузки — не повод объявлять язык: текста ещё нет.
    render("Загрузка");
    runContentScript();
    expect(document.documentElement.lang).toBe("en");
  });

  test("ВЫБОР человека старше догадки по содержимому", () => {
    render(RU_TEXT);
    document.documentElement.lang = "en";
    document.documentElement.setAttribute("data-lang-src", "cookie");
    runContentScript();
    expect(
      document.documentElement.lang,
      "выбранный человеком язык перебит определением по тексту",
    ).toBe("en");
  });

  test("скрипт куки помечает источник, иначе второй скрипт его перебьёт", () => {
    const { cookie } = langScripts();
    expect(cookie).toContain("data-lang-src");
  });

  test("определение стоит ПОСЛЕ содержимого, иначе читать нечего", () => {
    const src = readFileSync(LAYOUT, "utf8");
    const providers = src.indexOf("</ClientProviders>");
    const detector = src.indexOf("data-lang-src','content'");
    expect(providers, "не нашёл ClientProviders").toBeGreaterThan(-1);
    expect(detector, "не нашёл скрипт определения").toBeGreaterThan(-1);
    expect(
      detector,
      "скрипт определения языка стоит ДО содержимого — document.body там ещё пуст",
    ).toBeGreaterThan(providers);
  });
});
