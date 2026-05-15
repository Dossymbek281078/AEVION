"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

type Message = {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  authorName: string | null;
  authorPhoto: string | null;
  buildRole: string | null;
};

type Community = {
  id: string;
  slug: string;
  name: string;
  specialty: string;
  memberCount: number;
};

export default function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const user = useBuildAuth((s) => s.user);
  const token = useBuildAuth((s) => s.token);
  const [community, setCommunity] = useState<Community | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [joined, setJoined] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function load() {
    buildApi.community(slug).then((r) => {
      setCommunity(r.community);
      setMessages(r.messages);
    }).catch(() => {});
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5000); // poll every 5s
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await buildApi.sendCommunityMessage(slug, content.trim());
      setContent("");
      load();
    } catch {
      setError("Ошибка отправки. Попробуйте ещё раз.");
    } finally {
      setSending(false);
    }
  }

  async function handleJoin() {
    await buildApi.joinCommunity(slug);
    setJoined(true);
    load();
  }

  const ROLE_COLOR: Record<string, string> = {
    WORKER: "text-emerald-400",
    CLIENT: "text-sky-400",
    ADMIN: "text-fuchsia-400",
  };

  return (
    <BuildShell>
      <div className="flex h-[calc(100vh-12rem)] flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/build/communities" className="text-xs text-slate-400 hover:text-white">
              ← Все комьюнити
            </Link>
            <h1 className="mt-1 text-xl font-bold text-white">
              {community?.name ?? slug}
            </h1>
            {community && (
              <p className="text-xs text-slate-400">
                {community.specialty} · {community.memberCount} участников
              </p>
            )}
          </div>
          {token && !joined && (
            <button
              onClick={() => void handleJoin()}
              className="rounded-lg bg-teal-500/20 px-4 py-2 text-sm font-medium text-teal-200 hover:bg-teal-500/30"
            >
              Вступить
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 rounded-xl border border-white/10 bg-slate-900/50 p-4">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-8">Пока нет сообщений. Начните разговор!</p>
          ) : (
            messages.map((m) => {
              const isMe = m.userId === user?.id;
              return (
                <div key={m.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                  {m.authorPhoto ? (
                    <img src={m.authorPhoto} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white">
                      {(m.authorName ?? "?")[0]}
                    </div>
                  )}
                  <div className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                    <p className={`text-[10px] ${ROLE_COLOR[m.buildRole ?? ""] ?? "text-slate-400"}`}>
                      {m.authorName ?? "Пользователь"}
                      {m.buildRole && ` · ${m.buildRole}`}
                    </p>
                    <div className={`rounded-xl px-3 py-2 text-sm ${isMe ? "bg-teal-500/20 text-teal-100" : "bg-white/10 text-slate-100"}`}>
                      {m.content}
                    </div>
                    <p className="text-[10px] text-slate-600">
                      {new Date(m.createdAt).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {token ? (
          <form onSubmit={(e) => void send(e)} className="flex gap-2">
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Написать сообщение…"
              maxLength={2000}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <button
              type="submit"
              disabled={sending || !content.trim()}
              className="rounded-xl bg-teal-500 px-5 py-2.5 text-sm font-bold text-teal-950 hover:bg-teal-400 disabled:opacity-50"
            >
              {sending ? "…" : "↑"}
            </button>
          </form>
        ) : (
          <p className="text-center text-sm text-slate-500">
            <Link href="/build/profile" className="text-teal-400 underline">Войдите</Link> чтобы писать в чат
          </p>
        )}
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    </BuildShell>
  );
}
