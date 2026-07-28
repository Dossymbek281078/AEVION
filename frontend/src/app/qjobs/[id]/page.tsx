"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { TYPE_COLORS, typeLabel } from "../jobTypes";

// Страница одной вакансии. До неё вакансия жила только внутри списка: описание
// раскрывалось на месте, отдельного адреса не было — ни отправить ссылку, ни
// попасть на неё из поиска. Поля берутся из публичной выдачи `/jobs/:id`.

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

function bearerHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token =
    localStorage.getItem("aevion_auth_token_v1") || sessionStorage.getItem("aevion_auth_token_v1");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function hasToken(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    localStorage.getItem("aevion_auth_token_v1") || sessionStorage.getItem("aevion_auth_token_v1"),
  );
}

function postedLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "Posted today";
  if (days === 1) return "Posted yesterday";
  return `Posted ${days} days ago`;
}

export default function QJobDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const [coverLetter, setCoverLetter] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState("");

  // Токен читаем в эффекте: на сервере его нет, и разметка разошлась бы с
  // первой отрисовкой в браузере.
  useEffect(() => setSignedIn(hasToken()), []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/qjobs/jobs/${encodeURIComponent(id)}`), { cache: "no-store" });
      if (res.status === 404) {
        setMissing(true);
        return;
      }
      if (!res.ok) return;
      const json = (await res.json()) as { job?: Job };
      if (json.job) setJob(json.job);
      else setMissing(true);
    } catch {
      // Сеть отвалилась — ниже покажется экран «не найдено».
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleApply() {
    if (!job) return;
    setApplying(true);
    setApplyError("");
    try {
      const res = await fetch(apiUrl(`/api/qjobs/jobs/${encodeURIComponent(job.id)}/apply`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerHeader() },
        body: JSON.stringify({ coverLetter: coverLetter.trim() || undefined }),
      });
      if (!res.ok) {
        // Человеческие формулировки вместо кода ошибки: «auth required» на
        // экране ничего не объясняет тому, кто просто не вошёл.
        setApplyError(
          res.status === 401
            ? "Sign in to apply."
            : res.status === 404
              ? "This job is no longer open."
              : res.status === 409
                ? "You have already applied to this job."
                : "Could not send the application. Please try again.",
        );
        return;
      }
      setApplied(true);
      setJob({ ...job, applicantCount: job.applicantCount + 1 });
    } catch {
      setApplyError("Could not send the application. Please try again.");
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <>
        <Wave1Nav />
        <ProductPageShell maxWidth={780}>
          <div style={{ padding: "60px 0", textAlign: "center", color: "#94a3b8" }}>Loading job…</div>
        </ProductPageShell>
      </>
    );
  }

  if (missing || !job) {
    return (
      <>
        <Wave1Nav />
        <ProductPageShell maxWidth={780}>
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>
            <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800, color: "#0f172a" }}>
              Job not found
            </h1>
            <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: 15 }}>
              The posting may have been closed, or the link is wrong.
            </p>
            <Link
              href="/qjobs"
              style={{
                display: "inline-block",
                background: "#0f172a",
                color: "#fff",
                borderRadius: 8,
                padding: "10px 18px",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              All jobs
            </Link>
          </div>
        </ProductPageShell>
      </>
    );
  }

  const colors = TYPE_COLORS[job.type] ?? TYPE_COLORS.other;

  return (
    <>
      <Wave1Nav />
      <ProductPageShell maxWidth={780}>
        <Link
          href="/qjobs"
          style={{ display: "inline-block", marginBottom: 16, color: "#6366f1", fontSize: 14, fontWeight: 600, textDecoration: "none" }}
        >
          ← All jobs
        </Link>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <span
            style={{
              background: colors.bg,
              color: colors.fg,
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {typeLabel(job.type)}
          </span>
          {!job.isActive && (
            <span style={{ background: "#f1f5f9", color: "#64748b", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>
              Closed
            </span>
          )}
          <span style={{ fontSize: 13, color: "#94a3b8" }}>{postedLabel(job.createdAt)}</span>
        </div>

        <h1 style={{ margin: "0 0 6px", fontSize: 30, lineHeight: 1.2, fontWeight: 800, color: "#0f172a" }}>
          {job.title}
        </h1>
        <p style={{ margin: "0 0 20px", fontSize: 17, color: "#475569", fontWeight: 600 }}>
          {job.company} · {job.location}
        </p>

        <dl
          style={{
            margin: "0 0 22px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 14,
          }}
        >
          <Fact label="Salary" value={job.salary || "Not specified"} />
          <Fact label="Employment" value={typeLabel(job.type)} />
          <Fact label="Applicants" value={String(job.applicantCount)} />
        </dl>

        {job.skills && job.skills.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 22 }}>
            {job.skills.map((s) => (
              <span
                key={s}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 999,
                  padding: "4px 10px",
                  fontSize: 13,
                  color: "#475569",
                  fontWeight: 600,
                }}
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {job.description && (
          <p style={{ margin: "0 0 26px", fontSize: 16, lineHeight: 1.7, color: "#334155", whiteSpace: "pre-wrap" }}>
            {job.description}
          </p>
        )}

        {job.isActive ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: 18,
            }}
          >
            <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 800, color: "#0f172a" }}>Apply</h2>
            {applied ? (
              <p style={{ margin: 0, color: "#15803d", fontWeight: 700, fontSize: 15 }}>
                Application sent ✓ — the employer sees it in their applicants list.
              </p>
            ) : signedIn ? (
              <>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="A few lines about why you fit (optional)"
                  rows={4}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 15,
                    fontFamily: "inherit",
                    color: "#0f172a",
                    resize: "vertical",
                    marginBottom: 12,
                  }}
                />
                <button
                  onClick={handleApply}
                  disabled={applying}
                  style={{
                    background: applying ? "#c7d2fe" : "#0f172a",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    padding: "12px 22px",
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: applying ? "not-allowed" : "pointer",
                  }}
                >
                  {applying ? "Sending…" : "Send application"}
                </button>
              </>
            ) : (
              <Link
                href="/auth"
                style={{
                  display: "inline-block",
                  background: "#0f172a",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "12px 22px",
                  fontWeight: 700,
                  fontSize: 15,
                  textDecoration: "none",
                }}
              >
                Sign in to apply
              </Link>
            )}
            {applyError && (
              <p style={{ margin: "10px 0 0", color: "#b91c1c", fontSize: 14, fontWeight: 600 }}>{applyError}</p>
            )}
          </div>
        ) : (
          <div style={{ background: "#f1f5f9", borderRadius: 14, padding: 18, color: "#64748b", fontWeight: 600 }}>
            This posting is closed — applications are no longer accepted.
          </div>
        )}
      </ProductPageShell>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </dt>
      <dd style={{ margin: "4px 0 0", fontSize: 15, color: "#0f172a", lineHeight: 1.5 }}>{value}</dd>
    </div>
  );
}
