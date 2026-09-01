import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import {
  LAUNCH_MODULES,
  buildLaunchEmail,
  matchesModule,
  planLaunchAnnounce,
} from "../src/lib/launchAnnounce";

// Подготовка рассылки на запуск — 19.08.2026.
//
// Шесть страниц обещают «напишем в день запуска», а механизма рассылки не было
// вовсе. Этот модуль — подготовка: письмо, отбор получателей и сухой прогон.
// Отправки в нём нет намеренно, и первый же тест это фиксирует: разослать письма
// живым людям нельзя повторить «уже правильно», поэтому отправку выполняет
// владелец.
//
// Отбор — самое хрупкое место, потому что метка источника приходит в трёх видах:
// «devhub», «devhub-instagram» и (когда починят перезапись при повторной
// подписке) список через запятую.

// Секрет нужен, чтобы собиралась ссылка отписки: без него письмо намеренно пишет
// живой адрес почты вместо ссылки, которая молча не сработает (см.
// lib/waitlistUnsubToken.ts). Здесь проверяется именно рабочая ссылка.
process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || "test-secret-at-least-16-chars-long";

describe("отбор получателей по метке источника", () => {
  test("точная метка и метка с каналом подходят", () => {
    expect(matchesModule("devhub", "devhub")).toBe(true);
    expect(matchesModule("devhub-instagram", "devhub")).toBe(true);
    expect(matchesModule("multichat-qr-code", "multichat")).toBe(true);
  });

  test("чужая метка не подходит, даже если слово встречается внутри", () => {
    // Сравнение строгое по началу, а не подстрокой: иначе «devhub» притянул бы
    // любую метку, где это слово встретилось.
    expect(matchesModule("olddevhub", "devhub")).toBe(false);
    expect(matchesModule("cyberchess", "devhub")).toBe(false);
    expect(matchesModule("multichat", "devhub")).toBe(false);
  });

  test("склеенный список источников — оба интереса учтены", () => {
    // Так метка будет выглядеть после починки перезаписи: человек, оставивший
    // адрес и на шахматах, и на DevHub, обязан попасть в ОБЕ рассылки. Сейчас
    // источник перезаписывается последним, и этот случай — задел на починку.
    const both = "cyberchess-instagram,devhub";
    expect(matchesModule(both, "cyberchess")).toBe(true);
    expect(matchesModule(both, "devhub")).toBe(true);
    expect(matchesModule(both, "multichat")).toBe(false);
  });

  test("регистр и пробелы не мешают, пустая метка не подходит никуда", () => {
    expect(matchesModule("  DevHub-Instagram ", "devhub")).toBe(true);
    expect(matchesModule("", "devhub")).toBe(false);
    expect(matchesModule("unknown", "devhub")).toBe(false);
  });
});

describe("сухой прогон — кто получил бы письмо", () => {
  const rows = [
    { email: "a@primer.ru", source: "devhub" },
    { email: "b@primer.ru", source: "devhub-instagram" },
    { email: "c@primer.ru", source: "cyberchess" },
    { email: "A@primer.ru", source: "devhub-telegram" }, // тот же человек другим регистром
    { email: "d@primer.ru", source: "" },
    { email: "e@primer.ru", source: "cyberchess,devhub" },
  ];

  test("отобраны только подписчики этого модуля", () => {
    const plan = planLaunchAnnounce("devhub", rows);
    expect(plan.recipients).toEqual(["a@primer.ru", "b@primer.ru", "e@primer.ru"]);
  });

  test("один человек — одно письмо, даже если подписался дважды", () => {
    // «A@primer.ru» и «a@primer.ru» — один адрес: два письма подряд читаются как
    // сбой у нас, а не как внимание.
    const plan = planLaunchAnnounce("devhub", rows);
    expect(plan.recipients.filter((r) => r.startsWith("a@")).length).toBe(1);
  });

  test("видно, сколько записей просмотрено — иначе пустой список двусмыслен", () => {
    // «Никто не подписан» и «список не прочитан» дают одинаковый нуль
    // получателей, а решения разные.
    const plan = planLaunchAnnounce("multichat", rows);
    expect(plan.recipients).toEqual([]);
    expect(plan.scanned).toBe(rows.length);
    expect(plan.preview).toBeNull();
  });

  test("ни одного письма не отправлено — это записано в самом отчёте", () => {
    const plan = planLaunchAnnounce("devhub", rows);
    expect(plan.sent).toBe(0);
  });
});

