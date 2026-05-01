"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

type Season = {
  id: string;
  code: string;
  type: string;
  title: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
};

type Entry = {
  id: string;
  seasonId: string;
  artifactVersionId: string;
  status: string;
  submittedAt: string;
  qualifiedAt: string | null;
  disqualifyReason: string | null;
  submissionTitle: string;
  artifactType: string;
  ownerId: string;
  seasonCode: string;
  seasonTitle: string;
  seasonType: string;
};

type AuditEntry = {
  id: string;
  actor: string | null;
  action: string;
  targetId: string | null;
  payload: any;
  at: string;
};

const SEASON_STATUSES = ["draft", "open", "voting", "closed", "finalized"];
const AWARD_TYPES = ["music", "film"];
const ENTRY_FILTER = ["", "pending", "qualified", "disqualified"];

const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 14,
  padding: 16,
  background: "#fff",
};
const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.15)",
  fontSize: 13,
  marginBottom: 10,
};
const btnPrimary: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#0d9488",
  color: "#fff",
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
};

export default function AdminAwardsPage() {
  const { showToast } = useToast();
  const [hasToken, setHasToken] = useState(false);
  const [whoami, setWhoami] = useState<{ isAdmin: boolean; email: string | null } | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeason, setActiveSeason] = useState<string>("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entryStatusFilter, setEntryStatusFilter] = useState<string>("");
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingSeason, setCreatingSeason] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState("music");
  const [newTitle, setNewTitle] = useState("");
  const [newStatus, setNewStatus] = useState("draft");
  const [createBusy, setCreateBusy] = useState(false);
  const [disqualifyTarget, setDisqualifyTarget] = useState<Entry | null>(null);
  const [disqualifyReason, setDisqualifyReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [finalizeBusy, setFinalizeBusy] = useState<string | null>(null);

  const authHeaders = useCallback((): HeadersInit => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      return raw ? { Authorization: `Bearer ${raw}` } : {};
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    try {
      setHasToken(!!localStorage.getItem(TOKEN_KEY));
    } catch {}
  }, []);

  useEffect(() => {
    if (!hasToken) {
      setWhoami({ isAdmin: false, email: null });
      return;
    }
    fetch(apiUrl("/api/awards/admin/whoami"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setWhoami({ isAdmin: !!data.isAdmin, email: data.email || null }))
      .catch(() => setWhoami({ isAdmin: false, email: null }));
  }, [hasToken, authHeaders]);

  const loadSeasons = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/api/awards/seasons"), { headers: authHeaders() });
      if (r.ok) {
        const d = await r.json();
        setSeasons(d.items || []);
        if (!activeSeason && d.items?.[0]) setActiveSeason(d.items[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [authHeaders, activeSeason]);

  const loadEntries = useCallback(async () => {
    if (!whoami?.isAdmin) return;
    try {
      const params = new URLSearchParams();
      if (activeSeason) params.set("seasonId", activeSeason);
      if (entryStatusFilter) params.set("status", entryStatusFilter);
      const r = await fetch(apiUrl(`/api/awards/admin/entries?${params}`), { headers: authHeaders() });
      if (r.ok) {
        const d = await r.json();
        setEntries(d.items || []);
      }
    } catch {
      /* silent */
    }
  }, [whoami, authHeaders, activeSeason, entryStatusFilter]);

  const loadAudit = useCallback(async () => {
    if (!whoami?.isAdmin) return;
    try {
      const r = await fetch(apiUrl("/api/awards/admin/audit?limit=50"), { headers: authHeaders() });
      if (r.ok) {
        const d = await r.json();
        setAudit(d.items || []);
      }
    } catch {
      /* silent */
    }
  }, [whoami, authHeaders]);

  useEffect(() => {
    if (whoami?.isAdmin) {
      loadSeasons();
      loadAudit();
    }
  }, [whoami, loadSeasons, loadAudit]);

  useEffect(() => {
    if (whoami?.isAdmin && activeSeason) loadEntries();
  }, [whoami, activeSeason, entryStatusFilter, loadEntries]);

  const createSeason = async () => {
    if (!newCode.trim() || !newTitle.trim()) {
      showToast("Code and title required", "error");
      return;
    }
    setCreateBusy(true);
    try {
      const r = await fetch(apiUrl("/api/awards/admin/seasons"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          code: newCode.trim(),
          type: newType,
          title: newTitle.trim(),
          status: newStatus,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        showToast("Season created", "success");
        setCreatingSeason(false);
        setNewCode("");
        setNewTitle("");
        setNewStatus("draft");
        loadSeasons();
        loadAudit();
      } else {
        showToast(`Failed: ${d.error || r.status}`, "error");
      }
    } finally {
      setCreateBusy(false);
    }
  };

  const updateSeasonStatus = async (id: string, status: string) => {
    try {
      const r = await fetch(apiUrl(`/api/awards/admin/seasons/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status }),
      });
      if (r.ok) {
        showToast(`Status → ${status}`, "success");
        loadSeasons();
        loadAudit();
      } else {
        const d = await r.json().catch(() => ({}));
        showToast(`Failed: ${d.error || r.status}`, "error");
      }
    } catch (e) {
      showToast(`Failed: ${(e as Error).message}`, "error");
    }
  };

  const qualify = async (id: string) => {
    setActionBusy(true);
    try {
      const r = await fetch(apiUrl(`/api/awards/admin/entries/${id}/qualify`), {
        method: "POST",
        headers: authHeaders(),
      });
      if (r.ok) {
        showToast("Qualified", "success");
        loadEntries();
        loadAudit();
      }
    } finally {
      setActionBusy(false);
    }
  };

  const disqualify = async () => {
    if (!disqualifyTarget) return;
    setActionBusy(true);
    try {
      const r = await fetch(
        apiUrl(`/api/awards/admin/entries/${disqualifyTarget.id}/disqualify`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ reason: disqualifyReason.trim() || undefined }),
        }
      );
      if (r.ok) {
        showToast("Disqualified", "success");
        setDisqualifyTarget(null);
        setDisqualifyReason("");
        loadEntries();
        loadAudit();
      } else {
        const d = await r.json().catch(() => ({}));
        showToast(`Failed: ${d.error || r.status}`, "error");
      }
    } finally {
      setActionBusy(false);
    }
  };

  const finalize = async (id: string) => {
    if (!confirm("Finalize season? Computes top-3 medals and freezes status. Idempotent — safe to run again.")) return;
    setFinalizeBusy(id);
    try {
      const r = await fetch(apiUrl(`/api/awards/admin/seasons/${id}/finalize`), {
        method: "POST",
        headers: authHeaders(),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        showToast(`Finalized: ${d.medals?.length || 0} medals`, "success");
        loadSeasons();
        loadAudit();
      } else {
        showToast(`Failed: ${d.error || r.status}`, "error");
      }
    } finally {
      setFinalizeBusy(null);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa" }}>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 16px" }}>
          <div style={{ marginBottom: 16 }}>
            <Link
              href="/awards"
              style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}
            >
              ← AEVION Awards
            </Link>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", margin: 0 }}>
            Awards admin
          </h1>
          <p style={{ color: "#475569", fontSize: 13, marginTop: 6, marginBottom: 24 }}>
            Manage seasons, qualify entries, finalize medals.
          </p>

          {!hasToken && (
            <div style={{ ...card, color: "#854d0e", borderColor: "rgba(234,179,8,0.4)" }}>
              Sign in via Auth.
            </div>
          )}
          {hasToken && whoami && !whoami.isAdmin && (
            <div style={{ ...card, color: "#b91c1c", borderColor: "rgba(185,28,28,0.2)" }}>
              You are <strong>{whoami.email || "—"}</strong>, not an Awards admin. Set <code>AWARDS_ADMIN_EMAILS</code> on backend.
            </div>
          )}

          {whoami?.isAdmin && (
            <>
              {/* Seasons */}
              <div style={{ ...card, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Seasons</h2>
                  <span style={{ marginLeft: 10, fontSize: 11, color: "#94a3b8" }}>
                    {seasons.length} total
                  </span>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => setCreatingSeason(!creatingSeason)}
                    style={btnPrimary}
                  >
                    {creatingSeason ? "Cancel" : "+ New season"}
                  </button>
                </div>
                {creatingSeason && (
                  <div style={{ padding: 12, marginBottom: 12, borderRadius: 10, background: "#f8fafc" }}>
                    <input
                      placeholder="Code (e.g. music-2026-q2)"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      style={inputStyle}
                    />
                    <input
                      placeholder="Title (e.g. AEVION Music Awards 2026 Q2)"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      style={inputStyle}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value)}
                        style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                      >
                        {AWARD_TYPES.map((tp) => (
                          <option key={tp} value={tp}>
                            {tp}
                          </option>
                        ))}
                      </select>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                      >
                        {SEASON_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                      <button onClick={createSeason} disabled={createBusy} style={btnPrimary}>
                        {createBusy ? "…" : "Create"}
                      </button>
                    </div>
                  </div>
                )}
                {loading ? (
                  <div style={{ color: "#94a3b8", textAlign: "center", padding: 16 }}>Loading…</div>
                ) : seasons.length === 0 ? (
                  <div style={{ color: "#94a3b8", textAlign: "center", padding: 16 }}>
                    No seasons yet. Create one above.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {seasons.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: activeSeason === s.id ? "2px solid #0d9488" : "1px solid rgba(15,23,42,0.08)",
                          background: activeSeason === s.id ? "rgba(13,148,136,0.04)" : "#fff",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                          cursor: "pointer",
                        }}
                        onClick={() => setActiveSeason(s.id)}
                      >
                        <span style={{ fontWeight: 800, fontSize: 13, color: "#0f172a" }}>{s.title}</span>
                        <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(15,23,42,0.06)", color: "#475569", fontSize: 10, fontFamily: "monospace" }}>
                          {s.code}
                        </span>
                        <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(13,148,136,0.12)", color: "#0d9488", fontSize: 10, fontFamily: "monospace" }}>
                          {s.type}
                        </span>
                        <select
                          value={s.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateSeasonStatus(s.id, e.target.value)}
                          style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, fontFamily: "monospace", border: "1px solid rgba(15,23,42,0.15)" }}
                        >
                          {SEASON_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        {(s.status === "closed" || s.status === "finalized") && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              finalize(s.id);
                            }}
                            disabled={finalizeBusy === s.id}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              border: "1px solid #eab308",
                              background: "#fffbeb",
                              color: "#92400e",
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: finalizeBusy === s.id ? "not-allowed" : "pointer",
                            }}
                          >
                            {finalizeBusy === s.id
                              ? "…"
                              : s.status === "finalized"
                              ? "Re-finalize"
                              : "Finalize 🏆"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Entries */}
              <div style={{ ...card, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                    Entries
                    {activeSeason &&
                      seasons.find((x) => x.id === activeSeason)?.title &&
                      ` · ${seasons.find((x) => x.id === activeSeason)?.title}`}
                  </h2>
                  <div style={{ flex: 1 }} />
                  {ENTRY_FILTER.map((f) => (
                    <button
                      key={f || "all"}
                      onClick={() => setEntryStatusFilter(f)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid rgba(15,23,42,0.15)",
                        background: entryStatusFilter === f ? "#0f172a" : "#fff",
                        color: entryStatusFilter === f ? "#fff" : "#475569",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "monospace",
                      }}
                    >
                      {f || "all"}
                    </button>
                  ))}
                </div>
                {entries.length === 0 ? (
                  <div style={{ color: "#94a3b8", textAlign: "center", padding: 16, fontSize: 13 }}>
                    No entries.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {entries.map((e) => (
                      <div
                        key={e.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: "1px solid rgba(15,23,42,0.08)",
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
                            {e.submissionTitle}
                          </div>
                          <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, fontFamily: "monospace" }}>
                            {e.artifactType?.toUpperCase()} · entry {e.id.slice(0, 8)}… · owner {e.ownerId.slice(0, 8)}…
                          </div>
                          <div style={{ marginTop: 4 }}>
                            <span
                              style={{
                                padding: "2px 6px",
                                borderRadius: 4,
                                background:
                                  e.status === "qualified"
                                    ? "rgba(13,148,136,0.12)"
                                    : e.status === "disqualified"
                                    ? "rgba(220,38,38,0.12)"
                                    : "rgba(234,179,8,0.12)",
                                color:
                                  e.status === "qualified"
                                    ? "#0d9488"
                                    : e.status === "disqualified"
                                    ? "#dc2626"
                                    : "#854d0e",
                                fontSize: 10,
                                fontWeight: 800,
                              }}
                            >
                              {e.status}
                            </span>
                            {e.disqualifyReason && (
                              <span style={{ marginLeft: 6, fontSize: 10, color: "#dc2626" }}>
                                {e.disqualifyReason}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {e.status !== "qualified" && (
                            <button
                              onClick={() => qualify(e.id)}
                              disabled={actionBusy}
                              style={{
                                padding: "5px 10px",
                                borderRadius: 6,
                                border: "none",
                                background: "#0d9488",
                                color: "#fff",
                                fontSize: 11,
                                fontWeight: 800,
                                cursor: "pointer",
                              }}
                            >
                              ✓ Qualify
                            </button>
                          )}
                          {e.status !== "disqualified" && (
                            <button
                              onClick={() => {
                                setDisqualifyTarget(e);
                                setDisqualifyReason("");
                              }}
                              style={{
                                padding: "5px 10px",
                                borderRadius: 6,
                                border: "1px solid #dc2626",
                                background: "#fff",
                                color: "#dc2626",
                                fontSize: 11,
                                fontWeight: 800,
                                cursor: "pointer",
                              }}
                            >
                              ✕ DQ
                            </button>
                          )}
                          <Link
                            href={`/awards/badge/${e.id}`}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 6,
                              border: "1px solid rgba(15,23,42,0.15)",
                              color: "#0f172a",
                              fontSize: 11,
                              fontWeight: 700,
                              textDecoration: "none",
                            }}
                          >
                            Badge
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Audit */}
              <div style={{ ...card, marginBottom: 14 }}>
                <h2 style={{ margin: 0, marginBottom: 12, fontSize: 16, fontWeight: 800 }}>
                  Audit log
                </h2>
                {audit.length === 0 ? (
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>No events.</div>
                ) : (
                  <div style={{ display: "grid", gap: 4 }}>
                    {audit.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          background: "#f8fafc",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 11,
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(13,148,136,0.12)", color: "#0d9488", fontFamily: "monospace", fontWeight: 800, fontSize: 10 }}>
                          {a.action}
                        </span>
                        <span style={{ color: "#475569" }}>{a.actor || "—"}</span>
                        {a.targetId && (
                          <span style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: 10 }}>
                            {a.targetId.slice(0, 8)}…
                          </span>
                        )}
                        <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: 10 }}>
                          {new Date(a.at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </ProductPageShell>

      {/* Disqualify modal */}
      {disqualifyTarget && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionBusy) setDisqualifyTarget(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 480 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>
              Disqualify entry
            </div>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 14 }}>
              <strong>{disqualifyTarget.submissionTitle}</strong>
              <br />
              <span style={{ color: "#7f1d1d" }}>This is logged to the audit trail.</span>
            </div>
            <textarea
              value={disqualifyReason}
              onChange={(e) => setDisqualifyReason(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Reason (optional, ≤ 500 chars)"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", fontSize: 13, marginBottom: 14, resize: "vertical", fontFamily: "inherit" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setDisqualifyTarget(null)}
                disabled={actionBusy}
                style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", color: "#475569", fontWeight: 700, fontSize: 13, cursor: actionBusy ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={disqualify}
                disabled={actionBusy}
                style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontWeight: 800, fontSize: 13, cursor: actionBusy ? "not-allowed" : "pointer" }}
              >
                {actionBusy ? "…" : "Disqualify"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
