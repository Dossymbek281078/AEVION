"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { buildApi, type BuildResumeBundle } from "@/lib/build/api";

// Print-optimized standalone resume page. No BuildShell, no nav, no toaster.
// Browser Print → "Save as PDF" produces a 1-page candidate handout.
// QR code points back to the live profile so a printed copy stays linkable.
export default function ResumePage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id as string;
  const [profile, setProfile] = useState<BuildResumeBundle | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    buildApi
      .getProfile(userId)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((e) => {
        if (!cancelled) setErr((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (err) {
    return (
      <main className="mx-auto max-w-3xl p-8 text-sm text-rose-700">
        <div className="rounded border border-rose-300 bg-rose-50 p-4">
          Failed to load resume: {err}
        </div>
      </main>
    );
  }
  if (!profile) {
    return (
      <main className="mx-auto max-w-3xl p-8 text-sm text-slate-600">Loading…</main>
    );
  }

  const profileUrl = typeof window !== "undefined"
    ? `${window.location.origin}/build/u/${encodeURIComponent(userId)}`
    : `/build/u/${encodeURIComponent(userId)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(profileUrl)}`;

  return (
    <main className="resume-root mx-auto max-w-3xl bg-white text-slate-900">
      <style>{`
        :root { --resume-fg: #0f172a; --resume-muted: #475569; --resume-line: #e2e8f0; }
        @page { size: A4; margin: 14mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .resume-root { box-shadow: none !important; }
        }
        .resume-root { font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif; line-height: 1.45; }
        .resume-root h1 { font-size: 26px; font-weight: 700; color: var(--resume-fg); margin: 0; }
        .resume-root h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--resume-muted); margin: 16px 0 6px; padding-bottom: 4px; border-bottom: 1px solid var(--resume-line); }
        .resume-root .meta { color: var(--resume-muted); font-size: 12px; }
        .resume-root .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #f1f5f9; color: #334155; font-size: 11px; margin: 2px 4px 2px 0; }
        .resume-root .row { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-top: 2px; }
        .resume-root p { margin: 4px 0; font-size: 13px; }
        .resume-root .item-title { font-weight: 600; font-size: 14px; color: var(--resume-fg); }
        .resume-root .item-sub { font-size: 12px; color: var(--resume-muted); }
        .resume-root .item-desc { font-size: 12px; color: #1e293b; margin-top: 2px; }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between border-b border-slate-200 px-6 py-3 text-xs">
        <Link href={`/build/u/${encodeURIComponent(userId)}`} className="text-emerald-600 hover:underline">
          ← Back to profile
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600"
        >
          🖨 Print / Save as PDF
        </button>
      </div>

      <article className="px-8 py-6">
        <header className="row">
          <div className="min-w-0 flex-1">
            <h1>{profile.name || "Anonymous"}</h1>
            {profile.title && <div className="meta mt-1">{profile.title}</div>}
            <div className="meta mt-2">
              {[profile.city, profile.email, profile.experienceYears != null ? `${profile.experienceYears}y experience` : null]
                .filter(Boolean)
                .join("  ·  ")}
            </div>
            {profile.summary && <p className="mt-3" style={{ whiteSpace: "pre-wrap" }}>{profile.summary}</p>}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="QR to live profile" width={84} height={84} className="shrink-0 rounded border border-slate-200" />
        </header>

        {profile.skills && profile.skills.length > 0 && (
          <section>
            <h2>Skills</h2>
            <div>
              {profile.skills.map((s) => (
                <span key={s} className="pill">{s}</span>
              ))}
            </div>
          </section>
        )}

        {profile.experiences && profile.experiences.length > 0 && (
          <section>
            <h2>Experience</h2>
            {profile.experiences.map((e) => {
              const fromYear = e.fromDate ? new Date(e.fromDate).getFullYear() : null;
              const toYear = e.current ? "present" : e.toDate ? new Date(e.toDate).getFullYear() : null;
              const range = fromYear || toYear ? `${fromYear ?? ""}${fromYear || toYear ? " – " : ""}${toYear ?? ""}` : "";
              return (
                <div key={e.id} className="mt-2">
                  <div className="row">
                    <div className="item-title">{e.title}{e.company ? ` · ${e.company}` : ""}</div>
                    <div className="item-sub">{range}</div>
                  </div>
                  {e.city && <div className="item-sub">{e.city}</div>}
                  {e.description && <div className="item-desc" style={{ whiteSpace: "pre-wrap" }}>{e.description}</div>}
                </div>
              );
            })}
          </section>
        )}

        {profile.education && profile.education.length > 0 && (
          <section>
            <h2>Education</h2>
            {profile.education.map((e) => (
              <div key={e.id} className="mt-2">
                <div className="row">
                  <div className="item-title">{e.institution}{e.field ? ` · ${e.field}` : ""}</div>
                  <div className="item-sub">
                    {e.fromYear ?? ""}{e.fromYear || e.toYear ? " – " : ""}{e.toYear ?? ""}
                  </div>
                </div>
                {e.degree && <div className="item-desc">{e.degree}</div>}
              </div>
            ))}
          </section>
        )}

        {profile.languages && profile.languages.length > 0 && (
          <section>
            <h2>Languages</h2>
            <div>{profile.languages.map((l) => <span key={l} className="pill">{l}</span>)}</div>
          </section>
        )}

        <footer className="mt-8 border-t border-slate-200 pt-2 text-[10px] text-slate-500">
          Generated by AEVION QBuild · {new Date().toLocaleDateString()} · {profileUrl}
        </footer>
      </article>
    </main>
  );
}
