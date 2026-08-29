"use client";
import { apiUrl } from "@/lib/apiBase";
import { getAuthToken } from "@/lib/auth";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  ref_id: string | null;
  amount: number | null;
  read_at: string | null;
  created_at: string;
}

const KIND_ICON: Record<string, string> = {
  payment_received: "💸",
  deposit_received: "💳",
  payout_approved: "✅",
  payout_paid: "🏦",
  payout_rejected: "✗",
  kyc_verified: "🛡",
};

function fmtDate(iso: string, lang: string) {
  const localeTag = lang === "en" ? "en-US" : "ru-RU";
  return new Date(iso).toLocaleString(localeTag, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmt(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function NotificationsPage() {
  const { t, lang } = useI18n();
  const [token, setToken] = useState("");
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = getAuthToken() ?? "";
    setToken(saved);
    if (!saved) { setLoading(false); return; }
    fetch(apiUrl("/api/qpaynet/notifications"), { headers: { Authorization: `Bearer ${saved}` } })
      .then(r => r.json())
      .then(d => setItems(d.notifications ?? []))
      .finally(() => setLoading(false));
  }, []);

  // Ответ обеих ручек выбрасывался, а список правился безусловно.
  // fetch не бросает исключение на 401 и 500 — он возвращает ответ. Значит
  // отказ помечал уведомление прочитанным ТОЛЬКО на экране: человек считал,
  // что разобрал оповещение о платеже, а после перезагрузки оно возвращалось
  // непрочитанным. Отказ выглядел успехом.
  async function markRead(id: string) {
    const r = await fetch(`/api/qpaynet/notifications/${id}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) { setError(t("qpaynet.notif.markFailed", { status: r.status })); return; }
    setError(null);
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }

  async function markAll() {
    const r = await fetch(apiUrl("/api/qpaynet/notifications/read-all"), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) { setError(t("qpaynet.notif.markFailed", { status: r.status })); return; }
    setError(null);
    setItems(prev => prev.map(n => n.read_at ? n : { ...n, read_at: new Date().toISOString() }));
  }

  const filtered = filter === "all" ? items : items.filter(n => !n.read_at);
  const unreadCount = items.filter(n => !n.read_at).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/qpaynet" className="text-slate-400 hover:text-white text-sm">← QPayNet</Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold">{t("qpaynet.notif.title")} {unreadCount > 0 && <span className="text-amber-400">({unreadCount})</span>}</h1>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAll}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg">
              {t("qpaynet.notif.markAll")}
            </button>
          )}
          <Link href="/qpaynet/notifications/preferences"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg">
            {t("qpaynet.notif.settings")}
          </Link>
        </div>
      </header>

        {error && (
          <div role="alert" className="px-3 py-2 rounded-lg bg-rose-950 text-rose-200 text-xs">
            {error}
          </div>
        )}
      <div className="max-w-xl mx-auto px-6 py-6 space-y-3">
        <div className="flex gap-2">
          {[["all", t("qpaynet.notif.filter.all")], ["unread", t("qpaynet.notif.filter.unread", { count: unreadCount })]].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v as "all" | "unread")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === v ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
              {l}
            </button>
          ))}
        </div>

        {loading && <div className="text-slate-500 text-sm py-12 text-center">{t("qpaynet.notif.loading")}</div>}
        {!loading && filtered.length === 0 && <div className="text-slate-600 text-sm py-12 text-center">{t("qpaynet.notif.empty")}</div>}

        {filtered.map(n => (
          <button key={n.id} onClick={() => !n.read_at && markRead(n.id)}
            className={`w-full text-left p-3 rounded-xl border transition-colors ${
              n.read_at ? "border-slate-800 bg-slate-900/50 opacity-60" : "border-slate-700 bg-slate-900 hover:border-slate-600"
            }`}>
            <div className="flex items-start gap-3">
              <div className="text-xl shrink-0 mt-0.5">{KIND_ICON[n.kind] ?? "🔔"}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="font-semibold text-sm text-white truncate">{n.title}</span>
                  {!n.read_at && <span className="w-2 h-2 bg-amber-400 rounded-full shrink-0" />}
                </div>
                {n.body && <div className="text-[12px] text-slate-400 truncate">{n.body}</div>}
                <div className="text-[10px] text-slate-600 mt-1">{fmtDate(n.created_at, lang)}</div>
                {n.amount != null && (
                  <div className="text-[12px] text-emerald-400 font-bold mt-1">+{fmt(n.amount)} ₸</div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
