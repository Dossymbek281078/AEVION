#!/usr/bin/env node
// qreal-benchmark-continuity — замер КОНСИСТЕНТНОСТИ персонажа между кадрами.
//
// Зачем отдельно от qreal-benchmark.mjs: там одиночные 6-секундные клипы и 14
// покадровых критериев, поэтому консистентность — то, что спека объявляет
// нашей нишей, — в замер не попадает вовсе. Здесь сцены многокадровые, и герой
// обязан повторяться минимум в двух кадрах.
//
// Плечи (кадры у обоих ОДИНАКОВЫЕ, разница только в тексте про героя):
//   naive — короткое упоминание героя, одинаковое во всех кадрах («Kazakh boy»).
//           Это ЩЕДРЫЙ контроль: реальный пользователь описывает героя каждый
//           раз по-разному, и дрейф у него был бы сильнее. Занижать контроль
//           руками нельзя — иначе победа будет подстроена.
//   qreal — канон реестра персонажей целиком + директива continuity.
//
// Директивы реализма получают ОБА плеча: измеряем вклад реестра, а не
// директив (их вклад меряет основной бенчмарк).
//
// Фазы (тратит только render и только с --confirm-spend):
//   node scripts/qreal-benchmark-continuity.mjs plan
//   node scripts/qreal-benchmark-continuity.mjs prepare
//   node scripts/qreal-benchmark-continuity.mjs render --confirm-spend
//   node scripts/qreal-benchmark-continuity.mjs poll
//   node scripts/qreal-benchmark-continuity.mjs sheet --judge anna
//   node scripts/qreal-benchmark-continuity.mjs score

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const ROOT = path.join(HERE, "..");
const SVC = path.join(ROOT, "aevion-globus-backend/src/services/qreal");
const OUT = process.env.QREAL_BENCH_OUT || path.join(ROOT, "benchmark-out", "qreal-continuity");
const API = (process.env.QREAL_API || "https://aevion.vercel.app/api-backend").replace(/\/$/, "");
const ENGINE_ID = process.env.QREAL_BENCH_ENGINE || "seedance";
const DURATION_SEC = Number(process.env.QREAL_BENCH_SECONDS) || 6;
const ARMS = ["naive", "qreal"];

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n", "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Промты строим ПРОДАКШЕН-кодом, а не копией правил в скрипте: разъедутся —
 *  и бенчмарк начнёт мерить не то, что уходит в движок. Бэкенд — CommonJS,
 *  поэтому грузим через .mts-копии (Node 24 срезает типы штатно). */
async function loadProductionModules() {
  const pid = process.pid;
  const tmp = [];
  const stage = (name, rewrites = []) => {
    const src = rewrites.reduce((s, [a, b]) => s.replace(a, b), readFileSync(path.join(SVC, `${name}.ts`), "utf8"));
    const f = path.join(SVC, `_bench-${name}-${pid}.mts`);
    writeFileSync(f, src, "utf8");
    tmp.push(f);
    return f;
  };
  stage("judge");
  const charFile = stage("characters");
  const dirFile = stage("directives");
  try {
    const chars = await import("file:///" + charFile.replace(/\\/g, "/"));
    const dirs = await import("file:///" + dirFile.replace(/\\/g, "/"));
    return { deriveName: chars.deriveName, consistencyDirective: chars.consistencyDirective, REALISM_DIRECTIVES: dirs.REALISM_DIRECTIVES };
  } finally {
    for (const f of tmp) { try { unlinkSync(f); } catch { /* уже убран */ } }
  }
}

async function getJson(url) {
  const r = await fetch(url);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return d;
}

