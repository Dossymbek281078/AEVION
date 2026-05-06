"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";
import { useToast } from "@/components/build/Toast";

type Key = Awaited<ReturnType<typeof buildApi.adminListPartnerKeys>>["items"][number];
type UsageItem = Awaited<ReturnType<typeof buildApi.adminPartnerKeysUsage>>["items"][number];

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
  const [usage, setUsage] = useState<Map<string, UsageItem> | null>(null);
  const [windowDays, setWindowDays] = useState(14);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<{ label: string; plaintext: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load() {
    try {
      const [keys, u] = await Promise.all([
        buildApi.adminListPartnerKeys(),
        buildApi.adminPartnerKeysUsage().catch(() => null),
      ]);
      setItems(keys.items);
      if (u) {
        setWindowDays(u.windowDays);
        setUsage(new Map(u.items.map((it) => [it.keyId, it])));
      }
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

  async function rotate(id: string) {
    if (!confirm("Rotate this key? Old key revokes immediately, new key with the same label is minted. Copy the plaintext on the next screen.")) return;
    try {
      const r = await buildApi.adminRotatePartnerKey(id);
      setFreshKey({ label: r.label, plaintext: r.plaintext });
      toast.success("Key rotated — copy the new plaintext");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function bulkRevoke() {
    const ids = Array.from(selected);
    if (ids.length === 0 || bulkBusy) return;
    if (!confirm(`Revoke ${ids.length} key${ids.length === 1 ? "" : "s"}? This action is per-key idempotent but cannot be undone.`)) return;
    setBulkBusy(true);
    let ok = 0;
    for (const id of ids) {
      try {
        await buildApi.adminRevokePartnerKey(id);
        ok++;
      } catch {
        /* keep going */
      }
    }
    toast.success(`Revoked ${ok} of ${ids.length}`);
    setSelected(new Set());
    setBulkBusy(false);
    await load();
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

      {items && items.length > 0 && selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          <span className="font-semibold">
            {selected.size} key{selected.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-rose-200 hover:text-white"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={bulkRevoke}
              disabled={bulkBusy}
              className="rounded-md border border-rose-500/40 bg-rose-500/20 px-2.5 py-1 font-semibold hover:bg-rose-500/30 disabled:opacity-50"
            >
              {bulkBusy ? "…" : `Revoke ${selected.size}`}
            </button>
          </div>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-2 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={
                      items != null &&
                      items.filter((k) => !k.revokedAt).length > 0 &&
                      items.filter((k) => !k.revokedAt).every((k) => selected.has(k.id))
                    }
                    onChange={(e) => {
                      if (!items) return;
                      if (e.target.checked) {
                        setSelected(new Set(items.filter((k) => !k.revokedAt).map((k) => k.id)));
                      } else {
                        setSelected(new Set());
                      }
                    }}
                    className="accent-emerald-400"
                    aria-label="Select all active keys"
                  />
                </th>
                <th className="px-3 py-2 text-left font-semibold">Label</th>
                <th className="px-3 py-2 text-left font-semibold">Last {windowDays}d</th>
                <th className="px-3 py-2 text-right font-semibold">Calls</th>
                <th className="px-3 py-2 text-right font-semibold">Last used</th>
                <th className="px-3 py-2 text-right font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((k) => (
                <tr key={k.id} className="border-t border-white/5">
                  <td className="px-2 py-2">
                    {!k.revokedAt && (
                      <input
                        type="checkbox"
                        checked={selected.has(k.id)}
                        onChange={() => toggleSelect(k.id)}
                        className="accent-emerald-400"
                        aria-label={`Select ${k.label}`}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-slate-200">{k.label}</div>
                    <div className="font-mono text-[10px] text-slate-500">id: {k.id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-3 py-2">
                    <UsageSparkline days={usage?.get(k.id)?.days || []} window={windowDays} />
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
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => rotate(k.id)}
                          className="text-[11px] text-amber-300 hover:text-amber-200"
                          title="Revoke + mint new key with same label"
                        >
                          ↻ Rotate
                        </button>
                        <button
                          onClick={() => revoke(k.id)}
                          className="text-[11px] text-rose-300 hover:text-rose-200"
                        >
                          Revoke
                        </button>
                      </div>
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

function UsageSparkline({ days, window }: { days: { day: string; hits: number }[]; window: number }) {
  // Build a complete N-day series anchored to today, filling missing days with 0.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const map = new Map(days.map((d) => [d.day, d.hits]));
  const series: { day: string; hits: number }[] = [];
  for (let i = window - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400_000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    series.push({ day: key, hits: Number(map.get(key) ?? 0) });
  }

  const max = Math.max(1, ...series.map((p) => p.hits));
  const total = series.reduce((s, p) => s + p.hits, 0);

  if (total === 0) {
    return <div className="text-[10px] text-slate-600">no traffic</div>;
  }

  const W = 110;
  const H = 24;
  const dx = series.length > 1 ? W / (series.length - 1) : W;
  const points = series.map((p, i) => {
    const x = i * dx;
    const y = H - (p.hits / max) * (H - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <div className="flex items-center gap-2">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="overflow-visible"
        role="img"
        aria-label={`Daily hits over the last ${window} days, total ${total}`}
      >
        <polyline
          fill="none"
          stroke="#34d399"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points.join(" ")}
        />
        {series.map((p, i) => (
          <circle
            key={p.day}
            cx={i * dx}
            cy={H - (p.hits / max) * (H - 2) - 1}
            r={p.hits > 0 ? 1.5 : 0}
            fill="#34d399"
          >
            <title>{`${p.day}: ${p.hits} hit${p.hits === 1 ? "" : "s"}`}</title>
          </circle>
        ))}
      </svg>
      <span className="tabular-nums text-[10px] text-slate-500">Σ {total}</span>
    </div>
  );
}
