"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";

type Doc = {
  id: string;
  docType: string;
  status: string;
  fileUrl: string;
  rejectReason: string | null;
  verifiedAt: string | null;
  createdAt: string;
};

const DOC_TYPES = [
  { value: "WELDER", label: "Welder certificate" },
  { value: "ELECTRICIAN", label: "Electrician certificate" },
  { value: "DRIVER_LICENSE", label: "Driver's license" },
  { value: "MEDICAL", label: "Medical clearance" },
  { value: "SAFETY", label: "Safety training" },
  { value: "PLUMBER", label: "Plumber certificate" },
  { value: "ENGINEER", label: "Engineer diploma" },
  { value: "OTHER", label: "Other document" },
];

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-yellow-500/15 text-yellow-200 border-yellow-500/30",
  VERIFIED: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  REJECTED: "bg-rose-500/15 text-rose-200 border-rose-500/30",
};

export default function DocumentsPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Body />
      </RequireAuth>
    </BuildShell>
  );
}

function Body() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState("WELDER");

  async function load() {
    try {
      const r = await buildApi.myDocuments();
      setDocs(r.items ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => { load(); }, []);

  async function upload() {
    const url = urlRef.current?.value.trim();
    if (!url) return;
    setUploading(true);
    setError(null);
    try {
      await buildApi.uploadDocument({ fileUrl: url, docType });
      if (urlRef.current) urlRef.current.value = "";
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">My documents</h1>
          <p className="mt-1 text-sm text-slate-400">
            Upload certificates and credentials for verification. Verified documents unlock the ✓ Verified badge.
          </p>
        </div>
        <Link
          href="/build/profile"
          className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10"
        >
          ← Profile
        </Link>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      {/* Upload form */}
      <section className="mb-8 rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-300">Upload new document</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="rounded-md border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            ref={urlRef}
            type="url"
            placeholder="https://drive.google.com/... or direct PDF/image URL"
            className="flex-1 rounded-md border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
          />
          <button
            onClick={upload}
            disabled={uploading}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Submit"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Paste a public URL to your document. Admin reviews within 1-3 business days.
        </p>
      </section>

      {/* Document list */}
      {!docs && !error && <p className="text-sm text-slate-400">Loading…</p>}
      {docs && docs.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-400">
          No documents yet. Upload your first credential above.
        </div>
      )}
      {docs && docs.length > 0 && (
        <ul className="space-y-3">
          {docs.map((doc) => {
            const typeLabel = DOC_TYPES.find((t) => t.value === doc.docType)?.label ?? doc.docType;
            return (
              <li key={doc.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📄</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{typeLabel}</p>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-emerald-400 hover:underline"
                      >
                        View document ↗
                      </a>
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[doc.status] ?? "border-white/10 text-slate-400"}`}
                  >
                    {doc.status}
                  </span>
                </div>
                {doc.rejectReason && (
                  <p className="mt-2 text-xs text-rose-300">Reason: {doc.rejectReason}</p>
                )}
                <p className="mt-1 text-[10px] text-slate-600">
                  Submitted {new Date(doc.createdAt).toLocaleDateString()}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
