"use client";

// Публичный просмотр беседы по ссылке.
//
// Самый внешний экран модуля: его открывает человек, у которого нет ни
// аккаунта, ни подписки, — и часто это первое, что он вообще видит про
// AEVION. До 2026-08-11 страница оставалась тёмной, хотя весь модуль
// переведён на светлый газетный эталон 2026-07-27: получатель ссылки попадал
// как будто в другой продукт.
//
// Цвета — только через токены ../../theme: контраст проверяется тестом
// scripts/multichat-contrast.test.mjs, а сырой литерал проверка не видит.

import { apiUrl } from "@/lib/apiBase";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { T } from "../../theme";

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

  const screen = {
    minHeight: "100vh",
    background: T.canvas,
    color: T.text,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  } as const;

  if (loading) {
    return (
      <div style={screen}>
        <p style={{ color: T.textMute, fontSize: 14 }}>Загрузка…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={screen}>
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 8px", color: T.text }}>
            Ссылка недоступна
          </h1>
          <p style={{ fontSize: 15, color: T.textMute, lineHeight: 1.6, margin: 0 }}>{error}</p>
          <Link
            href="/multichat-engine"
            style={{
              display: "inline-block", marginTop: 20, background: T.btnAccentBg,
              color: T.onAccentDeep, borderRadius: 10, padding: "9px 18px",
              fontSize: 14, fontWeight: 600, textDecoration: "none",
            }}
          >
            Открыть Мультичат
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
    <div style={{ minHeight: "100vh", background: T.canvas, color: T.text }}>
      <header
        style={{
          borderBottom: `1px solid ${T.lineSoft}`, padding: "14px 24px", display: "flex",
          alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
          <Link href="/multichat-engine" style={{ color: T.textMute, fontSize: 14, textDecoration: "none" }}>
            AEVION Мультичат
          </Link>
          <span style={{ color: T.textFaded }}>·</span>
          <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {data.conversation.title}
          </h1>
        </div>
        <span style={{ fontSize: 12, color: T.textMute, border: `1px solid ${T.lineSoft}`, borderRadius: 999, padding: "2px 10px" }}>
          Только просмотр
        </span>
      </header>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: 24, display: "grid", gap: 22 }}>
        <p style={{ fontSize: 13, color: T.textFaded, margin: 0 }}>
          Беседа создана {fmtDate(data.conversation.createdAt)}. Ответы агентов показаны рядом
          намеренно: там, где они разошлись, и надо смотреть в первую очередь.
        </p>

        {userTurns.map((u, idx) => (
          <div key={idx} style={{ display: "grid", gap: 12 }}>
            <div style={{ background: T.surfaceSoft, border: `1px solid ${T.lineSoft}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: T.textFaded, marginBottom: 6 }}>
                Вопрос · {fmtDate(u.createdAt)}
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.65, whiteSpace: "pre-wrap", color: T.text }}>{u.content}</div>
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              {agents.map(a => {
                const turn = (byAgent.get(a) ?? [])[idx];
                if (!turn) return null;
                // Не ответивший агент попадает в ленту как system-реплика —
                // показываем это прямо, иначе на его месте была бы пустота и
                // читатель решил бы, что агентов было меньше.
                const failed = turn.role === "system";
                return (
                  <article key={a} style={{ background: T.surface, border: `1px solid ${T.lineSoft}`, borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: T.textFaded, marginBottom: 8 }}>
                      {a}
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap", color: failed ? T.warn : T.textDim }}>
                      {failed ? "агент не ответил" : turn.content}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ textAlign: "center", paddingTop: 24, borderTop: `1px solid ${T.lineSoft}` }}>
          <p style={{ fontSize: 13, color: T.textFaded, margin: "0 0 12px" }}>
            Это ответ консилиума AEVION — три роли отвечают независимо, и разногласие видно сразу.
          </p>
          <Link
            href="/multichat-engine"
            style={{
              display: "inline-block", background: T.btnAccentBg, color: T.onAccentDeep,
              borderRadius: 10, padding: "9px 18px", fontSize: 14, fontWeight: 600, textDecoration: "none",
            }}
          >
            Спросить свой консилиум →
          </Link>
        </div>
      </div>
    </div>
  );
}
