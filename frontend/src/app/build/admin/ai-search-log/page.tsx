"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi, buildErrorText } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

type LogData = Awaited<ReturnType<typeof buildApi.adminAiSearchLog>>;

export default function AiSearchLogPage() {
  return (
    <RequireAuth>
      <BuildShell>
        <Body />
      </BuildShell>
    </RequireAuth>
  );
}

function Body() {
  const user = useBuildAuth((s) => s.user);
  const token = useBuildAuth((s) => s.token);
  const [data, setData] = useState<LogData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [onlyIssues, setOnlyIssues] = useState(false);

  useEffect(() => {
    if (!token || user?.role !== "ADMIN") return;
    buildApi
      .adminAiSearchLog(200)
      .then(setData)
      .catch((e) => setErr(buildErrorText(e)))
      .finally(() => setLoading(false));
  }, [token, user]);

  if (user && user.role !== "ADMIN") {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 text-sm text-rose-200">
        Only ADMIN accounts can view this page.
      </div>
    );
  }

  const rows = data
    ? onlyIssues
      ? data.recent.filter((r) => r.issues.length > 0)
      : data.recent
    : [];

  return (
    <section className="space-y-6">
      <header>
        <Link href="/build/admin" className="text-xs text-slate-400 hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-white">AI search accuracy</h1>
        <p className="max-w-3xl text-xs text-slate-400">
          Natural-language search runs two agents: a parser turns the phrase into filters, then a
          checker reviews it. A row has issues when the checker had to correct the parser — so the
          issue rate is how often the first agent got it wrong on real traffic, not on test inputs.
        </p>
      </header>

      {err && (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {err}
        </p>
      )}

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Searches logged" value={data.summary.total} />
            <Tile label="Last 7 days" value={data.summary.last7d} />
            <Tile
              label="Checker corrected"
              value={`${(data.summary.issueRate * 100).toFixed(1)}%`}
              sub={`${data.summary.withIssues} of ${data.summary.total}`}
              tone={data.summary.issueRate > 0.2 ? "rose" : "emerald"}
            />
            <Tile
              label="Talent / vacancy"
              value={`${data.summary.talentCount} / ${data.summary.vacancyCount}`}
            />
          </div>

          {data.summary.total === 0 && (
            <p className="rounded-lg border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-500">
              Nothing logged yet. Rows appear once someone runs a natural-language search.
            </p>
          )}

          {data.summary.total > 0 && (
            <>
              <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={onlyIssues}
                  onChange={(e) => setOnlyIssues(e.target.checked)}
                  className="h-4 w-4 accent-rose-500"
                />
                Only rows the checker corrected
              </label>

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="bg-white/5 uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3">Query</th>
                      <th className="px-4 py-3">Filters extracted</th>
                      <th className="px-4 py-3">Checker notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rows.map((r) => (
                      <tr key={r.id} className={r.issues.length > 0 ? "bg-rose-500/[0.04]" : undefined}>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                          {new Date(r.createdAt).toLocaleString("ru-RU")}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                            {r.mode}
                          </span>
                        </td>
                        <td className="max-w-[22rem] px-4 py-3 text-slate-200">{r.queryText}</td>
                        <td className="px-4 py-3">
                          <FilterChips filters={r.filters} />
                        </td>
                        <td className="max-w-[20rem] px-4 py-3">
                          {r.issues.length === 0 ? (
                            <span className="text-slate-600">—</span>
                          ) : (
                            <ul className="space-y-0.5 text-rose-200">
                              {r.issues.map((it, i) => (
                                <li key={i}>· {it}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {rows.length === 0 && (
                <p className="text-center text-sm text-slate-500">
                  No corrected rows among the last {data.recent.length}.
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function FilterChips({ filters }: { filters: Record<string, unknown> }) {
  const entries = Object.entries(filters).filter(
    ([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0),
  );
  if (entries.length === 0) return <span className="text-slate-600">nothing extracted</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-300"
        >
          {k}: {Array.isArray(v) ? v.join(", ") : String(v)}
        </span>
      ))}
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "emerald" | "rose";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div
        className={`mt-1 text-3xl font-bold ${
          tone === "emerald" ? "text-emerald-300" : tone === "rose" ? "text-rose-300" : "text-white"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}
