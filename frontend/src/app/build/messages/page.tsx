"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { ChatUI } from "@/components/build/ChatUI";
import { buildApi, type BuildInboxRow } from "@/lib/build/api";

export default function MessagesPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <MessagesBody />
        </Suspense>
      </RequireAuth>
    </BuildShell>
  );
}

function MessagesBody() {
  const router = useRouter();
  const params = useSearchParams();
  const peerFromUrl = params.get("to");
  const [inbox, setInbox] = useState<BuildInboxRow[]>([]);
  const [active, setActive] = useState<string | null>(peerFromUrl);
  const [loading, setLoading] = useState(true);

  async function refreshInbox() {
    try {
      const r = await buildApi.inbox();
      setInbox(r.items);
      if (!active && r.items.length > 0) {
        setActive(r.items[0].peerId);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshInbox();
    const t = setInterval(refreshInbox, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectPeer(peerId: string) {
    setActive(peerId);
    router.replace(`/build/messages?to=${encodeURIComponent(peerId)}`);
  }

  const activePeer = inbox.find((p) => p.peerId === active);

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <aside className="rounded-xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Inbox</h2>
        </div>
        {loading && <p className="p-4 text-sm text-slate-400">Loading…</p>}
        {!loading && inbox.length === 0 && (
          <p className="p-4 text-sm text-slate-400">
            No conversations yet. Open a vacancy and message an applicant or owner from there.
          </p>
        )}
        <ul className="divide-y divide-white/5">
          {inbox.map((row) => (
            <li key={row.peerId}>
              <button
                onClick={() => selectPeer(row.peerId)}
                className={`w-full px-4 py-3 text-left transition ${
                  active === row.peerId ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-white">
                    {row.peerName || row.peerEmail || row.peerId.slice(0, 8)}
                  </span>
                  {row.unread > 0 && (
                    <span className="rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-emerald-950">
                      {row.unread}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{row.lastContent}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {new Date(row.lastAt).toLocaleString()}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section>
        {active ? (
          <ChatUI peerId={active} peerName={activePeer?.peerName || activePeer?.peerEmail} />
        ) : (
          <div className="flex h-[70vh] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm text-slate-400">
            Select a conversation to start chatting.
          </div>
        )}
      </section>
    </div>
  );
}
