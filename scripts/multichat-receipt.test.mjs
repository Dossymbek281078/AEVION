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
put(`lib/qsignV2/_keys-${pid}.mts`, "export async function getActiveEd25519() { return null; }\n");

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

ok("verifyReceiptHash подтверждает целый чек", m.verifyReceiptHash(r, s1.hash) === true);
ok("verifyReceiptHash ловит подмену", m.verifyReceiptHash(tamperedPrompt, s1.hash) === false);

/* ── 4. Честность без ключей ────────────────────────────────────────────── */

ok("без ключей подписи нет", s1.signature === null);
ok("причина названа прямо", typeof s1.signatureNote === "string" && s1.signatureNote.length > 10, String(s1.signatureNote));
ok("но хеш есть всегда", !!s1.hash, "без подписи чек всё равно проверяем пересчётом");

console.log(failed ? `\n${failed} проверок упало` : `\nвсе проверки прошли`);
process.exitCode = failed ? 1 : 0;
