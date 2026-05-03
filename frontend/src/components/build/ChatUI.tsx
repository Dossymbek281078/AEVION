"use client";

import { useEffect, useRef, useState } from "react";
import { buildApi, type BuildMessage } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

export function ChatUI({
  peerId,
  peerName,
}: {
  peerId: string;
  peerName?: string | null;
}) {
  const me = useBuildAuth((s) => s.user);
  const [messages, setMessages] = useState<BuildMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    try {
      const data = await buildApi.thread(peerId);
      setMessages(data.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setError(null);
    const text = draft.trim();
    setDraft("");
    try {
      const msg = await buildApi.send({ receiverId: peerId, content: text });
      setMessages((prev) => [...prev, msg]);
    } catch (e) {
      setError((e as Error).message);
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[70vh] min-h-[400px] flex-col rounded-xl border border-white/10 bg-white/5">
      <header className="border-b border-white/10 px-4 py-3">
        <div className="text-sm font-semibold text-white">{peerName || "Conversation"}</div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {loading && <p className="text-sm text-slate-400">Loading…</p>}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-slate-400">No messages yet — say hello.</p>
        )}
        {messages.map((m) => {
          const mine = me?.id === m.senderId;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  mine
                    ? "bg-emerald-500 text-emerald-950"
                    : "bg-white/10 text-slate-100"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                <div className="mt-1 flex items-center gap-1 text-[10px] opacity-60">
                  <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  {mine && m.readAt && <span title="Read">✓✓</span>}
                  {mine && !m.readAt && <span title="Sent">✓</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="border-t border-white/10 px-3 py-3">
        {error && <p className="mb-2 text-xs text-rose-300">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(e);
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Type a message…"
            className="flex-1 resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
