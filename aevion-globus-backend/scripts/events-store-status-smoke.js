// Проверка eventsStoreStatus на РЕАЛЬНЫХ данных, а не на догадке.
// Три случая: файла нет, файл с событиями, файл с битой строкой.
const fs = require("fs");
const os = require("os");
const path = require("path");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aev-events-"));
const file = path.join(dir, "events.jsonl");
process.env.EVENTS_FILE = file;

const mod = require(path.join(__dirname, "..", "dist", "routes", "events.js"));
const status = mod.eventsStoreStatus;
if (typeof status !== "function") {
  console.log("ПРОВАЛ: eventsStoreStatus не экспортируется");
  process.exit(1);
}

let ok = true;
function check(label, got, want) {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) ok = false;
  console.log(`${pass ? "OK  " : "FAIL"} ${label}\n     получено ${JSON.stringify(got)}\n     ожидалось ${JSON.stringify(want)}`);
}

// 1. Файла нет.
check("файла нет", status(), { persistedByEnv: true, exists: false, count: 0, oldest: null });

// 2. Три события, самое старое — второе по порядку в файле.
fs.writeFileSync(
  file,
  [
    JSON.stringify({ ts: "2026-07-26T10:00:00.000Z", type: "page_view" }),
    JSON.stringify({ ts: "2026-07-25T08:00:00.000Z", type: "page_view" }),
    JSON.stringify({ ts: "2026-07-26T12:00:00.000Z", type: "click" }),
  ].join("\n") + "\n",
  "utf8",
);
check("три события", status(), {
  persistedByEnv: true,
  exists: true,
  count: 3,
  oldest: "2026-07-25T08:00:00.000Z",
});

// 3. Битая строка не должна ронять и не должна теряться из счёта.
fs.appendFileSync(file, "{это не json\n", "utf8");
const s3 = status();
check("битая строка не роняет", { exists: s3.exists, count: s3.count, oldest: s3.oldest }, {
  exists: true,
  count: 4,
  oldest: "2026-07-25T08:00:00.000Z",
});

// 4. Флаг фиксируется на момент загрузки модуля и НЕ меняется потом.
// Это намеренно: путь EVENTS_FILE тоже вычисляется при загрузке, и если бы
// флаг читал env при каждом вызове, он мог бы сказать "persisted", пока путь
// остаётся дефолтным. Статус, способный соврать, хуже отсутствующего.
delete process.env.EVENTS_FILE;
const after = status().persistedByEnv;
const stable = after === true;
if (!stable) ok = false;
console.log(`${stable ? "OK  " : "FAIL"} флаг не меняется после загрузки: ${after} (ожидалось true)`);

fs.rmSync(dir, { recursive: true, force: true });
console.log(ok ? "\nВСЁ СХОДИТСЯ" : "\nЕСТЬ РАСХОЖДЕНИЯ");
process.exit(ok ? 0 : 1);
