"use client";

// QReal Studio — витрина + рабочий кабинет.
// Стиль: светлый «газетный» эталон AEVION (serif-заголовки, тонкие линейки,
// белая бумага, teal/red акценты). Тёмной темы нет by design.
// Все строки — через useI18n (ключи qreal.* в i18n-data.ts, en/ru/kk).

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { useI18n } from "@/lib/i18n";

type Subject = { kind: string; description: string };
type QcCriterion = { id: string; label: string; weight: number; score: number | null; note: string | null };
type Shot = {
  id: string; order: number; title: string; description: string;
  subjects: Subject[]; camera: string; dialogue: string | null; soundscape: string;
  durationSec: number; prompt: string | null; engine: string | null;
  status: string; resultUrl: string | null;
  qc: {
    totalScore: number | null; method: string; criteria: QcCriterion[];
    verdict?: { verdict: string; weakest: Array<{ id: string; label: string; score: number }> };
  } | null;
};
type Project = {
  id: string; title: string; brief: string; format: string; language: string;
  targetDurationSec: number; status: string; shots: Shot[]; createdAt: string;
};
type Engine = { id: string; label: string; modality: string[]; configured: boolean; note: string; usdPerSecond?: number | null };
type Estimate = {
  shots: number; totalSec: number; cachedSec: number;
  engines: Array<{ id: string; label: string; configured: boolean; usdPerSecond: number; usdTotal: number }>;
};
type Provenance = { sha256: string; disclosure: string; aiGenerated: boolean };
type Character = { id: string; kind: string; name: string; canonical: string; refImages: string[]; shotIds: string[] };
type Continuity = {
  verdict: "consistent" | "drifting" | "insufficient";
  totalScore: number | null; threshold: number;
  weakest: Array<{ id: string; label: string; score: number }>;
};

