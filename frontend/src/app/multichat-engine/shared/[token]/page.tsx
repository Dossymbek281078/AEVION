"use client";
import { apiUrl } from "@/lib/apiBase";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { T } from "../../theme";
import { agentFailure } from "../../failureText";

// Публичная страница расшаренного консилиума — единственный экран модуля,
// который открывает ПОСТОРОННИЙ человек по ссылке.
//
// До 12.08.2026 она осталась на тёмных классах Tailwind (`bg-slate-950`,
// `text-slate-400`, фиолетовые акценты), хотя весь модуль 26–27.07 перевели на
// светлый газетный эталон AEVION и на токены ./theme. То есть первое, что видел
// приглашённый, выглядело как другой продукт. Токенов сторож не проверял: он
// ищет сырые hex-литералы, а имя класса Tailwind для него не цвет — поэтому
// расхождение и жило молча.
//
// Стиль здесь инлайновый и через T, как в остальном модуле: два способа
// красить одну зону разъезжаются на первой же смене темы.

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

/** Экран во всю высоту с одним сообщением по центру — загрузка и отказ. */
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.canvas,
        color: T.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
      }}
    >
      {children}
    </div>
  );
}

const linkButton: React.CSSProperties = {
  display: "inline-block",
  marginTop: 16,
  padding: "10px 18px",
  background: T.btnAccentBg,
  color: T.onAccent,
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  textDecoration: "none",
};

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
        // Голое «Ошибка 429» человеку ничего не говорит и звучит как его вина.
        const body = (await r.json().catch(() => null)) as { error?: unknown } | null;
        setError(agentFailure(body?.error ?? `upstream ${r.status}`).human);
        return;
      }
      setData(await r.json());
    } catch {
      setError("Не удалось загрузить страницу. Проверьте соединение и обновите её.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Centered>
        <p style={{ color: T.textMute, fontSize: 14 }}>Загрузка…</p>
      </Centered>
    );
  }

  if (error) {
    return (
      <Centered>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>🔗</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "10px 0 6px", color: T.text }}>
            Ссылка недоступна
          </h1>
          <p style={{ fontSize: 14, color: T.textMute, lineHeight: 1.6, margin: 0 }}>{error}</p>
          <Link href="/multichat-engine" style={linkButton}>
            Открыть Мультичат
          </Link>
        </div>
      </Centered>
    );
  }

  if (!data) return null;

  // Ответы сгруппированы по агенту: conversationId приходит как `${convId}:${agentId}`.
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
          borderBottom: `1px solid ${T.line}`,
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Link href="/multichat-engine" style={{ color: T.textMute, fontSize: 14, textDecoration: "none" }}>
            AEVION Мультичат
          </Link>
          <span style={{ color: T.textFaded }}>·</span>
          <h1
            style={{
              fontSize: 14,
              fontWeight: 700,
              margin: 0,
              color: T.text,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 420,
            }}
          >
            {data.conversation.title}
          </h1>
        </div>
        <span
          style={{
            fontSize: 10,
            padding: "3px 8px",
            borderRadius: 999,
            background: T.surfaceSoft,
            color: T.textMute,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          Открытая ссылка
        </span>
      </header>

      <div style={{ maxWidth: 1024, margin: "0 auto", padding: "32px 24px", display: "grid", gap: 24 }}>
        <div style={{ fontSize: 12, color: T.textFaded }}>
          Создано {fmtDate(data.conversation.createdAt)} · только просмотр, менять нельзя
        </div>

        {userTurns.map((u, idx) => (
          <div key={idx} style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                background: T.surfaceSoft,
                border: `1px solid ${T.line}`,
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  fontWeight: 700,
                  color: T.textMute,
                  marginBottom: 6,
                }}
              >
                Вопрос · {fmtDate(u.createdAt)}
              </div>
              <div style={{ fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.65, color: T.text }}>
                {u.content}
              </div>
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              {agents.map((a) => {
                const turn = (byAgent.get(a) ?? [])[idx];
                if (!turn) return null;
                return (
                  <div
                    key={a}
                    style={{
                      background: T.surface,
                      border: `1px solid ${T.lineSoft}`,
                      borderRadius: 12,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        fontWeight: 700,
                        color: T.textFaded,
                        marginBottom: 6,
                      }}
                    >
                      Агент: {a}
                    </div>
                    <div style={{ fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.65, color: T.textDim }}>
                      {turn.content}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ textAlign: "center", paddingTop: 28, borderTop: `1px solid ${T.lineSoft}` }}>
          <p style={{ fontSize: 12, color: T.textFaded, margin: "0 0 4px" }}>
            Сделано в AEVION Мультичат
          </p>
          <Link href="/multichat-engine" style={linkButton}>
            Собрать свой консилиум →
          </Link>
        </div>
      </div>
    </div>
  );
}
