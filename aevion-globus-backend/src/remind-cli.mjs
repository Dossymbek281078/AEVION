#!/usr/bin/env node
/**
 * Прогон напоминаний по выгрузке фирмы.
 *   node src/remind-cli.mjs выгрузка.csv [YYYY-MM-DD] [журнал-отправленного.jsonl]
 *
 * НИЧЕГО НЕ ОТПРАВЛЯЕТ. Печатает очередь на сегодня, список «нужен человек»
 * и список без контактов. Отправку делает человек или почтовый слой фирмы —
 * так решение остаётся у неё.
 */
import { readFile, appendFile } from "node:fs/promises";
const LINE_END = String.fromCharCode(10);   // перевод строки кодом: escape съедается на границе вызова
import { parseClientsCsv, decodeCsvBuffer } from "./csv.mjs";
import { неТотФормат } from "./encoding.mjs";
import { planReminders, isValidIsoDate } from "./reminders.mjs";
import { toCsv } from "./csv-out.mjs";
import { writeFile } from "node:fs/promises";

const rawArgs = process.argv.slice(2);
const outIdx = rawArgs.indexOf("--out");
const outPath = outIdx >= 0 ? rawArgs[outIdx + 1] : null;
if (outIdx >= 0) rawArgs.splice(outIdx, 2);
const limIdx = rawArgs.indexOf("--limit");
const dailyLimit = limIdx >= 0 ? Number(rawArgs[limIdx + 1]) : undefined;
if (limIdx >= 0) rawArgs.splice(limIdx, 2);
const [csvPath, dateArg, sentLogPath] = rawArgs;

