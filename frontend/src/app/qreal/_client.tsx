"use client";

// QReal Studio — витрина + рабочий кабинет.
// Стиль: светлый «газетный» эталон AEVION (serif-заголовки, тонкие линейки,
// белая бумага, teal/red акценты). Тёмной темы нет by design.

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

type Subject = { kind: string; description: string };
type QcCriterion = { id: string; label: string; weight: number; score: number | null; note: string | null };
type Shot = {
  id: string; order: number; title: string; description: string;
  subjects: Subject[]; camera: string; dialogue: string | null; soundscape: string;
  durationSec: number; prompt: string | null; engine: string | null;
  status: string; resultUrl: string | null;
  qc: { totalScore: number | null; method: string; criteria: QcCriterion[] } | null;
};
type Project = {
  id: string; title: string; brief: string; format: string; language: string;
  targetDurationSec: number; status: string; shots: Shot[]; createdAt: string;
};
type Engine = { id: string; label: string; modality: string[]; configured: boolean; note: string };
type Provenance = { sha256: string; disclosure: string; aiGenerated: boolean };

const SUBJECT_RU: Record<string, string> = {
  human: "человек", child: "ребёнок", animal: "животное",
  bird: "птица", nature: "природа", object: "объект",
};

const STATUS_RU: Record<string, string> = {
  draft: "черновик", prompt_ready: "промт готов", queued: "в очереди",
  rendered: "отрендерен", failed: "ошибка",
};

