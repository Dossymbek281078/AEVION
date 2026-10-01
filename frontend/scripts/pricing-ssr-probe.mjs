#!/usr/bin/env node
/*
 * Зонд: видны ли цены в ОТВЕТЕ СЕРВЕРА на /pricing.
 *
 * Тест рядом проверяет отрисовку блока без сети — он детерминирован и живёт в
 * наборе. Этот зонд проверяет живой прод и запускается руками после выкатки:
 * сетевой запрос внутри набора тестов сделал бы сборку хрупкой, а сторожа,
 * который краснеет от плохого интернета, перестают читать.
 *
 * Коды выхода: 0 — цены и названия видны, 1 — нет, 2 — спросить не удалось.
 */
const АДРЕС = process.argv[2] || "https://aevion.app/pricing?c=probe-ssr";

function видимыйТекст(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

const ответ = await fetch(АДРЕС, { redirect: "follow" }).catch((e) => {
  console.error(`не удалось спросить ${АДРЕС}: ${e.message}`);
  process.exit(2);
});
if (!ответ.ok) {
  console.error(`${АДРЕС} ответил ${ответ.status}`);
  process.exit(2);
}
const html = await ответ.text();
const текст = видимыйТекст(html);
const цены = текст.match(/[$]\d+(?:[.]\d{2})?/g) || [];
const имена = ["Multichat", "DevHub", "QRight", "QSign"].filter((n) => текст.includes(n));

console.log(`адрес:        ${АДРЕС}`);
console.log(`знаков HTML:  ${html.length}`);
console.log(`цен в тексте: ${цены.length}${цены.length ? ` (${[...new Set(цены)].slice(0, 6).join(", ")})` : ""}`);
console.log(`названий:     ${имена.length} из 4 (${имена.join(", ") || "нет"})`);

if (цены.length === 0 || имена.length === 0) {
  console.error("ЦЕН ИЛИ НАЗВАНИЙ В ОТВЕТЕ СЕРВЕРА НЕТ — поисковик и превью ссылки видят пустую страницу.");
  process.exit(1);
}
// Успех — просто выходим: process.exit(0) сразу после печати иногда роняет
// в консоль ассерт libuv на Windows, и зонд выглядит сломанным, когда он цел.
console.log("Цены и названия видны без запуска скриптов.");