async function loadContinuityCriteria() {
  // Критерии живут в коде; тянем их через тот же .mts-приём, чтобы шкала
  // судейства была ровно продуктовой.
  const pid = process.pid;
  const files = [];
  const stage = (name, rewrites = []) => {
    const src = rewrites.reduce((s, [a, b]) => s.replace(a, b), readFileSync(path.join(SVC, `${name}.ts`), "utf8"));
    const f = path.join(SVC, `_benchc-${name}-${pid}.mts`);
    writeFileSync(f, src, "utf8");
    files.push(f);
    return f;
  };
  stage("judge");
  stage("characters");
  const cont = stage("continuity", [
    ['from "./judge"', `from "./_benchc-judge-${pid}.mts"`],
    ['from "./characters"', `from "./_benchc-characters-${pid}.mts"`],
  ]);
  try {
    const m = await import("file:///" + cont.replace(/\\/g, "/"));
    return { criteria: m.CONTINUITY_CRITERIA, anchors: m.CONTINUITY_ANCHORS, threshold: m.continuityThreshold() };
  } finally {
    for (const f of files) { try { unlinkSync(f); } catch { /* уже убран */ } }
  }
}

const ENGINE_FALLBACK = {
  seedance: { label: "Seedance 2.0", falModelId: process.env.QREAL_FAL_MODEL_SEEDANCE?.trim() || "bytedance/seedance-2.0/text-to-video", usdPerSecond: 0.3034 },
  kling: { label: "Kling v3 standard", falModelId: process.env.QREAL_FAL_MODEL_KLING?.trim() || "fal-ai/kling-video/v3/standard/text-to-video", usdPerSecond: 0.126 },
};

async function loadEngine() {
  try {
    const d = await getJson(`${API}/api/qreal/engines`);
    const e = (d.engines || d).find((x) => x.id === ENGINE_ID);
    if (e?.falModelId && e?.usdPerSecond != null) return { label: e.label, falModelId: e.falModelId, usdPerSecond: e.usdPerSecond };
  } catch { /* локальный дубль ниже */ }
  const f = ENGINE_FALLBACK[ENGINE_ID];
  if (!f) throw new Error(`Неизвестный движок "${ENGINE_ID}"`);
  return f;
}

const loadScenes = () => readJson(path.join(HERE, "qreal-benchmark.scenes.json"));

/* ── plan ─────────────────────────────────────────────────────────────── */

async function cmdPlan() {
  const { scenes } = loadScenes();
  const { criteria, threshold } = await loadContinuityCriteria();
  const engine = await loadEngine();
  const clips = scenes.reduce((a, s) => a + s.shots.length, 0) * ARMS.length;
  const usd = clips * DURATION_SEC * engine.usdPerSecond;

  console.log("План бенчмарка КОНСИСТЕНТНОСТИ");
  console.log(`  движок:     ${engine.label}`);
  console.log(`  сцен:       ${scenes.length}, кадров суммарно ${clips / ARMS.length} на плечо`);
  console.log(`  плечи:      ${ARMS.join(" vs ")} (кадры одинаковые, разница — канон героя)`);
  console.log(`  клипов:     ${clips} × ${DURATION_SEC}с`);
  console.log(`  критериев:  ${criteria.length}, порог ${threshold}`);
  console.log(`  СТОИМОСТЬ:  $${usd.toFixed(2)}`);
  const alt = Object.entries(ENGINE_FALLBACK).find(([id]) => id !== ENGINE_ID);
  if (alt) console.log(`  дешевле:    QREAL_BENCH_ENGINE=${alt[0]} → $${(clips * DURATION_SEC * alt[1].usdPerSecond).toFixed(2)}`);

  console.log("\nПовторы героев (без повтора непрерывность не измерима):");
  for (const sc of scenes) {
    for (const c of sc.cast) {
      const n = sc.shots.filter((s) => s.cast.includes(c.id)).length;
      console.log(`  ${n >= 2 ? " " : "!"} ${sc.id}/${c.id}: ${n} кадра(ов)${n < 2 ? "  ← НЕ ИЗМЕРИМО" : ""}`);
    }
  }
  mkdirSync(OUT, { recursive: true });
  writeJson(path.join(OUT, "plan.json"), { engine, clips, usd: Number(usd.toFixed(2)), criteria, threshold });
  console.log(`\nЗаписан plan.json. Денег не потрачено.`);
}