export default function QRealClient() {
  const { t } = useI18n();
  const [project, setProject] = useState<Project | null>(null);
  const [engines, setEngines] = useState<Engine[]>([]);
  const [criteria, setCriteria] = useState<QcCriterion[]>([]);
  // Якоря 1/3/5 и порог приёмки — из того же ответа, что и критерии.
  const [anchors, setAnchors] = useState<Record<string, { "1": string; "3": string; "5": string }>>({});
  const [threshold, setThreshold] = useState<number | null>(null);
  const [provenance, setProvenance] = useState<Provenance | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [filmUrl, setFilmUrl] = useState<string | null>(null);
  const [variation, setVariation] = useState(1);
  const [qrightId, setQrightId] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [openPrompt, setOpenPrompt] = useState<string | null>(null);
  const [cast, setCast] = useState<Character[]>([]);
  const [castDraft, setCastDraft] = useState<Record<string, string>>({});
  const [refDraft, setRefDraft] = useState<Record<string, string>>({});
  const [continuity, setContinuity] = useState<Continuity | null>(null);
  const [openQc, setOpenQc] = useState<string | null>(null);
  const [qcScores, setQcScores] = useState<Record<string, string>>({});

  const loadDemo = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/qreal/demo"));
      const d = await r.json();
      if (d?.project) {
        setProject(d.project);
        const pr = await fetch(apiUrl(`/api/qreal/projects/${d.project.id}/provenance`));
        const pd = await pr.json();
        if (pd?.provenance) setProvenance(pd.provenance);
      }
    } catch { /* backend offline — витрина остаётся статичной */ }
  }, []);

  useEffect(() => {
    loadDemo();
    fetch(apiUrl("/api/qreal/engines")).then((r) => r.json()).then((d) => setEngines(d?.engines || [])).catch(() => {});
    fetch(apiUrl("/api/qreal/realism-criteria")).then((r) => r.json()).then((d) => {
      setCriteria(d?.criteria || []);
      setAnchors(d?.anchors || {});
      setThreshold(typeof d?.threshold === "number" ? d.threshold : null);
    }).catch(() => {});
  }, [loadDemo]);

  // Смета зависит от статусов кадров, поэтому пересчитывается на любое
  // изменение проекта — включая тики автопула во время рендера.
  useEffect(() => {
    if (!project) return;
    fetch(apiUrl(`/api/qreal/projects/${project.id}/estimate`))
      .then((r) => r.json()).then((d) => { if (d?.engines) setEstimate(d); })
      .catch(() => {});
  }, [project]);

  // Каст и черновики правок — только на смену ПРОЕКТА, не на каждое его
  // обновление. Автопул рендера подменяет объект project раз в 10 секунд; будь
  // эффект завязан на объект, набранный режиссёром текст описания стирался бы
  // каждые 10 секунд прямо во время работы. Вердикт непрерывности тоже
  // сбрасываем: оценка старого проекта под новым — ложное измерение.
  const projectId = project?.id;
  useEffect(() => {
    if (!projectId) return;
    setCastDraft({});
    setRefDraft({});
    setContinuity(null);
    fetch(apiUrl(`/api/qreal/projects/${projectId}/characters`))
      .then((r) => r.json()).then((d) => setCast(d?.characters || []))
      .catch(() => {});
  }, [projectId]);

  // Правка канона режиссёром. Сервер пересобирает промты кадров, поэтому
  // проект перечитываем целиком — иначе на экране остались бы старые промты.
  async function saveCharacter(cid: string) {
    if (!project || busy) return;
    const canonical = castDraft[cid];
    const newRef = (refDraft[cid] || "").trim();
    const existing = cast.find((c) => c.id === cid);
    // Сервер перезаписывает refImages целиком, поэтому шлём накопленный список,
    // а не одну ссылку — иначе каждая новая картинка стирала бы предыдущие.
    const refImages = newRef ? [...(existing?.refImages || []), newRef].slice(0, 9) : undefined;
    if ((!canonical || canonical.trim().length < 3) && !refImages) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {};
      if (canonical && canonical.trim().length >= 3) body.canonical = canonical.trim();
      if (refImages) body.refImages = refImages;
      const r = await fetch(apiUrl(`/api/qreal/projects/${project.id}/characters/${cid}`), {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d?.characters) setCast(d.characters);
      if (d?.note) setNote(d.note);
      setRefDraft({ ...refDraft, [cid]: "" });
      const pr = await fetch(apiUrl(`/api/qreal/projects/${project.id}`));
      const pd = await pr.json();
      if (pd?.project) setProject(pd.project);
    } catch { setNote(t("qreal.note.backend.down")); }
    finally { setBusy(false); }
  }

  // Ручная оценка непрерывности: судим по собранной сцене своими глазами.
  // VLM-вариант ({judge:true}) платный, поэтому из UI его не дёргаем — цена
  // вызова у fal не опубликована, и жать её кнопкой вслепую нельзя.
  async function checkContinuity() {
    if (!project || busy) return;
    setBusy(true);
    try {
      const r = await fetch(apiUrl(`/api/qreal/projects/${project.id}/continuity`), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const d = await r.json();
      if (d?.note) setNote(d.note);
      if (d?.message) setNote(d.message);
      setContinuity(d?.continuity || null);
    } catch { setNote(t("qreal.note.backend.down")); }
    finally { setBusy(false); }
  }

  // Пустое значение = критерий неприменим к кадру. Шлём его как null, а не как
  // ноль: иначе кадр без речи получил бы штраф за липсинк.
  async function submitQc(shotId: string) {
    if (!project || busy) return;
    setBusy(true);
    try {
      const scores = criteria.map((c) => ({ id: c.id, score: qcScores[c.id] ? Number(qcScores[c.id]) : null }));
      const r = await fetch(apiUrl(`/api/qreal/projects/${project.id}/shots/${shotId}/qc`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores, method: "manual" }),
      });
      const d = await r.json();
      if (d?.note) setNote(d.note);
      const pr = await fetch(apiUrl(`/api/qreal/projects/${project.id}`));
      const pd = await pr.json();
      if (pd?.project) setProject(pd.project);
    } catch { setNote(t("qreal.note.backend.down")); }
    finally { setBusy(false); }
  }

  async function renderAll() {
    if (!project || busy) return;
    setBusy(true);
    try {
      const r = await fetch(apiUrl(`/api/qreal/projects/${project.id}/render-all`), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const d = await r.json();
      if (d?.project) setProject(d.project);
      if (Array.isArray(d?.notes) && d.notes.length) setNote(d.notes[0].note);
    } catch { setNote(t("qreal.note.backend.down")); }
    finally { setBusy(false); }
  }

  // Демо-фильм одной кнопкой: кадры демо в прод-кэше ($0) → ленивый
  // re-assemble на сервере → открываем готовый mp4.
  async function watchDemoFilm() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(apiUrl("/api/qreal/projects/demo-steppe-morning/render-all"), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: '{"engine":"kling"}',
      });
      window.open(apiUrl("/api/qreal/projects/demo-steppe-morning/film"), "_blank");
    } catch { setNote(t("qreal.note.backend.down")); }
    finally { setBusy(false); }
  }

  async function registerAuthorship() {
    if (!project || busy) return;
    setBusy(true);
    try {
      const r = await fetch(apiUrl(`/api/qreal/projects/${project.id}/register`), { method: "POST" });
      const d = await r.json();
      if (d?.qrightObjectId) setQrightId(d.qrightObjectId);
      else setNote(d?.error || t("qreal.note.backend.down"));
    } catch { setNote(t("qreal.note.backend.down")); }
    finally { setBusy(false); }
  }

  async function nextVariation() {
    if (!project || busy) return;
    setBusy(true);
    try {
      const v = variation >= 3 ? 1 : variation + 1;
      const r = await fetch(apiUrl(`/api/qreal/projects/${project.id}/storyboard`), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variation: v }),
      });
      const d = await r.json();
      if (d?.project) { setProject(d.project); setVariation(v); setNote(d.storyboardMethod === "llm-cached" ? t("qreal.note.storyboard.llm") : t("qreal.note.storyboard.llm")); }
    } catch { setNote(t("qreal.note.backend.down")); }
    finally { setBusy(false); }
  }

  async function assembleFilm() {
    if (!project || busy) return;
    setBusy(true);
    try {
      const r = await fetch(apiUrl(`/api/qreal/projects/${project.id}/assemble`), { method: "POST" });
      const d = await r.json();
      if (r.ok && d?.filmUrl) setFilmUrl(apiUrl(d.filmUrl));
      else setNote(d?.message || d?.error || t("qreal.note.backend.down"));
    } catch { setNote(t("qreal.note.backend.down")); }
    finally { setBusy(false); }
  }

  // Кадры в очереди на рендер — автопул статуса раз в 10с, пока не готово.
  useEffect(() => {
    if (!project || !project.shots.some((s) => s.status === "queued")) return;
    const timer = setInterval(async () => {
      try {
        const queued = project.shots.filter((s) => s.status === "queued");
        await Promise.all(queued.map((s) =>
          fetch(apiUrl(`/api/qreal/projects/${project.id}/shots/${s.id}/render-status`)).catch(() => null)
        ));
        const pr = await fetch(apiUrl(`/api/qreal/projects/${project.id}`));
        const pd = await pr.json();
        if (pd?.project) setProject(pd.project);
      } catch { /* следующий тик */ }
    }, 10000);
    return () => clearInterval(timer);
  }, [project]);

  async function createFromBrief() {
    if (brief.trim().length < 10 || busy) return;
    setBusy(true); setNote(null);
    try {
      const r = await fetch(apiUrl("/api/qreal/projects"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || undefined, brief: brief.trim(), format: "scene" }),
      });
      const d = await r.json();
      if (!r.ok || !d?.project) throw new Error(d?.message || d?.error || "create failed");
      const sb = await fetch(apiUrl(`/api/qreal/projects/${d.project.id}/storyboard`), { method: "POST" });
      const sd = await sb.json();
      if (sd?.project) {
        setProject(sd.project);
        setNote(sd.storyboardMethod === "llm" ? t("qreal.note.storyboard.llm") : t("qreal.note.storyboard.stub"));
        const pr = await fetch(apiUrl(`/api/qreal/projects/${sd.project.id}/provenance`));
        const pd = await pr.json();
        if (pd?.provenance) setProvenance(pd.provenance);
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : t("qreal.note.backend.down"));
    } finally { setBusy(false); }
  }

  async function renderShot(shotId: string) {
    if (!project || busy) return;
    setBusy(true);
    try {
      const r = await fetch(apiUrl(`/api/qreal/projects/${project.id}/shots/${shotId}/render`), { method: "POST" });
      const d = await r.json();
      if (d?.note) setNote(d.note);
      const pr = await fetch(apiUrl(`/api/qreal/projects/${project.id}`));
      const pd = await pr.json();
      if (pd?.project) setProject(pd.project);
    } catch { setNote(t("qreal.note.backend.down")); }
    finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-[#faf8f3] text-neutral-900">
      <div className="mx-auto max-w-5xl px-5 py-10">

        {/* Шапка-манифест */}
        <header className="border-b-2 border-neutral-900 pb-6">
          <p className="text-[11px] uppercase tracking-[0.25em] text-teal-700">{t("qreal.badge")}</p>
          <h1 className="mt-2 font-serif text-5xl leading-tight">QReal Studio</h1>
          <p className="mt-3 max-w-3xl font-serif text-xl leading-relaxed text-neutral-700">{t("qreal.hero.lead")}</p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-red-700">{t("qreal.hero.ethics")}</p>
        </header>

        {/* Живое сравнение движков */}
        <section className="mt-8 border-b border-neutral-300 pb-8">
          <h2 className="font-serif text-2xl">{t("qreal.compare.h")}</h2>
          <p className="mt-1 max-w-3xl text-sm text-neutral-600">{t("qreal.compare.sub")}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <figure className="border border-neutral-300 bg-white p-3">
              <video controls preload="metadata" className="w-full" src="/qreal/shot2-kling.mp4" />
              <figcaption className="mt-2 text-xs text-neutral-600">
                <span className="font-semibold text-neutral-900">Kling 3.0 pro</span> — {t("qreal.compare.same.prompt")}
              </figcaption>
            </figure>
            <figure className="border border-neutral-300 bg-white p-3">
              <video controls preload="metadata" className="w-full" src="/qreal/shot2-seedance.mp4" />
              <figcaption className="mt-2 text-xs text-neutral-600">
                <span className="font-semibold text-neutral-900">Seedance 2.0</span> — {t("qreal.compare.same.prompt")}
              </figcaption>
            </figure>
          </div>
          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-neutral-500">{t("qreal.compare.note")}</p>
          <button
            onClick={watchDemoFilm}
            disabled={busy}
            className="mt-3 border border-neutral-900 bg-neutral-900 px-5 py-2 text-sm text-white transition hover:bg-teal-800 disabled:opacity-40"
          >
            {busy ? t("qreal.brief.cta.busy") : t("qreal.film.watch")}
          </button>
        </section>

        {/* Бриф */}
        <section className="mt-8 border-b border-neutral-300 pb-8">
          <h2 className="font-serif text-2xl">{t("qreal.brief.h")}</h2>
          <p className="mt-1 text-sm text-neutral-600">{t("qreal.brief.sub")}</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label={t("qreal.brief.title.aria")} placeholder={t("qreal.brief.title.ph")}
            className="mt-4 w-full border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-700"
          />
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={4}
            aria-label={t("qreal.brief.brief.aria")} placeholder={t("qreal.brief.brief.ph")}
            className="mt-2 w-full border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-teal-700"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => setBrief(t(`qreal.preset.${n}`))}
                className="border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 transition hover:border-teal-700 hover:text-teal-800"
              >
                {t(`qreal.preset.${n}.label`)}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4">
            <button
              onClick={createFromBrief}
              disabled={busy || brief.trim().length < 10}
              className="border border-neutral-900 bg-neutral-900 px-5 py-2 text-sm text-white transition hover:bg-teal-800 disabled:opacity-40"
            >
              {busy ? t("qreal.brief.cta.busy") : t("qreal.brief.cta")}
            </button>
            {note && <span className="text-sm text-neutral-600">{note}</span>}
          </div>
        </section>

        {/* Раскадровка */}
        {project && (
          <section className="mt-8 border-b border-neutral-300 pb-8">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-2xl">{t("qreal.storyboard.h")} — «{project.title}»</h2>
              <span className="flex items-center gap-3 text-xs uppercase tracking-widest text-neutral-500">
                {project.shots.length} {t("qreal.storyboard.shots")} · ~{project.shots.reduce((a, s) => a + s.durationSec, 0)}s
                <button onClick={nextVariation} disabled={busy} className="border border-neutral-300 bg-white px-2 py-0.5 normal-case tracking-normal text-teal-800 transition hover:border-teal-700 disabled:opacity-40">
                  {t("qreal.storyboard.variation")} {variation}/3
                </button>
              </span>
            </div>
            {estimate && estimate.engines.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-4 border border-neutral-300 bg-white px-4 py-2">
                <span className="text-sm text-neutral-700">
                  {t("qreal.estimate.prefix")}{" "}
                  {estimate.engines.map((e, i) => (
                    <span key={e.id}>
                      {i > 0 && " / "}
                      <span className="font-mono font-semibold text-teal-800">${e.usdTotal.toFixed(2)}</span>
                      {" "}<span className="text-neutral-500">({e.id})</span>
                    </span>
                  ))}
                  {estimate.cachedSec > 0 && (
                    <span className="text-neutral-500"> · {estimate.cachedSec}s {t("qreal.estimate.cached")}</span>
                  )}
                </span>
                <span className="ml-auto flex gap-2">
                  <button
                    onClick={renderAll}
                    disabled={busy}
                    className="border border-teal-800 bg-white px-4 py-1.5 text-sm text-teal-800 transition hover:bg-teal-800 hover:text-white disabled:opacity-40"
                  >
                    {t("qreal.render.all")}
                  </button>
                  {project.shots.length > 0 && project.shots.every((s) => s.status === "rendered") && !filmUrl && (
                    <button
                      onClick={assembleFilm}
                      disabled={busy}
                      className="border border-neutral-900 bg-neutral-900 px-4 py-1.5 text-sm text-white transition hover:bg-teal-800 disabled:opacity-40"
                    >
                      {t("qreal.film.assemble")}
                    </button>
                  )}
                  {filmUrl && (
                    <a
                      href={filmUrl}
                      className="border border-neutral-900 bg-neutral-900 px-4 py-1.5 text-sm text-white transition hover:bg-teal-800"
                    >
                      {t("qreal.film.download")}
                    </a>
                  )}
                </span>
              </div>
            )}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {project.shots.map((s) => (
                <article key={s.id} className="border border-neutral-300 bg-white p-4">
                  <div className="flex items-baseline justify-between border-b border-neutral-200 pb-2">
                    <h3 className="font-serif text-lg">{s.order}. {s.title}</h3>
                    <span className={`text-[11px] uppercase tracking-wider ${s.status === "queued" ? "text-teal-700" : "text-neutral-500"}`}>
                      {t(`qreal.status.${s.status}`)} · {s.durationSec}s
                    </span>
                  </div>
                  {s.resultUrl && (
                    <video controls preload="metadata" className="mt-2 w-full border border-neutral-200" src={s.resultUrl} />
                  )}
                  <p className="mt-2 text-sm leading-relaxed text-neutral-700">{s.description}</p>
                  <p className="mt-2 text-xs text-neutral-500">
                    <span className="text-neutral-700">{t("qreal.shot.camera")}:</span> {s.camera}
                    <br /><span className="text-neutral-700">{t("qreal.shot.sound")}:</span> {s.soundscape}
                    {s.dialogue && (<><br /><span className="text-neutral-700">{t("qreal.shot.line")}:</span> «{s.dialogue}»</>)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.subjects.map((x, i) => (
                      <span key={i} className="border border-teal-700/40 bg-teal-50 px-2 py-0.5 text-[11px] text-teal-800">
                        {t(`qreal.subject.${x.kind}`)}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-3 border-t border-neutral-200 pt-2 text-xs">
                    <button onClick={() => renderShot(s.id)} disabled={busy} className="text-teal-800 underline underline-offset-2 hover:text-teal-600 disabled:opacity-40">
                      {t("qreal.shot.render")}
                    </button>
                    <button onClick={() => setOpenPrompt(openPrompt === s.id ? null : s.id)} className="text-neutral-600 underline underline-offset-2 hover:text-neutral-900">
                      {openPrompt === s.id ? t("qreal.shot.prompt.hide") : t("qreal.shot.prompt.show")}
                    </button>
                    {/* Судить можно только то, что отрендерено. Панель даёт человеку
                        те же якоря, по которым судит VLM, — иначе две оценки
                        несопоставимы. */}
                    {s.resultUrl && (
                      <button onClick={() => { setOpenQc(openQc === s.id ? null : s.id); setQcScores({}); }} className="text-neutral-600 underline underline-offset-2 hover:text-neutral-900">
                        {openQc === s.id ? t("qreal.qc.judge.hide") : t("qreal.qc.judge")}
                      </button>
                    )}
                  </div>
                  {openQc === s.id && (
                    <div className="mt-2 border-t border-neutral-200 pt-2">
                      <table className="w-full text-[11px]">
                        <tbody>
                          {criteria.map((c) => (
                            <tr key={c.id} className="border-b border-dotted border-neutral-200">
                              <td className="py-1 pr-2 align-top text-neutral-700" title={anchors[c.id] ? `1 — ${anchors[c.id]["1"]}\n3 — ${anchors[c.id]["3"]}\n5 — ${anchors[c.id]["5"]}` : undefined}>
                                {c.label}
                              </td>
                              <td className="w-28 py-1 text-right">
                                <select
                                  value={qcScores[c.id] ?? ""}
                                  onChange={(ev) => setQcScores({ ...qcScores, [c.id]: ev.target.value })}
                                  className="border border-neutral-300 bg-white px-1 py-0.5"
                                >
                                  <option value="">{t("qreal.qc.na")}</option>
                                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button onClick={() => submitQc(s.id)} disabled={busy} className="mt-2 border border-teal-800 bg-white px-3 py-1 text-xs text-teal-800 hover:bg-teal-800 hover:text-white disabled:opacity-40">
                        {t("qreal.qc.submit")}
                      </button>
                      {s.qc?.verdict && (
                        <p className="mt-2 text-xs">
                          <span className={s.qc.verdict.verdict === "pass" ? "text-teal-800" : "text-red-700"}>
                            {t(`qreal.qc.verdict.${s.qc.verdict.verdict}`)}
                          </span>
                          {s.qc.totalScore != null && <span className="font-mono"> · {s.qc.totalScore.toFixed(2)}</span>}
                          {s.qc.verdict.weakest.length > 0 && (
                            <span className="text-neutral-500"> · {s.qc.verdict.weakest.map((w) => w.id).join(", ")}</span>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                  {openPrompt === s.id && s.prompt && (
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap border border-neutral-200 bg-[#faf8f3] p-2 text-[11px] leading-relaxed text-neutral-600">{s.prompt}</pre>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Каст сцены: канон описания героя, который уходит во ВСЕ его кадры.
            Без этой правки режиссёром реестр остаётся догадкой LLM. */}
        {cast.length > 0 && (
          <section className="mt-8 border-b border-neutral-300 pb-8">
            <h2 className="font-serif text-2xl">{t("qreal.cast.h")}</h2>
            <p className="mt-1 max-w-3xl text-sm text-neutral-600">{t("qreal.cast.sub")}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {cast.map((c) => (
                <div key={c.id} className="border border-neutral-300 bg-white p-3">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-serif text-base">{c.name}</h3>
                    <span className="text-[11px] uppercase tracking-wider text-neutral-500">
                      {t(`qreal.subject.${c.kind}`)} · {t("qreal.cast.shots", { n: c.shotIds.length })}
                    </span>
                  </div>
                  <textarea
                    value={castDraft[c.id] ?? c.canonical}
                    onChange={(ev) => setCastDraft({ ...castDraft, [c.id]: ev.target.value })}
                    rows={3}
                    className="mt-2 w-full border border-neutral-300 bg-[#faf8f3] p-2 text-xs leading-relaxed text-neutral-700"
                  />
                  {/* Референс-кадр фиксирует лицо надёжнее любого текста:
                      движок получает картинку, а не описание. Принимаем URL —
                      хранилища для загрузки у модуля пока нет, и делать вид,
                      что оно есть, хуже, чем честное поле со ссылкой. */}
                  <input
                    type="url"
                    value={refDraft[c.id] ?? ""}
                    onChange={(ev) => setRefDraft({ ...refDraft, [c.id]: ev.target.value })}
                    aria-label={t("qreal.cast.ref.aria")} placeholder={t("qreal.cast.ref.add")}
                    className="mt-2 w-full border border-neutral-300 bg-white px-2 py-1 text-[11px] text-neutral-700"
                  />
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={() => saveCharacter(c.id)}
                      disabled={
                        busy ||
                        ((castDraft[c.id] ?? c.canonical) === c.canonical && !(refDraft[c.id] || "").trim())
                      }
                      className="border border-teal-800 bg-white px-3 py-1 text-xs text-teal-800 hover:bg-teal-800 hover:text-white disabled:opacity-40"
                    >
                      {t("qreal.cast.save")}
                    </button>
                    {c.refImages.length > 0 && (
                      <span className="text-[11px] text-teal-800">
                        {t("qreal.cast.refs", { n: c.refImages.length })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Непрерывность измерима только там, где герой появляется дважды.
                Показываем это состояние честно, а не прячем кнопку: «нечего
                сравнивать» — тоже результат, и он объясняет, почему сцена не
                демонстрирует консистентность. */}
            <div className="mt-4 border-t border-neutral-200 pt-3 text-sm">
              {cast.some((c) => c.shotIds.length >= 2) ? (
                <>
                  <button
                    onClick={checkContinuity}
                    disabled={busy}
                    className="border border-neutral-900 bg-neutral-900 px-4 py-1.5 text-sm text-white transition hover:bg-teal-800 disabled:opacity-40"
                  >
                    {t("qreal.cast.continuity.check")}
                  </button>
                  {continuity && (
                    <p className="mt-2 text-xs">
                      <span className={continuity.verdict === "consistent" ? "text-teal-800" : "text-red-700"}>
                        {t(`qreal.cast.continuity.${continuity.verdict}`)}
                      </span>
                      {continuity.totalScore != null && (
                        <span className="font-mono"> · {continuity.totalScore.toFixed(2)} / {continuity.threshold}</span>
                      )}
                      {continuity.weakest.length > 0 && (
                        <span className="text-neutral-500"> · {continuity.weakest.map((w) => w.id).join(", ")}</span>
                      )}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-neutral-500">{t("qreal.cast.continuity.na")}</p>
              )}
            </div>
          </section>
        )}

        {/* QC реализма */}
        <section className="mt-8 border-b border-neutral-300 pb-8">
          <h2 className="font-serif text-2xl">{t("qreal.qc.h")}</h2>
          <p className="mt-1 max-w-3xl text-sm text-neutral-600">{t("qreal.qc.sub")}</p>
          <ol className="mt-4 grid gap-x-8 gap-y-1 text-sm leading-relaxed md:grid-cols-2">
            {criteria.map((c, i) => {
              const a = anchors[c.id];
              return (
                <li key={c.id} className="border-b border-dotted border-neutral-300 py-1">
                  <details className="group">
                    {/* Якоря приходят с бэкенда вместе с критериями — тот же текст,
                        по которому судит VLM. Держать их только в API значит
                        оставить человека без линейки, по которой судит машина. */}
                    <summary className={`flex cursor-pointer gap-2 ${a ? "" : "list-none"}`}>
                      <span className="font-serif text-neutral-400">{String(i + 1).padStart(2, "0")}</span>
                      <span>{c.label}</span>
                      <span className="ml-auto shrink-0 font-serif text-xs text-neutral-400">×{c.weight}</span>
                    </summary>
                    {a && (
                      <dl className="mt-1 space-y-1 pl-7 text-xs text-neutral-600">
                        {(["1", "3", "5"] as const).map((lvl) => (
                          <div key={lvl} className="flex gap-2">
                            <dt className="shrink-0 font-serif text-neutral-400">{lvl}</dt>
                            <dd>{a[lvl]}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </details>
                </li>
              );
            })}
          </ol>
          {threshold != null && (
            <p className="mt-3 text-xs text-neutral-500">
              {t("qreal.qc.threshold", { v: threshold.toFixed(2) })}
            </p>
          )}
        </section>

        {/* Движки */}
        <section className="mt-8 border-b border-neutral-300 pb-8">
          <h2 className="font-serif text-2xl">{t("qreal.engines.h")}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {engines.map((e) => (
              <div key={e.id} className="border border-neutral-300 bg-white p-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{e.label}</h3>
                  <span className={`text-[11px] uppercase tracking-wider ${e.configured ? "text-teal-700" : "text-red-700"}`}>
                    {e.configured ? t("qreal.engines.on") : t("qreal.engines.off")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-600">{e.note}</p>
                {typeof e.usdPerSecond === "number" && e.usdPerSecond > 0 && (
                  <p className="mt-1 font-mono text-[11px] text-teal-800">~${e.usdPerSecond.toFixed(3)}/s</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Provenance */}
        {provenance && (
          <section className="mt-8 pb-12">
            <h2 className="font-serif text-2xl">{t("qreal.prov.h")}</h2>
            <div className="mt-4 border-l-4 border-teal-700 bg-white p-4">
              <p className="text-sm leading-relaxed text-neutral-700">{provenance.disclosure}</p>
              <p className="mt-2 break-all font-mono text-[11px] text-neutral-500">sha256: {provenance.sha256}</p>
              <div className="mt-3 flex items-center gap-3">
                {!qrightId ? (
                  <button
                    onClick={registerAuthorship}
                    disabled={busy || !project}
                    className="border border-teal-800 bg-white px-4 py-1.5 text-sm text-teal-800 transition hover:bg-teal-800 hover:text-white disabled:opacity-40"
                  >
                    {t("qreal.prov.register")}
                  </button>
                ) : (
                  <span className="text-sm text-teal-800">
                    {t("qreal.prov.registered")}{" "}
                    <a href="/qright" className="underline underline-offset-2">QRight</a>
                    <span className="ml-2 font-mono text-[11px] text-neutral-500">{qrightId.slice(0, 8)}…</span>
                  </span>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
