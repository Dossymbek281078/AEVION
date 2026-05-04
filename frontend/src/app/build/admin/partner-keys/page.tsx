"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";
import { useToast } from "@/components/build/Toast";

type Key = Awaited<ReturnType<typeof buildApi.adminListPartnerKeys>>["items"][number];

export default function PartnerKeysPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Body />
      </RequireAuth>
    </BuildShell>
  );
}

function Body() {
  const user = useBuildAuth((s) => s.user);
  const toast = useToast();
  const [items, setItems] = useState<Key[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<{ label: string; plaintext: string } | null>(null);

  async function load() {
    try {
      const r = await buildApi.adminListPartnerKeys();
      setItems(r.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    if (user?.role === "ADMIN") load();
  }, [user?.role]);

  if (user && user.role !== "ADMIN") {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 text-sm text-rose-200">
        Only ADMIN accounts can manage partner API keys.
      </div>
    );
  }

  async function create() {
    if (label.trim().length < 2) {
      toast.error("Label is too short");
      return;
    }
    setCreating(true);
    try {
      const r = await buildApi.adminCreatePartnerKey(label.trim());
      setFreshKey({ label: r.label, plaintext: r.plaintext });
      setLabel("");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this key? Partners using it will start failing immediately.")) return;
    try {
      await buildApi.adminRevokePartnerKey(id);
      toast.success("Key revoked");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <Link href="/build/admin" className="text-xs text-slate-400 hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Partner API keys</h1>
        <p className="mt-1 text-xs text-slate-400">
          Read-only access to the public vacancies feed at{" "}
          <code className="rounded bg-white/5 px-1 py-0.5">/api/build/public/v1/vacancies</code>.
          Send the key in the <code className="rounded bg-white/5 px-1 py-0.5">X-Build-Key</code> header.
        </p>
      </header>

      <details className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-xs">
        <summary className="cursor-pointer font-semibold text-emerald-200">
          Drop-in widget (auto-renders feed on a partner site)
        </summary>
        <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-2 font-mono text-[11px] text-slate-200">{`<div data-aevion-build
     data-key="qb_pk_..."
     data-limit="6"
     data-city="Astana"
     data-skill="welding"></div>
<script src="https://aevion.tech/api/build/public/widget.js" defer></script>`}</pre>
        <p className="mt-2 text-slate-400">
          One <code className="rounded bg-white/5 px-1 py-0.5">&lt;script&gt;</code>, no framework
          deps, no bundler. The widget queries the public feed using the key you provide and
          renders a styled list of open roles.
        </p>
      </details>

      {error && (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Mint a new key
        </h2>
        <div className="flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. Acme Construction syndication)"
            className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
          />
          <button
            onClick={create}
            disabled={creating || label.trim().length < 2}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {creating ? "…" : "Create key"}
          </button>
        </div>
        {freshKey && (
          <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-200">
              ⚠ Copy now — this is the only time the plaintext is shown.
            </div>
            <div className="mt-1 text-xs text-slate-300">{freshKey.label}</div>
            <pre className="mt-2 overflow-x-auto rounded bg-black/40 px-2 py-1.5 font-mono text-[11px] text-amber-100">
              {freshKey.plaintext}
            </pre>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(freshKey.plaintext);
                  toast.success("Copied");
                } catch {
                  toast.error("Clipboard blocked");
                }
              }}
              className="mt-2 rounded-md bg-amber-500/20 px-3 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/30"
            >
              Copy plaintext
            </button>
          </div>
        )}
      </div>

      {!items && !error && <p className="text-sm text-slate-400">Loading…</p>}

      {items && items.length === 0 && (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-400">
          No partner keys yet. Mint one above to grant a partner site read access to the feed.
        </p>
      )}

      {items && items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Label</th>
                <th className="px-3 py-2 text-right font-semibold">Calls</th>
                <th className="px-3 py-2 text-right font-semibold">Last used</th>
                <th className="px-3 py-2 text-right font-semibold">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((k) => (
                <tr key={k.id} className="border-t border-white/5">
                  <td className="px-3 py-2">
                    <div className="text-slate-200">{k.label}</div>
                    <div className="font-mono text-[10px] text-slate-500">id: {k.id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{k.usageCount}</td>
                  <td className="px-3 py-2 text-right text-[11px] text-slate-400">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("ru-RU") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {k.revokedAt ? (
                      <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] text-rose-200">
                        revoked
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
                        active
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!k.revokedAt && (
                      <button
                        onClick={() => revoke(k.id)}
                        className="text-[11px] text-rose-300 hover:text-rose-200"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
