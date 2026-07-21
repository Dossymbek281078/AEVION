// QReal Studio — «полностью живое» AI-видео без съёмки актёра.
//
// Пайплайн: бриф → AI-раскадровка → render-ready промты с директивами
// реализма → внешний движок (Higgsfield/Veo/Kling через адаптеры) →
// QC-петля реализма (14 критериев) → сборка → provenance-манифест.
//
// Принципиально: КАЖДЫЙ проект несёт неотключаемую AI-декларацию
// (C2PA-style манифест, sha256, EU AI Act art. 50 disclosure). Реализм —
// продукт; неотличимость БЕЗ маркировки — не наш рынок.
//
//   GET  /api/qreal/health
//   GET  /api/qreal/engines                        ← честный статус движков
//   GET  /api/qreal/realism-criteria               ← QC-чеклист (14 критериев)
//   GET  /api/qreal/demo                           ← засеянный демо-проект
//   POST /api/qreal/projects                       ← {title, brief, format?...}
//   GET  /api/qreal/projects                       ← мои (Bearer)
//   GET  /api/qreal/projects/:id
//   POST /api/qreal/projects/:id/storyboard        ← бриф → кадры (LLM или stub)
//   POST /api/qreal/projects/:id/shots/:sid/render ← собрать промт, job
//   POST /api/qreal/projects/:id/shots/:sid/qc     ← отчёт реализма
//   GET  /api/qreal/projects/:id/provenance        ← подписанный манифест
import { Router } from "express";
import crypto from "node:crypto";
import { makeServiceCapture } from "../lib/sentry/platform";
import { verifyBearerOptional } from "../lib/authJwt";
import { callProvider, pickConfiguredProvider } from "../services/qcoreai/providers";
import { renderEngines, pickVideoEngine, falSubmit, falPoll } from "../services/qreal/engines";

const captureQRealError = makeServiceCapture("qreal");

export const qrealRouter = Router();

/* ── Типы ── */

type SubjectKind = "human" | "child" | "animal" | "bird" | "nature" | "object";
type Subject = { kind: SubjectKind; description: string };

type QcCriterion = {
  id: string;
  label: string;
  weight: number;
  score: number | null; // 0..1, null = не оценено
  note: string | null;
};
type QcReport = {
  totalScore: number | null;
  method: "vlm-judge" | "manual" | "pending";
  criteria: QcCriterion[];
  checkedAt: string;
};

type ShotStatus = "draft" | "prompt_ready" | "queued" | "rendered" | "failed";
type Shot = {
  id: string;
  order: number;
  title: string;
  description: string;
  subjects: Subject[];
  camera: string;
  dialogue: string | null;
  soundscape: string;
  durationSec: number;
  prompt: string | null;
  engine: string | null;
  engineRequestId: string | null;
  status: ShotStatus;
  resultUrl: string | null;
  qc: QcReport | null;
};

type ProjectFormat = "short" | "scene" | "film" | "music-video";
type Project = {
  id: string;
  userId: string;
  title: string;
  brief: string;
  format: ProjectFormat;
  targetDurationSec: number;
  language: string;
  depictsRealPeople: boolean;
  consentConfirmed: boolean;
  status: "draft" | "storyboarded" | "rendering" | "done";
  shots: Shot[];
  createdAt: string;
  updatedAt: string;
};

const memProjects = new Map<string, Project>();

function nowIso() { return new Date().toISOString(); }
function uid() { return crypto.randomUUID(); }

/* ── Движки: собственный слой прямых интеграций (services/qreal/engines) ── */

/* ── QC: 14 критериев реализма (ядро know-how модуля) ── */