describe("текст письма — обещает только то, что открылось", () => {
  test.each(Object.keys(LAUNCH_MODULES))("%s: название, дата, ссылка и отписка на месте", (slug) => {
    const mail = buildLaunchEmail(slug, "kto@primer.ru");
    const m = LAUNCH_MODULES[slug];

    expect(mail.subject).toContain(m.name);
    // Дата в теме — только когда она у нас есть. У четырёх модулей из пяти её
    // нет, и это осознанно: см. шапку LAUNCH_MODULES.
    if (m.date) expect(mail.subject).toContain(m.date);
    expect(mail.htmlContent).toContain(`https://aevion.app${m.page}`);
    // Отписка обязательна в каждом письме — иначе рассылка становится спамом
    // юридически, а не только по ощущению.
    // С 21.08 ссылка несёт ТОКЕН: до этого дня она вела на страницу, которой не
    // существует (404), то есть отписки не было вовсе. Проверяем и путь, и токен —
    // иначе тест снова пройдёт на мёртвой ссылке.
    expect(mail.htmlContent).toMatch(/unsubscribe\?email=[^"]+&t=[0-9a-f]{32}/);
    expect(mail.textContent).toMatch(/Отписаться/);
    // Адрес в ссылке отписки экранирован: почта с плюсом или кириллицей не
    // должна ломать ссылку.
    const withPlus = buildLaunchEmail(slug, "kto+tag@primer.ru");
    expect(withPlus.htmlContent).toContain("kto%2Btag%40primer.ru");
  });

  test.each(Object.keys(LAUNCH_MODULES))("%s: ни цены, ни скидки в письме", (slug) => {
    // Цена либо не назначена (мультичат), либо отсутствует в прайсе вовсе
    // (DevHub: $149 стоит только в плане запуска). Обещать в письме то, что
    // нельзя оплатить, — худший вид обещания: человек уже впустил нас в почту.
    const mail = buildLaunchEmail(slug, "kto@primer.ru");
    const all = `${mail.subject} ${mail.htmlContent} ${mail.textContent ?? ""}`;
    expect(all).not.toMatch(/\$\s?\d/);
    expect(all).not.toMatch(/скидк/i);
    expect(all).not.toMatch(/\d+\s?%/);
  });

  test("метки письма позволяют потом отличить рассылку запуска от прочих", () => {
    const mail = buildLaunchEmail("devhub", "kto@primer.ru");
    expect(mail.tags).toContain("launch");
    expect(mail.tags).toContain("launch-devhub");
  });

  test("неизвестный модуль — отказ, а не письмо ни о чём", () => {
    expect(() => buildLaunchEmail("нет-такого", "kto@primer.ru")).toThrow(/неизвестный модуль/);
    expect(() => planLaunchAnnounce("нет-такого", [])).toThrow(/неизвестный модуль/);
  });
});

describe("дата запуска обязана называть свой источник", () => {
  // Прежний тест требовал у всех пяти модулей непустую дату — и был зелёным на
  // трёх ВЫДУМАННЫХ датах. Он проверял длину строки, а не происхождение, то есть
  // наказывал бы за честное «дата не объявлена» и одобрял любую подставленную.
  //
  // Новое правило: дата не обязательна, но неподтверждённой быть не может.

  test("модулей не меньше пяти, у каждого страница и описание", () => {
    const slugs = Object.keys(LAUNCH_MODULES);
    expect(slugs.length).toBeGreaterThanOrEqual(5);
    for (const s of slugs) {
      expect(LAUNCH_MODULES[s].page.startsWith("/")).toBe(true);
      expect(LAUNCH_MODULES[s].opens.length).toBeGreaterThan(10);
    }
  });

  test("есть дата — есть и названный источник; нет даты — источник пуст", () => {
    for (const [slug, m] of Object.entries(LAUNCH_MODULES)) {
      if (m.date) {
        expect(m.date.length, `${slug}: дата слишком короткая`).toBeGreaterThan(3);
        // Ровно та проверка, которой не было: дата без источника — выдумка.
        expect(m.dateSource.length, `${slug}: дата без источника`).toBeGreaterThan(10);
      } else {
        expect(m.date).toBeNull();
        expect(m.dateSource).toBe("");
      }
    }
  });

  test("хотя бы у одного модуля дата подтверждена — иначе проверка выше пуста", () => {
    // Отрицательный контроль: без него все `date: null` дали бы зелёный тест,
    // ничего не проверяющий.
    const withDate = Object.values(LAUNCH_MODULES).filter((m) => m.date);
    expect(withDate.length).toBeGreaterThanOrEqual(1);
    // Расширено 30.08.2026: источником стал ПЛАН ОСНОВАТЕЛЯ, а он
    // авторитетнее имени ветки. Строгость сохранена — шаблон по-прежнему
    // требует назвать конкретный артефакт, а не общие слова.
    expect(withDate[0].dateSource).toMatch(/launch\/2026-08-30|CyberChess|ПЛАН-даты-запуска/);
  });

  test("ни одно письмо не печатает null или undefined вместо даты", () => {
    // Шаблонная строка `${m.date}` при null молча вставляет слово «null» — в
    // тему письма живому человеку. Проверяем все модули, включая бездатные.
    for (const slug of Object.keys(LAUNCH_MODULES)) {
      const mail = buildLaunchEmail(slug, "kto@primer.ru");
      const all = `${mail.subject} ${mail.htmlContent} ${mail.textContent}`;
      expect(all, `${slug}: в письме утекло служебное значение`).not.toMatch(
        /null|undefined|NaN/,
      );
    }
  });

  test("реестр не ссылается на несуществующий источник дат", () => {
    // Шапка ссылалась на scripts/launch-readiness.mjs — файла нет ни в одной
    // ветке, а ссылка на него придавала выдуманным датам вид выверенных.
    const src = readFileSync(join(__dirname, "..", "src", "lib", "launchAnnounce.ts"), "utf8");
    expect(src).not.toMatch(/launch-readiness/);
  });

  // Единственное нажатие всего запуска — «Открыть модуль», и большинство
  // сделает его пальцем: письмо открывают с телефона. 28.08.2026 замер на
  // 390x844 показал у прежней текстовой ссылки цель 165x17px; палец уверенно
  // попадает в 44. Тест держит именно ЦЕЛЬ КАСАНИЯ, а не оформление: важно,
  // что у ссылки есть блочная модель и вертикальный отступ, из которых
  // высота и складывается.
  test("главная ссылка письма — кнопка, в которую попадёт палец", () => {
    for (const slug of Object.keys(LAUNCH_MODULES)) {
      const mail = buildLaunchEmail(slug, "kto-to@primer.ru");
      const url = `https://aevion.app${LAUNCH_MODULES[slug].page}`;
      // Берём именно тот <a>, что ведёт на страницу модуля, а не любой в письме.
      const anchors = (mail.htmlContent.match(/<a\b[^>]*>/g) || []).filter((a) => a.includes(url));
      expect(anchors.length, `${slug}: ссылки на ${url} нет вовсе`).toBeGreaterThan(0);
      const cta = anchors[0];
      expect(cta, `${slug}: у кнопки нет блочной модели`).toMatch(/display\s*:\s*inline-block/);
      const pad = cta.match(/padding\s*:\s*(\d+(?:\.\d+)?)px/);
      expect(pad, `${slug}: у кнопки нет вертикального отступа`).not.toBeNull();
      // 14px сверху и снизу плюс строка ~19px дают ~47px — палец попадает.
      expect(Number(pad![1]), `${slug}: вертикальный отступ ${pad![1]}px мал для пальца`).toBeGreaterThanOrEqual(12);
    }
  });

  // Кнопка держится на фоновом цвете, а часть почтовых клиентов его срезает:
  // тогда белый текст оказался бы на белом. Запасная строка с полным адресом
  // обязана быть, иначе письмо запуска молча теряет единственное действие.
  test("если кнопка не отрисовалась, адрес виден строкой", () => {
    const mail = buildLaunchEmail("cyberchess", "kto-to@primer.ru");
    expect(mail.htmlContent).toMatch(/Кнопка не нажимается/);
    expect(mail.htmlContent).toContain(">https://aevion.app/cyberchess<");
  });

  // Найдено 28.08.2026: /go — единственная кликабельная ссылка в соцсетях и
  // главный вход воронки. Её форма обещает письмо в день запуска следующего
  // модуля, а отбор шёл только по метке модуля — эти люди не получили бы
  // ничего. Тест держит именно обещание, а не реализацию.
  test("подписавшиеся на «следующий запуск» получают письмо модуля", () => {
    const rows = [
      { email: "sam@primer.ru", source: "cyberchess" },
      { email: "iz-soceti@primer.ru", source: "go" },
      { email: "s-kanalom@primer.ru", source: "go-tt" },
      { email: "pro-dolgoletie@primer.ru", source: "longevity" },
      { email: "angliyskiy@primer.ru", source: "en-go" },
    ];
    const plan = planLaunchAnnounce("cyberchess", rows);
    expect(plan.recipients).toContain("sam@primer.ru");
    expect(plan.recipients, "общая очередь /go обещана письмом в день запуска").toContain("iz-soceti@primer.ru");
    expect(plan.recipients, "метка канала go-<канал> — та же общая очередь").toContain("s-kanalom@primer.ru");
    // Тематическая подписка на другое — не общая очередь.
    expect(plan.recipients).not.toContain("pro-dolgoletie@primer.ru");
    // Английской версии письма нет; молчание честнее русского письма.
    expect(plan.recipients, "en-go исключён намеренно: письма по-английски нет").not.toContain("angliyskiy@primer.ru");
  });

  test("общая очередь получает КАЖДЫЙ запуск, как и обещано", () => {
    const rows = [{ email: "iz-soceti@primer.ru", source: "go" }];
    for (const slug of Object.keys(LAUNCH_MODULES)) {
      expect(planLaunchAnnounce(slug, rows).recipients, `${slug}: общая очередь пропущена`).toContain("iz-soceti@primer.ru");
    }
  });

  test("строгость отбора по модулю не ослабла", () => {
    // Расширяя охват, легко случайно превратить сравнение в подстроку.
    expect(matchesModule("olddevhub", "devhub")).toBe(false);
    expect(matchesModule("gogo", "cyberchess")).toBe(false);
    const plan = planLaunchAnnounce("cyberchess", [{ email: "chuzhoy@primer.ru", source: "gogol" }]);
    expect(plan.recipients).toHaveLength(0);
  });

  // 28.08.2026: рассылка отбирала получателей по метке, которую пишет форма
  // страницы запуска, и совпадение этих двух мест никто не проверял. У шахмат
  // оно сошлось случайно, а стоило бы разойтись — письмо ушло бы в пустоту, и
  // узнали бы мы об этом в день запуска. Проверка держит связь фронта и
  // бэкенда, которую иначе не держит ничто.
  test("метка формы на странице запуска совпадает с ключом рассылки", () => {
    const appDir = join(__dirname, "..", "..", "frontend", "src", "app");
    expect(existsSync(appDir), `каталога страниц нет: ${appDir}`).toBe(true);

    // Берём страницы запуска, которые ЕСТЬ, и спрашиваем каждую: какую метку
    // она пишет и признаёт ли её хоть один модуль реестра.
    const launchPages = readdirSync(appDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(appDir, d.name, "launch", "page.tsx")))
      .map((d) => ({ dir: d.name, file: join(appDir, d.name, "launch", "page.tsx") }));
    expect(launchPages.length, "страниц запуска не найдено вовсе — проверка стала бы пустой").toBeGreaterThan(0);

    for (const p of launchPages) {
      const src = readFileSync(p.file, "utf8");
      // Метка задаётся двумя способами, и оба надо уметь читать: прямо
      // (`source="bureau"`) и тернаром с каналом
      // (`source = channel ? \`bureau-${channel}\` : "bureau"`). Первая версия
      // проверки знала только первый способ и упала на странице бюро — прибор
      // сам себя и поймал (28.08).
      const labels: string[] = [];
      // Перевод строки собираем кодом: обратный слэш в литерале не переживает
      // передачу правки и превращается в настоящий разрыв строки (28.08).
      for (const line of src.split(String.fromCharCode(10))) {
        if (!line.includes("source")) continue;
        for (const m of line.matchAll(/"([a-z0-9-]+)"/g)) labels.push(m[1]);
        for (const m of line.matchAll(/`([a-z0-9-]+)-\$\{channel\}`/g)) labels.push(m[1]);
      }
      expect(labels.length, `${p.dir}: на странице запуска не нашёл метки источника`).toBeGreaterThan(0);
      for (const label of new Set(labels)) {
        const owner = Object.keys(LAUNCH_MODULES).find((slug) => matchesModule(label, slug));
        expect(
          owner,
          `${p.dir}: форма пишет метку «${label}», но её не признаёт ни один модуль рассылки ` +
            `(${Object.keys(LAUNCH_MODULES).join(", ")}) — письмо запуска ушло бы в пустоту`,
        ).toBeDefined();
      }
    }
  });

  // У модуля с назначенной датой страница запуска обязана существовать: именно
  // на ней собирают адреса, которым потом уходит письмо.
  test("у модуля с датой есть страница запуска", () => {
    const appDir = join(__dirname, "..", "..", "frontend", "src", "app");
    for (const [slug, m] of Object.entries(LAUNCH_MODULES)) {
      if (!m.date) continue;
      const dir = m.page.replace(/^\//, "");
      expect(
        existsSync(join(appDir, dir, "launch", "page.tsx")),
        `${slug}: дата ${m.date} назначена, а страницы ${m.page}/launch нет — собирать адреса негде`,
      ).toBe(true);
    }
  });

  // Расширив охват на общую очередь, легко прислать человеку ДВА письма: он
  // мог подписаться и на /go, и на самой странице запуска — это две строки в
  // базе с одним адресом. Дедупликация в planLaunchAnnounce была и раньше,
  // но до 28.08 пересечься эти два списка не могли, и никто это не проверял.
  test("подписавшийся дважды получает одно письмо", () => {
    const plan = planLaunchAnnounce("cyberchess", [
      { email: "oba@primer.ru", source: "go" },
      { email: "OBA@primer.ru", source: "cyberchess" },
      { email: " oba@primer.ru ", source: "cyberchess-ig" },
      { email: "odin@primer.ru", source: "go-tt" },
    ]);
    expect(plan.recipients.filter((e) => e === "oba@primer.ru")).toHaveLength(1);
    expect(plan.recipients).toHaveLength(2);
  });

  // 28.08.2026: в шапке скрипта сухого прогона и в инструкции основателю на
  // день запуска стояло `npx tsx scripts/launch-announce-dry.ts`, а tsx в
  // проекте не установлен — npx полез бы за ним в сеть в утро запуска.
  // Рабочая команда всё это время лежала в package.json. Сторож держит простое
  // правило: инструкция не зовёт инструмент, которого у нас нет.
  test("команды в шапке скрипта запуска существуют на самом деле", () => {
    const root = join(__dirname, "..");
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const scripts: Record<string, string> = pkg.scripts || {};
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

    const file = join(root, "scripts", "launch-announce-dry.ts");
    expect(existsSync(file), "скрипта сухого прогона нет — инструкция ссылается в пустоту").toBe(true);
    // Смотрим ТОЛЬКО на строки-примеры (звёздочка и отступ), а не на всю
    // шапку: в пояснении рядом написано, какая команда стояла раньше и почему
    // её убрали, и первая версия сторожа поймала эту прозу как настоящий
    // вызов. Свой же текст, прочитанный как содержимое (28.08).
    const header = readFileSync(file, "utf8")
      .split("*/")[0]
      .split(String.fromCharCode(10))
      .filter((line) => {
        const t = line.trimStart();
        if (!t.startsWith("*")) return false;
        const after = t.slice(1);
        return after.startsWith("   ") && after.trim().length > 0;
      })
      .join(String.fromCharCode(10));

    for (const m of header.matchAll(/npm run ([a-z0-9:-]+)/g)) {
      expect(
        scripts[m[1]],
        `шапка зовёт «npm run ${m[1]}», а такой команды в package.json нет`,
      ).toBeDefined();
    }
    for (const m of header.matchAll(/npx (?:--[a-z-]+ )*([a-z0-9@/-]+)/g)) {
      const tool = m[1].replace(/^@[^/]+\//, "");
      expect(
        Object.keys(deps).some((d) => d === m[1] || d.endsWith("/" + tool) || d === tool),
        `шапка зовёт «npx ${m[1]}», а такой зависимости у проекта нет — ` +
          `npx пойдёт за ней в сеть, и в утро запуска это лишний риск`,
      ).toBe(true);
    }
  });

  // Прехедер — вторая строка, которую человек видит в СПИСКЕ писем. До
  // 29.08.2026 его не было, и туда попадало начало письма, повторявшее тему:
  // «CyberChess открыт — 30 августа» и следом «CyberChess открыт». Решение об
  // открытии принимается по двум строкам, и вторая обязана нести новое.
  test("в списке писем вторая строка не повторяет тему", () => {
    for (const slug of Object.keys(LAUNCH_MODULES)) {
      const mail = buildLaunchEmail(slug, "kto-to@primer.ru");
      const html = mail.htmlContent;
      const hidden = html.indexOf("display:none");
      expect(hidden, `${slug}: скрытого прехедера нет вовсе`).toBeGreaterThan(-1);
      // Он обязан стоять ДО видимого содержимого, иначе клиент возьмёт не его.
      // Якорь — ЗАГОЛОВОК, а не строка бренда: у модулей, чьё имя уже
      // начинается с «AEVION», строки бренда нет вовсе, и прежний якорь давал
      // indexOf = -1, то есть падение на исправном письме (поймано 29.08).
      expect(hidden, `${slug}: прехедер стоит после видимого текста`).toBeLessThan(html.indexOf("<h1"));
      // И нести то же обещание, что тело письма, — из ОДНОГО источника.
      const opens = LAUNCH_MODULES[slug].opens;
      const head = opens.charAt(0).toUpperCase() + opens.slice(1);
      expect(html.slice(hidden, hidden + 400), `${slug}: прехедер не из поля opens`).toContain(head);
      // И не быть пересказом темы.
      expect(html.slice(hidden, hidden + 400)).not.toContain(mail.subject);
    }
  });

  // 29.08.2026: у трёх модулей имя уже начинается с «AEVION», и над заголовком
  // стояла ещё одна строка «AEVION» — в письме выходило «AEVION AEVION IP
  // Bureau открыт». У шахмат этого не видно (имя другое), поэтому дефект и
  // дожил до проверки писем ВСЕЙ очереди, а не только ближайшего запуска.
  test("бренд не удваивается у модулей с AEVION в имени", () => {
    for (const slug of Object.keys(LAUNCH_MODULES)) {
      const mail = buildLaunchEmail(slug, "kto-to@primer.ru");
      const text = mail.htmlContent.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");
      expect(text, `${slug}: «AEVION AEVION» в письме`).not.toContain("AEVION AEVION");
      // И при этом имя платформы в письме остаётся — письмо без неё безымянное.
      expect(text, `${slug}: слова AEVION в письме нет вовсе`).toContain("AEVION");
    }
  });
});
