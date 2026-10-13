#!/usr/bin/env node
/*
 * refresh-sample.mjs — пересобрать manifest-sample.json из живых записей прода.
 *
 * ЗАЧЕМ. Образец ссылается на НАСТОЯЩИЕ записи реестра. Отзовут любую из них —
 * и покупатель, запустив проверяльщик, увидит FAIL на наборе, который мы в
 * письме назвали рабочим. Сам отказ при этом честен (подпись действительно
 * отозвана), но выглядит как сломанный пакет, и объяснять это приходится уже
 * после того, как человек посмотрел.
 *
 * Поэтому: перед отправкой архива прогоняется проверка, и если она краснеет —
 * этот скрипт берёт свежие живые записи и переписывает образец. Руками лазить
 * в JSON не нужно, и значит это не забудется.
 *
 *   node refresh-sample.mjs            # перезаписать образец
 *   node refresh-sample.mjs --dry-run  # только показать, что получилось бы
 *
 * Коды: 0 образец годен или обновлён, 1 живых записей не хватило,
 *       2 спросить прод не удалось (это НЕ «всё хорошо»).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ЗДЕСЬ = dirname(fileURLToPath(import.meta.url));
const ОБРАЗЕЦ = join(ЗДЕСЬ, "manifest-sample.json");
const API = process.env.AEVION_API || "https://api.aevion.app";
const СКОЛЬКО = 5;

const сухойПрогон = process.argv.includes("--dry-run");

async function главное() {
  let свежие;
  try {
    /*
     * limit=20, а не больше, и это замер, а не осторожность. Ручка /recent
     * принимает 1..20 при умолчании 8, но выход за предел она НЕ обрезает до
     * максимума — молча откатывается к умолчанию. Замер 05.10.2026:
     *   limit=20 -> 20 записей,  limit=40 -> 8,  limit=100 -> 8.
     * То есть «попросить побольше» давало ВТРОЕ МЕНЬШЕ, и первая версия этого
     * скрипта из-за этого честно сообщила «живых меньше пяти» при 22 живых на
     * проде. Ошибался прибор, а не реестр.
     */
    const r = await fetch(`${API}/api/qsign/v2/recent?limit=20`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    свежие = (await r.json()).items ?? [];
  } catch (e) {
    console.error(`спросить прод не удалось: ${e.message}`);
    console.error("это НЕ «образец в порядке» — код 2");
    process.exitCode = 2;
    return;
  }

  const живые = свежие.filter((x) => !x.revoked);
  console.log(`прод отдал записей: ${свежие.length}, из них живых: ${живые.length}`);

  if (живые.length < СКОЛЬКО) {
    console.error(`живых меньше ${СКОЛЬКО} — образец не из чего собрать`);
    process.exitCode = 1;
    return;
  }

  /*
   * Берём самые старые ИЗ ВИДИМЫХ, и честно про границу: /recent показывает
   * только последние 20 записей, то есть «самая старая живая в реестре» этим
   * путём недостижима. Нынешний образец (записи 22–27 июля) как раз из тех,
   * кого /recent уже не отдаёт, — и именно поэтому он хорош: он пережил два с
   * половиной месяца. Собранный этим скриптом набор будет свежее и тем самым
   * менее проверен временем; это запасной вариант, а не улучшение.
   */
  const отобранные = [...живые]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(0, СКОЛЬКО);

  const прежний = JSON.parse(readFileSync(ОБРАЗЕЦ, "utf8"));
  const сегодня = new Date().toISOString().slice(0, 10);
  const даты = отобранные.map((x) => x.createdAt.slice(0, 10));

  const новый = {
    note:
      `Five LIVE production records, not a file delivery. Created ${даты[0]}..${даты[даты.length - 1]}; ` +
      `checked ${сегодня}. If one is ever revoked the verifier will say so with the date — that is the ` +
      `verifier telling the truth, not this package breaking. Rebuild with: node refresh-sample.mjs`,
    apiBase: прежний.apiBase ?? API,
    publicKey: прежний.publicKey ?? null,
    records: отобранные.map((x, i) => ({ file: `live-record-${i + 1}`, id: x.id })),
  };

  for (const [i, x] of отобранные.entries()) {
    console.log(`  live-record-${i + 1}  ${x.id}  создана ${x.createdAt.slice(0, 10)}`);
  }

  if (сухойПрогон) {
    console.log("\n--dry-run: файл не тронут");
    return;
  }
  writeFileSync(ОБРАЗЕЦ, JSON.stringify(новый, null, 2) + "\n");
  console.log(`\nобразец переписан: ${ОБРАЗЕЦ}`);
  console.log("теперь прогоните: node verify-aevion.mjs manifest-sample.json");
}

главное();
