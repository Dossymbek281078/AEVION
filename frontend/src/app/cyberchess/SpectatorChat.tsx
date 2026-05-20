"use client";

/**
 * SpectatorChat — embedded live chat for CyberChess spectator viewer.
 *
 * - Loads recent messages on mount via GET /api/cyberchess-spectator/chat/:gameId
 * - Opens its own EventSource subscription for the "chat" event (separate
 *   connection from the parent's game-state EventSource — keeps this widget
 *   fully self-contained).
 * - POSTs new messages, handles rate-limit/validation errors gracefully.
 * - Stores display name in localStorage under `cc_chat_username_v1`.
 */

import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  author: string;
  text: string;
  ts: number;
  isHost?: boolean;
};

interface Props {
  gameId: string;
  hostName?: string;
  isHost?: boolean;
  surface1: string;
  surface2: string;
  border: string;
  text: string;
  textDim: string;
  brand: string;
}

const LS_USERNAME = "cc_chat_username_v1";
const MAX_TEXT = 200;

function emojiForAuthor(name: string): string {
  // Stable pseudo-random emoji based on author name hash.
  const POOL = [
    "🦊",
    "🐺",
    "🐻",
    "🐼",
    "🐯",
    "🦁",
    "🐸",
    "🐧",
    "🦉",
    "🐵",
    "🦄",
    "🐲",
    "🐙",
    "🦈",
    "🐝",
    "🦋",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return POOL[Math.abs(h) % POOL.length];
}

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "только что";
  if (sec < 60) return `${sec} сек`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч`;
  const day = Math.floor(hr / 24);
  return `${day} дн`;
}

export default function SpectatorChat(props: Props) {
  const {
    gameId,
    hostName,
    isHost = false,
    surface1,
    surface2,
    border,
    text,
    textDim,
    brand,
  } = props;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [username, setUsername] = useState("");
  const [usernameEditing, setUsernameEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [, forceRerender] = useState(0);

  const listRef = useRef<HTMLDivElement | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // Load username from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const v = window.localStorage.getItem(LS_USERNAME);
      if (v && v.trim()) setUsername(v.trim().slice(0, 32));
    } catch {
      /* ignore */
    }
  }, []);

  // Tick re-render every 30s so relative timestamps refresh
  useEffect(() => {
    const t = setInterval(() => forceRerender((n) => (n + 1) & 0xfff), 30_000);
    return () => clearInterval(t);
  }, []);

  // Initial load + SSE subscription for "chat" event
  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;

    (async () => {
      try {
        const r = await fetch(
          `/api/cyberchess-spectator/chat/${encodeURIComponent(gameId)}?limit=50`,
          { cache: "no-store" },
        );
        if (!r.ok) return;
        const data = await r.json();
        if (!cancelled && data?.ok && Array.isArray(data.messages)) {
          setMessages(data.messages as ChatMessage[]);
        }
      } catch {
        /* ignore initial-load errors */
      }
    })();

    const url = `/api/cyberchess-spectator/${encodeURIComponent(gameId)}`;
    const es = new EventSource(url);
    esRef.current = es;

    const onChat = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data) as ChatMessage;
        if (!msg || !msg.id) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          const next = [...prev, msg];
          if (next.length > 100) next.splice(0, next.length - 100);
          return next;
        });
      } catch {
        /* ignore */
      }
    };
    es.addEventListener("chat", onChat as any);

    return () => {
      cancelled = true;
      es.removeEventListener("chat", onChat as any);
      es.close();
      esRef.current = null;
    };
  }, [gameId]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const trimmedDraft = draft.trim();
  const canSend =
    !sending && trimmedDraft.length > 0 && trimmedDraft.length <= MAX_TEXT;

  const persistUsername = (name: string) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LS_USERNAME, name);
    } catch {
      /* ignore */
    }
  };

  const send = async () => {
    if (!canSend) return;
    let author = username.trim();
    if (!author) {
      author = `гость${Math.floor(Math.random() * 9000 + 1000)}`;
      setUsername(author);
      persistUsername(author);
    }
    setSending(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/cyberchess-spectator/chat/${encodeURIComponent(gameId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            author,
            text: trimmedDraft,
            isHost: isHost ? true : undefined,
          }),
        },
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.ok) {
        if (r.status === 429) {
          setError("слишком много сообщений · подожди минуту");
        } else if (data?.error === "bad_text") {
          setError("сообщение пустое или некорректное");
        } else if (data?.error === "bad_author") {
          setError("укажи имя");
        } else if (data?.error === "not_found") {
          setError("трансляция закончилась");
        } else {
          setError("не удалось отправить");
        }
        return;
      }
      setDraft("");
      // The broadcast SSE event will append the message — but if we get it
      // back from POST first, optimistically add (will be dedup'd by id).
      if (data?.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          const next = [...prev, data.message as ChatMessage];
          if (next.length > 100) next.splice(0, next.length - 100);
          return next;
        });
      }
    } catch {
      setError("сеть недоступна");
    } finally {
      setSending(false);
    }
  };

  const myName = username.trim().toLowerCase();

  return (
    <div
      style={{
        background: surface1,
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: text }}>
          Чат зрителей
        </div>
        <div style={{ fontSize: 11, color: textDim }}>
          {messages.length} {messages.length === 1 ? "сообщение" : "сообщений"}
        </div>
      </div>

      {/* Username row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: textDim,
        }}
      >
        <span>имя:</span>
        {usernameEditing ? (
          <>
            <input
              type="text"
              value={username}
              maxLength={32}
              autoFocus
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => {
                persistUsername(username.trim());
                setUsernameEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  persistUsername(username.trim());
                  setUsernameEditing(false);
                }
              }}
              style={{
                flex: 1,
                background: surface2,
                border: `1px solid ${border}`,
                borderRadius: 4,
                color: text,
                fontSize: 12,
                padding: "3px 6px",
                outline: "none",
              }}
            />
          </>
        ) : (
          <button
            onClick={() => setUsernameEditing(true)}
            style={{
              background: "transparent",
              border: "none",
              color: brand,
              fontSize: 11,
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {username || "выбрать"}
          </button>
        )}
      </div>

      {/* Message list */}
      <div
        ref={listRef}
        style={{
          maxHeight: 260,
          minHeight: 120,
          overflowY: "auto",
          background: surface2,
          border: `1px solid ${border}`,
          borderRadius: 8,
          padding: 8,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: textDim,
              textAlign: "center",
              padding: "16px 8px",
              fontStyle: "italic",
            }}
          >
            пока тишина · напиши первое сообщение
          </div>
        ) : (
          messages.map((m) => {
            const mine = myName && m.author.toLowerCase() === myName;
            const host =
              m.isHost === true ||
              (hostName && m.author.toLowerCase() === hostName.toLowerCase());
            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: mine ? "flex-end" : "flex-start",
                  gap: 2,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: textDim,
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  <span>{emojiForAuthor(m.author)}</span>
                  <span
                    style={{
                      color: host ? brand : textDim,
                      fontWeight: host ? 700 : 400,
                    }}
                  >
                    {host ? "👑 " : ""}
                    {m.author}
                  </span>
                  <span style={{ opacity: 0.6 }}>· {relativeTime(m.ts)}</span>
                </div>
                <div
                  style={{
                    background: mine
                      ? `${brand}22`
                      : host
                        ? `${brand}14`
                        : surface1,
                    border: `1px solid ${
                      mine ? brand : host ? brand : border
                    }`,
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: 13,
                    color: text,
                    maxWidth: "85%",
                    wordBreak: "break-word",
                    lineHeight: 1.35,
                  }}
                >
                  {m.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            fontSize: 11,
            color: "#f59e0b",
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.4)",
            borderRadius: 6,
            padding: "4px 8px",
          }}
        >
          {error}
        </div>
      )}

      {/* Input bar */}
      <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
        <input
          type="text"
          value={draft}
          maxLength={MAX_TEXT}
          placeholder="напиши сообщение…"
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          style={{
            flex: 1,
            background: surface2,
            border: `1px solid ${border}`,
            borderRadius: 6,
            color: text,
            fontSize: 13,
            padding: "8px 10px",
            outline: "none",
            minWidth: 0,
          }}
        />
        <button
          onClick={send}
          disabled={!canSend}
          style={{
            background: canSend ? brand : surface2,
            color: canSend ? "#0a0e1a" : textDim,
            border: `1px solid ${canSend ? brand : border}`,
            borderRadius: 6,
            padding: "0 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: canSend ? "pointer" : "not-allowed",
            opacity: canSend ? 1 : 0.6,
          }}
        >
          {sending ? "…" : "→"}
        </button>
      </div>

      <div
        style={{
          fontSize: 10,
          color: textDim,
          textAlign: "right",
          opacity: 0.7,
        }}
      >
        {draft.length}/{MAX_TEXT} · enter — отправить
      </div>
    </div>
  );
}
