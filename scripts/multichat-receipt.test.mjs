#!/usr/bin/env node
// Тест чека за ответ.
//   node scripts/multichat-receipt.test.mjs
//
// Чек имеет смысл ровно настолько, насколько он воспроизводим и чувствителен:
// одинаковый вход обязан давать одинаковый хеш, а любая подмена содержимого —
// другой. Если хоть одно из двух не выполняется, «квитанция» становится
// украшением, а мы получаем ровно то заявление без покрытия, от которого
// уходим.

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const ROOT = path.join(HERE, "..");
const BE = path.join(ROOT, "aevion-globus-backend/src");

// .mts-копии рядом с оригиналами: бэкенд — CommonJS-пакет, .ts в нём грузится
// как CJS и не отдаёт именованные экспорты; ESM требует явных расширений.
const pid = process.pid;
const tmp = [];
const put = (rel, src) => {
  const f = path.join(BE, rel);
  writeFileSync(f, src, "utf8");
  tmp.push(f);
  return f;
};
put(`lib/qsignV2/_canon-${pid}.mts`, readFileSync(path.join(BE, "lib/qsignV2/canonicalize.ts"), "utf8"));
put(`services/multichat/_dissent-${pid}.mts`, readFileSync(path.join(BE, "services/multichat/dissent.ts"), "utf8"));

// keyRegistry тянет БД; для чистых функций чека он не нужен — подменяем
// заглушкой, которая ведёт себя как «ключей нет». Именно этот путь и надо
// проверить: чек обязан честно отдаваться неподписанным.
put(
  `lib/qsignV2/_keys-${pid}.mts`,
  "export async function getActiveEd25519() { return null; }\n" +
    "export async function resolveEd25519(kid) { throw new Error('unknown kid ' + kid); }\n"
);

const receiptFile = put(
  `services/multichat/_receipt-${pid}.mts`,
  readFileSync(path.join(BE, "services/multichat/receipt.ts"), "utf8")
    .replace('from "../../lib/qsignV2/canonicalize"', `from "../../lib/qsignV2/_canon-${pid}.mts"`)
    .replace('from "../../lib/qsignV2/keyRegistry"', `from "../../lib/qsignV2/_keys-${pid}.mts"`)
    .replace('from "./dissent"', `from "./_dissent-${pid}.mts"`)
);

let m;
try {
  m = await import("file:///" + receiptFile.replace(/\\/g, "/"));
} finally {
  for (const f of tmp) { try { unlinkSync(f); } catch { /* уже убран */ } }
}

