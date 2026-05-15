"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { useToast } from "@/components/build/Toast";
import { buildApi } from "@/lib/build/api";

type Row = Awaited<ReturnType<typeof buildApi.adminListFlags>>["items"][number];
type Status = "open" | "dismissed" | "actioned";

export default function AdminFlagsPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Body />
      </RequireAuth>
    </BuildShell>
  );
}

function Body() {
  const toast = useToast();
  const [items, setItems] = useState<Row[] | null>(null);
  const [status, setStatus] = useState<Status>("open");

  async function refresh(s: Status = status) {
    try {
      const r = await buildApi.adminListFlags(s);
      setItems(r.items);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  useEffect(() => {
    refresh(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function resolve(id: string, next: "dismissed" | "actioned") {
    try {
      await buildApi.adminResolveFlag(id, next);
      toast.success(next === "dismissed" ? "Dismissed" : "Marked actioned");
      setItems((arr) => arr?.filter((x) => x.id !== id) ?? arr);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <header className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Application moderation queue</h1>
          <p className="mt-1 text-sm text-slate-400">
            Flagged applications. Dismiss for false positives, action for spam/abuse confirmed.
          </p>
        </div>
        <Link href="/build/admin" className="text-xs text-emerald-300 hover:underline">
          ← Admin home
        </Link>
      </header>

      <div className="mb-4 flex items-center gap-1 text-xs">
        {(["open", "actioned", "dismissed"] as Status[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-md px-3 py-1.5 ${
              status === s ? "bg-emerald-500/20 text-emerald-200" : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {!items && <p className="text-sm text-slate-400">Loading…</p>}
      {items && items.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
          <p className="text-sm text-slate-400">
            {status === "open" ? "Inbox zero — no flags awaiting review." : `No ${status} flags.`}
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="space-y-3">
          {items.map((f) => (
            <div key={f.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">
                    {f.candidateName || f.candidateId || "Unknown candidate"}{" "}
                    <span className="text-slate-500">·</span>{" "}
                    <span className="font-normal text-slate-400">
                      {f.vacancyTitle || "—"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span>
                      Reason: <span className="text-rose-200 font-mono">{f.reason}</span>
                    </span>
                    <span>by {f.reporterName || f.reporterUserId}</span>
                    <span>{new Date(f.createdAt).toLocaleString()}</span>
                  </div>
                  {f.note && (
                    <p className="mt-2 rounded border border-white/5 bg-black/20 p-2 text-xs text-slate-300">
                      {f.note}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {f.vacancyId && f.applicationId && (
                    <Link
                      href={`/build/vacancy/${encodeURIComponent(f.vacancyId)}/review/${encodeURIComponent(f.applicationId)}`}
                      className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                    >
                      Review →
                    </Link>
                  )}
                  {status === "open" && (
                    <>
                      <button
                        type="button"
                        onClick={() => resolve(f.id, "dismissed")}
                        className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() => resolve(f.id, "actioned")}
                        className="rounded-md border border-rose-500/30 bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-100 hover:bg-rose-500/25"
                      >
                        Action
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
