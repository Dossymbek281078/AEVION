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
          {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <ProfileForm initial={profile} onSaved={(p) => setProfile(p)} />
          </div>
        </div>

        <ExperienceEditor items={experiences} onChange={loadResume} />
        <EducationEditor items={education} onChange={loadResume} />
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
              </li>
            ))}
          </ul>
        )}
      </aside>
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
            <li key={e.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-white">{e.title}</div>
                  <div className="text-sm text-slate-300">
                    {e.company}
                    {e.city ? ` · ${e.city}` : ""}
                  </div>
                  <div className="text-xs text-slate-500">
                    {[e.fromDate, e.current ? "present" : e.toDate].filter(Boolean).join(" — ")}
                  </div>
                  {e.description && (
                    <p className="mt-1 text-sm text-slate-400">{e.description}</p>
                  )}
                </div>
                <button
                  onClick={() => remove(e.id)}
                  className="text-xs text-rose-300/80 hover:text-rose-200"
                  aria-label="Delete experience"
                >
                  ✕
                </button>
              </div>
            </li>
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
