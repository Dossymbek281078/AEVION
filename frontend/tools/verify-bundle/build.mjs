#!/usr/bin/env node
/*
 * build.mjs — собрать public/aevion-verify.zip из tools/verify-bundle/src.
 *
 * ЗАЧЕМ ЭТОТ ФАЙЛ ПОЯВИЛСЯ. До 13.10.2026 единственным источником правды для
 * набора проверяльщика был САМ архив: в репозитории лежал только
 * `public/aevion-verify.zip`, исходников не было, скрипта сборки не было.
 * Последствия, которые это уже имело: правка набора не видна в дифе (в истории
 * стоит «Bin 24324 -> 25708 bytes»), вторая пара глаз прочитать её не может, а
 * отличить «поправили проверку» от «подменили пример» нельзя вовсе.
 *
 * Поэтому: исходники в `src/`, архив — производное. Правится src, архив
 * пересобирается этим скриптом.
 *
 * Сборка ДЕТЕРМИНИРОВАННАЯ: порядок записей по имени, время записей
 * фиксированное (1980-01-01, нулевое значение поля в формате zip). Значит два
 * прогона дают побайтно равный архив, и `git diff` по бинарю означает ровно
 * «изменилось содержимое», а не «пересобрали».
 *
 *   node tools/verify-bundle/build.mjs            # собрать
 *   node tools/verify-bundle/build.mjs --check    # не писать; сказать, совпадает ли
 *
 * Коды: 0 — готово/совпадает, 1 — расхождение при --check, 2 — не смог собрать.
 * Зависимостей нет намеренно: набор обещает покупателю «no dependencies», и
 * тащить архиватор ради его сборки было бы странно.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const КОРЕНЬ = dirname(fileURLToPath(import.meta.url));
const ИСХОДНИКИ = join(КОРЕНЬ, "src");
const АРХИВ = join(КОРЕНЬ, "..", "..", "public", "aevion-verify.zip");

/** CRC-32, как требует формат zip. Таблица считается один раз. */
const таблицаCRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = таблицаCRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function собрать() {
  const имена = readdirSync(ИСХОДНИКИ).filter((н) => !н.startsWith(".")).sort();
  if (имена.length === 0) throw new Error("в src нет файлов — собирать нечего");

  const локальные = [];
  const центральные = [];
  let смещение = 0;

  for (const имя of имена) {
    // Концы строк — всегда LF: иначе архив зависит от машины сборщика (13.10: на
    // checkout с CRLF verify-aevion.mjs уехал на 331 байт толще, и сторож дрейфа покраснел у соседа).
    const сырое = readFileSync(join(ИСХОДНИКИ, имя));
    const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
    const текстовый = /\.(mjs|js|json|md|txt)$/i.test(имя);
    const тело = текстовый ? Buffer.from(сырое.toString("utf8").split(CR + LF).join(LF), "utf8") : сырое;
    const сжатое = deflateRawSync(тело, { level: 9 });
    const crc = crc32(тело);
    const имяБуф = Buffer.from(имя, "utf8");

    const лок = Buffer.alloc(30);
    лок.writeUInt32LE(0x04034b50, 0);   // подпись локальной записи
    лок.writeUInt16LE(20, 4);           // нужная версия
    лок.writeUInt16LE(0, 6);            // флаги
    лок.writeUInt16LE(8, 8);            // метод: deflate
    лок.writeUInt16LE(0, 10);           // время — фиксировано
    лок.writeUInt16LE(33, 12);          // дата — 1980-01-01, фиксировано
    лок.writeUInt32LE(crc, 14);
    лок.writeUInt32LE(сжатое.length, 18);
    лок.writeUInt32LE(тело.length, 22);
    лок.writeUInt16LE(имяБуф.length, 26);
    лок.writeUInt16LE(0, 28);           // extra
    локальные.push(лок, имяБуф, сжатое);

    const цен = Buffer.alloc(46);
    цен.writeUInt32LE(0x02014b50, 0);
    цен.writeUInt16LE(20, 4);           // кем создан
    цен.writeUInt16LE(20, 6);           // нужная версия
    цен.writeUInt16LE(0, 8);
    цен.writeUInt16LE(8, 10);
    цен.writeUInt16LE(0, 12);
    цен.writeUInt16LE(33, 14);
    цен.writeUInt32LE(crc, 16);
    цен.writeUInt32LE(сжатое.length, 20);
    цен.writeUInt32LE(тело.length, 24);
    цен.writeUInt16LE(имяБуф.length, 28);
    цен.writeUInt16LE(0, 30);
    цен.writeUInt16LE(0, 32);           // комментарий
    цен.writeUInt16LE(0, 34);           // диск
    цен.writeUInt16LE(0, 36);           // внутренние атрибуты
    цен.writeUInt32LE(0, 38);           // внешние атрибуты
    цен.writeUInt32LE(смещение, 42);
    центральные.push(цен, имяБуф);

    смещение += лок.length + имяБуф.length + сжатое.length;
  }

  const телоЛок = Buffer.concat(локальные);
  const телоЦен = Buffer.concat(центральные);
  const конец = Buffer.alloc(22);
  конец.writeUInt32LE(0x06054b50, 0);
  конец.writeUInt16LE(0, 4);
  конец.writeUInt16LE(0, 6);
  конец.writeUInt16LE(имена.length, 8);
  конец.writeUInt16LE(имена.length, 10);
  конец.writeUInt32LE(телоЦен.length, 12);
  конец.writeUInt32LE(телоЛок.length, 16);
  конец.writeUInt16LE(0, 20);

  return { архив: Buffer.concat([телоЛок, телоЦен, конец]), имена };
}

try {
  const { архив, имена } = собрать();
  const проверка = process.argv.includes("--check");
  const было = existsSync(АРХИВ) ? readFileSync(АРХИВ) : null;
  const совпадает = было !== null && было.equals(архив);

  if (проверка) {
    console.log(`файлов в src: ${имена.length}; архив ${совпадает ? "СОВПАДАЕТ" : "РАСХОДИТСЯ"} с пересборкой` +
      (было ? ` (на диске ${было.length} б, пересборка ${архив.length} б)` : " (архива на диске нет)"));
    process.exit(совпадает ? 0 : 1);
  }

  writeFileSync(АРХИВ, архив);
  console.log(`собрано ${имена.length} файл(ов) → ${АРХИВ}, ${архив.length} байт`);
  console.log(имена.map((н) => "  " + н).join("\n"));
  process.exit(0);
} catch (e) {
  console.error("не смог собрать:", e.message);
  process.exit(2);
}
