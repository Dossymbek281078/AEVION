import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ukazanieBezVydumannyhDannyh, tekushchiyGod, yazykZaprosa } from "../src/lib/devhubNoFakeData";

/*
 * 🔴 ГЕНЕРАЦИЯ НЕ ДОЛЖНА ВЫДУМЫВАТЬ ДАННЫЕ ЧЕЛОВЕКА.
 *
 * Замер окна продаж 12.10.2026 на живом проде: путь гостя до работающего адреса
 * проходится за 1 мин 26 с, обрыва нет — но в выданной странице стоят «г. Москва,
 * ул. Примерная, д. 10» и «© 2023» при 2026 годе, плюс название и меню, которых
 * не просили. Человек выкатывает на свой адрес страницу с чужим адресом и
 * позапрошлым годом.
 *
 * ⚠️ ЧТО ЭТОТ СТОРОЖ МОЖЕТ И ЧЕГО НЕ МОЖЕТ, честно. Он проверяет, что указание
 * СФОРМУЛИРОВАНО и ДОЕЗЖАЕТ до модели во всех ветвях — то есть нашу половину.
 * Он НЕ доказывает, что модель послушалась: это решает прогон живых генераций
 * с грепом по результату, и знаменатель там равен числу прогнанных идей, а не
 * «вообще». Путать эти два утверждения нельзя — на этом классе мы уже обжигались.
 */

const ПУТЬ = join(__dirname, "../src/routes/devhub.ts");
const КОД = readFileSync(ПУТЬ, "utf8");

describe("указание «не выдумывай данные» доезжает до модели", () => {
  it("🔴 ВСЕ ТРИ ветви системного промпта накрыты одной строкой — знаменатель 3 из 3", () => {
    // Ветвей ровно три: одна цель, несколько согласованных файлов, каркас.
    // Если их станет больше или меньше, проверка обязана покраснеть: новая
    // ветвь без указания — это дырявая половина при зелёном прогоне.
    const ветвей = (КОД.match(/You are an expert developer\./g) || []).length;
    expect(ветвей, `ветвей системного промпта найдено ${ветвей}`).toBe(3);

    // И накрыты они ОДНИМ дописыванием после тернарника, а не тремя копиями:
    // копии расходятся при первой правке.
    // 12.10.2026: вторым аргументом едет язык запроса, определённый сервером.
    expect(КОД).toContain("const промптСЗапретом = `${systemPrompt} ${ukazanieBezVydumannyhDannyh(tekushchiyGod(), yazykZaprosa(prompt))}`");
    // Модели уходит строка С запретом, а не исходная.
    expect(КОД).toContain('{ role: "system", content: промптСЗапретом }');
  });

  /*
   * 🔴 ВТОРОЕ МЕСТО НАШЛА САМА ЭТА ПРОВЕРКА, и это главный её улов.
   *
   * Первая редакция требовала, чтобы голого `systemPrompt` модели не уходило
   * нигде, — и покраснела. Оказалось, в файле ДВА вызова по одному шаблону:
   * генератор кода и ручка замысла (`/plan`). Вторая кода не пишет, но отдаёт
   * `firstPrompt` и `milestones[].prompt` — готовые промпты, которые уходят
   * генератору как сообщение ПОЛЬЗОВАТЕЛЯ. Выдуманный там адрес генератор
   * исполнит добросовестно: системный запрет на той стороне с просьбой человека
   * заспорит. Поэтому запрет стоит в обоих местах, а проверка считает ВСЕ вызовы.
   */
  it("🔴 ни один вызов модели не уходит с промптом БЕЗ запрета — знаменатель по всем вызовам", () => {
    const всеСистемные = (КОД.match(/\{ role: "system", content: ([^ }]+) \}/g) || [])
      .map((m) => m.replace(/.*content: /, "").replace(/ \}$/, ""));
    expect(всеСистемные.length, `системных сообщений найдено ${всеСистемные.length}`).toBeGreaterThanOrEqual(2);
    const голые = всеСистемные.filter((имя) => !/СЗапретом$/.test(имя));
    expect(голые, `без запрета уходят: ${голые.join(", ") || "нет"}`).toEqual([]);
    // Контроль прибора: он действительно различает имена, а не принимает любое.
    expect(всеСистемные).toContain("промптСЗапретом");
    expect(всеСистемные).toContain("промптЗамыслаСЗапретом");
  });

  it("🔴 запрещено ровно то, что выдумывалось на проде", () => {
    const у = ukazanieBezVydumannyhDannyh(2026).toLowerCase();
    for (const что of ["address", "phone", "email", "price", "company name", "person name"]) {
      expect(у, `в указании нет запрета на «${что}»`).toContain(что);
    }
    expect(у).toContain("never invent");
  });

  it("🔴 вместе с запретом названа РАЗРЕШЁННАЯ замена — иначе модель снесёт весь раздел", () => {
    const у = ukazanieBezVydumannyhDannyh(2026);
    // Заглушки на двух языках: половина гостей пишет промпт латиницей.
    expect(у).toContain("[your address]");
    expect(у).toContain("[ваш адрес]");
    // И прямой запрет удалять блок: без этой строки мы меняем одну беду на другую.
    expect(у.toLowerCase()).toContain("do not delete");
    expect(у.toLowerCase()).toContain("keep the section");
  });

  it("🔴 заготовка — на языке ОПИСАНИЯ человека, и смешение запрещено прямо", () => {
    /*
     * Повод 12.10.2026, замер на проде: на русской странице «визитка мастера
     * маникюра» модель выдала «[your price] руб.» — склеила два языка в одной
     * строке. Прежняя формулировка «in the same language as the rest of the
     * page» оказалась слабой: модель прочла её как «страница русская, но
     * плашки можно английские». Поэтому язык назван от ОПИСАНИЯ, показаны обе
     * формы и запрещено смешение — с тем самым неудачным примером.
     */
    const у = ukazanieBezVydumannyhDannyh(2026);
    expect(у).toMatch(/SAME LANGUAGE the user wrote/i);
    expect(у, "нет примера русских заготовок").toContain("[ваша цена]");
    expect(у, "нет примера английских заготовок").toContain("[your price]");
    expect(у.toLowerCase(), "смешение языков не запрещено прямо").toContain("never mix languages");
    // И ровно та склейка, что получилась на проде, названа как неверная.
    expect(у).toContain('"[your price] руб." is wrong');
  });

  it("🔴 год приходит ЧИСЛОМ: «текущий год» модель домыслит, так и появился © 2023", () => {
    const у = ukazanieBezVydumannyhDannyh(2026);
    expect(у).toContain("The current year is 2026");
    expect(у).toContain("use 2026 for copyright");
    // Контроль: год действительно подставляется, а не зашит константой.
    expect(ukazanieBezVydumannyhDannyh(2031)).toContain("The current year is 2031");
    expect(ukazanieBezVydumannyhDannyh(2031)).not.toContain("2026");
    // И прямой запрет более раннего года — именно он и стоял на проде.
    expect(у.toLowerCase()).toContain("never write an earlier year");
  });

  it("год берётся с часов сервера и правдоподобен", () => {
    const г = tekushchiyGod();
    expect(г).toBeGreaterThanOrEqual(2026);
    expect(г).toBeLessThan(2100);
  });

  it("контроль прибора: файл маршрута прочитан, а не пуст", () => {
    expect(КОД.length).toBeGreaterThan(50_000);
    expect(КОД).toContain("devhubNoFakeData");
  });
});

