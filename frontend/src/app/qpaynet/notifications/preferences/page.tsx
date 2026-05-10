"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Prefs {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  mutedKinds: string[];
  availableKinds: string[];
}

const KIND_LABEL: Record<string, string> = {
  payment_received: "💸 Получен платёж",
  deposit_received: "💳 Кошелёк пополнен",
  payout_approved:  "✅ Выплата одобрена",
  payout_paid:      "🏦 Выплата отправлена",
  payout_rejected:  "✗ Выплата отклонена",
  kyc_verified:     "🛡 KYC верифицирован",
};

export default function NotificationPrefsPage() {
  const [token, setToken] = useState("");
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("aevion_token") ?? "";
    setToken(t);
    if (!t) { setLoading(false); return; }
    fetch("/api/qpaynet/notifications/preferences", { headers: { Authorization: `Bearer ${t}` } })
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
      const r = await fetch("/api/qpaynet/notifications/preferences", {
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
        <p className="text-slate-400">Войдите чтобы настроить уведомления.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/qpaynet/notifications" className="text-slate-400 hover:text-white text-sm">← Уведомления</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">Настройки</h1>
        </div>
        {savedAt && <span className="text-[10px] text-emerald-400">✓ Сохранено</span>}
      </header>

      <div className="max-w-md mx-auto px-6 py-8 space-y-5">
        {loading && <div className="text-slate-500 text-sm py-12 text-center">Загрузка...</div>}

        {!loading && prefs && (
          <>
            {/* Channels */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4">
              <h2 className="font-bold text-sm">Каналы</h2>
              <Toggle
                label="🔔 В приложении"
                hint="Показывать на /qpaynet/notifications с бейджем"
                checked={prefs.inAppEnabled}
                onToggle={v => save({ inAppEnabled: v })}
                disabled={saving}
              />
              <Toggle
                label="✉ Email"
                hint="Письмо на ваш AEVION email при каждом событии"
                checked={prefs.emailEnabled}
                onToggle={v => save({ emailEnabled: v })}
                disabled={saving}
              />
            </div>

            {/* Per-event mute */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-3">
              <h2 className="font-bold text-sm mb-1">События</h2>
              <p className="text-[11px] text-slate-500 mb-3">Отключите ненужные типы — пропустят и in-app, и email.</p>
              {prefs.availableKinds.map(kind => {
                const muted = prefs.mutedKinds.includes(kind);
                return (
                  <label key={kind} className="flex items-center justify-between gap-3 cursor-pointer">
                    <span className={`text-sm ${muted ? "text-slate-500 line-through" : "text-slate-200"}`}>
                      {KIND_LABEL[kind] ?? kind}
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
