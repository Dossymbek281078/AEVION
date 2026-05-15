"use client";

import type { BuildProfile } from "@/lib/build/api";

// v2: profile + experiences + education combined. 14 fields, equal weight.
// "Priority" fields are the ones that materially change discoverability
// in /talent search (skills, photo, summary). They get highlighted first
// in the missing list.

type Field = {
  key: string;
  label: string;
  priority?: boolean;
  // Optional anchor for the page to scroll to when the user clicks "Add".
  anchor?: string;
  filled: (p: BuildProfile, ctx: { hasExperiences: boolean; hasEducation: boolean }) => boolean;
};

const FIELDS: Field[] = [
  { key: "name", label: "Имя", filled: (p) => !!p.name?.trim() },
  { key: "title", label: "Headline / должность", priority: true, filled: (p) => !!p.title?.trim() },
  { key: "city", label: "Город", priority: true, filled: (p) => !!p.city?.trim() },
  { key: "summary", label: "Summary (2–4 предложения)", priority: true, filled: (p) => (p.summary?.trim().length ?? 0) >= 40 },
  { key: "skills", label: "Skills (≥3)", priority: true, filled: (p) => Array.isArray(p.skills) && p.skills.length >= 3 },
  { key: "languages", label: "Языки", filled: (p) => Array.isArray(p.languages) && p.languages.length > 0 },
  { key: "experienceYears", label: "Лет опыта", filled: (p) => (p.experienceYears ?? 0) > 0 },
  { key: "salaryMin", label: "Зарплатный диапазон", filled: (p) => (p.salaryMin ?? 0) > 0 },
  { key: "photoUrl", label: "Фото", priority: true, filled: (p) => !!p.photoUrl?.trim() },
  { key: "introVideoUrl", label: "🎬 Видео-резюме (×3 заметнее)", filled: (p) => !!p.introVideoUrl?.trim() },
  { key: "openToWork", label: "Open to work", filled: (p) => !!p.openToWork },
  { key: "shiftPreference", label: "Предпочтения по сменам", filled: (p) => !!p.shiftPreference?.trim() },
  { key: "experiences", label: "Опыт работы (минимум одна запись)", priority: true, filled: (_p, ctx) => ctx.hasExperiences },
  { key: "education", label: "Образование", filled: (_p, ctx) => ctx.hasEducation },
];

export function ProfileCompletenessMeter({
  profile,
  hasExperiences = false,
  hasEducation = false,
}: {
  profile: BuildProfile | null;
  hasExperiences?: boolean;
  hasEducation?: boolean;
}) {
  if (!profile) return null;
  const ctx = { hasExperiences, hasEducation };
  const filledFields = FIELDS.filter((f) => f.filled(profile, ctx));
  const missing = FIELDS.filter((f) => !f.filled(profile, ctx));
  const pct = Math.round((filledFields.length / FIELDS.length) * 100);
  // Sort missing — priority items first.
  const missingSorted = [...missing].sort((a, b) =>
    (b.priority ? 1 : 0) - (a.priority ? 1 : 0),
  );

  const tone =
    pct >= 90
      ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-200"
      : pct >= 60
        ? "border-amber-500/40 bg-amber-500/5 text-amber-200"
        : "border-rose-500/40 bg-rose-500/5 text-rose-200";

  return (
    <section className={`rounded-2xl border p-5 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider opacity-70">Profile completeness</div>
          <div className="mt-1 text-3xl font-bold">{pct}%</div>
          <div className="mt-0.5 text-xs opacity-70">
            {filledFields.length} of {FIELDS.length} fields filled
          </div>
        </div>
        <div className="text-right">
          {pct >= 90 ? (
            <div className="text-xs font-semibold">✓ Discoverable</div>
          ) : pct >= 60 ? (
            <div className="text-xs font-semibold">Almost there</div>
          ) : (
            <div className="text-xs font-semibold">Boost your visibility</div>
          )}
        </div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-current transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {missingSorted.length > 0 && (
        <ul className="mt-4 grid gap-1.5 text-xs sm:grid-cols-2">
          {missingSorted.slice(0, 8).map((f) => (
            <li key={f.key} className="flex items-start gap-1.5 opacity-90">
              <span aria-hidden>◌</span>
              <span>
                {f.label}
                {f.priority && <span className="ml-1 rounded bg-current/20 px-1 text-[9px] uppercase opacity-80">priority</span>}
              </span>
            </li>
          ))}
          {missingSorted.length > 8 && (
            <li className="opacity-60">+{missingSorted.length - 8} more…</li>
          )}
        </ul>
      )}
    </section>
  );
}