/* ── prepare ──────────────────────────────────────────────────────────── */

async function cmdPrepare() {
  const { scenes } = loadScenes();
  const { deriveName, consistencyDirective, REALISM_DIRECTIVES } = await loadProductionModules();
  mkdirSync(OUT, { recursive: true });
  const items = [];

  for (const sc of scenes) {
    const byId = Object.fromEntries(sc.cast.map((c) => [c.id, c]));
    for (const arm of ARMS) {
      const sceneClipId = randomUUID().slice(0, 8);
      for (const shot of sc.shots) {
        const cast = shot.cast.map((id) => byId[id]);
        const lines = cast.map((c) =>
          arm === "qreal"
            ? `${c.kind}: ${c.canonical}`
            // Щедрый контроль: короткое, но ОДИНАКОВОЕ во всех кадрах упоминание.
            // Реальный пользователь дрейфовал бы сильнее; занижать контроль руками
            // значит подстроить победу.
            : `${c.kind}: ${deriveName(c.canonical)}`
        );
        const continuity = arm === "qreal"
          ? consistencyDirective(cast.map((c) => ({ ...c, name: c.id, refImages: [], shotIds: shot.cast })))
          : "";
        const prompt =
          `${shot.description} Subjects — ${lines.join("; ")}. Camera: ${shot.camera}. ` +
          `Sound: ${shot.soundscape}. ${REALISM_DIRECTIVES}${continuity}`;
        items.push({
          clipId: randomUUID().slice(0, 8), sceneClipId, sceneId: sc.id, arm,
          order: shot.order, prompt, status: "prompt_ready",
        });
      }
    }
    console.log(`  ok ${sc.id}: ${sc.shots.length} кадров × ${ARMS.length} плеча`);
  }

  writeJson(path.join(OUT, "manifest.json"), { createdAt: new Date().toISOString(), engineId: ENGINE_ID, durationSec: DURATION_SEC, items });
  console.log(`\n${items.length} промтов в manifest.json. Денег не потрачено.`);
}

/* ── render / poll ────────────────────────────────────────────────────── */

const falRequestsBase = (m) => m.split("/").slice(0, 2).join("/");
const falInput = (id, prompt, sec) =>
  id === "kling"
    ? { prompt, duration: sec <= 7 ? "5" : "10", aspect_ratio: "16:9", generate_audio: true }
    : { prompt, duration: sec, aspect_ratio: "16:9", resolution: "1080p", generate_audio: true };

