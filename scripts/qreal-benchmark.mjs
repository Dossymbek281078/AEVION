#!/usr/bin/env node
// qreal-benchmark — слепой бенчмарк реализма QReal.
//
// Зачем: пост «QReal лучше Higgsfield» заблокирован основателем до измеримого
// доказательства (CLAUDE.md, открытые пункты). Этот раннер даёт доказательство
// того типа, который переживёт критику: одинаковый движок, одинаковые
// параметры, разница ТОЛЬКО в промте, слепое судейство по нашей же шкале.
//
// Плечи:
//   naive  — контроль: бриф уходит в движок как есть, одной строкой.
//   qreal  — лечение: промт, который собрал наш пайплайн (раскадровка +
//            REALISM_DIRECTIVES), первый кадр.
//   Оба плеча рендерятся ОДНИМ кодом на одном движке с одними параметрами,
//   поэтому дельта измеряет режиссуру, а не модель. Это наш реальный IP.
//
//   Плечо «market» (клипы чужого продукта) в этом раннере НЕ реализовано —
//   и намеренно: там другая базовая модель, поэтому дельта смешивает «нашу
//   режиссуру» с «их моделью». Такое сравнение годится для маркетинговой
//   иллюстрации, но не для доказательства, ради которого раннер и написан.
//   Если понадобится — класть клипы руками и судить той же панелью, пометив
//   результат как confounded.
//
// Фазы (ничего не тратит, пока не передан --confirm-spend):
//   node scripts/qreal-benchmark.mjs plan                    # $0 — смета и проверка шкалы
//   node scripts/qreal-benchmark.mjs prepare                 # НЕ бесплатен: пишет 10 проектов
//                                                            # в прод и жжёт токены LLM (см. протокол)
//   node scripts/qreal-benchmark.mjs render --confirm-spend  # ТРАТИТ деньги fal.ai
//   node scripts/qreal-benchmark.mjs poll                    # дождаться ссылок
//   node scripts/qreal-benchmark.mjs sheet --judge anna      # слепой лист оценки
//   node scripts/qreal-benchmark.mjs score                   # агрегация + вердикт
//
// Env: FAL_KEY (только для render/poll), QREAL_API (база API),
//      QREAL_BENCH_ENGINE=seedance|kling, QREAL_FAL_MODEL_* (как в engines.ts).

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const OUT = process.env.QREAL_BENCH_OUT || path.join(HERE, "..", "benchmark-out", "qreal-realism");
const API = (process.env.QREAL_API || "https://aevion.vercel.app/api-backend").replace(/\/$/, "");
const ENGINE_ID = process.env.QREAL_BENCH_ENGINE || "seedance";
const DURATION_SEC = Number(process.env.QREAL_BENCH_SECONDS) || 6;

// Дублируют engines.ts на случай, если API недоступен. Раннер всегда сначала
// пробует /api/qreal/engines — прайс не должен разъезжаться в двух местах.
const ENGINE_FALLBACK = {
  seedance: {
    label: "Seedance 2.0 (ByteDance)",
    falModelId: process.env.QREAL_FAL_MODEL_SEEDANCE?.trim() || "bytedance/seedance-2.0/text-to-video",
    usdPerSecond: 0.3034,
  },
  kling: {
    label: "Kling v3 standard (Kuaishou)",
    falModelId: process.env.QREAL_FAL_MODEL_KLING?.trim() || "fal-ai/kling-video/v3/standard/text-to-video",
    usdPerSecond: 0.126,
  },
};

