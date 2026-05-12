"use client";
import { apiUrl } from "@/lib/apiBase";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Turn {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  conversationId?: string;
}

interface SharedConversation {
  conversation: {
    id: string;
    title: string;
    createdAt: string;
  };
  turns: Turn[];
}

function fmtDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SharedConversationPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [data, setData] = useState<SharedConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch(apiUrl(`/api/multichat/shared/${encodeURIComponent(token)}`));
      if (r.status === 404) {
        setError("Эта ссылка не найдена или была отозвана автором.");
        return;
      }
      if (!r.ok) {
        setError(`Ошибка ${r.status}`);
        return;
      }
      setData(await r.json());
    } catch {
      setError("Не удалось загрузить");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-500 text-sm">Загрузка...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-3">
          <div className="text-4xl">🔗</div>
          <h1 className="text-xl font-bold">Ссылка недоступна</h1>
          <p className="text-sm text-slate-400">{error}</p>
          <Link
            href="/multichat-engine"
            className="inline-block mt-4 px-4 py-2 bg-violet-700 hover:bg-violet-600 rounded-lg text-sm"
          >
            Открыть Multichat
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Group turns by agent (conversationId pattern: `${convId}:${agentId}`)
  const byAgent = new Map<string, Turn[]>();
  const userTurns: Turn[] = [];
  for (const t of data.turns) {
    if (t.role === "user") {
      userTurns.push(t);
      continue;
    }
    const cid = t.conversationId ?? "";
    const agentId = cid.includes(":") ? cid.split(":")[1] : "agent";
    const arr = byAgent.get(agentId) ?? [];
    arr.push(t);
    byAgent.set(agentId, arr);
  }
  const agents = [...byAgent.keys()];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/multichat-engine" className="text-slate-400 hover:text-white text-sm">
            AEVION Multichat
          </Link>
          <span className="text-slate-600">·</span>
          <h1 className="text-sm font-bold truncate max-w-md">{data.conversation.title}</h1>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900 text-emerald-300 font-semibold">
          PUBLIC SHARE
        </span>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="text-xs text-slate-500">
          Чат создан {fmtDate(data.conversation.createdAt)} · только просмотр (read-only)
        </div>

        {userTurns.map((u, idx) => (
          <div key={idx} className="space-y-3">
            <div className="bg-violet-900/30 border border-violet-800 rounded-xl p-4">
              <div className="text-[10px] uppercase font-bold text-violet-300 mb-1">
                User · {fmtDate(u.createdAt)}
              </div>
              <div className="text-sm whitespace-pre-wrap">{u.content}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {agents.map(a => {
                const turn = (byAgent.get(a) ?? [])[idx];
                if (!turn) return null;
                return (
                  <div
                    key={a}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4"
                  >
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                      Agent: {a}
                    </div>
                    <div className="text-sm whitespace-pre-wrap text-slate-200">
                      {turn.content}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="text-center pt-8 border-t border-slate-800">
          <p className="text-xs text-slate-600 mb-3">Powered by AEVION Multichat Engine</p>
          <Link
            href="/multichat-engine"
            className="inline-block px-4 py-2 bg-violet-700 hover:bg-violet-600 rounded-lg text-sm font-semibold"
          >
            Создать свой multichat →
          </Link>
        </div>
      </div>
    </div>
  );
}