async function cmdRender(argv) {
  const key = process.env.FAL_KEY?.trim();
  if (!key) throw new Error("FAL_KEY не задан.");
  const mp = path.join(OUT, "manifest.json");
  if (!existsSync(mp)) throw new Error("Сначала prepare.");
  const manifest = readJson(mp);
  const engine = await loadEngine();
  const pending = manifest.items.filter((i) => i.status === "prompt_ready");
  const usd = pending.length * manifest.durationSec * engine.usdPerSecond;
  if (!argv.includes("--confirm-spend")) {
    console.log(`Готов отправить ${pending.length} клипов. СТОИМОСТЬ ~$${usd.toFixed(2)}. Ничего не отправлено.`);
    console.log("Подтвердить: render --confirm-spend");
    return;
  }
  for (const it of pending) {
    const r = await fetch(`https://queue.fal.run/${engine.falModelId}`, {
      method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(falInput(ENGINE_ID, it.prompt, manifest.durationSec)),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d?.request_id) { it.requestId = String(d.request_id); it.status = "queued"; console.log(`  → ${it.sceneId}/${it.arm} кадр ${it.order}`); }
    else { it.status = "failed"; it.error = String(d?.detail || d?.error || r.status).slice(0, 200); console.error(`  ! ${it.sceneId}/${it.arm}: ${it.error}`); }
    writeJson(mp, manifest);
  }
  console.log("\nДальше: poll");
}

async function cmdPoll() {
  const key = process.env.FAL_KEY?.trim();
  if (!key) throw new Error("FAL_KEY не задан.");
  const mp = path.join(OUT, "manifest.json");
  const manifest = readJson(mp);
  const engine = await loadEngine();
  const base = falRequestsBase(engine.falModelId);
  for (let round = 0; round < 80; round++) {
    const queued = manifest.items.filter((i) => i.status === "queued");
    if (!queued.length) break;
    for (const it of queued) {
      const s = await fetch(`https://queue.fal.run/${base}/requests/${it.requestId}/status`, { headers: { Authorization: `Key ${key}` } });
      const sd = await s.json().catch(() => ({}));
      if (String(sd?.status || "").toUpperCase() !== "COMPLETED") continue;
      const res = await fetch(`https://queue.fal.run/${base}/requests/${it.requestId}`, { headers: { Authorization: `Key ${key}` } });
      const rd = await res.json().catch(() => ({}));
      const url = rd?.video?.url || rd?.videos?.[0]?.url || rd?.output?.url || null;
      it.status = url ? "rendered" : "failed";
      it.resultUrl = url;
      console.log(`  ${it.status === "rendered" ? "✓" : "!"} ${it.sceneId}/${it.arm} кадр ${it.order}`);
      writeJson(mp, manifest);
    }
    if (manifest.items.some((i) => i.status === "queued")) await sleep(15_000);
  }
  const left = manifest.items.filter((i) => i.status === "queued").length;
  console.log(left ? `\nОсталось ${left}. Запусти poll ещё раз.` : "\nГотово. Дальше: sheet");
}

/* ── sheet ────────────────────────────────────────────────────────────── */

async function cmdSheet(argv) {
  const judge = (argv[argv.indexOf("--judge") + 1] || "").trim();
  if (!judge || judge.startsWith("--")) throw new Error("Укажи судью: --judge <имя>");
  const { scenes } = loadScenes();
  const { criteria } = await loadContinuityCriteria();
  const mp = path.join(OUT, "manifest.json");
  // Внятный отказ вместо сырого ENOENT: по документу легко запустить
  // фазу не в том порядке.
  if (!existsSync(mp)) throw new Error("Нет manifest.json — сначала prepare (и render/poll, если нужны клипы).");
  const manifest = readJson(path.join(OUT, "manifest.json"));
  const titleById = Object.fromEntries(scenes.map((s) => [s.id, s.title]));

  // Судят ПОСЛЕДОВАТЕЛЬНОСТЬ кадров, а не клип: непрерывность видна только
  // при сравнении появлений героя. Группируем по (сцена, плечо) и прячем плечо.
  const groups = [];
  for (const it of manifest.items.filter((i) => i.status === "rendered")) {
    let g = groups.find((x) => x.key === `${it.sceneId}|${it.arm}`);
    if (!g) { g = { key: `${it.sceneId}|${it.arm}`, sceneId: it.sceneId, groupId: it.sceneClipId, clips: [] }; groups.push(g); }
    g.clips.push(it);
  }
  if (!groups.length) throw new Error("Нечего судить: нет отрендеренных клипов.");
  for (const g of groups) g.clips.sort((a, b) => a.order - b.order);

  const seeded = groups
    .map((g) => ({ g, k: createHash("sha1").update(`${judge}:${g.groupId}`).digest("hex") }))
    .sort((a, b) => (a.k < b.k ? -1 : 1))
    .map((x) => x.g);

  const rows = [["group_id", "scene", "criterion_id", "criterion_label", "weight", "score_1_5", "note"]];
  const playlist = [];
  for (const g of seeded) {
    playlist.push(`${g.groupId}\t${titleById[g.sceneId]}\t${g.clips.map((c) => c.resultUrl).join("\t")}`);
    for (const c of criteria) rows.push([g.groupId, titleById[g.sceneId], c.id, c.label, c.weight, "", ""]);
  }
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");

  for (const [name, text] of [["sheet", csv], ["playlist", playlist.join("\n")]]) {
    const leak = ARMS.find((a) => new RegExp(`\\b${a}\\b`, "i").test(text));
    if (leak) throw new Error(`Слепота нарушена: в ${name} встречается «${leak}».`);
  }
  writeFileSync(path.join(OUT, `scoresheet-${judge}.csv`), "﻿" + csv, "utf8");
  writeFileSync(path.join(OUT, `playlist-${judge}.tsv`), playlist.join("\n") + "\n", "utf8");
  console.log(`Лист судьи «${judge}»: ${seeded.length} последовательностей × ${criteria.length} критериев.`);
  console.log("Смотреть клипы каждой строки ПОДРЯД — непрерывность видна только в сравнении.");
}

/* ── score ────────────────────────────────────────────────────────────── */

function parseCsv(text) {
  const rows = []; let row = [], field = "", q = false;
  for (const ch of text.replace(/^﻿/, "").replace(/\r/g, "")) {
    if (q) { if (ch === '"') q = false; else field += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v !== ""));
}

async function cmdScore() {
  const { scenes } = loadScenes();
  const { criteria, threshold } = await loadContinuityCriteria();
  const weight = Object.fromEntries(criteria.map((c) => [c.id, c.weight]));
  const manifest = readJson(path.join(OUT, "manifest.json"));
  const armByGroup = {}, sceneByGroup = {};
  for (const it of manifest.items) { armByGroup[it.sceneClipId] = it.arm; sceneByGroup[it.sceneClipId] = it.sceneId; }

  const sheets = readdirSync(OUT).filter((f) => /^scoresheet-.+\.csv$/.test(f));
  if (!sheets.length) throw new Error("Нет заполненных scoresheet-*.csv");
  const knownGroups = new Set(manifest.items.map((i) => i.sceneClipId));
  const stale = [];
  const usedSheets = [];
  const scores = {};
  for (const f of sheets) {
    const rows = parseCsv(readFileSync(path.join(OUT, f), "utf8"));
    const head = rows[0].map((h) => h.trim());
    const ix = (n) => head.indexOf(n);
    const body = rows.slice(1);
    // Лист прошлого прогона: его id принадлежат другому манифесту. В тотал он
    // не попадёт, но судья заполнял ДРУГОЙ набор сцен — молча считать такую
    // панель полной нельзя. Сцен всего три, цена ошибки высока.
    const unknown = body.filter((r) => !knownGroups.has(r[ix("group_id")])).length;
    if (body.length && unknown > body.length / 2) {
      stale.push({ file: f, unknown, total: body.length });
      console.error(`! ${f}: ${unknown} из ${body.length} строк не из этого прогона — лист пропущен целиком.`);
      continue;
    }
    usedSheets.push(f);
    for (const r of body) {
      const g = r[ix("group_id")], cid = r[ix("criterion_id")], raw = (r[ix("score_1_5")] || "").trim();
      if (!raw) continue;
      if (!knownGroups.has(g)) continue; // одиночная строка из старого прогона
      const v = Number(raw);
      if (!Number.isFinite(v) || v < 1 || v > 5) { console.error(`! ${f}: ${g}/${cid} — «${raw}» вне 1-5`); continue; }
      ((scores[g] ||= {})[cid] ||= []).push(v);
    }
  }
  if (!usedSheets.length) throw new Error("Все найденные листы — от другого прогона. Убери их из каталога и пересобери sheet.");

  const groupScore = (g) => {
    const per = scores[g] || {};
    let num = 0, den = 0;
    for (const [cid, vals] of Object.entries(per)) {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      num += ((mean - 1) / 4) * (weight[cid] || 1); den += weight[cid] || 1;
    }
    return den ? num / den : null;
  };

  const perScene = [];
  const dropped = [];
  for (const sc of scenes) {
    const g = {};
    for (const arm of ARMS) {
      const id = Object.keys(armByGroup).find((k) => armByGroup[k] === arm && sceneByGroup[k] === sc.id);
      g[arm] = id ? groupScore(id) : null;
    }
    if (g.naive == null || g.qreal == null) {
      // Сцен всего три: потеря даже одной меняет вердикт, поэтому она обязана
      // быть видна в отчёте, а не исчезнуть тихо.
      dropped.push({ title: sc.title, missing: ARMS.filter((a) => g[a] == null) });
      continue;
    }
    perScene.push({ id: sc.id, title: sc.title, naive: g.naive, qreal: g.qreal, delta: g.qreal - g.naive });
  }

  const wins = perScene.filter((x) => x.delta > 0).length;
  const meanDelta = perScene.reduce((a, x) => a + x.delta, 0) / (perScene.length || 1);
  // Порог назван ДО прогона: сцен мало (3), поэтому требуем победу во ВСЕХ и
  // заметную дельту — на трёх наблюдениях слабое преимущество неотличимо от шума.
  const proven = perScene.length >= 3 && wins === perScene.length && meanDelta >= 0.15;

  const L = [];
  L.push("# Бенчмарк консистентности QReal\n");
  L.push(`Судейских листов учтено: ${usedSheets.length}. Порог приёмки кадра-сцены: ${threshold}.`);
  if (stale.length) {
    L.push(`
> ⚠️ **Пропущено листов от другого прогона: ${stale.length}.** ` +
      stale.map((x) => `${x.file} (${x.unknown} из ${x.total} строк с чужими id)`).join("; ") + `.`);
  }
  L.push(`Плечи: naive (короткое упоминание героя) vs qreal (канон реестра + директива continuity). Кадры одинаковые.\n`);
  L.push("## Вердикт\n");
  L.push(proven
    ? `**ПОДТВЕРЖДЕНО.** Реестр персонажей даёт непрерывность: ${wins}/${perScene.length} сцен, средняя дельта +${meanDelta.toFixed(3)} по шкале 0-1.`
    : `**НЕ ПОДТВЕРЖДЕНО.** ${wins}/${perScene.length} сцен, средняя дельта ${meanDelta >= 0 ? "+" : ""}${meanDelta.toFixed(3)}. Порог (все сцены и ≥+0.15) не взят.`);
  L.push(`\nОговорка: сцен всего ${perScene.length}. Это проверка направления, а не статистика; для публичного заявления нужен больший набор.\n`);
  if (dropped.length) {
    L.push(`\n> ⚠️ **Выпало сцен: ${dropped.length} из ${scenes.length}.** ` +
      dropped.map((d) => `${d.title} (нет плеча: ${d.missing.join(", ")})`).join("; ") +
      `. Сцен всего три — потеря даже одной меняет вердикт.`);
  }
  L.push("## По сценам\n");
  L.push("| Сцена | naive | qreal | дельта |");
  L.push("|---|---|---|---|");
  for (const x of perScene) L.push(`| ${x.title} | ${x.naive.toFixed(3)} | ${x.qreal.toFixed(3)} | ${x.delta >= 0 ? "+" : ""}${x.delta.toFixed(3)} |`);

  const md = L.join("\n") + "\n";
  writeFileSync(path.join(OUT, "report.md"), md, "utf8");
  console.log(md);
}

/* ── entry ────────────────────────────────────────────────────────────── */

const cmd = process.argv[2] || "plan";
const argv = process.argv.slice(3);
const table = { plan: cmdPlan, prepare: cmdPrepare, render: cmdRender, poll: cmdPoll, sheet: cmdSheet, score: cmdScore };
if (!table[cmd]) { console.error(`Фазы: ${Object.keys(table).join(" | ")}`); process.exitCode = 2; }
else table[cmd](argv).catch((e) => { console.error(`\n${e.message}`); process.exitCode = 1; });