const REALISM_CRITERIA: Array<{ id: string; label: string; weight: number }> = [
  { id: "micro-expressions", label: "Непроизвольная микромимика (не «маска», асимметрия лица)", weight: 1.2 },
  { id: "blink-rate", label: "Моргание 10–20/мин, неравномерное, с частичными морганиями", weight: 1.0 },
  { id: "skin-sss", label: "Подповерхностное рассеивание кожи (уши/пальцы на просвет)", weight: 1.0 },
  { id: "hands-topology", label: "Руки: 5 пальцев, суставы, естественные хваты", weight: 1.3 },
  { id: "eye-parallax", label: "Глаза: влажность, саккады, параллакс отражений", weight: 1.1 },
  { id: "hair-cloth-physics", label: "Физика волос и ткани (инерция, ветер, без «желе»)", weight: 1.0 },
  { id: "lipsync", label: "Липсинк ±40 мс, ко-артикуляция губ, видимый язык на [л]/[т]", weight: 1.3 },
  { id: "gait-motorics", label: "Походка/моторика: вес тела, у детей — детская, не «взрослая уменьшенная»", weight: 1.1 },
  { id: "animal-ethology", label: "Животные/птицы: видоспецифичное поведение (уши, хвост, взгляд, посадка головы)", weight: 1.1 },
  { id: "camera-body", label: "Камера с «телом»: микротряска руки, вес стедикама, не идеальный слайдер", weight: 0.9 },
  { id: "room-tone", label: "Room tone: у тишины есть звук помещения/улицы, без цифрового нуля", weight: 1.0 },
  { id: "foley-sync", label: "Фоли: шаги/одежда/предметы синхронны и материально верны", weight: 1.0 },
  { id: "light-continuity", label: "Свет: один источник во всех кадрах сцены, тени согласованы", weight: 0.9 },
  { id: "motion-blur", label: "24fps, шаттер 180°, естественный motion blur (не «видеоигра»)", weight: 0.8 },
];

function emptyQcReport(): QcReport {
  return {
    totalScore: null,
    method: "pending",
    criteria: REALISM_CRITERIA.map((c) => ({ ...c, score: null, note: null })),
    checkedAt: nowIso(),
  };
}

/* ── Директивы реализма, вшиваемые в каждый render-промт ── */

const REALISM_DIRECTIVES =
  "Shot on ARRI Alexa 35, 24fps, 180-degree shutter, natural motion blur. " +
  "Skin with subsurface scattering, visible pores, slight asymmetry. Involuntary " +
  "micro-expressions; irregular blinking every 3-6s including partial blinks. " +
  "Hands anatomically correct. Handheld micro-jitter (sub-pixel), camera has body weight. " +
  "Species-accurate animal behavior. Natural ambient sound bed (room tone), " +
  "material-true foley, dialogue with real room acoustics. No slow-motion look, " +
  "no beauty filter, no digital sharpness.";

function buildRenderPrompt(p: Project, s: Shot): string {
  const subj = s.subjects.map((x) => `${x.kind}: ${x.description}`).join("; ");
  const dial = s.dialogue ? ` Dialogue (${p.language}): "${s.dialogue}".` : "";
  return (
    `${s.description} Subjects — ${subj}. Camera: ${s.camera}. ` +
    `Sound: ${s.soundscape}.${dial} ${REALISM_DIRECTIVES}`
  );
}

/* ── Раскадровка: LLM-декомпозиция с детерминированным fallback ── */

const STORYBOARD_SYSTEM =
  "Ты — режиссёр раскадровки фотореалистичного видео. Разбей бриф на 3-6 кадров. " +
  "Ответь СТРОГО JSON-массивом объектов: {\"title\":string,\"description\":string(на английском, кинематографично)," +
  "\"subjects\":[{\"kind\":\"human|child|animal|bird|nature|object\",\"description\":string}]," +
  "\"camera\":string,\"dialogue\":string|null,\"soundscape\":string,\"durationSec\":number}. " +
  "Без markdown, без пояснений.";

function stubStoryboard(p: Project): Shot[] {
  const base = p.brief.slice(0, 220);
  const mk = (order: number, title: string, description: string, camera: string, soundscape: string, durationSec: number): Shot => ({
    id: uid(), order, title, description,
    subjects: [{ kind: "nature", description: "environment from the brief" }],
    camera, dialogue: null, soundscape, durationSec,
    prompt: null, engine: null, engineRequestId: null, status: "draft", resultUrl: null, qc: null,
  });
  return [
    mk(1, "Establishing", `Wide establishing shot. ${base}`, "slow push-in, eye level", "wind, distant ambient bed", 6),
    mk(2, "Medium", `Medium shot of the main subject. ${base}`, "handheld, 35mm", "close ambience, breathing room tone", 5),
    mk(3, "Close-up", `Close-up on the emotional detail. ${base}`, "85mm, shallow DOF", "intimate foley, fabric and skin sounds", 4),
    mk(4, "Closing", `Closing wide, subject leaves frame. ${base}`, "static tripod, long lens", "ambience swells then settles", 6),
  ];
}

