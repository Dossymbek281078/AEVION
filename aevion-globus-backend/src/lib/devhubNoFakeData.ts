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

/**
 * Текст указания с подставленным годом.
 *
 * Год — параметр, а не вызов `new Date()` внутри: иначе проверку пришлось бы
 * писать про «сегодня», а такая проверка зеленеет сама собой 1 января и ничего
 * не утверждает. Сторож передаёт год явно и сравнивает с ним же.
 */
export function ukazanieBezVydumannyhDannyh(год: number): string {
  return (
    `NEVER invent the user's real-world data. Do NOT write made-up street addresses, ` +
    `city names, phone numbers, email addresses, prices, company names, person names, ` +
    `social media handles, opening hours or legal entities. ` +
    `If the design needs such a value and the user did not provide it, KEEP the section ` +
    `and put a visible placeholder in square brackets instead, in the same language as ` +
    `the rest of the page: [your address], [your phone], [your email], [your price], ` +
    `[your company name], [ваш адрес], [ваш телефон], [ваша почта], [ваша цена]. ` +
    `Do not delete the contacts or pricing block just because the data is unknown — ` +
    `a placeholder the user can fill in is useful, an invented address is harmful. ` +
    `The current year is ${год}: use ${год} for copyright lines and dates, or omit the ` +
    `year entirely. Never write an earlier year.`
  );
}

/** Текущий год по часам сервера — единственное место, где он берётся. */
export function tekushchiyGod(): number {
  return new Date().getFullYear();
}
