"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildApi, BuildApiError } from "@/lib/build/api";

export function QuickApplyButton({
  vacancyId,
  referredByUserId,
  className,
  alreadyApplied,
}: {
  vacancyId: string;
  referredByUserId?: string;
  className?: string;
  alreadyApplied?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<boolean>(!!alreadyApplied);
  const router = useRouter();

  if (done) {
    return (
      <button
        disabled
        className={
          className ||
          "rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200"
        }
      >
        ✓ Отклик отправлен
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await buildApi.quickApply({ vacancyId, referredByUserId });
            setDone(true);
            router.refresh();
          } catch (e) {
            const msg = e instanceof BuildApiError ? e.message : (e as Error).message;
            if (msg === "profile_required_for_quick_apply") {
              router.push(`/build/profile?next=/build/vacancy/${vacancyId}`);
              return;
            }
            if (msg === "already_applied") {
              setDone(true);
              return;
            }
            setErr(msg);
          } finally {
            setBusy(false);
          }
        }}
        className={
          className ||
          "inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
        }
      >
        {busy ? "Отправка…" : "⚡ Quick Apply"}
      </button>
      {err && <p className="text-xs text-rose-300">{err}</p>}
    </div>
  );
}
