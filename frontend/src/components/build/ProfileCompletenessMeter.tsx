"use client";

import type { BuildProfile } from "@/lib/build/api";

// 12 high-signal fields. We weight them equally — the goal is to nudge
// completion, not score it scientifically. A profile at 80%+ is
// "ready to apply"; at 100% it's "ready to be discovered" via /talent
// search.
const FIELDS: { key: keyof BuildProfile; label: string }[] = [
  { key: "name", label: "Имя" },
  { key: "title", label: "Headline / должность" },
  { key: "city", label: "Город" },
  { key: "summary", label: "Summary (2–4 предложения)" },
  { key: "skills", label: "Skills (минимум 3)" },
  { key: "languages", label: "Языки" },
  { key: "experienceYears", label: "Лет опыта" },
  { key: "salaryMin", label: "Зарплатный диапазон" },
  { key: "photoUrl", label: "Фото" },
  { key: "introVideoUrl", label: "🎬 Видео-резюме (×3 заметнее)" },
  { key: "openToWork", label: "Open to work" },
  { key: "shiftPreference", label: "Предпочтения по сменам" },
];

function isFilled(profile: BuildProfile, key: keyof BuildProfile): boolean {
  const v = profile[key];
  if (v == null || v === false) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return v > 0;
  if (Array.isArray(v)) {
    if (key === "skills") return v.length >= 3;
    return v.length > 0;
  }
  return true;
}

export function ProfileCompletenessMeter({ profile }: { profile: BuildProfile | null }) {
  if (!profile) return null;
  const filled = FIELDS.filter((f) => isFilled(profile, f.key));
  const missing = FIELDS.filter((f) => !isFilled(profile, f.key));
  const pct = Math.round((filled.length / FIELDS.length) * 100);
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
        </div>
        <div className="hidden text-right text-xs sm:block">
          <div className="opacity-70">{filled.length} of {FIELDS.length} fields</div>
          {pct < 100 && <div className="mt-0.5">⚠ {missing.length} осталось</div>}
        </div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-current transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {missing.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer opacity-80 hover:opacity-100">
            Что осталось заполнить
          </summary>
          <ul className="mt-2 space-y-1">
            {missing.map((f) => (
              <li key={String(f.key)} className="opacity-90">
                ◌ {f.label}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