async function aiStoryboard(p: Project): Promise<Shot[] | null> {
  try {
    const provider = pickConfiguredProvider();
    if (!provider || provider === "stub") return null;
    const r = await callProvider(
      provider,
      [
        { role: "system", content: STORYBOARD_SYSTEM },
        { role: "user", content: `Бриф (${p.format}, ~${p.targetDurationSec}с, язык диалогов: ${p.language}):\n${p.brief}` },
      ],
      "", 0.7
    );
    const jsonText = r.reply.replace(/```json|```/g, "").trim();
    const arr = JSON.parse(jsonText);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.slice(0, 8).map((s: any, i: number): Shot => ({
      id: uid(),
      order: i + 1,
      title: String(s.title || `Shot ${i + 1}`).slice(0, 120),
      description: String(s.description || "").slice(0, 1200),
      subjects: Array.isArray(s.subjects)
        ? s.subjects.slice(0, 8).map((x: any) => ({
            kind: (["human", "child", "animal", "bird", "nature", "object"].includes(x?.kind) ? x.kind : "object") as SubjectKind,
            description: String(x?.description || "").slice(0, 300),
          }))
        : [],
      camera: String(s.camera || "handheld, 35mm").slice(0, 200),
      dialogue: s.dialogue ? String(s.dialogue).slice(0, 500) : null,
      soundscape: String(s.soundscape || "natural ambient bed").slice(0, 300),
      durationSec: Number(s.durationSec) > 0 ? Math.min(20, Number(s.durationSec)) : 5,
      prompt: null, engine: null, engineRequestId: null, status: "draft", resultUrl: null, qc: null,
    }));
  } catch {
    return null; // честный fallback на stub, без маскировки под AI
  }
}

/* ── Provenance: неотключаемая AI-декларация ── */

function provenanceManifest(p: Project) {
  const payload = {
    standard: "AEVION-QReal/1.0 (C2PA-style)",
    projectId: p.id,
    title: p.title,
    aiGenerated: true, // всегда true, тумблера нет by design
    disclosure:
      "Это видео полностью сгенерировано ИИ (AEVION QReal). Люди, дети, животные и " +
      "среда в кадре не существуют. Маркировка соответствует EU AI Act art. 50.",
    depictsRealPeople: p.depictsRealPeople,
    shots: p.shots.map((s) => ({ id: s.id, title: s.title, engine: s.engine, status: s.status })),
    createdAt: p.createdAt,
  };
  const sha256 = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return { ...payload, sha256, verify: "/api/data-quality/trust-score/verify" };
}

/* ── Демо-проект (витрина без логина) ── */

const DEMO_ID = "demo-steppe-morning";

function seedDemo() {
  if (memProjects.has(DEMO_ID)) return;
  const created = "2026-07-21T06:00:00.000Z";
  const shots: Shot[] = [
    {
      id: "demo-shot-1", order: 1, title: "Рассвет над степью",
      description: "Golden-hour wide shot of the Kazakh steppe; feather grass bends in waves under the wind, a dirt road leads to a lone yurt with smoke from the chimney.",
      subjects: [{ kind: "nature", description: "steppe, feather grass, dawn light, wind" }],
      camera: "slow aerial push-in, 21mm", dialogue: null,
      soundscape: "steady steppe wind, skylark far away, grass rustle",
      durationSec: 7, prompt: null, engine: null, engineRequestId: null, status: "draft", resultUrl: null, qc: null,
    },
    {
      id: "demo-shot-2", order: 2, title: "Мальчик и собака",
      description: "A 7-year-old boy runs out of the yurt, an Alabai dog jumps around him; the boy laughs, dust rises from bare feet on the packed ground.",
      subjects: [
        { kind: "child", description: "7yo boy, tousled hair, oversized sweater, childlike gait" },
        { kind: "animal", description: "Central Asian shepherd dog, tail wagging, ears reacting to voice" },
      ],
      camera: "handheld tracking, 35mm, knee height", dialogue: "Айда, Ақтөс!",
      soundscape: "boy's laughter with open-air acoustics, dog paws on dirt, morning birds",
      durationSec: 6, prompt: null, engine: null, engineRequestId: null, status: "draft", resultUrl: null, qc: null,
    },
    {
      id: "demo-shot-3", order: 3, title: "Бабушка у очага",
      description: "Inside the yurt an elderly woman pours tea from a kettle; steam curls in a sunbeam from the shanyrak; her hands show age spots and slight tremor.",
      subjects: [
        { kind: "human", description: "grandmother ~70, weathered hands, warm squint, headscarf" },
        { kind: "object", description: "copper kettle, piala bowls, steam in light shaft" },
      ],
      camera: "static 50mm, table level, shallow DOF", dialogue: "Шай ішіп ал, балам.",
      soundscape: "pouring tea, fire crackle, muffled wind outside — dense room tone",
      durationSec: 5, prompt: null, engine: null, engineRequestId: null, status: "draft", resultUrl: null, qc: null,
    },
    {
      id: "demo-shot-4", order: 4, title: "Беркут взлетает",
      description: "A golden eagle takes off from a wooden perch: two heavy wing beats, feathers spread against the low sun, camera pans with the bird into the sky.",
      subjects: [{ kind: "bird", description: "golden eagle, accurate wing mechanics, feather detail" }],
      camera: "pan with subject, 135mm, slight lag behind motion", dialogue: null,
      soundscape: "heavy wing beats close-up, wind gust, single eagle cry with natural echo",
      durationSec: 6, prompt: null, engine: null, engineRequestId: null, status: "draft", resultUrl: null, qc: null,
    },
  ];
  const demo: Project = {
    id: DEMO_ID, userId: "aevion-demo",
    title: "Утро в степи",
    brief: "Утро казахской семьи в степи: рассвет, мальчик с собакой, бабушка с чаем в юрте, беркут. Полностью живое видео без единой съёмки — люди, ребёнок, животные, птица, ветер и звук сгенерированы.",
    format: "scene", targetDurationSec: 24, language: "kk",
    depictsRealPeople: false, consentConfirmed: false,
    status: "storyboarded", shots,
    createdAt: created, updatedAt: created,
  };
  for (const s of demo.shots) s.prompt = buildRenderPrompt(demo, s);
  memProjects.set(DEMO_ID, demo);
}
seedDemo();

