"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface ViewEntry {
  id: string;
  viewerIp: string | null;
  viewerUa: string | null;
  viewerEmail: string | null;
  signedAt: string | null;
  viewedAt: string;
}

interface LogData {
  documentId: string;
  title: string;
  viewCount: number;
  maxViews: number | null;
  expiresAt: string | null;
  revokedAt: string | null;
  requireSignature: boolean;
  qrightId: string | null;
  expired: boolean;
  views: ViewEntry[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function uaShort(ua: string | null): string {
  if (!ua) return "—";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  if (ua.includes("curl")) return "curl";
  return ua.slice(0, 30);
}

export default function DocumentLog() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<LogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("aevion_token") ?? "";
    if (!token) { setError("Необходима авторизация"); setLoading(false); return; }
    fetch(`/api/qcontract/documents/${id}/log`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); } else { setData(d); }
      })
      .catch(() => setError("Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="text-center"><div className="text-3xl mb-3 animate-pulse">📊</div><p className="text-sm">Загрузка лога...</p></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-slate-400">{error || "Документ не найден"}</p>
          <Link href="/qcontract" className="text-xs text-slate-600 hover:text-slate-400 mt-4 inline-block underline">← К дашборду</Link>
        </div>
      </div>
    );
  }

  const signedCount = data.views.filter((v) => v.viewerEmail).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/qcontract" className="text-slate-400 hover:text-white text-sm">← Дашборд</Link>
        <span className="text-slate-600">·</span>
        <h1 className="text-sm font-bold truncate max-w-xs">{data.title}</h1>
        <div className="ml-auto flex items-center gap-2">
          {data.revokedAt && <span className="text-[10px] bg-red-900 text-red-300 px-2 py-0.5 rounded-full">Отозван</span>}
          {data.expired && !data.revokedAt && <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">Истёк</span>}
          {!data.expired && <span className="text-[10px] bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded-full">Активен</span>}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ["👁", "Просмотров", `${data.viewCount}${data.maxViews ? `/${data.maxViews}` : ""}`],
            ["✍️", "Подписей", `${signedCount}`],
            ["⏱", "Истекает", data.expiresAt ? new Date(data.expiresAt).toLocaleDateString("ru-RU") : "∞"],
            ["🛡", "QRight", data.qrightId ? data.qrightId.slice(0, 8) + "..." : "—"],
          ].map(([icon, label, value]) => (
            <div key={label} className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-center">
              <div className="text-2xl mb-1">{icon}</div>
              <div className="text-lg font-bold text-white">{value}</div>
              <div className="text-[11px] text-slate-500">{label}</div>
            </div>
          ))}
        </div>

        {/* View log table */}
        <div>
          <h2 className="text-sm font-bold text-slate-300 mb-3">
            Лог просмотров ({data.views.length})
          </h2>

          {data.views.length === 0 ? (
            <div className="text-center py-12 text-slate-600">
              <div className="text-3xl mb-3">👀</div>
              <p className="text-sm">Документ ещё никто не открывал</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-800">
                    <th className="pb-2 font-semibold pr-4">#</th>
                    <th className="pb-2 font-semibold pr-4">Дата и время</th>
                    <th className="pb-2 font-semibold pr-4">Email (подпись)</th>
                    <th className="pb-2 font-semibold pr-4">IP</th>
                    <th className="pb-2 font-semibold">Браузер</th>
                  </tr>
                </thead>
                <tbody>
                  {data.views.map((v, i) => (
                    <tr key={v.id} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                      <td className="py-2.5 pr-4 text-slate-500">{i + 1}</td>
                      <td className="py-2.5 pr-4 text-slate-300 whitespace-nowrap">{formatDate(v.viewedAt)}</td>
                      <td className="py-2.5 pr-4">
                        {v.viewerEmail ? (
                          <span className="text-emerald-400 font-medium">{v.viewerEmail}</span>
                        ) : (
                          <span className="text-slate-600 italic">не указан</span>
                        )}
                        {v.signedAt && (
                          <span className="ml-2 text-[10px] text-emerald-600">✍️ {new Date(v.signedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-slate-400">{v.viewerIp ?? "—"}</td>
                      <td className="py-2.5 text-slate-500">{uaShort(v.viewerUa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-slate-800 flex-wrap">
          <Link href="/qcontract" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors">
            ← К дашборду
          </Link>
          {data.views.length > 0 && (
            <button
              onClick={async () => {
                const token = localStorage.getItem("aevion_token") ?? "";
                const r = await fetch(`/api/qcontract/documents/${id}/log.csv`, { headers: { Authorization: `Bearer ${token}` } });
                if (!r.ok) return;
                const blob = await r.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `qcontract-log-${id?.slice(0,8) ?? "doc"}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
            >
              ⬇ CSV аудит
            </button>
          )}
          {!data.expired && (
            <button
              onClick={async () => {
                if (!confirm("Отозвать документ?")) return;
                const token = localStorage.getItem("aevion_token") ?? "";
                await fetch(`/api/qcontract/documents/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
                window.location.href = "/qcontract";
              }}
              className="px-4 py-2 bg-red-900 hover:bg-red-800 text-red-300 rounded-lg text-sm transition-colors"
            >
              Отозвать документ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