const ARMS = ["naive", "qreal"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n", "utf8");

/** --limit N: пилот на первых N брифах. Решение «платить $36 за полный прогон»
 *  не должно быть «всё или ничего» — сначала дешёвый прогон на 3 брифах
 *  показывает, сходятся ли судьи по шкале, и только потом полная выборка.
 *  Порог вердикта требует ≥8 брифов, поэтому пилот честно печатает
 *  «НЕ ПОДТВЕРЖДЕНО» — он для калибровки, а не для заявлений. */
function limitFrom(argv) {
  const i = argv.indexOf("--limit");
  const n = i >= 0 ? Number(argv[i + 1]) : Number(process.env.QREAL_BENCH_LIMIT) || 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function loadLocal(limit = 0) {
  const briefs = readJson(path.join(HERE, "qreal-benchmark.briefs.json"));
  const rubric = readJson(path.join(HERE, "qreal-benchmark.rubric.json"));
  if (limit) briefs.briefs = briefs.briefs.slice(0, limit);
  return { briefs, rubric };
}

async function getJson(url, init) {
  const r = await fetch(url, init);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${url} → ${r.status} ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

/** Шкала берётся из прода (единственный источник правды) и сверяется с локальными
 *  якорями. Разъехались — падаем: судить половину критериев без якорей нельзя. */
async function loadCriteria(rubric) {
  let criteria = null;
  let apiAnchors = null;
  try {
    const d = await getJson(`${API}/api/qreal/realism-criteria`);
    criteria = d.criteria;
    apiAnchors = d.anchors || null;
  } catch (e) {
    console.error(`! Не дотянулся до ${API}/api/qreal/realism-criteria: ${e.message}`);
    throw new Error("Шкалу нельзя брать по памяти. Подними backend или задай QREAL_API.");
  }
  const apiIds = criteria.map((c) => c.id).sort();
  const rubricIds = Object.keys(rubric.anchors).sort();
  const missing = apiIds.filter((id) => !rubricIds.includes(id));
  const extra = rubricIds.filter((id) => !apiIds.includes(id));
  if (missing.length || extra.length) {
    throw new Error(
      `Шкала разъехалась с якорями.\n  нет якорей для: ${missing.join(", ") || "—"}\n  якоря-сироты: ${extra.join(", ") || "—"}\n` +
        `Почини scripts/qreal-benchmark.rubric.json под REALISM_CRITERIA и повтори.`
    );
  }

  // Якоря — продуктовый IP, они живут в services/qreal/judge.ts и отдаются
  // вместе с критериями. Локальный rubric.json остаётся читаемой копией для
  // судьи-человека, но расходиться с продуктом ему нельзя: иначе VLM-судья и
  // люди мерят разными линейками, и сравнивать их скоры бессмысленно.
  if (apiAnchors) {
    const drift = apiIds.filter((id) => {
      const a = apiAnchors[id], b = rubric.anchors[id];
      return !a || !b || ["1", "3", "5"].some((lvl) => (a[lvl] || "").trim() !== (b[lvl] || "").trim());
    });
    if (drift.length) {
      throw new Error(
        `Якоря бенчмарка разошлись с продуктовыми по: ${drift.join(", ")}.\n` +
          `Источник правды — REALISM_ANCHORS в services/qreal/judge.ts. Синхронизируй rubric.json и повтори.`
      );
    }
  } else {
    console.error(`! Прод ещё не отдаёт anchors (старая версия backend) — сверяю только состав критериев, тексты якорей не проверены.`);
  }
  return criteria;
}

async function loadEngine() {
  try {
    const d = await getJson(`${API}/api/qreal/engines`);
    const e = (d.engines || d).find((x) => x.id === ENGINE_ID);
    if (e?.falModelId && e?.usdPerSecond != null) {
      return { label: e.label, falModelId: e.falModelId, usdPerSecond: e.usdPerSecond };
    }
  } catch { /* прод мог не отдать — ниже локальный дубль */ }
  const f = ENGINE_FALLBACK[ENGINE_ID];
  if (!f) throw new Error(`Неизвестный движок "${ENGINE_ID}" (ожидаю: ${Object.keys(ENGINE_FALLBACK).join("|")})`);
  return f;
}

/* ── plan ─────────────────────────────────────────────────────────────── */

async function cmdPlan(argv) {
  const limit = limitFrom(argv);
  const { briefs, rubric } = loadLocal(limit);
  const criteria = await loadCriteria(rubric);
  const engine = await loadEngine();
  const clips = briefs.briefs.length * ARMS.length;
  const usd = clips * DURATION_SEC * engine.usdPerSecond;

  console.log(`План бенчмарка реализма QReal${limit ? ` — ПИЛОТ на ${limit} брифах (вердикт требует ≥8, пилот его не даёт)` : ""}`);
  console.log(`  движок:      ${engine.label} (${engine.falModelId})`);
  console.log(`  брифов:      ${briefs.briefs.length}`);
  console.log(`  плечи:       ${ARMS.join(" vs ")} (одинаковый движок, разный промт)`);
  console.log(`  клипов:      ${clips} × ${DURATION_SEC}с`);
  console.log(`  критериев:   ${criteria.length}, суммарный вес ${criteria.reduce((a, c) => a + c.weight, 0).toFixed(1)}`);
  console.log(`  СТОИМОСТЬ:   $${usd.toFixed(2)} (${engine.usdPerSecond}/с)`);
  const alt = Object.entries(ENGINE_FALLBACK).find(([id]) => id !== ENGINE_ID);
  if (alt) console.log(`  дешевле:     QREAL_BENCH_ENGINE=${alt[0]} → $${(clips * DURATION_SEC * alt[1].usdPerSecond).toFixed(2)}`);
  console.log(`\nПокрытие критериев брифами (сколько брифов нагружают критерий):`);
  for (const c of criteria) {
    const n = briefs.briefs.filter((b) => b.stresses.includes(c.id)).length;
    console.log(`  ${n > 0 ? " " : "!"} ${String(n).padStart(2)} × ${c.id}${n === 0 ? "  ← ни один бриф не проверяет" : ""}`);
  }
  mkdirSync(OUT, { recursive: true });
  writeJson(path.join(OUT, "plan.json"), { engine, clips, durationSec: DURATION_SEC, usd: Number(usd.toFixed(2)), arms: ARMS, criteria });
  console.log(`\nЗаписан ${path.join(OUT, "plan.json")}. Денег не потрачено.`);
}

/* ── prepare: собрать промты обоих плеч ───────────────────────────────── */

async function cmdPrepare(argv) {
  const { briefs, rubric } = loadLocal(limitFrom(argv));
  await loadCriteria(rubric);
  mkdirSync(OUT, { recursive: true });
  const items = [];

  for (const b of briefs.briefs) {
    // naive: бриф как есть — то, что получает обычный пользователь.
    items.push({ clipId: randomUUID().slice(0, 8), briefId: b.id, arm: "naive", prompt: b.brief, status: "prompt_ready" });

    // qreal: промт нашего пайплайна. Берём ПЕРВЫЙ кадр раскадровки, чтобы
    // сравнивать клип с клипом, а не 1 клип против шести.
    let prompt = null;
    let method = null;
    try {
      const created = await getJson(`${API}/api/qreal/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `bench ${b.id}`, brief: b.brief, format: "short", targetDurationSec: DURATION_SEC, language: b.language }),
      });
      const pid = created.project.id;
      const sb = await getJson(`${API}/api/qreal/projects/${pid}/storyboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variation: 1 }),
      });
      prompt = sb.project?.shots?.[0]?.prompt || null;
      method = sb.storyboardMethod;
      if (method === "deterministic-stub") {
        console.error(`! ${b.id}: раскадровка сорвалась на детерминированный стаб — это НЕ наш пайплайн, а заглушка.`);
      }
    } catch (e) {
      console.error(`! ${b.id}: пайплайн недоступен (${e.message})`);
    }
    if (!prompt) throw new Error(`Нет промта QReal для ${b.id}. Без него плечо qreal измеряло бы пустоту — останавливаюсь.`);
    items.push({ clipId: randomUUID().slice(0, 8), briefId: b.id, arm: "qreal", prompt, storyboardMethod: method, status: "prompt_ready" });
    console.log(`  ok ${b.id}  naive=${b.brief.length}симв  qreal=${prompt.length}симв (${method})`);
  }

  writeJson(path.join(OUT, "manifest.json"), { createdAt: new Date().toISOString(), engineId: ENGINE_ID, durationSec: DURATION_SEC, items });
  console.log(`\n${items.length} промтов в manifest.json. Денег не потрачено.`);
}