export default function QRealClient() {
  const [project, setProject] = useState<Project | null>(null);
  const [engines, setEngines] = useState<Engine[]>([]);
  const [criteria, setCriteria] = useState<QcCriterion[]>([]);
  const [provenance, setProvenance] = useState<Provenance | null>(null);
  const [brief, setBrief] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [openPrompt, setOpenPrompt] = useState<string | null>(null);

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
    fetch(apiUrl("/api/qreal/realism-criteria")).then((r) => r.json()).then((d) => setCriteria(d?.criteria || [])).catch(() => {});
  }, [loadDemo]);

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
        setNote(sd.storyboardMethod === "llm"
          ? "Раскадровка собрана AI-режиссёром."
          : "Раскадровка собрана детерминированным планировщиком (AI-провайдер не сконфигурирован).");
        const pr = await fetch(apiUrl(`/api/qreal/projects/${sd.project.id}/provenance`));
        const pd = await pr.json();
        if (pd?.provenance) setProvenance(pd.provenance);
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Не удалось создать проект — бэкенд недоступен.");
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
    } catch { setNote("Рендер недоступен — бэкенд не отвечает."); }
    finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-[#faf8f3] text-neutral-900">
      <div className="mx-auto max-w-5xl px-5 py-10">

        {/* Шапка-манифест */}
        <header className="border-b-2 border-neutral-900 pb-6">
          <p className="text-[11px] uppercase tracking-[0.25em] text-teal-700">AEVION · новый модуль · прототип</p>
          <h1 className="mt-2 font-serif text-5xl leading-tight">QReal Studio</h1>
          <p className="mt-3 max-w-3xl font-serif text-xl leading-relaxed text-neutral-700">
            Полностью живое видео без единой съёмки. Люди, дети, животные, птицы, ветер,
            дождь и голоса — сгенерированы и неотличимы от реальности. Без актёра,
            без референс-видео: бриф на входе — готовая сцена на выходе.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-red-700">
            Принцип модуля: реализм — продукт, обман — нет. Каждый кадр несёт
            неотключаемую AI-маркировку (C2PA-style манифест, sha256, EU AI Act art. 50).
          </p>
        </header>

        {/* Бриф */}
        <section className="mt-8 border-b border-neutral-300 pb-8">
          <h2 className="font-serif text-2xl">1 · Бриф</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Опишите сцену словами — кто в кадре, где, что происходит, какой звук.
          </p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название (необязательно)"
            className="mt-4 w-full border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-700"
          />
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={4}
            placeholder="Например: дождливый вечер в городе, девочка кормит уличного кота под козырьком киоска, звук дождя по жести, проезжающий троллейбус…"
            className="mt-2 w-full border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-teal-700"
          />
          <div className="mt-3 flex items-center gap-4">
            <button
              onClick={createFromBrief}
              disabled={busy || brief.trim().length < 10}
              className="border border-neutral-900 bg-neutral-900 px-5 py-2 text-sm text-white transition hover:bg-teal-800 disabled:opacity-40"
            >
              {busy ? "Собираю раскадровку…" : "Разложить на кадры"}
            </button>
            {note && <span className="text-sm text-neutral-600">{note}</span>}
          </div>
        </section>

        {/* Раскадровка */}
        {project && (
          <section className="mt-8 border-b border-neutral-300 pb-8">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-2xl">2 · Раскадровка — «{project.title}»</h2>
              <span className="text-xs uppercase tracking-widest text-neutral-500">
                {project.shots.length} кадров · ~{project.shots.reduce((a, s) => a + s.durationSec, 0)} c
              </span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {project.shots.map((s) => (
                <article key={s.id} className="border border-neutral-300 bg-white p-4">
                  <div className="flex items-baseline justify-between border-b border-neutral-200 pb-2">
                    <h3 className="font-serif text-lg">{s.order}. {s.title}</h3>
                    <span className={`text-[11px] uppercase tracking-wider ${s.status === "queued" ? "text-teal-700" : "text-neutral-500"}`}>
                      {STATUS_RU[s.status] || s.status} · {s.durationSec}с
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-700">{s.description}</p>
                  <p className="mt-2 text-xs text-neutral-500">
                    <span className="text-neutral-700">Камера:</span> {s.camera}
                    <br /><span className="text-neutral-700">Звук:</span> {s.soundscape}
                    {s.dialogue && (<><br /><span className="text-neutral-700">Реплика:</span> «{s.dialogue}»</>)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.subjects.map((x, i) => (
                      <span key={i} className="border border-teal-700/40 bg-teal-50 px-2 py-0.5 text-[11px] text-teal-800">
                        {SUBJECT_RU[x.kind] || x.kind}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-3 border-t border-neutral-200 pt-2 text-xs">
                    <button onClick={() => renderShot(s.id)} disabled={busy} className="text-teal-800 underline underline-offset-2 hover:text-teal-600 disabled:opacity-40">
                      Рендер кадра
                    </button>
                    <button onClick={() => setOpenPrompt(openPrompt === s.id ? null : s.id)} className="text-neutral-600 underline underline-offset-2 hover:text-neutral-900">
                      {openPrompt === s.id ? "Скрыть промт" : "Показать render-промт"}
                    </button>
                  </div>
                  {openPrompt === s.id && s.prompt && (
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap border border-neutral-200 bg-[#faf8f3] p-2 text-[11px] leading-relaxed text-neutral-600">{s.prompt}</pre>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* QC реализма */}
        <section className="mt-8 border-b border-neutral-300 pb-8">
          <h2 className="font-serif text-2xl">3 · QC-петля реализма</h2>
          <p className="mt-1 max-w-3xl text-sm text-neutral-600">
            Каждый рендер проходит судью по {criteria.length || 14} критериям. Кадр, заваливший
            порог, перегенерируется автоматически — это и есть разрыв с «плавающими» генераторами.
          </p>
          <ol className="mt-4 grid gap-x-8 gap-y-1 text-sm leading-relaxed md:grid-cols-2">
            {criteria.map((c, i) => (
              <li key={c.id} className="flex gap-2 border-b border-dotted border-neutral-300 py-1">
                <span className="font-serif text-neutral-400">{String(i + 1).padStart(2, "0")}</span>
                <span>{c.label}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Движки */}
        <section className="mt-8 border-b border-neutral-300 pb-8">
          <h2 className="font-serif text-2xl">4 · Движки рендера</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {engines.map((e) => (
              <div key={e.id} className="border border-neutral-300 bg-white p-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{e.label}</h3>
                  <span className={`text-[11px] uppercase tracking-wider ${e.configured ? "text-teal-700" : "text-red-700"}`}>
                    {e.configured ? "подключён" : "не подключён"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-600">{e.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Provenance */}
        {provenance && (
          <section className="mt-8 pb-12">
            <h2 className="font-serif text-2xl">5 · Провенанс</h2>
            <div className="mt-4 border-l-4 border-teal-700 bg-white p-4">
              <p className="text-sm leading-relaxed text-neutral-700">{provenance.disclosure}</p>
              <p className="mt-2 break-all font-mono text-[11px] text-neutral-500">sha256: {provenance.sha256}</p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
