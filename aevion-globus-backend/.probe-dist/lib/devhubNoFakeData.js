"use strict";
/**
 * Указание модели: НЕ выдумывать данные человека.
 *
 * 🔴 ПОВОД — замер окна продаж 12.10.2026 на живом проде. Путь гостя от идеи до
 * работающего адреса проходится за 1 мин 26 с, обрыва нет; но в сгенерированной
 * странице стоят выдуманные данные как настоящие:
 *   «г. Москва, ул. Примерная, д. 10» — адреса, которого человек не называл;
 *   «© 2023» — при том, что идёт 2026 год;
 *   название компании и пункты меню, которых не просили.
 * Человек, которому это выкатили на его адрес, обнаруживает на своей странице
 * чужой адрес и позапрошлый год. Это дороже любой поломки: страницу, которую
 * стыдно показать, не покупают, и ролик с такой страницей продаёт против нас.
 *
 * ПОЧЕМУ ИМЕННО ЭТИ ТРИ ЗАПРЕТА, а не «будь аккуратнее». Модель не ошибается —
 * она добросовестно заполняет пропуск: её просили «лендинг кофейни», а лендинг
 * без адреса выглядит незаконченным. Поэтому запрет работает только вместе с
 * РАЗРЕШЁННОЙ заменой: место-заглушка в квадратных скобках. Иначе модель уберёт
 * весь блок контактов, и мы получим вторую беду вместо первой — поэтому в
 * указании прямо сказано «оставь раздел, подставь заглушку».
 *
 * 🔴 ГОД ПЕРЕДАЁТСЯ ЧИСЛОМ, А НЕ СЛОВАМИ «текущий год». Своей даты модель не
 * знает: обучение закончилось раньше, и «текущий» она домыслит — ровно так и
 * появился «© 2023». Поэтому год подставляет НАШ сервер, у которого часы есть.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ukazanieBezVydumannyhDannyh = ukazanieBezVydumannyhDannyh;
exports.tekushchiyGod = tekushchiyGod;
exports.yazykZaprosa = yazykZaprosa;
exports.ukazanieOYazyke = ukazanieOYazyke;
/**
 * Текст указания с подставленным годом.
 *
 * Год — параметр, а не вызов `new Date()` внутри: иначе проверку пришлось бы
 * писать про «сегодня», а такая проверка зеленеет сама собой 1 января и ничего
 * не утверждает. Сторож передаёт год явно и сравнивает с ним же.
 */
function ukazanieBezVydumannyhDannyh(год, язык = "unknown") {
    return (ukazanieOYazyke(язык) +
        `NEVER invent the user's real-world data. Do NOT write made-up street addresses, ` +
        `city names, phone numbers, email addresses, prices, company names, person names, ` +
        `social media handles, opening hours or legal entities. ` +
        `If the design needs such a value and the user did not provide it, KEEP the section ` +
        `and put a visible placeholder in square brackets instead. ` +
        /*
         * 🔴 ЯЗЫК ЗАГОТОВКИ — ЯЗЫК ОПИСАНИЯ, и сказано это жёстко не из педантизма.
         * Прежняя формулировка «in the same language as the rest of the page»
         * оказалась слабой: замер 12.10.2026 на русской странице «визитка мастера
         * маникюра» дал «[your price] руб.» — модель прочла её как «страница
         * русская, но плашки можно английские», и склеила два языка в одной
         * строке. Поэтому ниже названо прямо: язык берётся у ОПИСАНИЯ человека,
         * обе формы показаны примерами, а смешение запрещено отдельной фразой с
         * тем самым неудачным примером.
         */
        `The placeholder MUST be written in the SAME LANGUAGE the user wrote their request in — ` +
        `not in English by default. If the request is in Russian, every placeholder is Russian: ` +
        `[ваш адрес], [ваш телефон], [ваша почта], [ваша цена], [название вашей компании]. ` +
        `If the request is in English: [your address], [your phone], [your email], [your price], ` +
        `[your company name]. NEVER mix languages inside one line — "[your price] руб." is wrong, ` +
        `"[ваша цена] руб." is right. ` +
        `Do not delete the contacts or pricing block just because the data is unknown — ` +
        `a placeholder the user can fill in is useful, an invented address is harmful. ` +
        `The current year is ${год}: use ${год} for copyright lines and dates, or omit the ` +
        `year entirely. Never write an earlier year.`);
}
/** Текущий год по часам сервера — единственное место, где он берётся. */
function tekushchiyGod() {
    return new Date().getFullYear();
}
function yazykZaprosa(текст) {
    const т = String(текст ?? "");
    const кир = (т.match(/[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/g) || []).length;
    const лат = (т.match(/[A-Za-z]/g) || []).length;
    const букв = кир + лат;
    if (букв < 3)
        return "unknown";
    if (кир / букв >= 0.6)
        return "ru";
    if (лат / букв >= 0.6)
        return "en";
    return "unknown";
}
/** Фраза для промпта: язык НАЗВАН, а не «тот же, что у запроса». */
function ukazanieOYazyke(язык) {
    if (язык === "ru") {
        return (`The user's request is written in RUSSIAN. Every piece of visible text you generate — ` +
            `headings, buttons, labels and EVERY placeholder in square brackets — must be in Russian. `);
    }
    if (язык === "en") {
        return (`The user's request is written in ENGLISH. Every piece of visible text you generate — ` +
            `headings, buttons, labels and EVERY placeholder in square brackets — must be in English. ` +
            `Do not write a single Cyrillic word anywhere in the page. `);
    }
    return "";
}
