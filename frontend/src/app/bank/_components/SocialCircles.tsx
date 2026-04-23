"use client";

import { useEffect, useRef, useState } from "react";
import { useCircles } from "../_hooks/useCircles";
import * as contactsLib from "../_lib/contacts";
import type { Contact } from "../_lib/contacts";
import { useCurrency } from "../_lib/CurrencyContext";
import { formatCurrency } from "../_lib/currency";
import { formatRelative } from "../_lib/format";
import { absoluteRequestUrl } from "../_lib/paymentRequest";
import type { Circle } from "../_lib/circles";
import { btnSecondary, inputStyle } from "./formPrimitives";

type Notify = (msg: string, type?: "success" | "error" | "info") => void;

type Props = {
  myAccountId: string;
  myNickname: string;
  balance: number;
  send: (to: string, amount: number) => Promise<boolean>;
  notify: Notify;
};

export function SocialCircles({ myAccountId, myNickname, balance, send, notify }: Props) {
  const { items, add, remove, postMessage } = useCircles();
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [name, setName] = useState<string>("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setContacts(contactsLib.listContacts());
  }, [formOpen, items.length]);

  useEffect(() => {
    if (formOpen) nameInputRef.current?.focus();
  }, [formOpen]);

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const create = () => {
    if (!name.trim()) {
      notify("Give the circle a name", "error");
      return;
    }
    if (selectedIds.size === 0) {
      notify("Pick at least one member", "error");
      return;
    }
    const members = contacts
      .filter((c) => selectedIds.has(c.id))
      .map((c) => ({ accountId: c.id, nickname: c.nickname }));
    const c = add(name.trim(), members);
    notify(`"${c.name}" created`, "success");
    setName("");
    setSelectedIds(new Set());
    setFormOpen(false);
    setActiveId(c.id);
  };

  const active = items.find((c) => c.id === activeId) ?? null;

  return (
    <section
      style={{
        border: "1px solid rgba(15,23,42,0.1)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        background: "#fff",
      }}
      aria-labelledby="circles-heading"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <h2
          id="circles-heading"
          style={{ fontSize: 16, fontWeight: 900, margin: 0 }}
        >
          Circles · group chats + payments
          {items.length > 0 ? (
            <span
              style={{
                marginLeft: 10,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(219,39,119,0.12)",
                color: "#9d174d",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {items.length}
            </span>
          ) : null}
        </h2>
        <button
          onClick={() => setFormOpen((v) => !v)}
          aria-expanded={formOpen}
          aria-controls="circle-form"
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "none",
            background: formOpen ? "#64748b" : "linear-gradient(135deg, #db2777, #9d174d)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {formOpen ? "Cancel" : "+ New circle"}
        </button>
      </div>

      {formOpen ? (
        <div
          id="circle-form"
          style={{
            padding: 14,
            borderRadius: 12,
            border: "1px solid rgba(219,39,119,0.2)",
            background: "rgba(219,39,119,0.04)",
            marginBottom: 14,
            display: "grid",
            gap: 10,
          }}
        >
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Circle name</span>
            <input
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Trip crew, Roommates, Co-authors…"
              maxLength={60}
              style={inputStyle}
            />
          </label>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginBottom: 6 }}>
              Members ({selectedIds.size})
            </div>
            {contacts.length === 0 ? (
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                Add people to your address book first (via Send AEC form).
              </div>
            ) : (
              <div style={{ display: "grid", gap: 4, maxHeight: 160, overflowY: "auto" as const }}>
                {contacts.map((c) => {
                  const checked = selectedIds.has(c.id);
                  return (
                    <label
                      key={c.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: checked ? "1px solid rgba(219,39,119,0.3)" : "1px solid rgba(15,23,42,0.08)",
                        background: checked ? "rgba(219,39,119,0.04)" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMember(c.id)}
                      />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", flex: 1 }}>
                        {c.nickname}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setFormOpen(false)} style={btnSecondary}>
              Cancel
            </button>
            <button
              onClick={create}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #db2777, #9d174d)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Create
            </button>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div
          style={{
            padding: 20,
            textAlign: "center" as const,
            fontSize: 13,
            color: "#94a3b8",
            border: "1px dashed rgba(15,23,42,0.1)",
            borderRadius: 10,
          }}
        >
          No circles yet. Create one to group chat + pay with your collaborators.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <ul role="list" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4 }}>
            {items.map((c) => {
              const selected = c.id === activeId;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setActiveId(c.id)}
                    aria-pressed={selected}
                    style={{
                      width: "100%",
                      textAlign: "left" as const,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: selected ? "1px solid rgba(219,39,119,0.35)" : "1px solid rgba(15,23,42,0.08)",
                      background: selected ? "rgba(219,39,119,0.06)" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#0f172a",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      {c.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                      {c.members.length} members · {c.messages.length} messages
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          <div>
            {active ? (
              <CircleDetail
                circle={active}
                myAccountId={myAccountId}
                myNickname={myNickname}
                balance={balance}
                send={send}
                postMessage={postMessage}
                onDelete={() => {
                  if (confirm(`Delete circle "${active.name}"?`)) {
                    remove(active.id);
                    setActiveId(null);
                    notify("Circle deleted", "info");
                  }
                }}
                notify={notify}
              />
            ) : (
              <div
                style={{
                  padding: 24,
                  textAlign: "center" as const,
                  fontSize: 13,
                  color: "#94a3b8",
                  border: "1px dashed rgba(15,23,42,0.1)",
                  borderRadius: 10,
                }}
              >
                Select a circle to open chat.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function CircleDetail({
  circle,
  myAccountId,
  myNickname,
  balance,
  send,
  postMessage,
  onDelete,
  notify,
}: {
  circle: Circle;
  myAccountId: string;
  myNickname: string;
  balance: number;
  send: (to: string, amount: number) => Promise<boolean>;
  postMessage: (circleId: string, input: Parameters<ReturnType<typeof useCircles>["postMessage"]>[1]) => void;
  onDelete: () => void;
  notify: Notify;
}) {
  const [text, setText] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [recipientId, setRecipientId] = useState<string>(circle.members[0]?.accountId ?? "");
  const [busy, setBusy] = useState<boolean>(false);
  const { code } = useCurrency();
  const feedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [circle.messages.length]);

  const postText = () => {
    if (!text.trim()) return;
    postMessage(circle.id, {
      authorId: myAccountId,
      authorNickname: myNickname,
      kind: "text",
      text: text.trim(),
    });
    setText("");
  };

  const postSend = async () => {
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) {
      notify("Invalid amount", "error");
      return;
    }
    const rec = circle.members.find((m) => m.accountId === recipientId);
    if (!rec) {
      notify("Pick a recipient", "error");
      return;
    }
    if (n > balance) {
      notify("Insufficient funds", "error");
      return;
    }
    setBusy(true);
    const ok = await send(rec.accountId, n);
    setBusy(false);
    if (!ok) return;
    postMessage(circle.id, {
      authorId: myAccountId,
      authorNickname: myNickname,
      kind: "sent",
      text: `Sent ${formatCurrency(n, code)} to ${rec.nickname}`,
      amount: n,
      recipient: rec.accountId,
    });
    setAmount("");
    notify(`Sent ${formatCurrency(n, code)} to ${rec.nickname}`, "success");
  };

  const postRequest = () => {
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) {
      notify("Invalid amount", "error");
      return;
    }
    postMessage(circle.id, {
      authorId: myAccountId,
      authorNickname: myNickname,
      kind: "requested",
      text: `Requested ${formatCurrency(n, code)} from everyone`,
      amount: n,
      memo: circle.name,
    });
    setAmount("");
    notify("Request posted. Tap Copy link on the bubble to share.", "success");
  };

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(15,23,42,0.08)",
        background: "rgba(15,23,42,0.02)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{circle.name}</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            {circle.members.map((m) => m.nickname).join(" · ")}
          </div>
        </div>
        <button
          onClick={onDelete}
          aria-label={`Delete ${circle.name}`}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid rgba(220,38,38,0.2)",
            background: "#fff",
            color: "#991b1b",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Delete
        </button>
      </div>

      <div
        ref={feedRef}
        role="log"
        aria-live="polite"
        aria-label={`${circle.name} messages`}
        style={{
          padding: 10,
          borderRadius: 10,
          border: "1px solid rgba(15,23,42,0.06)",
          background: "#fff",
          maxHeight: 260,
          overflowY: "auto" as const,
          display: "grid",
          gap: 6,
        }}
      >
        {circle.messages.length === 0 ? (
          <div style={{ fontSize: 12, color: "#94a3b8", padding: "8px 0", textAlign: "center" as const }}>
            No messages yet. Say hi or send someone AEC.
          </div>
        ) : (
          circle.messages.map((m) => <Bubble key={m.id} msg={m} myAccountId={myAccountId} notify={notify} />)
        )}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") postText();
          }}
          placeholder="Type a message…"
          aria-label="Message"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={postText}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            background: "#0f172a",
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Post
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          aria-label="Recipient"
          style={{ ...inputStyle, flex: "1 1 120px", cursor: "pointer" }}
        >
          {circle.members.map((m) => (
            <option key={m.accountId} value={m.accountId}>
              {m.nickname}
            </option>
          ))}
        </select>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00 AEC"
          aria-label="Amount AEC"
          style={{ ...inputStyle, flex: "0 0 120px" }}
        />
        <button
          onClick={postSend}
          disabled={busy}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            background: busy ? "#94a3b8" : "#0f766e",
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "Sending…" : "Send"}
        </button>
        <button
          onClick={postRequest}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid rgba(219,39,119,0.3)",
            background: "#fff",
            color: "#9d174d",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Request
        </button>
      </div>
    </div>
  );
}

function Bubble({
  msg,
  myAccountId,
  notify,
}: {
  msg: ReturnType<typeof useCircles>["items"][number]["messages"][number];
  myAccountId: string;
  notify: Notify;
}) {
  const mine = msg.authorId === myAccountId;
  const palette =
    msg.kind === "sent"
      ? { bg: "rgba(15,118,110,0.08)", border: "rgba(15,118,110,0.25)", fg: "#065f46" }
      : msg.kind === "requested"
        ? { bg: "rgba(219,39,119,0.06)", border: "rgba(219,39,119,0.25)", fg: "#9d174d" }
        : mine
          ? { bg: "rgba(15,23,42,0.04)", border: "rgba(15,23,42,0.08)", fg: "#0f172a" }
          : { bg: "#fff", border: "rgba(15,23,42,0.08)", fg: "#0f172a" };

  const copyRequestLink = async () => {
    if (!msg.amount) return;
    const url = absoluteRequestUrl({ to: myAccountId, amount: msg.amount, memo: msg.memo });
    try {
      await navigator.clipboard.writeText(url);
      notify("Request link copied", "success");
    } catch {
      notify("Clipboard blocked", "error");
    }
  };

  return (
    <div
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "90%",
        padding: "8px 12px",
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        background: palette.bg,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexWrap: "wrap",
          fontSize: 10,
          color: "#94a3b8",
          marginBottom: 2,
        }}
      >
        <span style={{ fontWeight: 700 }}>{mine ? "You" : msg.authorNickname}</span>
        <span>· {formatRelative(msg.createdAt)}</span>
        {msg.kind === "sent" ? <span style={{ color: "#065f46", fontWeight: 700 }}>· sent</span> : null}
        {msg.kind === "requested" ? <span style={{ color: "#9d174d", fontWeight: 700 }}>· request</span> : null}
      </div>
      <div style={{ fontSize: 13, color: palette.fg, fontWeight: 600 }}>{msg.text}</div>
      {msg.kind === "requested" ? (
        <button
          onClick={copyRequestLink}
          style={{
            marginTop: 6,
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid rgba(219,39,119,0.3)",
            background: "#fff",
            color: "#9d174d",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Copy pay link
        </button>
      ) : null}
    </div>
  );
}

