"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";

type Doc = {
  id: string;
  title: string;
  contentType: string;
  maxViews: number | null;
  viewCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  requireSignature: boolean;
  shareUrl: string;
  createdAt: string;
};

const TOKEN_KEY = "aevion_auth_token_v1";
function readToken() {
  try { return typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) || "" : ""; } catch { return ""; }
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    const token = readToken();
    if (!token || !id) { setLoading(false); return; }
    fetch(apiUrl(`/api/qcontract/documents`), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const found = (d.documents as Doc[])?.find((doc) => doc.id === id);
        if (found) setDoc(found);
        else setError("Document not found");
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  async function revoke() {
    if (!confirm("Revoke this document? Viewers will no longer be able to access it.")) return;
    setRevoking(true);
    const token = readToken();
    try {
      await fetch(apiUrl(`/api/qcontract/documents/${id}`), {
        method: "PATCH",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ revoke: true }),
      });
      setDoc((d) => d ? { ...d, revokedAt: new Date().toISOString() } : d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRevoking(false);
    }
  }

  function copyLink() {
    if (!doc?.shareUrl) return;
    navigator.clipboard.writeText(doc.shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (error) return <div className="p-8 text-rose-400">{error}</div>;
  if (!doc) return <div className="p-8 text-slate-400">Not found.</div>;

  const isLive = !doc.revokedAt && (!doc.expiresAt || new Date(doc.expiresAt) > new Date()) && (!doc.maxViews || doc.viewCount < doc.maxViews);
  const viewsLeft = doc.maxViews ? doc.maxViews - doc.viewCount : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/qcontract" className="text-slate-400 hover:text-white text-sm">← My documents</Link>
        <span className="text-slate-600">/</span>
        <span className="text-slate-300 text-sm truncate">{doc.title}</span>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white break-words">{doc.title}</h1>
            <p className="text-xs text-slate-500 mt-1">Created {new Date(doc.createdAt).toLocaleDateString()}</p>
          </div>
          <span className={`self-start rounded-full px-3 py-1 text-xs font-semibold border whitespace-nowrap ${
            doc.revokedAt ? "bg-rose-500/15 text-rose-300 border-rose-500/30" :
            isLive ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" :
            "bg-slate-500/15 text-slate-400 border-slate-500/30"
          }`}>
            {doc.revokedAt ? "Revoked" : isLive ? "Live" : "Expired / limit reached"}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Views", value: doc.viewCount },
            { label: "Limit", value: doc.maxViews ?? "∞" },
            { label: "Remaining", value: viewsLeft !== null ? Math.max(0, viewsLeft) : "∞" },
            { label: "Signatures", value: doc.requireSignature ? "required" : "off" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {doc.expiresAt && (
          <p className="text-xs text-slate-400">
            Expires: <span className="text-slate-200">{new Date(doc.expiresAt).toLocaleString()}</span>
          </p>
        )}

        {/* Share link */}
        {doc.shareUrl && (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-slate-500 mb-1.5">Share link</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-emerald-300 truncate">{doc.shareUrl}</code>
              <button
                onClick={copyLink}
                className="shrink-0 rounded-md bg-emerald-600/20 border border-emerald-500/30 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-600/30"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href={`/qcontract/documents/${id}/log`}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 hover:bg-white/10 min-h-[36px] inline-flex items-center"
          >
            Audit log →
          </Link>
          {!doc.revokedAt && isLive && (
            <button
              onClick={revoke}
              disabled={revoking}
              className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 min-h-[36px]"
            >
              {revoking ? "Revoking…" : "Revoke access"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
