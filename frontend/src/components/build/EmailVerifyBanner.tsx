"use client";

import { useState } from "react";
import { requestEmailVerification, BuildApiError } from "@/lib/build/api";

export function EmailVerifyBanner({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 text-sm">
        <span className="text-amber-200">
          ⚠️ Email <strong>{email}</strong> не подтверждён.
        </span>
        {sent ? (
          <span className="text-emerald-300">
            ✓ Письмо отправлено — проверьте почту.
          </span>
        ) : (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await requestEmailVerification();
                setSent(true);
              } catch (e) {
                const msg = e instanceof BuildApiError ? e.message : (e as Error).message;
                setErr(msg);
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-md bg-amber-500/25 px-3 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-500/40 disabled:opacity-50"
          >
            {busy ? "Отправляем…" : "Отправить письмо"}
          </button>
        )}
        {err && <span className="text-xs text-rose-300">{err}</span>}
        <button
          onClick={() => setDismissed(true)}
          className="ml-auto text-xs text-amber-400/70 hover:text-amber-300"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
