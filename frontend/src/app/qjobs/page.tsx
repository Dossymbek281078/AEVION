"use client";

import { useState, useEffect, useCallback } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  employerId: string;
  title: string;
  description: string;
  company: string;
  location: string;
  type: string;
  salary: string | null;
  skills: string[];
  isActive: boolean;
  applicantCount: number;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token =
    localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getAuthSub(): string | null {
  if (typeof window === "undefined") return null;
  const token =
    localStorage.getItem("aevion_token") || sessionStorage.getItem("aevion_token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  "full-time": { bg: "#dcfce7", fg: "#15803d" },
  "part-time": { bg: "#fef3c7", fg: "#92400e" },
  contract: { bg: "#eff6ff", fg: "#2563eb" },
  freelance: { bg: "#f5f3ff", fg: "#7c3aed" },
  internship: { bg: "#fce7f3", fg: "#be185d" },
};

function TypeBadge({ type }: { type: string }) {
  const colors = TYPE_COLORS[type] ?? { bg: "#f1f5f9", fg: "#475569" };
  return (
    <span
      style={{
        background: colors.bg,
        color: colors.fg,
        borderRadius: 20,
        padding: "3px 10px",
        fontSize: 12,
        fontWeight: 700,
        textTransform: "capitalize",
      }}
    >
      {type}
    </span>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  onApply,
}: {
  job: Job;
  onApply: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState("");
  const currentUserId = getAuthSub();

  async function handleApply() {
    setApplying(true);
    setApplyError("");
    try {
      const resp = await fetch(apiUrl(`/api/qjobs/jobs/${job.id}/apply`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ coverLetter: coverLetter.trim() || undefined }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({})) as { error?: string };
        setApplyError(j.error ?? "Application failed");
        return;
      }
      setApplied(true);
      onApply(job.id);
    } catch {
      setApplyError("Network error");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 20,
        marginBottom: 12,
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", marginBottom: 6 }}>
            {job.title}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ fontWeight: 600, color: "#334155", fontSize: 14 }}>{job.company}</span>
            <span style={{ color: "#94a3b8", fontSize: 13 }}>📍 {job.location}</span>
            <TypeBadge type={job.type} />
            {job.salary && (
              <span style={{ color: "#15803d", fontWeight: 600, fontSize: 14 }}>💰 {job.salary}</span>
            )}
          </div>
          {job.skills.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {job.skills.map((skill) => (
                <span
                  key={skill}
                  style={{
                    background: "#f1f5f9",
                    color: "#475569",
                    borderRadius: 6,
                    padding: "2px 8px",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Posted {relativeTime(job.createdAt)} • {job.applicantCount} applicants
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexDirection: "column", alignItems: "flex-end" }}>
          {currentUserId && !applied && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: "#0f172a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 20px",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Apply
            </button>
          )}
          {applied && (
            <span style={{ color: "#15803d", fontWeight: 700, fontSize: 14 }}>Applied ✓</span>
          )}
        </div>
      </div>

      {/* Description toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#6366f1",
          fontSize: 13,
          fontWeight: 600,
          padding: "8px 0 0",
          display: "block",
        }}
      >
        {expanded ? "Hide details ▲" : "View details ▼"}
      </button>

      {expanded && (
        <div style={{ marginTop: 14 }}>
          <p style={{ margin: "0 0 14px", fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
            {job.description}
          </p>
          {currentUserId && !applied && (
            <div>
              <textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Cover letter (optional)"
                rows={4}
                style={{
                  width: "100%",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 14,
                  resize: "vertical",
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                  marginBottom: 10,
                }}
              />
              <button
                onClick={handleApply}
                disabled={applying}
                style={{
                  background: applying ? "#c7d2fe" : "#6366f1",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 24px",
                  fontWeight: 700,
                  cursor: applying ? "not-allowed" : "pointer",
                  fontSize: 14,
                }}
              >
                {applying ? "Submitting..." : "Submit Application"}
              </button>
              {applyError && (
                <p style={{ color: "#ef4444", margin: "8px 0 0", fontSize: 13 }}>{applyError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Post Job Modal ───────────────────────────────────────────────────────────

function PostJobModal({ onClose, onPosted }: { onClose: () => void; onPosted: (job: Job) => void }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    company: "",
    location: "Remote",
    type: "full-time",
    salary: "",
    skills: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.description || !form.company) {
      setError("Title, description, and company are required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const resp = await fetch(apiUrl("/api/qjobs/me/jobs"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({
          ...form,
          salary: form.salary || undefined,
          skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({})) as { error?: string };
        setError(j.error ?? "Failed to post");
        return;
      }
      const { job } = await resp.json() as { job: Job };
      onPosted(job);
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    marginBottom: 12,
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 28,
          width: "100%",
          maxWidth: 500,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 20, color: "#0f172a" }}>
          Post a Job
        </div>
        <form onSubmit={handleSubmit}>
          <input placeholder="Job title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
          <textarea placeholder="Description *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
          <input placeholder="Company *" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} style={inputStyle} />
          <input placeholder="Location (default: Remote)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={inputStyle} />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ ...inputStyle, background: "#fff" }}>
            {["full-time", "part-time", "contract", "freelance", "internship"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input placeholder="Salary (e.g. $80k-$120k)" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} style={inputStyle} />
          <input placeholder="Skills (comma-separated)" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} style={inputStyle} />
          {error && <p style={{ color: "#ef4444", margin: "0 0 12px", fontSize: 13 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="submit"
              disabled={busy}
              style={{
                flex: 1,
                background: busy ? "#c7d2fe" : "#6366f1",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px",
                fontWeight: 700,
                cursor: busy ? "not-allowed" : "pointer",
                fontSize: 14,
              }}
            >
              {busy ? "Posting..." : "Post Job"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                background: "#f1f5f9",
                color: "#64748b",
                border: "none",
                borderRadius: 8,
                padding: "10px",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const JOB_TYPES = ["", "full-time", "part-time", "contract", "freelance", "internship"];

export default function QJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showPostModal, setShowPostModal] = useState(false);
  const currentUserId = getAuthSub();

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (locationFilter) params.set("location", locationFilter);
      if (search) params.set("q", search);
      const resp = await fetch(`${apiUrl("/api/qjobs/jobs")}${params.toString() ? "?" + params.toString() : ""}`);
      if (resp.ok) {
        const data = await resp.json() as { jobs: Job[] };
        setJobs(data.jobs ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [typeFilter, locationFilter, search]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 14px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    background: active ? "#0f172a" : "#f1f5f9",
    color: active ? "#fff" : "#64748b",
    transition: "all 0.15s",
    textTransform: "capitalize" as const,
  });

  return (
    <>
      <Wave1Nav />
      {showPostModal && (
        <PostJobModal
          onClose={() => setShowPostModal(false)}
          onPosted={(job) => setJobs((prev) => [job, ...prev])}
        />
      )}
      <ProductPageShell>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, color: "#0f172a" }}>
              QJobs
            </h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: 15 }}>
              Find your next role or hire great talent in the AEVION ecosystem.
            </p>
          </div>
          {currentUserId && (
            <button
              onClick={() => setShowPostModal(true)}
              style={{
                background: "#6366f1",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 24px",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 15,
              }}
            >
              + Post a Job
            </button>
          )}
        </div>

        {/* Filters */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs..."
              style={{
                flex: 1,
                minWidth: 160,
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "9px 14px",
                fontSize: 14,
                outline: "none",
              }}
            />
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 14,
                background: "#fff",
                outline: "none",
              }}
            >
              <option value="">All locations</option>
              <option value="Remote">Remote</option>
              <option value="On-site">On-site</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {JOB_TYPES.map((t) => (
              <button key={t} style={tabStyle(typeFilter === t)} onClick={() => setTypeFilter(t)}>
                {t || "All types"}
              </button>
            ))}
          </div>
        </div>

        {/* Job list */}
        {loading && (
          <p style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>Loading jobs...</p>
        )}
        {!loading && jobs.length === 0 && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: 40,
              textAlign: "center",
              color: "#94a3b8",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>No jobs found</div>
            <div style={{ fontSize: 14 }}>Be the first to post a job!</div>
          </div>
        )}
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onApply={() => fetchJobs()}
          />
        ))}
      </ProductPageShell>
    </>
  );
}