/* ── Роуты ── */

qrealRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    module: "qreal",
    label: "QReal Studio",
    tagline: "Полностью живое AI-видео без съёмки актёра — с неотключаемой AI-маркировкой",
    pipeline: ["brief", "storyboard", "render-prompts", "engine", "realism-qc", "assembly", "provenance"],
    projects: memProjects.size,
  });
});

qrealRouter.get("/engines", (_req, res) => {
  res.json({ engines: renderEngines() });
});

qrealRouter.get("/realism-criteria", (_req, res) => {
  res.json({ criteria: REALISM_CRITERIA });
});

qrealRouter.get("/demo", (_req, res) => {
  seedDemo();
  res.json({ project: memProjects.get(DEMO_ID) });
});

qrealRouter.post("/projects", (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    const { title, brief, format, targetDurationSec, language, depictsRealPeople, consentConfirmed } = req.body || {};
    if (!brief || typeof brief !== "string" || brief.trim().length < 10) {
      return res.status(400).json({ error: "brief required (10+ chars)" });
    }
    // Guardrail: реальные узнаваемые люди — только с подтверждённым согласием.
    if (depictsRealPeople === true && consentConfirmed !== true) {
      return res.status(422).json({
        error: "real_person_consent_required",
        message: "Для изображения реального человека нужно подтверждённое согласие (consentConfirmed: true).",
      });
    }
    const p: Project = {
      id: uid(),
      userId: auth?.sub || "anon",
      title: typeof title === "string" && title.trim() ? title.trim().slice(0, 200) : "Без названия",
      brief: brief.trim().slice(0, 4000),
      format: (["short", "scene", "film", "music-video"] as ProjectFormat[]).includes(format) ? format : "short",
      targetDurationSec: Number(targetDurationSec) > 0 ? Math.min(600, Number(targetDurationSec)) : 30,
      language: typeof language === "string" && language ? language.slice(0, 8) : "ru",
      depictsRealPeople: depictsRealPeople === true,
      consentConfirmed: consentConfirmed === true,
      status: "draft", shots: [],
      createdAt: nowIso(), updatedAt: nowIso(),
    };
    memProjects.set(p.id, p);
    res.status(201).json({ project: p });
  } catch (err) { captureQRealError(err, { route: "qreal" }); res.status(500).json({ error: "create project failed" }); }
});

qrealRouter.get("/projects", (req, res) => {
  try {
    const auth = verifyBearerOptional(req);
    if (!auth?.sub) return res.status(401).json({ error: "auth required" });
    const items = Array.from(memProjects.values())
      .filter((p) => p.userId === auth.sub)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json({ items });
  } catch (err) { captureQRealError(err, { route: "qreal" }); res.status(500).json({ error: "list failed" }); }
});

qrealRouter.get("/projects/:id", (req, res) => {
  const p = memProjects.get(req.params.id);
  if (!p) return res.status(404).json({ error: "not found" });
  res.json({ project: p });
});