/* ── render / poll: единственная фаза, которая тратит ─────────────────── */

const falRequestsBase = (modelId) => modelId.split("/").slice(0, 2).join("/");

function falInput(engineId, prompt, durationSec) {
  if (engineId === "kling") {
    return { prompt, duration: durationSec <= 7 ? "5" : "10", aspect_ratio: "16:9", generate_audio: true };
  }
  return { prompt, duration: durationSec, aspect_ratio: "16:9", resolution: "1080p", generate_audio: true };
}

async function cmdRender(argv) {
  const key = process.env.FAL_KEY?.trim();
  if (!key) throw new Error("FAL_KEY не задан — рендерить нечем.");
  const manifestPath = path.join(OUT, "manifest.json");
  if (!existsSync(manifestPath)) throw new Error("Сначала prepare.");
  const manifest = readJson(manifestPath);
  const engine = await loadEngine();
  const pending = manifest.items.filter((i) => i.status === "prompt_ready");
  const usd = pending.length * manifest.durationSec * engine.usdPerSecond;

  if (!argv.includes("--confirm-spend")) {
    console.log(`Готов отправить ${pending.length} клипов на ${engine.label}.`);
    console.log(`СТОИМОСТЬ: ~$${usd.toFixed(2)}. Ничего не отправлено.`);
    console.log(`Подтвердить: node scripts/qreal-benchmark.mjs render --confirm-spend`);
    return;
  }

  for (const it of pending) {
    const r = await fetch(`https://queue.fal.run/${engine.falModelId}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(falInput(ENGINE_ID, it.prompt, manifest.durationSec)),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d?.request_id) {
      it.requestId = String(d.request_id);
      it.status = "queued";
      console.log(`  → ${it.clipId} ${it.briefId}/${it.arm} queued`);
    } else {
      it.status = "failed";
      it.error = String(d?.detail || d?.error || `fal ${r.status}`).slice(0, 200);
      console.error(`  ! ${it.clipId} ${it.briefId}/${it.arm}: ${it.error}`);
    }
    writeJson(manifestPath, manifest);
  }
  console.log(`\nОтправлено. Дальше: node scripts/qreal-benchmark.mjs poll`);
}

async function cmdPoll() {
  const key = process.env.FAL_KEY?.trim();
  if (!key) throw new Error("FAL_KEY не задан.");
  const manifestPath = path.join(OUT, "manifest.json");
  const manifest = readJson(manifestPath);
  const engine = await loadEngine();
  const base = falRequestsBase(engine.falModelId);

  for (let round = 0; round < 60; round++) {
    const queued = manifest.items.filter((i) => i.status === "queued");
    if (!queued.length) break;
    for (const it of queued) {
      const s = await fetch(`https://queue.fal.run/${base}/requests/${it.requestId}/status`, { headers: { Authorization: `Key ${key}` } });
      const sd = await s.json().catch(() => ({}));
      const status = String(sd?.status || "").toUpperCase();
      if (status !== "COMPLETED") continue;
      const res = await fetch(`https://queue.fal.run/${base}/requests/${it.requestId}`, { headers: { Authorization: `Key ${key}` } });
      const rd = await res.json().catch(() => ({}));
      const url = rd?.video?.url || rd?.videos?.[0]?.url || rd?.output?.url || null;
      it.status = url ? "rendered" : "failed";
      it.resultUrl = url;
      if (!url) it.error = "движок вернул результат без ссылки на видео";
      console.log(`  ${it.status === "rendered" ? "✓" : "!"} ${it.clipId} ${it.briefId}/${it.arm}`);
      writeJson(manifestPath, manifest);
    }
    if (manifest.items.some((i) => i.status === "queued")) await sleep(15_000);
  }
  const left = manifest.items.filter((i) => i.status === "queued").length;
  console.log(left ? `\nОсталось в очереди: ${left}. Запусти poll ещё раз.` : `\nВсе клипы готовы. Дальше: sheet`);
}

