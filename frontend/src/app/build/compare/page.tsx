"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BuildShell } from "@/components/build/BuildShell";
import { buildApi, type BuildVacancy } from "@/lib/build/api";

export default function VacancyComparePage() {
  return (
    <BuildShell>
      <Body />
    </BuildShell>
  );
}

function Body() {
  const params = useSearchParams();
  const ids = useMemo(() => {
    const raw = params.get("ids") || "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
  }, [params]);

  const [items, setItems] = useState<(BuildVacancy | null)[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<(string | null)[]>([]);

  useEffect(() => {
    if (ids.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all(
      ids.map((id) =>
        buildApi
          .getVacancy(id)
          .then((v) => ({ ok: true as const, v }))
          .catch((e) => ({ ok: false as const, err: (e as Error).message })),
      ),
    ).then((results) => {
      if (cancelled) return;
      setItems(results.map((r) => (r.ok ? r.v : null)));
      setErrors(results.map((r) => (r.ok ? null : r.err)));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ids.join(",")]);

  if (ids.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
        <h1 className="text-xl font-bold text-white">No vacancies to compare</h1>
        <p className="mt-2 text-sm text-slate-400">
          Browse the feed and click <span className="font-semibold text-fuchsia-200">+ Compare</span> on 2-3
          vacancies, then come back here.
        </p>
        <Link
          href="/build/vacancies"
          className="mt-4 inline-block rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
        >
          Browse vacancies →
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Compare {ids.length} vacancies</h1>
          <p className="mt-1 text-xs text-slate-400">Side-by-side view of role, salary, city, skills.</p>
        </div>
        <Link href="/build/vacancies" className="text-xs text-emerald-300 hover:underline">
          ← Back to vacancies
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <div className={`grid gap-3 ${ids.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
            {items.map((v, i) =>
              v ? (
                <CompareCol key={v.id} vacancy={v} />
              ) : (
                <div
                  key={ids[i]}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"
                >
                  Failed to load: {errors[i] || "unknown error"}
                </div>
              ),
            )}
          </div>

          {/* Diff view: skills union with checkmarks */}
          <SkillsDiff items={items.filter((v): v is BuildVacancy => !!v)} />
        </div>
      )}
    </>
  );
}

function CompareCol({ vacancy: v }: { vacancy: BuildVacancy }) {
  const isClosed = v.status === "CLOSED";
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <Link
          href={`/build/vacancy/${encodeURIComponent(v.id)}`}
          className="text-base font-semibold text-white hover:text-emerald-200"
        >
          {v.title}
        </Link>
        <span
          className={
            isClosed
              ? "rounded bg-slate-500/20 px-2 py-0.5 text-[10px] uppercase text-slate-300"
              : "rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] uppercase text-emerald-200"
          }
        >
          {v.status}
        </span>
      </div>
      <dl className="space-y-2 text-sm">
        <Row label="Salary" value={v.salary > 0 ? `$${v.salary.toLocaleString()} ${v.salaryCurrency || ""}` : "—"} accent="emerald" />
        <Row label="City" value={v.city || "—"} />
        <Row label="Posted" value={new Date(v.createdAt).toLocaleDateString()} />
        <Row
          label="Expires"
          value={
            v.expiresAt
              ? `${new Date(v.expiresAt).toLocaleDateString()} (${Math.max(
                  0,
                  Math.ceil((new Date(v.expiresAt).getTime() - Date.now()) / 86400000),
                )}d)`
              : "—"
          }
        />
        <Row label="Applications" value={v.applicationsCount != null ? String(v.applicationsCount) : "—"} />
        <Row label="Project" value={v.projectTitle || "—"} />
      </dl>
      {v.skills && v.skills.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Skills</div>
          <div className="flex flex-wrap gap-1">
            {v.skills.map((s) => (
              <span key={s} className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3 line-clamp-4 text-xs text-slate-300">{v.description}</div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald";
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
      <dt className="text-xs uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className={accent === "emerald" ? "text-sm font-semibold text-emerald-300" : "text-sm text-slate-200"}>
        {value}
      </dd>
    </div>
  );
}

function SkillsDiff({ items }: { items: BuildVacancy[] }) {
  const allSkills = useMemo(() => {
    const set = new Set<string>();
    for (const v of items) for (const s of v.skills ?? []) set.add(s);
    return Array.from(set).sort();
  }, [items]);

  if (allSkills.length === 0 || items.length < 2) return null;

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Skills matrix
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 text-slate-400">
            <tr>
              <th className="py-2 pr-3">Skill</th>
              {items.map((v) => (
                <th key={v.id} className="py-2 pr-3 text-center">
                  <Link
                    href={`/build/vacancy/${encodeURIComponent(v.id)}`}
                    className="hover:underline"
                    title={v.title}
                  >
                    {v.title.length > 20 ? v.title.slice(0, 20) + "…" : v.title}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {allSkills.map((s) => (
              <tr key={s}>
                <td className="py-1.5 pr-3 text-slate-200">{s}</td>
                {items.map((v) => {
                  const has = (v.skills ?? []).includes(s);
                  return (
                    <td key={v.id} className="py-1.5 pr-3 text-center">
                      {has ? <span className="text-emerald-300">✓</span> : <span className="text-slate-600">–</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