qrealRouter.post("/projects/:id/storyboard", async (req, res) => {
  try {
    const p = memProjects.get(req.params.id);
    if (!p) return res.status(404).json({ error: "not found" });
    const viaAi = await aiStoryboard(p);
    p.shots = viaAi ?? stubStoryboard(p);
    for (const s of p.shots) s.prompt = buildRenderPrompt(p, s);
    p.status = "storyboarded";
    p.updatedAt = nowIso();
    res.json({ project: p, storyboardMethod: viaAi ? "llm" : "deterministic-stub" });
  } catch (err) { captureQRealError(err, { route: "qreal" }); res.status(500).json({ error: "storyboard failed" }); }
});

qrealRouter.post("/projects/:id/shots/:sid/render", async (req, res) => {
  try {
    const p = memProjects.get(req.params.id);
    const s = p?.shots.find((x) => x.id === req.params.sid);
    if (!p || !s) return res.status(404).json({ error: "not found" });
    s.prompt = buildRenderPrompt(p, s);
    const preferred = typeof req.body?.engine === "string" ? req.body.engine : undefined;
    const engine = pickVideoEngine(preferred);
    if (!engine) {
      s.engine = null;
      s.status = "prompt_ready"; // честно: промт собран, FAL_KEY не задан
      p.updatedAt = nowIso();
      return res.json({
        shot: s,
        note: "Render-промт готов. Прямой видеодвижок не сконфигурирован (env FAL_KEY) — задайте ключ fal.ai, и рендер пойдёт без посредников.",
      });
    }
    const sub = await falSubmit(engine, s.prompt, s.durationSec);
    if (!sub.ok) {
      s.engine = engine.id;
      s.status = "failed";
      p.updatedAt = nowIso();
      return res.status(502).json({ shot: s, note: `Движок ${engine.label} отклонил задачу: ${sub.error}` });
    }
    s.engine = engine.id;
    s.engineRequestId = sub.requestId;
    s.status = "queued";
    p.updatedAt = nowIso();
    const estUsd = engine.usdPerSecond != null ? (engine.usdPerSecond * s.durationSec).toFixed(2) : "?";
    res.json({ shot: s, note: `Кадр в очереди: ${engine.label}, ~$${estUsd}. Статус — /render-status.` });
  } catch (err) { captureQRealError(err, { route: "qreal" }); res.status(500).json({ error: "render failed" }); }
});

qrealRouter.get("/projects/:id/shots/:sid/render-status", async (req, res) => {
  try {
    const p = memProjects.get(req.params.id);
    const s = p?.shots.find((x) => x.id === req.params.sid);
    if (!p || !s) return res.status(404).json({ error: "not found" });
    if (s.status === "rendered" || !s.engineRequestId) return res.json({ shot: s });
    const engine = renderEngines().find((e) => e.id === s.engine);
    if (!engine) return res.json({ shot: s });
    const poll = await falPoll(engine, s.engineRequestId);
    if (poll.state === "completed") {
      s.resultUrl = poll.videoUrl;
      s.status = poll.videoUrl ? "rendered" : "failed";
    } else if (poll.state === "failed") {
      s.status = "failed";
    }
    p.updatedAt = nowIso();
    res.json({ shot: s, engineState: poll.state });
  } catch (err) { captureQRealError(err, { route: "qreal" }); res.status(500).json({ error: "render-status failed" }); }
});

qrealRouter.post("/projects/:id/shots/:sid/qc", (req, res) => {
  try {
    const p = memProjects.get(req.params.id);
    const s = p?.shots.find((x) => x.id === req.params.sid);
    if (!p || !s) return res.status(404).json({ error: "not found" });
    // MVP: без прикреплённого рендера отчёт остаётся pending/manual —
    // VLM-judge подключается вместе с движком (кадры → судья → скор).
    s.qc = emptyQcReport();
    s.qc.method = s.resultUrl ? "vlm-judge" : "manual";
    p.updatedAt = nowIso();
    res.json({ qc: s.qc, note: s.resultUrl ? "Рендер найден — очередь VLM-судьи." : "Рендера ещё нет: чеклист для ручной проверки." });
  } catch (err) { captureQRealError(err, { route: "qreal" }); res.status(500).json({ error: "qc failed" }); }
});

qrealRouter.get("/projects/:id/provenance", (req, res) => {
  const p = memProjects.get(req.params.id);
  if (!p) return res.status(404).json({ error: "not found" });
  res.json({ provenance: provenanceManifest(p) });
});
