#!/usr/bin/env node
/**
 * Прогнать смоук и СКАЗАТЬ, если он упал.
 *
 * Зачем отдельная обёртка. Задача в расписании пишет лог, но лог никто не
 * читает. Сторож без читателя — не сторож: платформа уже наступала на это
 * (см. память feedback_alarm_channels_without_readers). Приём, принятый
 * здесь: отчёт появляется ТОЛЬКО при падении, в папке, куда основатель
 * заходит; при успехе прошлый отчёт УБИРАЕТСЯ.
 *
 * Второе важно не меньше первого: отчёт, оставшийся от позавчерашней
 * поломки, читается как сегодняшняя тревога. Починили — след должен
 * исчезнуть сам.
 *
 * Запуск:
 *   node scripts/smoke-report-on-fail.mjs                 # смоук QSkyway
 *   node scripts/smoke-report-on-fail.mjs all-smokes
 *
 * Коды выхода наследуются от smoke-with-server.mjs:
 *   0 — прошло, 1 — смоук упал, 2 — прогон НЕ состоялся (бэкенд не поднялся).
 * Второе и третье различаются в отчёте: «упало» и «не проверялось» — разные
 * новости, и путать их нельзя.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const script = process.argv[2] || "qskyway-smoke";

const VAULT = "C:\\Users\\user\\OneDrive\\AEVION-KNOWLEDGE\\04-Daily";
const OUT_DIR = existsSync(VAULT) ? VAULT : "C:\\Users\\user";
// Имя ЛАТИНИЦЕЙ намеренно. Первая версия называлась
// qskyway-smoke-ПАДЕНИЕ.md, и удалить её из кода не удавалось: rmSync
// молчал, а файл оставался. За 19.08.2026 кириллица в путях и шаблонах
// подвела пять раз подряд (греп, регулярки, экранирование), и спорить с
// ней ради красоты имени не стоит — отчёт всё равно читают по содержимому.
const REPORT = join(OUT_DIR, "qskyway-smoke-FAILED.md");

// Вывод собираем СВОЙ, а не читаем общий лог.
//
// Первая версия брала хвост из qskyway-smoke-local.log — файла, который пишет
// задача расписания. Проверено 19.08.2026: при ручном падении отчёт показал
// хвост ПРОШЛОГО УСПЕШНОГО прогона, то есть строки «PASS» под заголовком
// «падение». Устаревшее, выданное за текущее, — худший вид отчёта: он
// выглядит информативным и уводит в сторону.
const captured = [];
const child = spawn(process.execPath, [join(HERE, "smoke-with-server.mjs"), script], {
  cwd: join(HERE, ".."),
  stdio: ["inherit", "pipe", "pipe"],
});
for (const stream of [child.stdout, child.stderr]) {
  stream.on("data", (buf) => {
    const text = buf.toString();
    captured.push(text);
    process.stdout.write(text);
  });
}

child.on("exit", (code) => {
  const ok = code === 0;

  if (ok) {
    // Починилось — старая тревога должна исчезнуть, иначе она переживёт причину.
    if (existsSync(REPORT)) {
      rmSync(REPORT, { force: true });
      // Проверяем, а не верим на слово. 19.08.2026 эта строка печатала
      // «убран», а файл оставался на месте — то есть отчёт о падении пережил
      // починку и читался как сегодняшняя тревога.
      if (existsSync(REPORT)) {
        console.error(`[smoke] прошло, но прежний отчёт УБРАТЬ НЕ УДАЛОСЬ: ${REPORT}`);
      } else {
        console.log("[smoke] прошло; прежний отчёт о падении убран");
      }
    }
    process.exit(0);
  }

  // Хвост режем от строки «запускаю» — это отметка, после которой начинается
  // сам смоук. До неё идёт стартовый вывод бэкенда (нет соединения с узлом
  // Bitcoin, база недоступна, очередь вебхуков) — шум, который человеку
  // ничего не говорит о причине падения и вытесняет полезное.
  const outLines = captured.join("").split("\n");
  const startAt = outLines.findIndex((l) => l.includes("запускаю"));
  const meaningful = startAt >= 0 ? outLines.slice(startAt) : outLines;
  const tail = meaningful.length > 1 ? meaningful.slice(-25).join("\n") : "(прогон не дал вывода)";

  const what =
    code === 2
      ? "ПРОГОН НЕ СОСТОЯЛСЯ — бэкенд не поднялся за 120 секунд.\n\nЭто НЕ то же самое, что «смоук упал»: проверка просто не выполнялась,\nи о состоянии путей записи сегодня ничего не известно."
      : `СМОУК УПАЛ (код ${code}). Ниже хвост лога — в нём видно, какая\nименно проверка не прошла.`;

  const now = new Date().toISOString().replace("T", " ").slice(0, 16);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    REPORT,
    `# Локальный смоук QSkyway: ${code === 2 ? "не состоялся" : "падение"}\n\n` +
      `Время: ${now}\nПрогон: ${script}\n\n${what}\n\n` +
      "Эти проверки покрывают пути ЗАПИСИ (бронирование слотов, предел\n" +
      "вместимости, выдача чека QRight), которые на проде запускать нельзя.\n" +
      "Значит другой проверки у них нет.\n\n" +
      "## Хвост лога\n\n```\n" + tail + "\n```\n\n" +
      "Файл исчезнет сам, как только следующий прогон пройдёт.\n",
    "utf8",
  );
  console.error(`[smoke] отчёт о падении: ${REPORT}`);
  process.exit(code ?? 1);
});
