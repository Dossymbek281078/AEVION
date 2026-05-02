"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { ProfileForm } from "@/components/build/ProfileForm";
import {
  buildApi,
  type BuildProfile,
  type BuildApplication,
  type BuildExperience,
  type BuildEducation,
} from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";
import { VoiceInput } from "@/components/build/VoiceInput";
import { ResumeImporter } from "@/components/build/ResumeImporter";
import { AiCoachChat } from "@/components/build/AiCoachChat";
import { TrialTaskBlock } from "@/components/build/TrialTaskBlock";
import { AiImprove } from "@/components/build/AiImprove";
import { ProfileCompletenessMeter } from "@/components/build/ProfileCompletenessMeter";
import { PushSubscribeButton } from "@/components/build/PushSubscribeButton";

export default function ProfilePage() {
  return (
    <BuildShell>
      <RequireAuth>
        <ProfileBody />
      </RequireAuth>
    </BuildShell>
  );
}

const APP_STATUS_TONE = {
  PENDING: "bg-slate-500/15 text-slate-200 border-slate-500/30",
  ACCEPTED: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  REJECTED: "bg-rose-500/15 text-rose-200 border-rose-500/30",
} as const;

function ProfileBody() {
  const me = useBuildAuth((s) => s.user);
  const [profile, setProfile] = useState<BuildProfile | null>(null);
  const [applications, setApplications] = useState<BuildApplication[]>([]);
  const [experiences, setExperiences] = useState<BuildExperience[]>([]);
  const [education, setEducation] = useState<BuildEducation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadResume = useCallback(async () => {
    if (!me?.id) return;
    try {
      const bundle = await buildApi.getProfile(me.id);
      setExperiences(bundle.experiences);
      setEducation(bundle.education);
    } catch {
      // Public bundle 404 simply means no profile yet — fine.
    }
  }, [me?.id]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      buildApi.me().catch(() => ({ profile: null, user: null as never })),
      buildApi.myApplications().catch(() => ({ items: [] as BuildApplication[], total: 0 })),
    ])
      .then(([m, apps]) => {
        if (cancelled) return;
        setProfile(m.profile);
        setApplications(apps.items);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadResume();
  }, [loadResume]);

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (error) return (
    <p className="rounded-md border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
      Failed to load profile: {error}
    </p>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <section className="lg:col-span-2 space-y-6">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-2xl font-bold text-white">Your profile</h1>
            {me?.id && (
              <Link
                href={`/build/u/${me.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-300 hover:underline"
              >
                Open public profile ↗
              </Link>
            )}
          </div>
          <p className="mb-5 text-sm text-slate-400">
            Tell clients and project owners who you are. Required to apply for vacancies.
          </p>

          {profile && (
            <div className="mb-4">
              <ProfileCompletenessMeter profile={profile} />
            </div>
          )}

          <div className="mb-4">
            <ResumeImporter
              onApplied={async () => {
                const m = await buildApi.me().catch(() => ({ profile: null }));
                setProfile(m.profile);
                loadResume();
              }}
            />
          </div>

          {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <ProfileForm initial={profile} onSaved={(p) => setProfile(p)} />
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-5">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-300">
              🔔 Push-уведомления
            </h3>
            <p className="mb-3 text-xs text-slate-400">
              Получай новые сообщения, отклики и события смены прямо в браузер. Работает на десктопе и Android.
            </p>
            <PushSubscribeButton />
          </div>
        </div>

        <ExperienceEditor items={experiences} onChange={loadResume} />
        <EducationEditor items={education} onChange={loadResume} />
        <PortfolioPhotosSection userId={me?.id} />
        <DocumentsSection />
      </section>

      <aside>
        <h2 className="mb-3 text-lg font-semibold text-white">My applications</h2>
        {applications.length === 0 ? (
          <p className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-5 text-center text-sm text-slate-400">
            You haven&apos;t applied for any vacancies yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {applications.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/build/vacancy/${encodeURIComponent(a.vacancyId)}`}
                    className="line-clamp-1 font-medium text-white hover:text-emerald-200"
                  >
                    {a.vacancyTitle || a.vacancyId}
                  </Link>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${APP_STATUS_TONE[a.status]}`}
                  >
                    {a.status}
                  </span>
                </div>
                {a.projectTitle && (
                  <Link
                    href={`/build/project/${encodeURIComponent(a.projectId || "")}`}
                    className="mt-0.5 line-clamp-1 text-xs text-slate-400 hover:underline"
                  >
                    {a.projectTitle}
                  </Link>
                )}
                <div className="mt-2 text-xs text-slate-500">
                  {new Date(a.createdAt).toLocaleDateString()}
                </div>
                <TrialTaskBlock
                  applicationId={a.id}
                  isRecruiter={false}
                  isCandidate
                />
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="lg:col-span-3">
        <h2 className="mb-3 mt-2 text-lg font-semibold text-white">Ask the AI coach</h2>
        <AiCoachChat height={420} />
      </section>
    </div>
  );
}

function ExperienceEditor({
  items,
  onChange,
}: {
  items: BuildExperience[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [current, setCurrent] = useState(false);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await buildApi.addExperience({
        title: title.trim(),
        company: company.trim(),
        city: city.trim() || null,
        fromDate: fromDate.trim() || null,
        toDate: current ? null : toDate.trim() || null,
        current,
        description: description.trim() || null,
      });
      setTitle("");
      setCompany("");
      setCity("");
      setFromDate("");
      setToDate("");
      setCurrent(false);
      setDescription("");
      setOpen(false);
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this experience?")) return;
    await buildApi.deleteExperience(id);
    onChange();
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          Experience <span className="text-slate-500">({items.length})</span>
        </h2>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30"
          >
            + Add experience
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={add} className="mb-4 space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Position (Welder, Foreman…)"
              required
              className="input-resume"
            />
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company"
              required
              className="input-resume"
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="input-resume"
            />
            <input
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              placeholder="From (e.g. 2021-03)"
              className="input-resume"
            />
            <input
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              disabled={current}
              placeholder="To (e.g. 2024-09)"
              className="input-resume"
            />
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={current}
                onChange={(e) => setCurrent(e.target.checked)}
                className="h-4 w-4 accent-emerald-500"
              />
              I work here now
            </label>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What did you do? (optional)"
            className="input-resume"
          />
          <VoiceInput
            onAppend={(chunk) =>
              setDescription((prev) => (prev ? prev.trim() + " " + chunk : chunk))
            }
          />
          <AiImprove
            value={description}
            onAccept={(v) => setDescription(v)}
            kind="experience"
            hint="Сделать описание роли конкретнее (объёмы, сроки, бюджет)"
          />
          {err && <p className="text-xs text-rose-300">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50">
              {busy ? "…" : "Add"}
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-5 text-center text-sm text-slate-400">
          No experience added yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((e) => (
            <ExperienceRow key={e.id} item={e} onChanged={onChange} onDelete={() => remove(e.id)} />
          ))}
        </ul>
      )}

      <style>{`
        .input-resume {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          padding: 0.5rem 0.625rem;
          font-size: 0.8125rem;
          color: white;
        }
        .input-resume:focus { outline: none; border-color: rgba(16,185,129,0.5); }
        .input-resume::placeholder { color: rgb(100,116,139); }
        .input-resume:disabled { opacity: 0.5; }
      `}</style>
    </div>
  );
}

function ExperienceRow({
  item,
  onChanged,
  onDelete,
}: {
  item: BuildExperience;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(item.description ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await buildApi.updateExperience(item.id, { description: desc.trim() || null });
      setEditing(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="font-semibold text-white">{item.title}</div>
          <div className="text-sm text-slate-300">
            {item.company}
            {item.city ? ` · ${item.city}` : ""}
          </div>
          <div className="text-xs text-slate-500">
            {[item.fromDate, item.current ? "present" : item.toDate].filter(Boolean).join(" — ")}
          </div>
          {!editing && item.description && (
            <p className="mt-1 text-sm text-slate-400">{item.description}</p>
          )}
          {editing && (
            <div className="mt-2 space-y-2">
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                placeholder="Describe what you did, scope, results…"
                className="w-full rounded-md border border-white/10 bg-white/5 p-2 text-sm text-white placeholder:text-slate-500"
              />
              <AiImprove
                value={desc}
                onAccept={(v) => setDesc(v)}
                kind="experience"
                hint="Сделать описание роли конкретнее"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={busy}
                  className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  {busy ? "…" : "Сохранить"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDesc(item.description ?? "");
                    setEditing(false);
                  }}
                  className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-1 text-[10px] font-semibold text-fuchsia-200 hover:bg-fuchsia-500/20"
              title="Edit description (with AI improve)"
            >
              ✨ Edit
            </button>
          )}
          <button
            onClick={onDelete}
            className="text-xs text-rose-300/80 hover:text-rose-200"
            aria-label="Delete experience"
          >
            ✕
          </button>
        </div>
      </div>
    </li>
  );
}

function EducationEditor({
  items,
  onChange,
}: {
  items: BuildEducation[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [institution, setInstitution] = useState("");
  const [degree, setDegree] = useState("");
  const [field, setField] = useState("");
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await buildApi.addEducation({
        institution: institution.trim(),
        degree: degree.trim() || null,
        field: field.trim() || null,
        fromYear: fromYear ? Number(fromYear) : null,
        toYear: toYear ? Number(toYear) : null,
      });
      setInstitution("");
      setDegree("");
      setField("");
      setFromYear("");
      setToYear("");
      setOpen(false);
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this education entry?")) return;
    await buildApi.deleteEducation(id);
    onChange();
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          Education <span className="text-slate-500">({items.length})</span>
        </h2>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30"
          >
            + Add education
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={add} className="mb-4 space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
          <input
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="Institution (KazNTU, MGTU…)"
            required
            className="input-edu"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={degree}
              onChange={(e) => setDegree(e.target.value)}
              placeholder="Degree (Bachelor, Diploma)"
              className="input-edu"
            />
            <input
              value={field}
              onChange={(e) => setField(e.target.value)}
              placeholder="Field (Civil engineering)"
              className="input-edu"
            />
            <input
              type="number"
              min={1900}
              max={2100}
              value={fromYear}
              onChange={(e) => setFromYear(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="From year"
              className="input-edu"
            />
            <input
              type="number"
              min={1900}
              max={2100}
              value={toYear}
              onChange={(e) => setToYear(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="To year"
              className="input-edu"
            />
          </div>
          {err && <p className="text-xs text-rose-300">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50">
              {busy ? "…" : "Add"}
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-5 text-center text-sm text-slate-400">
          No education added yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((e) => (
            <li key={e.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-white">{e.institution}</div>
                  <div className="text-sm text-slate-300">
                    {[e.degree, e.field].filter(Boolean).join(", ")}
                  </div>
                  <div className="text-xs text-slate-500">
                    {[e.fromYear, e.toYear].filter(Boolean).join(" — ")}
                  </div>
                </div>
                <button
                  onClick={() => remove(e.id)}
                  className="text-xs text-rose-300/80 hover:text-rose-200"
                  aria-label="Delete education"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <style>{`
        .input-edu {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          padding: 0.5rem 0.625rem;
          font-size: 0.8125rem;
          color: white;
        }
        .input-edu:focus { outline: none; border-color: rgba(16,185,129,0.5); }
        .input-edu::placeholder { color: rgb(100,116,139); }
      `}</style>
    </div>
  );
}

// ── Portfolio Photos Section ──────────────────────────────────────────

type Photo = { id: string; url: string; caption: string | null; projectType: string | null; sortOrder: number };

function PortfolioPhotosSection({ userId }: { userId?: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [projectType, setProjectType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!userId) return;
    buildApi.portfolioPhotos(userId).then((r) => setPhotos(r.items)).catch(() => {});
  }

  useEffect(() => { load(); }, [userId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await buildApi.addPortfolioPhoto({ url: url.trim(), caption: caption.trim() || undefined, projectType: projectType.trim() || undefined });
      setUrl(""); setCaption(""); setProjectType("");
      load();
    } catch { setError("Ошибка добавления фото"); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    await buildApi.deletePortfolioPhoto(id);
    load();
  }

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
      <h3 className="mb-3 text-sm font-semibold text-white">📸 Фото-портфолио объектов</h3>
      <form onSubmit={(e) => void add(e)} className="space-y-2 text-sm mb-4">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL фото (Imgur, Google Drive, etc.) *" required className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500" />
        <div className="flex gap-2">
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Описание (необязательно)" className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500" />
          <input value={projectType} onChange={(e) => setProjectType(e.target.value)} placeholder="Тип объекта" className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500" />
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50">
          {busy ? "…" : "+ Добавить фото"}
        </button>
      </form>
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((p) => (
            <div key={p.id} className="group relative overflow-hidden rounded-xl aspect-video bg-slate-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption ?? ""} className="h-full w-full object-cover" />
              <button
                onClick={() => void remove(p.id)}
                className="absolute right-1 top-1 hidden rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-rose-300 group-hover:block hover:bg-black/80"
              >×</button>
              {(p.caption || p.projectType) && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 px-2 py-1.5">
                  {p.projectType && <p className="text-[10px] text-slate-400">{p.projectType}</p>}
                  {p.caption && <p className="text-[10px] text-white">{p.caption}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Documents Section ─────────────────────────────────────────────────

const DOC_TYPES_RU: Record<string, string> = {
  WELDER: "Удостоверение сварщика",
  ELECTRICIAN: "Удостоверение электрика",
  DRIVER_LICENSE: "Водительское удостоверение",
  MEDICAL: "Медицинская комиссия",
  SAFETY: "Удостоверение по ОТ",
  PLUMBER: "Удостоверение сантехника",
  ENGINEER: "Диплом инженера",
  OTHER: "Другой документ",
};

type MyDoc = { id: string; docType: string; status: string; verifiedAt: string | null; rejectReason: string | null; fileUrl: string };

const DOC_STATUS_STYLE: Record<string, string> = {
  PENDING: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  VERIFIED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  REJECTED: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

function DocumentsSection() {
  const [docs, setDocs] = useState<MyDoc[]>([]);
  const [docType, setDocType] = useState("MEDICAL");
  const [fileUrl, setFileUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() { buildApi.myDocuments().then((r) => setDocs(r.items)).catch(() => {}); }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fileUrl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await buildApi.uploadDocument({ fileUrl: fileUrl.trim(), docType });
      setFileUrl("");
      load();
    } catch { setError("Ошибка загрузки. Проверьте URL."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
      <h3 className="mb-1 text-sm font-semibold text-white">🏅 Верификация документов</h3>
      <p className="mb-3 text-xs text-slate-400">Загрузите скан/фото — администратор проверит и поставит галочку на вашем профиле</p>
      <form onSubmit={(e) => void submit(e)} className="space-y-2 text-sm mb-4">
        <select value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white">
          {Object.entries(DOC_TYPES_RU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="URL файла (Google Drive, Dropbox, Imgur…) *" required className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500" />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-lg bg-teal-500/20 px-4 py-2 text-sm font-medium text-teal-200 hover:bg-teal-500/30 disabled:opacity-50">
          {busy ? "…" : "Отправить на проверку"}
        </button>
      </form>
      {docs.length > 0 && (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${DOC_STATUS_STYLE[doc.status] ?? DOC_STATUS_STYLE.PENDING}`}>
              <span>{DOC_TYPES_RU[doc.docType] ?? doc.docType}</span>
              <span className="font-bold">{doc.status === "VERIFIED" ? "✓ Подтверждён" : doc.status === "REJECTED" ? "✗ Отклонён" : "⏳ На проверке"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
