#!/usr/bin/env node
/**
 * Разборы задач CyberChess (ru/en/kk) — разовый прогон через Message Batches API (волна 142, 18.10.2026).
 *
 * ГЛАВНОЕ: факт о позиции — из позиции. Линия решения берётся из данных задачи (fen + sol в UCI), chess.js даёт
 * SAN, верную нумерацию, клетки и фигуры; модель только формулирует. Сторож отбрасывает любой текст, где есть
 * клетка/ход/фигура не из линии, неверная нумерация или русские названия фигур в казахском. Печатает знаменатель.
 *
 * Ключ API читается ТОЛЬКО из файла (по умолчанию C:/Users/user/.aevion-api-key.txt или --key-file), не из env,
 * не печатается, в репо не лежит. После 31.10 прогон не нужен: тексты в БД (scripts/razbory-zadach/import.cjs).
 *
 * Запуск (из каталога aevion-globus-backend, нужен node_modules/chess.js):
 *   node scripts/razbory-zadach/generate.cjs --limit 50000 --out <папка> [--prioritet <файл id по строке>]
 *     [--min-rating 800] [--max-rating 1600] [--max-mate 3] [--batch-size 5000] [--budget-usd 95] [--dry]
 * Возобновляемый: уже готовые id (<out>/gotovo.jsonl) и уже созданные пакеты (<out>/pakety.json) не повторяются.
 */
const fs = require("fs");
const path = require("path");
const { Chess } = require("chess.js");

const arg = (name, dflt) => { const i = process.argv.indexOf("--" + name); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : dflt; };
const flag = (name) => process.argv.includes("--" + name);
const LIMIT = Number(arg("limit", 50000)), OUT = arg("out", path.join(__dirname, "out"));
const MIN_R = Number(arg("min-rating", 800)), MAX_R = Number(arg("max-rating", 1600)), MAX_MATE = Number(arg("max-mate", 3));
const BATCH = Math.min(50000, Number(arg("batch-size", 5000))), BUDGET = Number(arg("budget-usd", 95));
const API = arg("api", "https://api.aevion.app");
const KEY = fs.readFileSync(arg("key-file", "C:/Users/user/.aevion-api-key.txt"), "utf8").trim();
const MODEL = "claude-sonnet-5-5";
// Цены batch (50 % от $2/$10; кэш: запись $2,5 → $1,25, чтение $0,2 → $0,10) за 1 млн токенов
const ЦЕНА = { in: 1 / 1e6, out: 5 / 1e6, cacheWrite: 1.25 / 1e6, cacheRead: 0.1 / 1e6 };
fs.mkdirSync(OUT, { recursive: true });
const F_GOTOVO = path.join(OUT, "gotovo.jsonl"), F_BRAK = path.join(OUT, "brak.jsonl"), F_PAKETY = path.join(OUT, "pakety.json"), F_VYBOR = path.join(OUT, "vybor.json"), F_ITOG = path.join(OUT, "itog.json");

const ФИГУРЫ = { p: { ru: "пешка", en: "pawn", kk: "пешка" }, n: { ru: "конь", en: "knight", kk: "ат" }, b: { ru: "слон", en: "bishop", kk: "піл" }, r: { ru: "ладья", en: "rook", kk: "тура" }, q: { ru: "ферзь", en: "queen", kk: "уәзір" }, k: { ru: "король", en: "king", kk: "патша" } };
const КОРНИ = { ru: { p: /пешк/i, n: /кон[ьяею]/i, b: /слон/i, r: /лад[ьиь]/i, q: /ферз/i, k: /корол/i }, en: { p: /pawn/i, n: /knight/i, b: /bishop/i, r: /rook/i, q: /queen/i, k: /king/i }, kk: { p: /пешк/i, n: /\bат/i, b: /піл/i, r: /тура/i, q: /уәзір/i, k: /патша/i } };

