"use client";
import { apiUrl } from "@/lib/apiBase";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";
import { useToast } from "@/components/build/Toast";

type Shift = {
  id: string;
  applicationId: string;
  workerId: string;
  clientId: string;
  shiftDate: string;
  startTime: string | null;
  endTime: string | null;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  workerName: string | null;
  clientName: string | null;
};

type BriefingRecord = {
  id: string;
  shiftId: string;
  workerId: string;
  items: string[];
  signedAt: string;
};

export default function SafetyBriefingPage() {
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

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(true);

  const [templateItems, setTemplateItems] = useState<string[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [signing, setSigning] = useState(false);

  const [briefings, setBriefings] = useState<BriefingRecord[]>([]);
  const [loadingBriefings, setLoadingBriefings] = useState(false);

  async function loadShifts() {
    setLoadingShifts(true);
    try {
      const r = await buildApi.myShifts();
      setShifts(r.items);
    } catch {
      // ignore
    } finally {
      setLoadingShifts(false);
    }
  }

  async function loadTemplate() {
    try {
      const r = await buildApi.safetyBriefingTemplate();
      setTemplateItems(r.items);
      const init: Record<string, boolean> = {};
      r.items.forEach((_, i) => { init[String(i)] = false; });
      setChecked(init);
    } catch {
      // ignore
    }
  }

  async function loadBriefingsForShift(shiftId: string) {
    setLoadingBriefings(true);
    try {
      const res = await fetch(`/api/build/safety-briefing/shift/${shiftId}`, {
        headers: {
          Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("build_token") ?? "" : ""}`,
        },
      });
      const json = await res.json();
      if (res.ok) setBriefings(json.items ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingBriefings(false);
    }
  }

  useEffect(() => {
    loadShifts();
    loadTemplate();
  }, []);

  useEffect(() => {
    if (selectedShiftId) {
      loadBriefingsForShift(selectedShiftId);
    }
  }, [selectedShiftId]);

  function toggleItem(key: string) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function allChecked() {
    return templateItems.length > 0 && templateItems.every((_, i) => checked[String(i)]);
  }

  async function sign() {
    if (!selectedShiftId) return;
    if (!allChecked()) {
      toast.error("Please confirm all safety items before signing.");
      return;
    }
    setSigning(true);
    try {
      const signedItems = templateItems.filter((_, i) => checked[String(i)]);
      const res = await fetch(apiUrl("/api/build/safety-briefing"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("build_token") ?? "" : ""}`,
        },
        body: JSON.stringify({ shiftId: selectedShiftId, items: signedItems }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "sign_failed");
      toast.success("Safety briefing signed. Stay safe on site!");
      await loadBriefingsForShift(selectedShiftId);
      // Reset checklist
      const reset: Record<string, boolean> = {};
      templateItems.forEach((_, i) => { reset[String(i)] = false; });
      setChecked(reset);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSigning(false);
    }
  }

  const myShifts = shifts.filter((s) => s.workerId === me?.id);
  const selectedShift = shifts.find((s) => s.id === selectedShiftId) ?? null;

  const alreadySigned = briefings.some((b) => b.workerId === me?.id);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Safety Briefing</h1>
        <p className="mt-1 text-sm text-slate-400">
          Sign off on safety items before each shift. Required for site entry.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left — shift selector + sign-off form */}
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Select shift
            </label>
            {loadingShifts ? (
              <p className="text-sm text-slate-500">Loading shifts…</p>
            ) : myShifts.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
                No upcoming shifts.{" "}
                <Link href="/build/shifts" className="text-emerald-300 hover:underline">
                  View shifts →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {myShifts.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedShiftId(s.id)}
                    className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                      selectedShiftId === s.id
                        ? "border-emerald-500/40 bg-emerald-500/10 text-white"
                        : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {new Date(s.shiftDate).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                        {s.startTime ? ` · ${s.startTime}` : ""}
                      </span>
                      <ShiftStatusBadge status={s.status} />
                    </div>
                    {s.clientName && (
                      <p className="mt-0.5 text-xs text-slate-500">Client: {s.clientName}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedShiftId && templateItems.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Safety checklist</h2>
                {alreadySigned && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                    Already signed
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                {templateItems.map((item, i) => (
                  <label
                    key={i}
                    className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                      checked[String(i)]
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-white/10 bg-transparent hover:border-white/20"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!checked[String(i)]}
                      onChange={() => toggleItem(String(i))}
                      disabled={alreadySigned}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
                    />
                    <span className="text-sm text-slate-300 leading-snug">{item}</span>
                  </label>
                ))}
              </div>

              {!alreadySigned && (
                <button
                  onClick={sign}
                  disabled={signing || !allChecked()}
                  className="mt-4 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {signing ? "Signing…" : allChecked() ? "Sign & confirm" : `${templateItems.filter((_, i) => checked[String(i)]).length} / ${templateItems.length} confirmed`}
                </button>
              )}

              {alreadySigned && (
                <p className="mt-3 text-center text-xs text-emerald-400">
                  You have signed off on this shift's safety briefing.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right — recent briefings */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            {selectedShift
              ? `Briefings for ${new Date(selectedShift.shiftDate).toLocaleDateString()}`
              : "Recent briefings"}
          </h2>

          {!selectedShiftId && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
              <p className="text-sm text-slate-500">Select a shift to view its briefings.</p>
            </div>
          )}

          {selectedShiftId && loadingBriefings && (
            <p className="text-sm text-slate-500">Loading…</p>
          )}

          {selectedShiftId && !loadingBriefings && briefings.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
              <p className="text-sm text-slate-500">No sign-offs recorded for this shift yet.</p>
            </div>
          )}

          {selectedShiftId && !loadingBriefings && briefings.length > 0 && (
            <div className="space-y-3">
              {briefings.map((b) => (
                <BriefingCard key={b.id} briefing={b} isMe={b.workerId === me?.id} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShiftStatusBadge({ status }: { status: string }) {
  const cls =
    status === "SCHEDULED"
      ? "text-sky-300 bg-sky-500/10 border-sky-500/20"
      : status === "IN_PROGRESS"
        ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
        : status === "COMPLETED"
          ? "text-slate-400 bg-slate-500/10 border-slate-500/20"
          : "text-amber-300 bg-amber-500/10 border-amber-500/20";

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${cls}`}>
      {status}
    </span>
  );
}

function BriefingCard({
  briefing,
  isMe,
}: {
  briefing: BriefingRecord;
  isMe: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">
              {isMe ? "You" : `Worker ${briefing.workerId.slice(0, 8)}…`}
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-300">
              Signed
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {new Date(briefing.signedAt).toLocaleString()}
          </p>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          {expanded ? "Hide items" : `${briefing.items.length} items`}
        </button>
      </div>

      {expanded && (
        <ul className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
          {briefing.items.map((item, i) => (
            <li key={i} className="flex gap-2 text-xs text-slate-400">
              <span className="mt-0.5 text-emerald-500">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
