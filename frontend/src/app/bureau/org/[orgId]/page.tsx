"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { useToast } from "@/components/ToastProvider";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";

type Member = {
  id: string;
  userId: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
  name: string | null;
  email: string | null;
};

type Invite = {
  id: string;
  invitedEmail: string;
  role: string;
  createdAt: string;
  expiresAt: string;
};

type OrgDetail = {
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    createdAt: string;
    billingEmail: string | null;
    billingCountry: string | null;
  };
  members: Member[];
  invites: Invite[];
  myRole: "owner" | "admin" | "member";
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-violet-900/60 text-violet-300 border border-violet-700",
  admin: "bg-sky-900/60 text-sky-300 border border-sky-700",
  member: "bg-slate-700/60 text-slate-300 border border-slate-600",
};

export default function BureauOrgDetailPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const { showToast } = useToast();

  const [data, setData] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviting, setInviting] = useState(false);
  const [pendingInviteUrl, setPendingInviteUrl] = useState<string | null>(null);

  const authHeaders = (): HeadersInit => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      return raw ? { Authorization: `Bearer ${raw}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
    } catch {
      return { "Content-Type": "application/json" };
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl(`/api/bureau/org/${orgId}`), { headers: authHeaders() });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        showToast((err as any).error || "Failed to load org", "error");
        return;
      }
      setData(await r.json());
    } catch {
      showToast("Network error", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (orgId) load(); }, [orgId]);

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.includes("@")) return;
    setInviting(true);
    setPendingInviteUrl(null);
    try {
      const r = await fetch(apiUrl(`/api/bureau/org/${orgId}/invite`), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const json = await r.json();
      if (!r.ok) { showToast((json as any).error || "Invite failed", "error"); return; }
      showToast(`Invite sent to ${inviteEmail}`, "success");
      setPendingInviteUrl((json as any).acceptUrl);
      setInviteEmail("");
      await load();
    } catch {
      showToast("Network error", "error");
    } finally {
      setInviting(false);
    }
  };

  const removeInvite = async (inviteId: string, email: string) => {
    try {
      const r = await fetch(apiUrl(`/api/bureau/org/${orgId}/invites/${inviteId}`), {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (r.ok) { showToast(`Invite to ${email} cancelled`, "success"); await load(); }
      else { const j = await r.json().catch(() => ({})); showToast((j as any).error || "Failed", "error"); }
    } catch { showToast("Network error", "error"); }
  };

  const removeMember = async (memberId: string, name: string) => {
    if (!confirm(`Remove ${name || memberId} from this org?`)) return;
    try {
      const r = await fetch(apiUrl(`/api/bureau/org/${orgId}/members/${memberId}`), {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (r.ok) { showToast("Member removed", "success"); await load(); }
      else { const j = await r.json().catch(() => ({})); showToast((j as any).error || "Failed", "error"); }
    } catch { showToast("Network error", "error"); }
  };

  const changeRole = async (memberId: string, role: "admin" | "member") => {
    try {
      const r = await fetch(apiUrl(`/api/bureau/org/${orgId}/members/${memberId}`), {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ role }),
      });
      if (r.ok) { showToast("Role updated", "success"); await load(); }
      else { const j = await r.json().catch(() => ({})); showToast((j as any).error || "Failed", "error"); }
    } catch { showToast("Network error", "error"); }
  };

  if (loading) {
    return (
      <ProductPageShell>
        <Wave1Nav />
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="animate-pulse text-slate-400">Loading…</div>
        </div>
      </ProductPageShell>
    );
  }

  if (!data) {
    return (
      <ProductPageShell>
        <Wave1Nav />
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
          <p className="text-red-400">Could not load organization. You may not be a member.</p>
          <Link href="/bureau/org" className="text-teal-400 underline text-sm">Back to orgs</Link>
        </div>
      </ProductPageShell>
    );
  }

  const { organization: org, members, invites, myRole } = data;
  const canManage = myRole === "owner" || myRole === "admin";

  return (
    <ProductPageShell>
      <Wave1Nav />
      <div className="min-h-screen bg-slate-950 text-slate-100 pt-20 pb-24 px-4">
        <div className="max-w-3xl mx-auto space-y-8">

          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs text-teal-400 mb-1 uppercase tracking-widest">IP Bureau</div>
              <h1 className="text-2xl font-bold text-white">{org.name}</h1>
              <p className="text-slate-400 text-sm mt-1">
                <span className="font-mono text-slate-500">@{org.slug}</span>
                {" · "}Plan: <span className="capitalize text-teal-300">{org.plan}</span>
                {" · "}Your role: <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${ROLE_COLORS[myRole]}`}>{myRole}</span>
              </p>
            </div>
            <Link href="/bureau/org" className="text-sm text-slate-400 hover:text-teal-300 transition-colors">
              ← All orgs
            </Link>
          </div>

          {/* Members */}
          <section className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="font-semibold text-slate-200">Members ({members.length})</h2>
            </div>
            <ul className="divide-y divide-slate-800">
              {members.map((m) => (
                <li key={m.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-teal-300 shrink-0">
                      {(m.name || m.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-100 truncate">{m.name || m.userId}</div>
                      {m.email && <div className="text-xs text-slate-500 truncate">{m.email}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${ROLE_COLORS[m.role]}`}>{m.role}</span>
                    {myRole === "owner" && m.role !== "owner" && (
                      <>
                        <select
                          value={m.role}
                          onChange={(e) => changeRole(m.id, e.target.value as "admin" | "member")}
                          className="text-xs bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300"
                        >
                          <option value="admin">admin</option>
                          <option value="member">member</option>
                        </select>
                        <button
                          onClick={() => removeMember(m.id, m.name || m.email || m.userId)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Remove
                        </button>
                      </>
                    )}
                    {myRole === "admin" && m.role === "member" && (
                      <button
                        onClick={() => removeMember(m.id, m.name || m.email || m.userId)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Pending Invites */}
          {invites.length > 0 && (
            <section className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800">
                <h2 className="font-semibold text-slate-200">Pending Invites ({invites.length})</h2>
              </div>
              <ul className="divide-y divide-slate-800">
                {invites.map((inv) => (
                  <li key={inv.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-sm text-slate-100">{inv.invitedEmail}</div>
                      <div className="text-xs text-slate-500">
                        Role: <span className="capitalize text-slate-400">{inv.role}</span>
                        {" · "}Expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                    {canManage && (
                      <button
                        onClick={() => removeInvite(inv.id, inv.invitedEmail)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Invite new member */}
          {canManage && (
            <section className="bg-slate-900 rounded-xl border border-slate-800 p-5">
              <h2 className="font-semibold text-slate-200 mb-4">Invite Member</h2>
              <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  required
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={inviting}
                  className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg px-5 py-2 text-sm font-medium transition-colors"
                >
                  {inviting ? "Sending…" : "Send Invite"}
                </button>
              </form>
              {pendingInviteUrl && (
                <div className="mt-4 p-3 bg-slate-800 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Share this invite link:</p>
                  <code className="text-xs text-teal-300 break-all">
                    {typeof window !== "undefined" ? window.location.origin : ""}{pendingInviteUrl}
                  </code>
                </div>
              )}
            </section>
          )}

          {/* Billing info */}
          <section className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <h2 className="font-semibold text-slate-200 mb-3">Organization Info</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <dt className="text-slate-500">Created</dt>
              <dd className="text-slate-300">{new Date(org.createdAt).toLocaleDateString()}</dd>
              {org.billingEmail && (
                <>
                  <dt className="text-slate-500">Billing email</dt>
                  <dd className="text-slate-300">{org.billingEmail}</dd>
                </>
              )}
              {org.billingCountry && (
                <>
                  <dt className="text-slate-500">Country</dt>
                  <dd className="text-slate-300">{org.billingCountry}</dd>
                </>
              )}
            </dl>
          </section>
        </div>
      </div>
    </ProductPageShell>
  );
}
