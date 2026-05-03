"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { SubrouteFooter } from "../_components/SubrouteFooter";
import { listAccounts, listOperations } from "../_lib/api";
import {
  listContacts,
  removeContact,
  saveContact,
  type Contact,
} from "../_lib/contacts";
import type { Account, Operation } from "../_lib/types";

type Stats = { count: number; total: number; recent: number };

function relativeTime(ts: number, lang: string): string {
  const diff = Date.now() - ts;
  const sec = Math.round(diff / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  const wk = Math.round(day / 7);
  const mo = Math.round(day / 30);
  const yr = Math.round(day / 365);
  try {
    const rtf = new Intl.RelativeTimeFormat(
      lang === "kk" ? "kk-KZ" : lang === "ru" ? "ru-RU" : "en-US",
      { numeric: "auto" },
    );
    if (sec < 60) return rtf.format(-sec, "second");
    if (min < 60) return rtf.format(-min, "minute");
    if (hr < 24) return rtf.format(-hr, "hour");
    if (day < 7) return rtf.format(-day, "day");
    if (wk < 5) return rtf.format(-wk, "week");
    if (mo < 12) return rtf.format(-mo, "month");
    return rtf.format(-yr, "year");
  } catch {
    return new Date(ts).toLocaleDateString();
  }
}

export default function ContactsPage() {
  const { t, lang } = useI18n();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newId, setNewId] = useState("");
  const [newNick, setNewNick] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setContacts(listContacts());
  }, [tick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, o] = await Promise.all([listAccounts(), listOperations()]);
        if (cancelled) return;
        setAccounts(a);
        setOperations(o);
      } catch {
        // offline ok
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const myAccount = accounts[0] ?? null;

  const opsByContact = useMemo(() => {
    const map = new Map<string, number>();
    if (!myAccount) return map;
    for (const op of operations) {
      if (op.kind !== "transfer") continue;
      const counterparty = op.from === myAccount.id ? op.to : op.from === null ? null : op.from;
      if (!counterparty || counterparty === myAccount.id) continue;
      map.set(counterparty, (map.get(counterparty) ?? 0) + 1);
    }
    return map;
  }, [operations, myAccount]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) => c.nickname.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
    );
  }, [contacts, query]);

  const stats: Stats = useMemo(() => {
    const total = contacts.length;
    const recent = contacts.filter((c) => Date.now() - c.lastUsed < 7 * 86_400_000).length;
    return { count: filtered.length, total, recent };
  }, [contacts, filtered]);

  const startEdit = (c: Contact) => {
    setEditingId(c.id);
    setEditValue(c.nickname);
  };
  const commitEdit = () => {
    if (!editingId) return;
    const v = editValue.trim();
    if (v) saveContact(editingId, v);
    setEditingId(null);
    setEditValue("");
    setTick((n) => n + 1);
  };
  const remove = (id: string) => {
    if (!confirm(t("contacts.confirmRemove"))) return;
    removeContact(id);
    setTick((n) => n + 1);
  };
  const copyId = (id: string) => {
    navigator.clipboard?.writeText(id).catch(() => {});
  };
  const addContact = (e: React.FormEvent) => {
    e.preventDefault();
    const id = newId.trim();
    const nick = newNick.trim();
    if (!id || !nick) return;
    saveContact(id, nick);
    setNewId("");
    setNewNick("");
    setTick((n) => n + 1);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
        padding: "24px 16px 56px",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link
          href="/bank"
          style={{ fontSize: 12, color: "#475569", textDecoration: "none", fontWeight: 700 }}
        >
          ← {t("about.backToBank")}
        </Link>

        <header style={{ marginTop: 14, marginBottom: 18 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 4,
              color: "#0d9488",
              textTransform: "uppercase",
            }}
          >
            {t("contacts.kicker")}
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: "4px 0 8px 0", letterSpacing: -0.6 }}>
            {t("contacts.headline")}
          </h1>
          <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.5, maxWidth: 580 }}>
            {t("contacts.lede")}
          </div>
        </header>

        {/* Stats strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <Stat label={t("contacts.stat.total")} value={String(stats.total)} accent="#0d9488" />
          <Stat label={t("contacts.stat.recent")} value={String(stats.recent)} accent="#0ea5e9" />
          <Stat label={t("contacts.stat.shown")} value={String(stats.count)} accent="#7c3aed" />
        </div>

        {/* Search */}
        <input
          type="search"
          placeholder={t("contacts.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t("contacts.searchAria")}
          style={{
            width: "100%",
            padding: "11px 14px",
            borderRadius: 10,
            border: "1px solid rgba(15,23,42,0.14)",
            fontSize: 14,
            outline: "none",
            background: "#fff",
            marginBottom: 14,
          }}
        />

        {/* Add new */}
        <form
          onSubmit={addContact}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr auto",
            gap: 8,
            marginBottom: 18,
          }}
        >
          <input
            type="text"
            placeholder={t("contacts.add.id")}
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            aria-label={t("contacts.add.id")}
            style={inputStyle()}
          />
          <input
            type="text"
            placeholder={t("contacts.add.nickname")}
            value={newNick}
            onChange={(e) => setNewNick(e.target.value)}
            aria-label={t("contacts.add.nickname")}
            style={inputStyle()}
          />
          <button
            type="submit"
            disabled={!newId.trim() || !newNick.trim()}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              background: !newId.trim() || !newNick.trim() ? "#cbd5e1" : "#0d9488",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              border: "none",
              cursor: !newId.trim() || !newNick.trim() ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t("contacts.add.cta")}
          </button>
        </form>

        {/* List */}
        {filtered.length === 0 ? (
          <div
            style={{
              padding: 32,
              borderRadius: 14,
              background: "#fff",
              border: "1px dashed rgba(15,23,42,0.18)",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }} aria-hidden>
              ✉
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
              {contacts.length === 0
                ? t("contacts.empty.title")
                : t("contacts.searchEmpty.title")}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
              {contacts.length === 0
                ? t("contacts.empty.body")
                : t("contacts.searchEmpty.body", { q: query })}
            </div>
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((c) => {
              const opCount = opsByContact.get(c.id) ?? 0;
              const editing = editingId === c.id;
              return (
                <li
                  key={c.id}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: "#fff",
                    border: "1px solid rgba(15,23,42,0.08)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editing ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            if (e.key === "Escape") {
                              setEditingId(null);
                              setEditValue("");
                            }
                          }}
                          onBlur={commitEdit}
                          aria-label={t("contacts.edit.aria")}
                          style={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: "#0f172a",
                            border: "1px solid #0d9488",
                            borderRadius: 6,
                            padding: "4px 8px",
                            outline: "none",
                            width: "100%",
                            maxWidth: 280,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: "#0f172a",
                            cursor: "pointer",
                          }}
                          onClick={() => startEdit(c)}
                          title={t("contacts.edit.aria")}
                        >
                          {c.nickname}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          fontFamily: "ui-monospace, SFMono-Regular, monospace",
                          marginTop: 4,
                          wordBreak: "break-all",
                        }}
                      >
                        {c.id}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <span>
                          {t("contacts.lastUsed")} · {relativeTime(c.lastUsed, lang)}
                        </span>
                        {opCount > 0 && (
                          <span style={{ color: "#0d9488", fontWeight: 700 }}>
                            {opCount === 1
                              ? t("contacts.opCountOne", { count: opCount })
                              : t("contacts.opCountMany", { count: opCount })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => copyId(c.id)}
                        title={t("contacts.action.copyId")}
                        style={iconBtn("#0d9488")}
                      >
                        ⧉
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        title={t("contacts.action.edit")}
                        style={iconBtn("#475569")}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        title={t("contacts.action.remove")}
                        style={iconBtn("#dc2626")}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Privacy footer */}
        <div
          style={{
            marginTop: 22,
            padding: 14,
            borderRadius: 10,
            background: "rgba(13,148,136,0.06)",
            border: "1px solid rgba(13,148,136,0.18)",
            fontSize: 12,
            color: "#0f4c4a",
            lineHeight: 1.55,
          }}
        >
          <strong>{t("contacts.privacy.title")}</strong> {t("contacts.privacy.body")}
        </div>

        <div style={{ marginTop: 16 }}>
          <InstallBanner />
        </div>
        <div style={{ marginTop: 16 }}>
          <SubrouteFooter />
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        background: "#fff",
        border: "1px solid rgba(15,23,42,0.08)",
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 800, textTransform: "uppercase", color: accent }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>{value}</div>
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid rgba(15,23,42,0.14)",
    fontSize: 13,
    outline: "none",
    minWidth: 0,
  };
}

function iconBtn(color: string): React.CSSProperties {
  return {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: `${color}12`,
    color,
    fontSize: 14,
    fontWeight: 900,
    border: `1px solid ${color}33`,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  };
}
