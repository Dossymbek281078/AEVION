"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi, type TalentRow, type BuildRole } from "@/lib/build/api";
import { BookmarkButton } from "@/components/build/BookmarkButton";
import { StarsDisplay } from "@/components/build/StarRating";

const ROLE_FILTERS: { value: BuildRole | "ALL"; label: string }[] = [
  { value: "ALL", label: "Any role" },
  { value: "WORKER", label: "Workers" },
  { value: "CONTRACTOR", label: "Contractors" },
  { value: "CLIENT", label: "Clients" },
];

export default function TalentPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <TalentBody />
      </RequireAuth>
    </BuildShell>
  );
}

function TalentBody() {
  const [items, setItems] = useState<TalentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{
    planKey: string;
    talentSearches: number;
    talentSearchLimit: number;
  } | null>(null);

  const [q, setQ] = useState("");
  const [skill, setSkill] = useState("");
  const [city, setCity] = useState("");
  const [role, setRole] = useState<BuildRole | "ALL">("ALL");
  const [minExp, setMinExp] = useState<string>("");
  const [openOnly, setOpenOnly] = useState(true);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [withRatingOnly, setWithRatingOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    buildApi
      .myUsage()
      .then((u) => {
        if (cancelled) return;
        setUsage({
          planKey: u.plan.key,
          talentSearches: u.usage.talentSearches,
          talentSearchLimit: u.plan.talentSearchPerMonth,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      let cancelled = false;
      setLoading(true);
      const exp = minExp ? Number(minExp) : undefined;
      buildApi
        .searchProfiles({
          q: q.trim() || undefined,
          skill: skill.trim() || undefined,
          city: city.trim() || undefined,
          role: role === "ALL" ? undefined : role,
          minExp: Number.isFinite(exp) ? (exp as number) : undefined,
          openToWork: openOnly,
          limit: 50,
        })
        .then((r) => {
          if (!cancelled) {
            setItems(r.items);
            setError(null);
            // Refresh usage counter — we just spent one search.
            buildApi.myUsage().then((u) => {
              if (!cancelled) {
                setUsage({
                  planKey: u.plan.key,
                  talentSearches: u.usage.talentSearches,
                  talentSearchLimit: u.plan.talentSearchPerMonth,
                });
              }
            }).catch(() => {});
          }
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
    }, 250);
    return () => clearTimeout(handle);
  }, [q, skill, city, role, minExp, openOnly]);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Talent search</h1>
          <p className="mt-1 text-sm text-slate-400">
            Search candidates by skill, city, experience. All resumes — на любом тарифе, без отдельной платы за доступ к базе.
          </p>
        </div>
        <Link
          href="/build/pricing"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
        >
          Free vs HH →
        </Link>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, headline, summary…"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
        />
        <input
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
          placeholder="Skills (welding, AutoCAD)"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
        />
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
        />
        <input
          type="number"
          min={0}
          max={80}
          value={minExp}
          onChange={(e) => setMinExp(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="Min years experience"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r.value}
              onClick={() => setRole(r.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                role === r.value
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOpenOnly((v) => !v)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            openOnly ? "bg-emerald-500/20 text-emerald-200" : "bg-white/5 text-slate-400 hover:bg-white/10"
          }`}
        >
          {openOnly ? "✓ Open to work only" : "Open to work only"}
        </button>
        <button
          onClick={() => setVerifiedOnly((v) => !v)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            verifiedOnly ? "bg-sky-500/20 text-sky-200" : "bg-white/5 text-slate-400 hover:bg-white/10"
          }`}
        >
          {verifiedOnly ? "✓ Verified only" : "Verified only"}
        </button>
        <button
          onClick={() => setWithRatingOnly((v) => !v)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            withRatingOnly ? "bg-amber-500/20 text-amber-200" : "bg-white/5 text-slate-400 hover:bg-white/10"
          }`}
        >
          {withRatingOnly ? "★ Reviewed only" : "★ Reviewed only"}
        </button>
      </div>

      {usage && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
          <span>
            Plan: <span className="font-semibold text-slate-200">{usage.planKey}</span> ·
            Talent search this month:{" "}
            <span className="font-semibold text-emerald-200">
              {usage.talentSearches}
            </span>{" "}
            /{" "}
            <span className="text-slate-300">
              {usage.talentSearchLimit === -1 ? "∞" : usage.talentSearchLimit}
            </span>
          </span>
          <Link href="/build/pricing" className="text-emerald-300 hover:underline">
            {usage.talentSearchLimit !== -1 && usage.talentSearches >= usage.talentSearchLimit ? "Upgrade →" : "Compare plans →"}
          </Link>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          <div className="font-medium">{error}</div>
          {error.includes("plan_talent_search_limit_reached") && (
            <Link href="/build/pricing" className="mt-1 inline-block text-rose-100 underline">
              Upgrade to Pro for unlimited search →
            </Link>
          )}
        </div>
      )}

      {loading && <p className="text-sm text-slate-400">Searching…</p>}

      {!loading && (() => {
        const filtered = items
          .filter((t) => (verifiedOnly ? !!t.verifiedAt : true))
          .filter((t) => (withRatingOnly ? (t.reviewCount ?? 0) > 0 : true));
        if (filtered.length === 0) {
          return (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <p className="text-sm text-slate-400">
                {items.length > 0
                  ? "No candidates match the active quick-filters. Toggle Verified / Reviewed off to widen."
                  : (
                    <>
                      No candidates match these filters yet. Try clearing some — or invite people to{" "}
                      <Link href="/build/profile" className="text-emerald-300 underline">
                        create a profile
                      </Link>
                      .
                    </>
                  )}
              </p>
            </div>
          );
        }
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((t) => (
              <TalentCard key={t.userId} talent={t} />
            ))}
          </div>
        );
      })()}
    </>
  );
}

function TalentCard({ talent }: { talent: TalentRow }) {
  const initials = talent.name
    .split(/\s+/)
    .map((s) => s.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Link
      href={`/build/u/${encodeURIComponent(talent.userId)}`}
      className="group block rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-white/30 hover:bg-white/10"
    >
      <div className="flex items-start gap-3">
        {talent.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={talent.photoUrl}
            alt={talent.name}
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-200">
            {initials || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate font-semibold text-white group-hover:text-emerald-200">
              {talent.name}
            </div>
            {talent.verifiedAt && (
              <span
                title={`Verified ${new Date(talent.verifiedAt).toLocaleDateString()}`}
                className="shrink-0 rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-200"
              >
                ✓ verified
              </span>
            )}
            {talent.openToWork && (
              <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-200">
                open
              </span>
            )}
          </div>
          {talent.title && (
            <div className="mt-0.5 truncate text-sm text-emerald-200/80">{talent.title}</div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
            {talent.city && <span>📍 {talent.city}</span>}
            {talent.experienceYears > 0 && <span>⏱ {talent.experienceYears}y</span>}
            <span>{talent.buildRole}</span>
            {typeof talent.reviewCount === "number" && talent.reviewCount > 0 && (
              <StarsDisplay
                value={talent.avgRating ?? 0}
                size="sm"
                showValue
                reviewCount={talent.reviewCount}
              />
            )}
          </div>
        </div>
        {(talent.salaryMin || talent.salaryMax) && (
          <div className="shrink-0 text-right text-xs">
            <div className="text-slate-500">Expects</div>
            <div className="font-semibold text-emerald-200">
              {talent.salaryMin ? talent.salaryMin.toLocaleString() : "—"}
              {talent.salaryMax ? `–${talent.salaryMax.toLocaleString()}` : ""}
              {" "}
              <span className="text-slate-400">{talent.salaryCurrency || "RUB"}</span>
            </div>
          </div>
        )}
        <BookmarkButton kind="CANDIDATE" targetId={talent.userId} />
      </div>
      {talent.summary && (
        <p className="mt-2 line-clamp-2 text-sm text-slate-300">{talent.summary}</p>
      )}
      {talent.skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {talent.skills.slice(0, 6).map((s) => (
            <span
              key={s}
              className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200"
            >
              {s}
            </span>
          ))}
          {talent.skills.length > 6 && (
            <span className="text-[10px] text-slate-500">+{talent.skills.length - 6}</span>
          )}
        </div>
      )}
    </Link>
  );
}