describe("язык запроса называется модели прямо", () => {
  /*
   * 🔴 Повод 12.10.2026 (окно ИИ-блогера, живой замер): на английский запрос
   * «birthday party invitation…» DevHub отдал страницу с 11 строками кириллицы:
   * «[Имя именинника] Birthday Party!», «[Название места]», «© 2026 [Ваша
   * компания/Имя]». Правило «на языке запроса» в промпте было — но язык модель
   * должна была вывести сама, а системный промпт вокруг русский. Теперь язык
   * определяет сервер и называет словом.
   */
  it("🔴 детектор: английский, русский, казахский, смешанный, пустой — знаменатель 5 из 5", () => {
    const случаи: Array<[string, string]> = [
      ["birthday party invitation: date, place, party schedule", "en"],
      ["визитка мастера маникюра с ценами и записью", "ru"],
      ["кофеханаға арналған сайт: мәзір, мекенжай", "ru"],
      ["landing для кофейни with menu and карта проезда", "unknown"],
      ["", "unknown"],
    ];
    for (const [т, ждём] of случаи) expect(yazykZaprosa(т), `текст: «${т}»`).toBe(ждём);
    expect(случаи.length).toBe(5);
  });

  it("🔴 для английского запроса промпт запрещает кириллицу прямо, для русского — требует русский", () => {
    const en = ukazanieBezVydumannyhDannyh(2026, "en");
    expect(en).toContain("request is written in ENGLISH");
    expect(en).toContain("Do not write a single Cyrillic word");
    const ru = ukazanieBezVydumannyhDannyh(2026, "ru");
    expect(ru).toContain("request is written in RUSSIAN");
    expect(ru).not.toContain("Cyrillic word");
    // Неизвестный язык — никакой ложной уверенности: фразы про язык нет вовсе,
    // работает прежнее правило «как у запроса».
    const нет = ukazanieBezVydumannyhDannyh(2026, "unknown");
    expect(нет).not.toContain("request is written in");
    // Контроль: прежнее правило при этом на месте во всех трёх.
    for (const п of [en, ru, нет]) expect(п).toContain("SAME LANGUAGE the user wrote their request in");
  });

  it("🔴 ОБА места вызова передают язык запроса — знаменатель 2 из 2", () => {
    const код = readFileSync(join(process.cwd(), "src/routes/devhub.ts"), "utf8");
    const вызовы = код.match(/ukazanieBezVydumannyhDannyh\(tekushchiyGod\(\)[^)]*\)/g) || [];
    expect(вызовы.length, "мест вызова").toBe(2);
    const безЯзыка = вызовы.filter((в) => !/yazykZaprosa\((prompt|idea)\)/.test(в));
    expect(безЯзыка, "вызовы без языка запроса").toEqual([]);
  });
});