/* ── sheet: слепой лист оценки ────────────────────────────────────────── */

async function cmdSheet(argv) {
  const judge = (argv[argv.indexOf("--judge") + 1] || "").trim();
  if (!judge || judge.startsWith("--")) throw new Error("Укажи судью: --judge <имя>");
  const { briefs, rubric } = loadLocal();
  const criteria = await loadCriteria(rubric);
  const mp = path.join(OUT, "manifest.json");
  // Внятный отказ вместо сырого ENOENT: по документу легко запустить
  // фазу не в том порядке.
  if (!existsSync(mp)) throw new Error("Нет manifest.json — сначала prepare (и render/poll, если нужны клипы).");
  const manifest = readJson(path.join(OUT, "manifest.json"));
  const rendered = manifest.items.filter((i) => i.status === "rendered");
  if (!rendered.length) throw new Error("Нечего судить: нет отрендеренных клипов.");

  // Порядок клипов перемешан детерминированно по имени судьи — у двух судей
  // разный порядок, поэтому «первый клип всегда naive» не выучивается.
  // sha1, а не самодельный хэш: у цепочки `a*31+c` вклад имени судьи вытесняется
  // за ~7 символов, и все судьи получают один порядок (поймано на синтетике).
  const seeded = rendered
    .map((i) => ({ i, k: createHash("sha1").update(`${judge}:${i.clipId}`).digest("hex") }))
    .sort((a, b) => (a.k < b.k ? -1 : 1))
    .map((x) => x.i);

  const briefById = Object.fromEntries(briefs.briefs.map((b) => [b.id, b]));
  const rows = [["clip_id", "brief_title", "criterion_id", "criterion_label", "weight", "score_1_5", "note"]];
  const playlist = [];
  for (const it of seeded) {
    playlist.push(`${it.clipId}\t${briefById[it.briefId].title}\t${it.resultUrl}`);
    for (const c of criteria) {
      rows.push([it.clipId, briefById[it.briefId].title, c.id, c.label, c.weight, "", ""]);
    }
  }
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");

  // Слепота — не «мы же не печатали плечо», а проверяемое свойство. Имя плеча
  // может просочиться через resultUrl (имя файла у движка/зеркала) или через
  // clipId. Пусть это будет громкая ошибка, а не тихо испорченный бенчмарк.
  for (const [name, text] of [[`scoresheet-${judge}.csv`, csv], [`playlist-${judge}.tsv`, playlist.join("\n")]]) {
    const leak = ARMS.find((a) => new RegExp(`\\b${a}\\b`, "i").test(text));
    if (leak) throw new Error(`Слепота нарушена: в ${name} встречается «${leak}». Судья увидит плечо — лист не выпускаю.`);
  }

  writeFileSync(path.join(OUT, `scoresheet-${judge}.csv`), "﻿" + csv, "utf8");
  writeFileSync(path.join(OUT, `playlist-${judge}.tsv`), playlist.join("\n") + "\n", "utf8");

  console.log(`Лист судьи «${judge}»: scoresheet-${judge}.csv (${rendered.length} клипов × ${criteria.length} критериев)`);
  console.log(`Плейлист: playlist-${judge}.tsv — в нём НЕТ плеча, только id клипа и бриф.`);
  console.log(`Якоря шкалы 1/3/5 — scripts/qreal-benchmark.rubric.json. Неприменимый критерий — оставить пустым.`);
  console.log(`\nСоответствие клип→плечо лежит в manifest.json. Судья не открывает его до сдачи листа.`);
}

