"use client";

import { useEffect, useState } from "react";
import { buildApi } from "@/lib/build/api";

export function SafetyBriefingModal({
  shiftId,
  onClose,
  onSigned,
}: {
  shiftId: string;
  onClose: () => void;
  onSigned?: () => void;
}) {
  const [items, setItems] = useState<string[] | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    buildApi.safetyTemplate().then((r) => setItems(r.items)).catch(() => setItems([]));
  }, []);

  if (!items) return null;
  const allChecked = items.length > 0 && items.every((_, i) => checked[i]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-amber-500/10 px-5 py-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-amber-200">⛑️ Pre-shift</div>
            <h3 className="text-base font-bold text-white">Инструктаж по технике безопасности</h3>
          </div>
          <button onClick={onClose} className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/5">×</button>
        </div>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto p-5">
          {items.map((it, i) => (
            <label key={i} className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2.5 hover:bg-white/[0.05]">
              <input
                type="checkbox"
                checked={!!checked[i]}
                onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))}
                className="mt-0.5 h-4 w-4 accent-emerald-500"
              />
              <span className="text-sm text-slate-200">{it}</span>
            </label>
          ))}
          {err && <p className="text-sm text-rose-300">{err}</p>}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-white/[0.02] px-5 py-3 text-xs">
          <span className="text-slate-400">
            {Object.values(checked).filter(Boolean).length} / {items.length}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-white/10 px-3 py-1.5 text-slate-300 hover:bg-white/5">Отмена</button>
            <button
              disabled={!allChecked || busy}
              onClick={async () => {
                setBusy(true);
                setErr(null);
                try {
                  await buildApi.signSafetyBriefing(shiftId, items);
                  onSigned?.();
                  onClose();
                } catch (e) {
                  setErr((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
              className="rounded-md bg-emerald-500 px-3 py-1.5 font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {busy ? "Подписываю…" : "Подписать инструктаж"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
