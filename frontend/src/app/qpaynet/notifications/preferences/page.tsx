"use client";
import { apiUrl } from "@/lib/apiBase";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface Prefs {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  mutedKinds: string[];
  availableKinds: string[];
}

const KIND_KEY: Record<string, string> = {
  payment_received: "qpaynet.notifPrefs.kind.paymentReceived",
  deposit_received: "qpaynet.notifPrefs.kind.depositReceived",
  payout_approved:  "qpaynet.notifPrefs.kind.payoutApproved",
  payout_paid:      "qpaynet.notifPrefs.kind.payoutPaid",
  payout_rejected:  "qpaynet.notifPrefs.kind.payoutRejected",
  kyc_verified:     "qpaynet.notifPrefs.kind.kycVerified",
};

export default function NotificationPrefsPage() {
  const { t } = useI18n();
  const [token, setToken] = useState("");
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("aevion_token") ?? "";
    setToken(saved);
    if (!saved) { setLoading(false); return; }
    fetch(apiUrl("/api/qpaynet/notifications/preferences"), { headers: { Authorization: `Bearer ${saved}` } })
      .then(r => r.json())
      .then(d => setPrefs(d))
      .finally(() => setLoading(false));
  }, []);

  async function save(next: Partial<Prefs>) {
    if (!prefs) return;
    setSaving(true);
    const body = {
      emailEnabled: next.emailEnabled ?? prefs.emailEnabled,
      inAppEnabled: next.inAppEnabled ?? prefs.inAppEnabled,
      mutedKinds: next.mutedKinds ?? prefs.mutedKinds,
    };
    try {
      const r = await fetch(apiUrl("/api/qpaynet/notifications/preferences"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const d = await r.json();
        setPrefs({ emailEnabled: d.emailEnabled, inAppEnabled: d.inAppEnabled, mutedKinds: d.mutedKinds, availableKinds: prefs.availableKinds });
        setSavedAt(Date.now());
        setTimeout(() => setSavedAt(null), 2000);
      }
    } finally { setSaving(false); }
  }

  function toggleKind(kind: string) {
    if (!prefs) return;
    const next = prefs.mutedKinds.includes(kind)
      ? prefs.mutedKinds.filter(k => k !== kind)
      : [...prefs.mutedKinds, kind];
    void save({ mutedKinds: next });
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">{t("qpaynet.notifPrefs.loginPrompt")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/qpaynet/notifications" className="text-slate-400 hover:text-white text-sm">{t("qpaynet.notifPrefs.backNotif")}</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">{t("qpaynet.notifPrefs.title")}</h1>
        </div>
        {savedAt && <span className="text-[10px] text-emerald-400">{t("qpaynet.notifPrefs.saved")}</span>}
      </header>

      <div className="max-w-md mx-auto px-6 py-8 space-y-5">
        {loading && <div className="text-slate-500 text-sm py-12 text-center">{t("qpaynet.notifPrefs.loading")}</div>}

        {!loading && prefs && (
          <>
            {/* Channels */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4">
              <h2 className="font-bold text-sm">{t("qpaynet.notifPrefs.channels")}</h2>
              <Toggle
                label={t("qpaynet.notifPrefs.inApp")}
                hint={t("qpaynet.notifPrefs.inAppHint")}
                checked={prefs.inAppEnabled}
                onToggle={v => save({ inAppEnabled: v })}
                disabled={saving}
              />
              <Toggle
                label={t("qpaynet.notifPrefs.email")}
                hint={t("qpaynet.notifPrefs.emailHint")}
                checked={prefs.emailEnabled}
                onToggle={v => save({ emailEnabled: v })}
                disabled={saving}
              />
            </div>

            {/* Per-event mute */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-3">
              <h2 className="font-bold text-sm mb-1">{t("qpaynet.notifPrefs.events")}</h2>
              <p className="text-[11px] text-slate-500 mb-3">{t("qpaynet.notifPrefs.eventsHint")}</p>
              {prefs.availableKinds.map(kind => {
                const muted = prefs.mutedKinds.includes(kind);
                return (
                  <label key={kind} className="flex items-center justify-between gap-3 cursor-pointer">
                    <span className={`text-sm ${muted ? "text-slate-500 line-through" : "text-slate-200"}`}>
                      {KIND_KEY[kind] ? t(KIND_KEY[kind]) : kind}
                    </span>
                    <input
                      type="checkbox"
                      checked={!muted}
                      onChange={() => toggleKind(kind)}
                      disabled={saving}
                      className="w-4 h-4 accent-violet-600"
                    />
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onToggle, disabled }: {
  label: string; hint?: string; checked: boolean; onToggle: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button onClick={() => !disabled && onToggle(!checked)} disabled={disabled}
      className="w-full flex items-center justify-between gap-3 text-left disabled:opacity-50">
      <div>
        <div className="text-sm font-medium text-slate-200">{label}</div>
        {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
      </div>
      <div className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? "bg-violet-600" : "bg-slate-700"}`}>
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </div>
    </button>
  );
}