/* ── score: агрегация и вердикт ───────────────────────────────────────── */

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (const ch of text.replace(/^﻿/, "").replace(/\r/g, "")) {
    if (q) {
      if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v !== ""));
}

async function cmdScore() {
  const { briefs, rubric } = loadLocal();
  const criteria = await loadCriteria(rubric);
  const weightById = Object.fromEntries(criteria.map((c) => [c.id, c.weight]));
  const manifest = readJson(path.join(OUT, "manifest.json"));
  const armByClip = Object.fromEntries(manifest.items.map((i) => [i.clipId, i.arm]));
  const briefByClip = Object.fromEntries(manifest.items.map((i) => [i.clipId, i.briefId]));
  const briefById = Object.fromEntries(briefs.briefs.map((b) => [b.id, b]));

  const sheets = readdirSync(OUT).filter((f) => /^scoresheet-.+\.csv$/.test(f));
  if (!sheets.length) throw new Error("Нет заполненных листов scoresheet-*.csv");

  // scores[clipId][criterionId] = [оценки всех судей]
  const scores = {};
  let filled = 0;
  for (const f of sheets) {
    const rows = parseCsv(readFileSync(path.join(OUT, f), "utf8"));
    const head = rows[0].map((h) => h.trim());
    const ix = (n) => head.indexOf(n);
    for (const r of rows.slice(1)) {
      const clipId = r[ix("clip_id")], cid = r[ix("criterion_id")], raw = (r[ix("score_1_5")] || "").trim();
      if (!raw) continue; // неприменимо — исключаем у обоих плеч
      const v = Number(raw);
      if (!Number.isFinite(v) || v < 1 || v > 5) { console.error(`! ${f}: ${clipId}/${cid} — оценка "${raw}" вне 1-5, пропущена`); continue; }
      ((scores[clipId] ||= {})[cid] ||= []).push(v);
      filled++;
    }
  }

  // Взвешенное среднее клипа: только по критериям, которые судьи заполнили.
  const clipScore = (clipId) => {
    const per = scores[clipId] || {};
    let num = 0, den = 0;
    for (const [cid, vals] of Object.entries(per)) {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      num += mean * (weightById[cid] || 1);
      den += weightById[cid] || 1;
    }
    return den ? num / den : null;
  };

  const perBrief = [];
  for (const b of briefs.briefs) {
    const clips = Object.fromEntries(
      ARMS.map((arm) => {
        const c = manifest.items.find((i) => i.briefId === b.id && i.arm === arm && i.status === "rendered");
        return [arm, c ? clipScore(c.clipId) : null];
      })
    );
    if (clips.naive == null || clips.qreal == null) continue;
    perBrief.push({ briefId: b.id, title: b.title, naive: clips.naive, qreal: clips.qreal, delta: clips.qreal - clips.naive });
  }

  const wins = perBrief.filter((x) => x.delta > 0).length;
  const meanDelta = perBrief.reduce((a, x) => a + x.delta, 0) / (perBrief.length || 1);
  // Порог задан ДО прогона: 8/10 побед и дельта ≥0.5 балла. Иначе не заявляем.
  const proven = perBrief.length >= 8 && wins >= Math.ceil(perBrief.length * 0.8) && meanDelta >= 0.5;

  // Срез по критериям — где именно режиссура даёт выигрыш.
  const perCriterion = criteria.map((c) => {
    const d = [];
    for (const b of briefs.briefs) {
      const get = (arm) => {
        const it = manifest.items.find((i) => i.briefId === b.id && i.arm === arm);
        const vals = it && scores[it.clipId]?.[c.id];
        return vals ? vals.reduce((a, v) => a + v, 0) / vals.length : null;
      };
      const n = get("naive"), q = get("qreal");
      if (n != null && q != null) d.push(q - n);
    }
    return { id: c.id, label: c.label, n: d.length, delta: d.length ? d.reduce((a, v) => a + v, 0) / d.length : null };
  }).filter((x) => x.n > 0).sort((a, b) => b.delta - a.delta);

  const L = [];
  L.push(`# Бенчмарк реализма QReal — результат\n`);
  L.push(`Судейских листов: ${sheets.length} (${sheets.join(", ")}), заполненных оценок: ${filled}.`);
  L.push(`Плечи: naive (бриф как есть) vs qreal (промт пайплайна). Движок один — ${manifest.engineId}, ${manifest.durationSec}с.\n`);
  L.push(`## Вердикт\n`);
  L.push(proven
    ? `**ПОДТВЕРЖДЕНО.** Режиссура QReal выигрывает у голого промта на том же движке: ${wins}/${perBrief.length} брифов, средняя дельта +${meanDelta.toFixed(2)} балла из 5.`
    : `**НЕ ПОДТВЕРЖДЕНО.** ${wins}/${perBrief.length} побед, средняя дельта ${meanDelta >= 0 ? "+" : ""}${meanDelta.toFixed(2)}. Порог (≥80% побед и ≥+0.50) не взят — заявлять превосходство нельзя.`);
  L.push(`\nЧто эта цифра НЕ доказывает: превосходство над чужим продуктом. Плечи naive/qreal делят одну модель, поэтому измерена наша режиссура и только она. Сравнение с Higgsfield/Veo/Kling-продуктом смешивает режиссуру с базовой моделью — такое число в публичном посте будет некорректным.\n`);
  L.push(`## По брифам\n`);
  L.push(`| Бриф | naive | qreal | дельта |`);
  L.push(`|---|---|---|---|`);
  for (const x of perBrief) L.push(`| ${x.title} | ${x.naive.toFixed(2)} | ${x.qreal.toFixed(2)} | ${x.delta >= 0 ? "+" : ""}${x.delta.toFixed(2)} |`);
  L.push(`\n## По критериям (где режиссура даёт выигрыш)\n`);
  L.push(`| Критерий | брифов | дельта |`);
  L.push(`|---|---|---|`);
  for (const c of perCriterion) L.push(`| ${c.label} | ${c.n} | ${c.delta >= 0 ? "+" : ""}${c.delta.toFixed(2)} |`);

  const md = L.join("\n") + "\n";
  writeFileSync(path.join(OUT, "report.md"), md, "utf8");
  console.log(md);
  console.log(`Записан ${path.join(OUT, "report.md")}`);
}

/* ── entry ────────────────────────────────────────────────────────────── */

const cmd = process.argv[2] || "plan";
const argv = process.argv.slice(3);
const table = { plan: cmdPlan, prepare: cmdPrepare, render: cmdRender, poll: cmdPoll, sheet: cmdSheet, score: cmdScore };
if (!table[cmd]) {
  console.error(`Фазы: ${Object.keys(table).join(" | ")}`);
  process.exitCode = 2;
} else {
  table[cmd](argv).catch((e) => {
    console.error(`\n${e.message}`);
    process.exitCode = 1;
  });
}