let failed = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${name}${cond || !extra ? "" : ` — ${extra}`}`);
  if (!cond) failed++;
};

const dissent = {
  verdict: "split",
  agreement: 0.31,
  numericConflicts: [{ context: "стоимость прогона", values: [], spread: 21 }],
  outlier: { agentId: "skeptic", distance: 0.7 },
  hedges: [{ agentId: "practic", kind: "hedged", note: "не уверен" }],
  checks: [
    { kind: "number", text: "Сверить число с источником — analyst: 40 против skeptic: 300.", agents: ["analyst", "skeptic"], weight: 3 },
    { kind: "outlier", text: "Прочитать первым ответ агента skeptic.", agents: ["skeptic"], weight: 1 },
  ],
};

const base = {
  conversationId: "conv-1",
  prompt: "Стоит ли запускать платный тариф до первой продажи?",
  askedAt: "2026-07-26T14:00:00.000Z",
  answers: [
    { agentId: "analyst", provider: "anthropic", ok: true, reply: "Данных недостаточно, нужен замер." },
    { agentId: "skeptic", provider: "openai", ok: true, reply: "Нет: тариф без спроса не проверяет гипотезу." },
    { agentId: "practic", provider: "google", ok: false },
  ],
  dissent,
};

/* ── 1. Содержимое чека ─────────────────────────────────────────────────── */

const r = m.buildReceipt(base);
ok("панель попала целиком", r.panel.length === 3);
ok("упавший агент отмечен", r.panel.find((p) => p.agentId === "practic")?.ok === false);
ok("стоимость посчитана", r.cost.calls === 3 && r.cost.answered === 2 && r.cost.failed === 1,
  JSON.stringify(r.cost));
ok("вердикт разногласий перенесён", r.dissent.verdict === "split" && r.dissent.numericConflicts === 1);
ok("аутлаер назван", r.dissent.outlier === "skeptic");

// В чеке лежат ХЕШИ ответов, а не сами ответы: артефакт проверяем, но не тащит
// в себя переписку.
ok("ответы хранятся хешами, не текстом",
  r.panel.every((p) => !p.replyHash || /^[0-9a-f]{64}$/.test(p.replyHash)) &&
    !JSON.stringify(r).includes("тариф без спроса"),
  "текст ответа не должен попадать в чек");
ok("у не ответившего хеша нет", r.panel.find((p) => p.agentId === "practic")?.replyHash === null);
ok("канонизация указана", r.canonicalization === "RFC8785", r.canonicalization);

// Список «что проверить» — то, по чему человек ДЕЙСТВУЕТ. Не покрыть его чеком
// значило бы оставить единственное место, где совет можно подменить незаметно.
ok("список попал в чек", r.dissent.checks.length === 2, JSON.stringify(r.dissent.checks));
ok("порядок списка сохранён", r.dissent.checks[0].kind === "number" && r.dissent.checks[1].kind === "outlier");
ok("вес перенесён", r.dissent.checks[0].weight === 3);
ok("совет хранится хешем, а не текстом",
  r.dissent.checks.every((c) => /^[0-9a-f]{64}$/.test(c.textHash)) && !JSON.stringify(r).includes("Сверить число"),
  "текст совета не должен попадать в чек");

/* ── 2. Воспроизводимость ───────────────────────────────────────────────── */

const again = m.buildReceipt(base);
ok("одинаковый вход → одинаковый чек", JSON.stringify(r) === JSON.stringify(again));

const s1 = await m.signReceipt(r);
const s2 = await m.signReceipt(again);
ok("одинаковый чек → одинаковый хеш", s1.hash === s2.hash, `${s1.hash?.slice(0, 12)} vs ${s2.hash?.slice(0, 12)}`);
ok("хеш выглядит как sha256", /^[0-9a-f]{64}$/.test(s1.hash), s1.hash);

/* ── 3. Чувствительность к подмене ──────────────────────────────────────── */

const tamperedPrompt = m.buildReceipt({ ...base, prompt: base.prompt + " " });
ok("изменённый промт меняет хеш", (await m.signReceipt(tamperedPrompt)).hash !== s1.hash);

const tamperedAnswer = m.buildReceipt({
  ...base,
  answers: base.answers.map((a) => (a.agentId === "analyst" ? { ...a, reply: "Наоборот, запускайте." } : a)),
});
ok("подменённый ответ меняет хеш", (await m.signReceipt(tamperedAnswer)).hash !== s1.hash);

const tamperedVerdict = m.buildReceipt({ ...base, dissent: { ...dissent, verdict: "consensus" } });
ok("подменённый вердикт меняет хеш", (await m.signReceipt(tamperedVerdict)).hash !== s1.hash);

// Главное свойство: подменённый совет обязан ломать хеш. Иначе чек покрывает
// всё, кроме той части, ради которой его читают.
const tamperedCheck = m.buildReceipt({
  ...base,
  dissent: {
    ...dissent,
    checks: [
      { ...dissent.checks[0], text: "Ничего проверять не нужно, всё сходится." },
      dissent.checks[1],
    ],
  },
});
ok("подменённый совет меняет хеш", (await m.signReceipt(tamperedCheck)).hash !== s1.hash);

// И перестановка тоже: порядок здесь несёт смысл — сверху то, что проверяется
// за минуту. Поменяв порядок местами, можно увести человека от главного.
const reordered = m.buildReceipt({
  ...base,
  dissent: { ...dissent, checks: [dissent.checks[1], dissent.checks[0]] },
});
ok("перестановка советов меняет хеш", (await m.signReceipt(reordered)).hash !== s1.hash);

ok("verifyReceiptHash подтверждает целый чек", m.verifyReceiptHash(r, s1.hash) === true);
ok("verifyReceiptHash ловит подмену", m.verifyReceiptHash(tamperedPrompt, s1.hash) === false);

/* ── 4. Честность без ключей ────────────────────────────────────────────── */

ok("без ключей подписи нет", s1.signature === null);
ok("причина названа прямо", typeof s1.signatureNote === "string" && s1.signatureNote.length > 10, String(s1.signatureNote));
ok("но хеш есть всегда", !!s1.hash, "без подписи чек всё равно проверяем пересчётом");

/* ── 5. Проверка чека ───────────────────────────────────────────────────── */

const v = await m.verifyReceipt({ receipt: r, hash: s1.hash, signature: null });
ok("целый чек проходит проверку", v.hashMatches === true);
ok("подпись честно помечена отсутствующей", v.signature === "absent", v.signature);
ok("спецификация отдаётся наружу", v.spec.canonicalization === "RFC8785" && v.spec.digest === "sha256",
  JSON.stringify(v.spec));

const vBad = await m.verifyReceipt({ receipt: tamperedPrompt, hash: s1.hash, signature: null });
ok("подменённый чек проверку НЕ проходит", vBad.hashMatches === false);
ok("но пересчитанный хеш всё равно отдаётся", /^[0-9a-f]{64}$/.test(vBad.computedHash));

// Без переданного хеша сравнивать не с чем. Выдать «сходится» было бы ложным
// подтверждением, ровно тем, от чего чек и защищает. Но и «не сходится» здесь
// нельзя: ручка принимает голый чек как штатный формат, и на подлинный
// документ страница отвечала «содержимое изменено». Поэтому третье
// состояние — null, и оно обязано отличаться от false.
const vNoHash = await m.verifyReceipt({ receipt: r, signature: null });
ok("без переданного хеша — не «сходится»", vNoHash.hashMatches !== true, String(vNoHash.hashMatches));
ok("без переданного хеша — и не «подделан»", vNoHash.hashMatches === null, String(vNoHash.hashMatches));
ok("пересчитанный хеш при этом отдаётся — есть что сверить самому",
  vNoHash.computedHash === s1.hash, `${vNoHash.computedHash} vs ${s1.hash}`);
ok("пояснение говорит, что сверять не с чем",
  /не приложен/i.test(String(vNoHash.signatureNote)), String(vNoHash.signatureNote));

const vAlgo = await m.verifyReceipt({ receipt: r, hash: s1.hash, signature: { algo: "rsa", kid: "k1", value: "00" } });
ok("неизвестный алгоритм → unverifiable, а не valid", vAlgo.signature === "unverifiable", vAlgo.signature);
ok("хеш проверяется даже при непроверяемой подписи", vAlgo.hashMatches === true);

// Ключ не разрешается — подпись непроверяема, но подмену содержимого это
// скрыть не должно.
const vNoKey = await m.verifyReceipt({ receipt: tamperedPrompt, hash: s1.hash, signature: { algo: "ed25519", kid: "missing", value: "00" } });
ok("недоступный ключ не маскирует подмену", vNoKey.hashMatches === false && vNoKey.signature === "unverifiable",
  `${vNoKey.hashMatches} / ${vNoKey.signature}`);
ok("детали реестра наружу не утекают",
  !/SASL|SCRAM|password|postgres|unknown kid/i.test(String(vNoKey.signatureNote)), String(vNoKey.signatureNote));

console.log(failed ? `\n${failed} проверок упало` : `\nвсе проверки прошли`);
process.exitCode = failed ? 1 : 0;