function fakty(p) {
  const g = new Chess(p.fen);
  const uci = (m) => ({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
  if (!g.move(uci(p.sol[0]))) throw new Error("первый ход нелегален");
  const решает = g.turn() === "w" ? "white" : "black";
  const линия = [], клетки = new Set(), фигуры = new Set();
  for (let i = 1; i < p.sol.length; i++) {
    const num = Number(g.fen().split(" ")[5]), dots = g.turn() === "w" ? "." : "...";
    const m = g.move(uci(p.sol[i])); if (!m) throw new Error(`ход ${i} нелегален: ${p.sol[i]}`);
    линия.push({ san: m.san, num, dots, from: m.from, to: m.to, piece: m.piece, captured: m.captured || null, кто: m.color === (решает === "white" ? "w" : "b") ? "solver" : "opponent", шах: /\+/.test(m.san), мат: /#/.test(m.san) });
    клетки.add(m.from); клетки.add(m.to); фигуры.add(m.piece); if (m.captured) фигуры.add(m.captured);
  }
  if (линия.length === 0) throw new Error("линия пуста");
  if (линия.some((m) => m.шах || m.мат)) фигуры.add("k"); // король при шахе/мате — факт позиции
  return { решает, линия, клетки: [...клетки], фигуры: [...фигуры] };
}

const SYSTEM = `You write very short chess puzzle explanations (1–2 sentences per language) for a learning app.
Hard rules:
- Use ONLY the moves, squares and piece names given in the "Allowed" section. Never mention any other square, move or piece.
- Do not invent threats, variations, or alternatives. Describe why the given line works using only the given moves.
- Mention the key idea (e.g. decoy, back rank, fork) only if it is given in "Theme".
- Output strict JSON: {"ru": "...", "en": "...", "kk": "..."} — Russian, English, Kazakh. No markdown.
- Write moves in the notation given (SAN). Keep each text under 220 characters.`;

function userPrompt(p, f) {
  const sanLine = f.линия.map((m) => `${m.num}${m.dots}${m.san} (${m.кто}; ${ФИГУРЫ[m.piece].en} ${m.from}→${m.to}${m.captured ? ", captures " + ФИГУРЫ[m.captured].en : ""})`).join("\n");
  return `Puzzle. Solver plays ${f.решает}. Goal: ${p.goal}${p.mateIn ? ` (mate in ${p.mateIn})` : ""}. Theme: ${p.theme}.
Solution line (the only moves you may mention):
${sanLine}
Allowed squares: ${f.клетки.join(", ")}
Allowed piece names: ${f.фигуры.map((x) => ФИГУРЫ[x].en).join(", ")}
If you number moves, copy the numbering exactly as given (e.g. "${f.линия[0].num}${f.линия[0].dots}${f.линия[0].san}"); you may also omit numbers.
Kazakh chess terms: уәзір (queen), тура (rook), піл (bishop), ат (knight), пешка, патша (king), шах, мат.
Write the JSON now.`;
}

function storozh(text, lang, f) {
  const нарушения = [];
  const клетки = new Set(f.клетки);
  for (const m of text.matchAll(/\b([a-h][1-8])\b/g)) if (!клетки.has(m[1])) нарушения.push(`клетка ${m[1]}`);
  const san = new Set(f.линия.map((m) => m.san.replace(/[+#]/g, "")));
  for (const m of text.matchAll(/\b([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|O-O(?:-O)?)\b/g)) { const t = m[1]; if (/^[a-h][1-8]$/.test(t)) continue; if (!san.has(t)) нарушения.push(`ход ${t}`); }
  for (const [piece, re] of Object.entries(КОРНИ[lang])) if (re.test(text) && !f.фигуры.includes(piece)) нарушения.push(`фигура ${ФИГУРЫ[piece][lang]}`);
  if (lang === "kk") for (const [piece, re] of Object.entries(КОРНИ.ru)) if (re.test(text) && !f.фигуры.includes(piece)) нарушения.push(`фигура(рус.) ${ФИГУРЫ[piece].ru}`);
  for (const m of text.matchAll(/(\d+)\s*(\.{1,3})\s*([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O(?:-O)?[+#]?)/g)) {
    const t = m[3].replace(/[+#]/g, ""); const ход = f.линия.find((x) => x.san.replace(/[+#]/g, "") === t);
    if (!ход) continue;
    if (Number(m[1]) !== ход.num || (m[2].length === 1 ? "." : "...") !== ход.dots) нарушения.push(`нумерация ${m[1]}${m[2]}${m[3]}`);
  }
  if (!text.trim()) нарушения.push("пусто");
  if (text.length > 260) нарушения.push("длина " + text.length);
  return нарушения;
}

const api = async (p, init = {}) => {
  const r = await fetch("https://api.anthropic.com" + p, { ...init, headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json", ...(init.headers || {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(`API ${r.status} ${p}: ${text.slice(0, 200)}`);
  return text;
};
const читатьJsonl = (f) => fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Выбор задач: сперва приоритетные id, затем страницы банка по рейтингу с фильтром mateIn. */
async function vybrat() {
  if (fs.existsSync(F_VYBOR)) { const v = JSON.parse(fs.readFileSync(F_VYBOR, "utf8")); console.log(`выбор из файла: ${v.length}`); return v; }
  const выбранные = new Map();
  const приоритет = arg("prioritet", "") ? fs.readFileSync(arg("prioritet", ""), "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
  for (const id of приоритет) {
    try { const j = await (await fetch(`${API}/api/cyberchess-puzzles/${encodeURIComponent(id)}`)).json(); if (j?.puzzle?.id && Array.isArray(j.puzzle.sol)) выбранные.set(j.puzzle.id, j.puzzle); } catch { /* нет такой — пропускаем */ }
  }
  console.log(`приоритетных: ${выбранные.size} из ${приоритет.length}`);
  for (let offset = 0; выбранные.size < LIMIT; offset += 25000) {
    const q = new URLSearchParams({ limit: "25000", offset: String(offset), minRating: String(MIN_R), maxRating: String(MAX_R) });
    const j = await (await fetch(`${API}/api/cyberchess-puzzles?${q}`)).json();
    const стр = j?.puzzles || [];
    if (стр.length === 0) break;
    for (const p of стр) { if (выбранные.size >= LIMIT) break; if (!p.id || !Array.isArray(p.sol) || p.sol.length < 2) continue; if (!(p.mateIn >= 1 && p.mateIn <= MAX_MATE)) continue; if (!выбранные.has(p.id)) выбранные.set(p.id, p); }
    console.log(`страница offset ${offset}: получено ${стр.length}, выбрано всего ${выбранные.size}`);
    if (стр.length < 25000) break;
  }
  const v = [...выбранные.values()].sort((a, b) => (приоритет.indexOf(a.id) >= 0 ? -1 : 0) - (приоритет.indexOf(b.id) >= 0 ? -1 : 0) || (a.r ?? 0) - (b.r ?? 0));
  fs.writeFileSync(F_VYBOR, JSON.stringify(v));
  return v;
}

(async () => {
  const выбор = await vybrat();
  const готовые = new Set(читатьJsonl(F_GOTOVO).map((x) => x.id));
  const бракИд = new Set(читатьJsonl(F_BRAK).map((x) => x.id));
  const очередь = выбор.filter((p) => !готовые.has(p.id) && !бракИд.has(p.id));
  console.log(`всего выбрано ${выбор.length}; уже готово ${готовые.size}; брак ранее ${бракИд.size}; в очереди ${очередь.length}`);
  const пакеты = fs.existsSync(F_PAKETY) ? JSON.parse(fs.readFileSync(F_PAKETY, "utf8")) : [];
  const фактыПоId = new Map();
  let стоимость = fs.existsSync(F_ITOG) ? Number(JSON.parse(fs.readFileSync(F_ITOG, "utf8")).стоимость_usd || 0) : 0;
  let позицияБрак = 0;
  // 1) создать пакеты (пропуская уже созданные)
  const вПакетах = new Set(пакеты.flatMap((b) => b.ids));
  const новые = очередь.filter((p) => !вПакетах.has(p.id));
  for (let i = 0; i < новые.length; i += BATCH) {
    const кусок = новые.slice(i, i + BATCH);
    const requests = [];
    for (const p of кусок) {
      let f; try { f = fakty(p); } catch (e) { позицияБрак++; fs.appendFileSync(F_BRAK, JSON.stringify({ id: p.id, причина: "позиция: " + e.message }) + "\n"); continue; }
      requests.push({ custom_id: p.id, params: { model: MODEL, max_tokens: 400, system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }], messages: [{ role: "user", content: userPrompt(p, f) }], output_config: { effort: "low" } } });
    }
    if (requests.length === 0) continue;
    if (flag("dry")) { console.log(`[dry] пакет из ${requests.length} запросов не отправлен`); continue; }
    const j = JSON.parse(await api("/v1/messages/batches", { method: "POST", body: JSON.stringify({ requests }) }));
    пакеты.push({ id: j.id, ids: requests.map((r) => r.custom_id), status: j.processing_status, created: new Date().toISOString() });
    fs.writeFileSync(F_PAKETY, JSON.stringify(пакеты));
    console.log(`пакет ${j.id}: ${requests.length} запросов, статус ${j.processing_status}`);
  }
  if (flag("dry")) { console.log(`[dry] брак позиций ${позицияБрак}`); return; }
  // 2) дождаться и разобрать результаты
  for (const b of пакеты) {
    if (b.done) continue;
    let st;
    for (;;) { st = JSON.parse(await api(`/v1/messages/batches/${b.id}`)); if (st.processing_status === "ended") break; console.log(`${b.id}: ${st.processing_status}, в работе ${st.request_counts?.processing}`); await sleep(60_000); }
    const lines = (await api(`/v1/messages/batches/${b.id}/results`)).split("\n").filter(Boolean);
    const поId = new Map(выбор.map((p) => [p.id, p]));
    let прошло = 0, брак = 0;
    for (const line of lines) {
      const r = JSON.parse(line); const p = поId.get(r.custom_id); if (!p) continue;
      if (r.result?.type !== "succeeded") { брак++; fs.appendFileSync(F_BRAK, JSON.stringify({ id: p.id, причина: "batch: " + r.result?.type }) + "\n"); continue; }
      const msg = r.result.message; const u = msg.usage || {};
      стоимость += (u.input_tokens || 0) * ЦЕНА.in + (u.output_tokens || 0) * ЦЕНА.out + (u.cache_creation_input_tokens || 0) * ЦЕНА.cacheWrite + (u.cache_read_input_tokens || 0) * ЦЕНА.cacheRead;
      const text = (msg.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
      let js; try { js = JSON.parse(text.replace(/^```json\s*|```$/g, "").trim()); } catch { брак++; fs.appendFileSync(F_BRAK, JSON.stringify({ id: p.id, причина: "не JSON" }) + "\n"); continue; }
      let f; try { f = фактыПоId.get(p.id) || fakty(p); } catch { брак++; continue; }
      const нар = {}; for (const lang of ["ru", "en", "kk"]) { const n = storozh(String(js[lang] || ""), lang, f); if (n.length) нар[lang] = n; }
      if (Object.keys(нар).length) { брак++; fs.appendFileSync(F_BRAK, JSON.stringify({ id: p.id, причина: "сторож", нарушения: нар }) + "\n"); continue; }
      прошло++;
      fs.appendFileSync(F_GOTOVO, JSON.stringify({ id: p.id, ru: js.ru, en: js.en, kk: js.kk, model: MODEL }) + "\n");
    }
    b.done = true; b.прошло = прошло; b.брак = брак; fs.writeFileSync(F_PAKETY, JSON.stringify(пакеты));
    console.log(`${b.id}: прошло сторож ${прошло} из ${lines.length}, брак ${брак}; потрачено всего $${стоимость.toFixed(2)}`);
    fs.writeFileSync(F_ITOG, JSON.stringify({ стоимость_usd: +стоимость.toFixed(4), обновлено: new Date().toISOString() }));
    if (стоимость > BUDGET) { console.error(`СТОП: бюджет $${BUDGET} исчерпан ($${стоимость.toFixed(2)}); остальные пакеты не разбираю`); break; }
  }
  const всегоГотово = читатьJsonl(F_GOTOVO).length, всегоБрак = читатьJsonl(F_BRAK).length;
  console.log(`ИТОГ: готово ${всегоГотово}; брак ${всегоБрак} (${(100 * всегоБрак / Math.max(1, всегоГотово + всегоБрак)).toFixed(1)} %); потрачено $${стоимость.toFixed(2)}`);
})().catch((e) => { console.error("ошибка:", e.message); process.exitCode = 2; });
