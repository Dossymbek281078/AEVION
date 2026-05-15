"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi, type BuildApplication } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";
import { useToast } from "@/components/build/Toast";

type ContractStatus = "pending" | "signed" | "expired";

type ContractEntry = BuildApplication & {
  contractStatus: ContractStatus;
  qsignUrl?: string;
  contractPayload?: {
    client: { name: string; city: string };
    worker: { name: string; city: string };
    vacancy: { title: string; salary: number | null; currency: string; project: string };
    generatedAt: string;
  };
};

const STATUS_COLOR: Record<ContractStatus, string> = {
  pending: "text-amber-200 bg-amber-500/10 border-amber-500/20",
  signed: "text-emerald-200 bg-emerald-500/10 border-emerald-500/20",
  expired: "text-rose-200 bg-rose-500/10 border-rose-500/20",
};

const STATUS_LABEL: Record<ContractStatus, string> = {
  pending: "Pending",
  signed: "Signed",
  expired: "Expired",
};

function deriveContractStatus(app: BuildApplication): ContractStatus {
  if (app.status === "REJECTED") return "expired";
  if (app.status === "ACCEPTED") return "pending";
  // Vacancy expired
  if (app.vacancyExpiresAt && new Date(app.vacancyExpiresAt) < new Date()) return "expired";
  return "pending";
}

export default function ContractsPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Body />
      </RequireAuth>
    </BuildShell>
  );
}

function Body() {
  const me = useBuildAuth((s) => s.user);
  const toast = useToast();
  const [items, setItems] = useState<ContractEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await buildApi.myApplications();
      const accepted = r.items.filter((a) => a.status === "ACCEPTED" || a.status === "REJECTED");
      setItems(
        accepted.map((a) => ({
          ...a,
          contractStatus: deriveContractStatus(a),
        })),
      );
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function generateContract(appId: string) {
    setGenerating(appId);
    try {
      const res = await fetch(`/api/build/applications/${appId}/contract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("build_token") ?? "" : ""}`,
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "contract_failed");
      setItems((prev) =>
        prev.map((e) =>
          e.id === appId
            ? {
                ...e,
                contractStatus: "pending",
                qsignUrl: json.qsignUrl,
                contractPayload: json.contractPayload,
              }
            : e,
        ),
      );
      toast.success("Contract generated — open QSign to sign.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGenerating(null);
    }
  }

  const asWorker = items.filter((e) => e.userId === me?.id);
  const asEmployer = items.filter((e) => e.userId !== me?.id);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Contracts</h1>
          <p className="mt-1 text-sm text-slate-400">
            Service agreements for accepted applications — signed via QSign v2.
          </p>
        </div>
        <Link
          href="/build/applications"
          className="text-sm text-emerald-300 hover:underline"
        >
          My applications →
        </Link>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {!loading && items.length === 0 && (
        <EmptyState />
      )}

      {!loading && asWorker.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            As worker ({asWorker.length})
          </h2>
          <div className="space-y-3">
            {asWorker.map((entry) => (
              <ContractCard
                key={entry.id}
                entry={entry}
                onGenerate={() => generateContract(entry.id)}
                generating={generating === entry.id}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && asEmployer.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            As employer ({asEmployer.length})
          </h2>
          <div className="space-y-3">
            {asEmployer.map((entry) => (
              <ContractCard
                key={entry.id}
                entry={entry}
                onGenerate={() => generateContract(entry.id)}
                generating={generating === entry.id}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-2xl">
        📄
      </div>
      <p className="text-sm text-slate-400">
        No contracts yet. Contracts are generated from accepted applications.
      </p>
      <Link
        href="/build/vacancies"
        className="mt-4 inline-block text-sm text-emerald-300 hover:underline"
      >
        Browse vacancies →
      </Link>
    </div>
  );
}

function ContractCard({
  entry,
  onGenerate,
  generating,
}: {
  entry: ContractEntry;
  onGenerate: () => void;
  generating: boolean;
}) {
  const statusCls = STATUS_COLOR[entry.contractStatus];
  const cp = entry.contractPayload;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white truncate">
              {entry.vacancyTitle ?? "Untitled vacancy"}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${statusCls}`}
            >
              {STATUS_LABEL[entry.contractStatus]}
            </span>
          </div>

          {entry.projectTitle && (
            <p className="mt-0.5 text-xs text-slate-400">{entry.projectTitle}</p>
          )}

          {cp && (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400 sm:grid-cols-4">
              <div>
                <span className="block text-slate-500">Client</span>
                <span className="text-slate-300">{cp.client.name}</span>
              </div>
              <div>
                <span className="block text-slate-500">Worker</span>
                <span className="text-slate-300">{cp.worker.name}</span>
              </div>
              {cp.vacancy.salary != null && (
                <div>
                  <span className="block text-slate-500">Salary</span>
                  <span className="text-slate-300">
                    {cp.vacancy.salary.toLocaleString()} {cp.vacancy.currency}
                  </span>
                </div>
              )}
              <div>
                <span className="block text-slate-500">Generated</span>
                <span className="text-slate-300">
                  {new Date(cp.generatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {entry.contractStatus === "pending" && !entry.qsignUrl && (
            <button
              onClick={onGenerate}
              disabled={generating}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {generating ? "Generating…" : "Generate contract"}
            </button>
          )}

          {entry.qsignUrl && (
            <Link
              href={entry.qsignUrl}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 transition-colors"
            >
              Open in QSign →
            </Link>
          )}

          {entry.contractStatus === "expired" && (
            <span className="text-xs text-rose-400">Application closed</span>
          )}

          <Link
            href={`/build/applications/${entry.id}`}
            className="text-xs text-slate-400 hover:text-slate-200 underline"
          >
            View application
          </Link>
        </div>
      </div>
    </div>
  );
}
