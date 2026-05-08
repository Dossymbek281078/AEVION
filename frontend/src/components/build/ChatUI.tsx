"use client";

import { useEffect, useRef, useState } from "react";
import { buildApi, type BuildMessage } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";
import {
  googleCalendarLink,
  outlookCalendarLink,
  icsBlob,
  interviewBlurb,
  type InterviewDraft,
} from "@/lib/build/calendar";

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
        {messages.map((m, idx) => {
          const mine = me?.id === m.senderId;
          // Show explicit "Read" label only on the LAST own message in the
          // thread — beyond that the ✓✓ tick is enough signal and the label
          // would be repetitive.
          const lastMineIdx = (() => {
            for (let i = messages.length - 1; i >= 0; i--) {
              if (messages[i].senderId === me?.id) return i;
            }
            return -1;
          })();
          const showReadLabel = mine && idx === lastMineIdx && !!m.readAt;
          const readTooltip = m.readAt
            ? `Read ${new Date(m.readAt).toLocaleString()}`
            : "Sent";
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-[80%]">
                <div
                  className={`rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? "bg-emerald-500 text-emerald-950"
                      : "bg-white/10 text-slate-100"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  <div className="mt-1 flex items-center gap-1 text-[10px] opacity-60">
                    <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    {mine && m.readAt && <span title={readTooltip}>✓✓</span>}
                    {mine && !m.readAt && <span title="Sent">✓</span>}
                  </div>
                </div>
                {showReadLabel && (
                  <div className="mt-0.5 pr-1 text-right text-[10px] text-emerald-300">
                    Read
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="border-t border-white/10 px-3 py-3">
        {error && <p className="mb-2 text-xs text-rose-300">{error}</p>}
        <ReplySuggestions
          peerId={peerId}
          // Re-fetch when the latest message arrives — but only when the peer's
          // last message is more recent than the suggestion fetch trigger.
          messageCount={messages.length}
          onPick={(text) => setDraft(text)}
        />
        <QuickTemplates onPick={(text) => setDraft((d) => (d ? `${d}\n\n${text}` : text))} />
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
          <ScheduleInterviewButton onInsert={(text) => setDraft((d) => (d ? `${d}\n\n${text}` : text))} />
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

function ScheduleInterviewButton({ onInsert }: { onInsert: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Interview · AEVION QBuild");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("14:00");
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState("");

  function buildDraft(): InterviewDraft | null {
    if (!date || !time) return null;
    const [hh, mm] = time.split(":").map(Number);
    const [yy, mo, dd] = date.split("-").map(Number);
    if (!yy || !mo || !dd || isNaN(hh) || isNaN(mm)) return null;
    return {
      title: title.trim() || "Interview",
      startsAt: new Date(yy, mo - 1, dd, hh, mm, 0),
      durationMinutes: Math.max(10, Math.min(240, duration)),
      location: location.trim() || undefined,
    };
  }

  function insertSnippet() {
    const d = buildDraft();
    if (!d) return;
    const links = { google: googleCalendarLink(d), outlook: outlookCalendarLink(d) };
    onInsert(interviewBlurb(d, links));
    setOpen(false);
  }

  function downloadIcs() {
    const d = buildDraft();
    if (!d) return;
    const blob = icsBlob(d);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${d.title.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 40)}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Generate calendar links for an interview slot"
        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-slate-200 hover:bg-white/10"
      >
        📅
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-20 mb-2 w-72 rounded-lg border border-white/10 bg-slate-900 p-3 shadow-2xl">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Schedule interview
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="mb-1.5 w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-slate-500"
          />
          <div className="mb-1.5 grid grid-cols-2 gap-1.5">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
            />
          </div>
          <div className="mb-1.5 flex items-center gap-2 text-xs">
            <label className="text-slate-400">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs text-white"
            >
              <option value={15}>15m</option>
              <option value={30}>30m</option>
              <option value={45}>45m</option>
              <option value={60}>60m</option>
              <option value={90}>90m</option>
            </select>
          </div>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (Zoom URL or address)"
            className="mb-2 w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-slate-500"
          />
          <div className="flex justify-between gap-1.5">
            <button
              type="button"
              onClick={downloadIcs}
              disabled={!buildDraft()}
              className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10 disabled:opacity-50"
            >
              .ics
            </button>
            <button
              type="button"
              onClick={insertSnippet}
              disabled={!buildDraft()}
              className="rounded-md bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              Insert in message
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReplySuggestions({
  peerId,
  messageCount,
  onPick,
}: {
  peerId: string;
  messageCount: number;
  onPick: (text: string) => void;
}) {
  const [items, setItems] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  async function load() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await buildApi.aiDmSuggest(peerId);
      setItems(r.suggestions);
      setCollapsed(false);
    } catch {
      setItems([]);
    } finally {
      setBusy(false);
    }
  }

  // Reset suggestions whenever a new message lands or peer changes — they're
  // stale relative to the latest turn.
  useEffect(() => {
    setItems(null);
    setCollapsed(true);
  }, [peerId, messageCount]);

  if (collapsed) {
    return (
      <div className="mb-2 flex items-center justify-end">
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-50"
          title="Generate 3 reply ideas based on the recent thread"
        >
          {busy ? "…" : "🤖 Suggest reply"}
        </button>
      </div>
    );
  }

  if (!items || items.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {items.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(s)}
          className="max-w-full truncate rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-100 hover:bg-cyan-400/20"
          title={s}
        >
          {s.length > 80 ? s.slice(0, 78) + "…" : s}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setCollapsed(true)}
        className="text-[10px] text-slate-500 hover:text-slate-300"
      >
        ✕
      </button>
    </div>
  );
}

const QUICK_TEMPLATES: { emoji: string; label: string; body: string }[] = [
  {
    emoji: "🙏",
    label: "Politely decline",
    body: "Спасибо, что откликнулись. К сожалению, в этот раз мы выбрали другого кандидата. Будем рады рассмотреть ваше резюме на следующих позициях.",
  },
  {
    emoji: "⏳",
    label: "Will get back",
    body: "Спасибо за отклик. Мы вернёмся к вам с обратной связью в течение 48 часов.",
  },
  {
    emoji: "📞",
    label: "Schedule call",
    body: "Здравствуйте! Готов созвониться, чтобы обсудить детали. Какое время вам удобно — сегодня или завтра до 18:00?",
  },
];

function QuickTemplates({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {QUICK_TEMPLATES.map((t) => (
        <button
          key={t.label}
          type="button"
          onClick={() => onPick(t.body)}
          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-slate-300 transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-100"
          title={t.body}
        >
          {t.emoji} {t.label}
        </button>
      ))}
    </div>
  );
}