if (!csvPath) {
  console.error("Использование: node src/remind-cli.mjs выгрузка.csv [YYYY-MM-DD] [журнал.jsonl] [--out очередь.csv] [--limit N]");
  process.exitCode = 2;
} else run: {
  const today = dateArg || new Date().toISOString().slice(0, 10);
  if (!isValidIsoDate(today)) {
    console.error("Дата прогона не понята: " + JSON.stringify(String(today)));
    console.error("Дата задаётся ВТОРЫМ аргументом, без ключа: node src/remind-cli.mjs выгрузка.csv 2026-09-08");
    process.exitCode = 2;   // 2 = проверка НЕ выполнилась, это не «всё хорошо»
    break run;
  }
  // Кодировку читаем, а не предполагаем: выгрузка из 1С обычно в
  // windows-1251, и прочитанная как UTF-8 она даёт ноль строк — а ноль
  // писем выглядит как "сегодня никому не надо".
  const байты = await readFile(csvPath);
  // Двоичный файл прочитается как мусор и даст ноль строк — а ноль строк
  // выглядит как «сегодня нечего делать». Проверяем ДО разбора и говорим,
  // что нажать, а не что у нас не вышло.
  const чужойФормат = неТотФормат(байты);
  if (чужойФормат) {
    console.error("Это " + чужойФормат.формат + ", а не таблица CSV.");
    console.error(чужойФормат.чтоДелать);
    process.exitCode = 2;
    break run;
  }
  const { text, encoding, replaced } = decodeCsvBuffer(байты);
  if (encoding !== "utf-8") {
    console.log("Кодировка файла: " + encoding + " (прочитано верно, файл не менялся)");
  }
  if (replaced > 0) {
    console.error("[ВНИМАНИЕ] в файле " + replaced + " нечитаемых символов — часть данных повреждена.");
    console.error("           Пришлите нам файл как есть, не пересохраняя: так видно причину.");
  }
  const parsed = parseClientsCsv(text);

  let alreadySent = new Set();
  if (sentLogPath) {
    try {
      const log = await readFile(sentLogPath, "utf8");
      for (const line of log.split("\n")) {
        if (!line.trim()) continue;
        try { alreadySent.add(JSON.parse(line).key); } catch { /* битая строка журнала */ }
      }
    } catch (e) {
      if (e.code !== "ENOENT") {
        // журнал есть, но не читается: НЕ делаем вид, что отправленного нет —
        // иначе клиенты получат повторы. Останавливаемся.
        console.error("[ОТКАЗ] журнал отправленного не читается (" + e.code + "). Прогон остановлен,");
        console.error("        иначе клиенты получат повторные напоминания.");
        process.exitCode = 2;
        process.exit();
      }
    }
  }

  const plan = planReminders(parsed.rows, { today, alreadySent, dailyLimit });

  console.log("=== ПРОГОН НА " + today + " ===");
  console.log("Строк в выгрузке: " + parsed.rows.length +
    (parsed.badRows ? " | битых строк: " + parsed.badRows : "") +
    (parsed.заголовкаНет ? " | строки заголовка НЕТ: первая строка — данные"
      : parsed.unmappedHeaders.length ? " | неопознанные столбцы: " + parsed.unmappedHeaders.join(", ") : ""));
  // Догадку об опознании столбца обязан увидеть человек: ошибка здесь — это
  // письмо клиенту с чужой суммой, а такое дороже отказа.
  if (parsed.guessedHeaders && parsed.guessedHeaders.length) {
    console.log("Столбцы опознаны ПО СМЫСЛУ — проверьте, что угадано верно:");
    for (const g of parsed.guessedHeaders) {
      console.log("  «" + g.столбец + "» → " + g.поле);
    }
  }
  if (parsed.пропущеноСверху) {
    console.log("Шапка отчёта над таблицей: пропущено строк — " + parsed.пропущеноСверху +
      " (заголовки найдены ниже).");
  }
  if (parsed.почтаНеРазобрана) {
    console.log("Ячеек почты без адреса («не указан», «—»): " + parsed.почтаНеРазобрана +
      " — эти клиенты попадут в список «написать некуда», а не в очередь.");
  }
  if (parsed.итоговых) {
    console.log("Итоговых строк («Итого», «Всего»): " + parsed.итоговых + " — это не клиенты, пропущены.");
  }
  if (parsed.syntheticIds) {
    console.log("Столбца с идентификатором в файле нет — ключ собран из контакта" +
      " (" + parsed.syntheticIds + " строк). По нему считается, кому уже писали.");
  }
  // Ноль разобранных строк при непустом файле — это НЕ «сегодня некому писать».
  // Прежде прогон отвечал кодом 0, и оператор читал это как «всё в порядке».
  if (parsed.rows.length === 0 && parsed.badRows > 0) {
    console.error("");
    console.error("[ОТКАЗ] выгрузку прочитать не удалось: ни одной строки из " +
      (parsed.rows.length + parsed.badRows) + ".");
      // Два разных диагноза и два разных действия человека. Раньше был один,
      // и он вводил в заблуждение: «не опознаны столбцы: ООО Ромашка, a@b.ru,
      // 120000» — это не названия столбцов, это данные ПЕРВОГО клиента,
      // съеденного вместо шапки. Так бывает, когда строки вставили из письма.
      if (parsed.заголовкаНет) {
        console.error("        Похоже, в файле НЕТ строки с названиями столбцов:");
        console.error("        первая строка — это уже данные (" +
          parsed.unmappedHeaders.slice(0, 3).join(", ") + ").");
        console.error("        Что сделать: добавьте первой строкой названия, например");
        console.error("        контрагент;эл. почта;сумма долга;дата счета");
        console.error("        Иначе первый клиент из списка будет принят за шапку и потерян.");
      } else {
      if (parsed.unmappedHeaders.length) {
        console.error("        Не опознаны столбцы: " + parsed.unmappedHeaders.slice(0, 8).join(", "));
        }
        console.error("        Нужны: имя, почта или телефон, сумма, срок оплаты, признак оплаты.");
      console.error("        Пришлите нам файл как есть — добавим ваши названия столбцов.");
      }
    process.exitCode = 2;
    break run;
  }
  console.log("Уже отправлено ранее: " + alreadySent.size);
  console.log("");
  console.log("К ОТПРАВКЕ СЕГОДНЯ: " + plan.queue.length +
    (plan.deferred.length ? "  (ещё " + plan.deferred.length + " отложено на завтра — дневной предел)" : ""));
  for (const q of plan.queue) {
    console.log("  → " + q.to + "  [" + q.kind + "]  " + q.subject);
  }
  if (plan.unreachable.length) {
    console.log("");
    console.log("БЕЗ КОНТАКТА (написать некуда): " + plan.unreachable.length);
    for (const u of plan.unreachable) console.log("  ⚠ " + u.id);
  }
  if (plan.escalate.length) {
    console.log("");
    console.log("НУЖЕН ЧЕЛОВЕК (напоминания исчерпаны): " + plan.escalate.length);
    for (const e of plan.escalate) console.log("  🔴 " + e.id + " — просрочка " + e.daysOverdue + " дн.");
  }
  if (plan.badRows.length) {
    // Раньше это был только счётчик «битых: 3» среди трёхсот клиентов —
    // то есть бесполезный: непонятно, каких именно и что чинить.
    console.log("");
    console.log("ЧИНИТЬ В ВЫГРУЗКЕ (напоминание не уйдёт): " + plan.badRows.length);
    for (const b of plan.badRows.slice(0, 20)) {
      console.log("  ✖ " + (b.id || "(строка без id)") + " — " + b.reason);
    }
    if (plan.badRows.length > 20) console.log("  … и ещё " + (plan.badRows.length - 20) + " — весь список в файле");
  }
  console.log("");
  if (outPath) {
    const rows = [];
    for (const q of plan.queue) rows.push([q.to, q.channel, q.kind, q.subject, q.body, "к отправке"]);
    for (const u of plan.unreachable) rows.push([u.id, "", "", "", u.reason, "НЕТ КОНТАКТА"]);
    for (const e of plan.escalate) rows.push([e.id, "", "", "", "просрочка " + e.daysOverdue + " дн.", "НУЖЕН ЧЕЛОВЕК"]);
    for (const b of plan.badRows) rows.push([b.id || "", "", "", "", b.reason, "ЧИНИТЬ В ВЫГРУЗКЕ"]);
    await writeFile(outPath, toCsv(["кому", "канал", "повод", "тема", "текст письма", "что делать"], rows), "utf8");
    console.log("Файл для фирмы: " + outPath + " (" + rows.length + " строк, открывается в Excel)");
    console.log("");
  }
  console.log("Пропущено: оплачено " + plan.skipped.paid +
    ", не тот день " + plan.skipped.notScheduled +
    ", повтор " + plan.skipped.duplicate +
    ", битых " + plan.skipped.badRow);

  if (process.env.SHOW_BODIES === "1" && plan.queue.length) {
    console.log("\n=== ТЕКСТЫ ===");
    for (const q of plan.queue) {
      console.log("\n--- " + q.to + " | " + q.subject + " ---");
      console.log(q.body);
    }
  }

  // Код выхода различает ТРИ исхода, как у остальных наших инструментов:
  // 0 — прогон чистый; 1 — есть то, что требует ЧЕЛОВЕКА (некому написать,
  // напоминания исчерпаны); 2 — прогон не состоялся. Раньше здесь всегда был 0,
  // и прогон с пятью должниками на эскалацию выглядел так же, как пустой.
  const needHuman = plan.unreachable.length + plan.escalate.length + plan.badRows.length;
  if (needHuman) {
    console.log("");
    console.log("Требует человека: " + needHuman +
      " (без контакта " + plan.unreachable.length +
      ", напоминания исчерпаны " + plan.escalate.length + ")");
  }

  if (sentLogPath && process.env.MARK_SENT === "1") {
    // Отказ записи здесь НЕЛЬЗЯ проглотить: неотмеченное письмо уйдёт
    // клиенту второй раз при следующем прогоне. И отметить "все", когда
    // записалась часть, — тоже ложь, только в другую сторону.
    let marked = 0;
    let failure = null;
    for (const q of plan.queue) {
      try {
        await appendFile(sentLogPath,
          JSON.stringify({ key: q.key, to: q.to, at: new Date().toISOString() }) + LINE_END, "utf8");
        marked++;
      } catch (e) {
        failure = e && e.code ? e.code : "write_failed";
        break;
      }
    }
    console.log("");
    console.log("Отмечено как отправленное: " + marked + " из " + plan.queue.length);
    if (failure) {
      console.error("[ОТКАЗ] журнал не дописан (" + failure + ").");
      console.error("        Неотмеченные письма попадут в очередь СНОВА — клиент получит повтор.");
      console.error("        Отмечено " + marked + ", осталось " + (plan.queue.length - marked) + ".");
      process.exitCode = 2;
    }
  }

  // Ключи очереди рядом с файлом: по ним человек отмечает ИМЕННО ТО, что
  // отправил. Пересчитывать очередь заново для отметки нельзя — между
  // прогонами меняется день, и отметится не то, что ушло.
  if (outPath) {
    const keysPath = outPath + ".ключи.jsonl";
    try {
      const lines = plan.queue.map((q) => JSON.stringify({ key: q.key, to: q.to })).join(LINE_END);
      await writeFile(keysPath, lines ? lines + LINE_END : "", "utf8");
    } catch (e) {
      console.error("[ОТКАЗ] не удалось сохранить ключи очереди (" + (e.code || "write_failed") + ").");
      console.error("        Без них отметка отправленного невозможна, и завтра будут повторы.");
      process.exitCode = 2;
    }
  }

  process.exitCode = needHuman ? 1 : 0;
}
