"use client";

import { useState } from "react";
import { buildApi, BuildApiError, type BuildProfile } from "@/lib/build/api";
import { VoiceInput } from "./VoiceInput";

type Mode = "TEXT" | "IMAGE";

type ParsedResume = Partial<BuildProfile> & {
  experiences?: { title?: string; company?: string; city?: string | null; fromDate?: string | null; toDate?: string | null; current?: boolean; description?: string | null }[];
  education?: { institution?: string; degree?: string | null; field?: string | null; fromYear?: number | null; toYear?: number | null }[];
};

const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB before base64

export function ResumeImporter({
  onApplied,
}: {
  /** Called after the parsed payload has been merged into the profile. */
  onApplied: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("TEXT");
  const [text, setText] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMediaType, setImageMediaType] = useState<string>("image/jpeg");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedResume | null>(null);
  const [applying, setApplying] = useState(false);

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Image too large (${Math.round(file.size / 1024 / 1024)} MB). Max 6 MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
      if (!m) {
        setError("Could not read image file.");
        return;
      }
      setImageMediaType(m[1] || "image/jpeg");
      setImageBase64(m[2]);
      setImagePreview(dataUrl);
      setError(null);
    };
    reader.onerror = () => setError("Failed to read file.");
    reader.readAsDataURL(file);
  }

  async function parse() {
    setError(null);
    setBusy(true);
    setParsed(null);
    try {
      const r =
        mode === "IMAGE" && imageBase64
          ? await buildApi.aiParseResume({ imageBase64, imageMediaType })
          : await buildApi.aiParseResume({ text: text.trim() });
      setParsed(r.parsed as ParsedResume);
    } catch (e) {
      const err = e as BuildApiError;
      setError(err.code || err.message);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!parsed) return;
    setApplying(true);
    setError(null);
    try {
      // Map parsed JSON → upsertProfile payload. Skip undefined keys.
      await buildApi.upsertProfile({
        name: String(parsed.name || "(unnamed)"),
        title: parsed.title ?? null,
        city: parsed.city ?? null,
        summary: parsed.summary ?? null,
        phone: parsed.phone ?? null,
        skills: Array.isArray(parsed.skills) ? parsed.skills : undefined,
        languages: Array.isArray(parsed.languages) ? parsed.languages : undefined,
        experienceYears:
          typeof parsed.experienceYears === "number" ? parsed.experienceYears : undefined,
        salaryMin: parsed.salaryMin ?? null,
        salaryMax: parsed.salaryMax ?? null,
        salaryCurrency: parsed.salaryCurrency ?? null,
        availability: parsed.availability ?? null,
        openToWork: parsed.openToWork ?? undefined,
        driversLicense: parsed.driversLicense ?? null,
        shiftPreference: parsed.shiftPreference ?? null,
        availabilityType: parsed.availabilityType ?? null,
        readyFromDate: parsed.readyFromDate ?? null,
        preferredLocations: Array.isArray(parsed.preferredLocations) ? parsed.preferredLocations : undefined,
        toolsOwned: Array.isArray(parsed.toolsOwned) ? parsed.toolsOwned : undefined,
        medicalCheckValid: parsed.medicalCheckValid ?? undefined,
        medicalCheckUntil: parsed.medicalCheckUntil ?? null,
        safetyTrainingValid: parsed.safetyTrainingValid ?? undefined,
        safetyTrainingUntil: parsed.safetyTrainingUntil ?? null,
        certifications: Array.isArray(parsed.certifications) ? (parsed.certifications as never) : undefined,
        portfolio: Array.isArray(parsed.portfolio) ? (parsed.portfolio as never) : undefined,
        achievements: Array.isArray(parsed.achievements) ? (parsed.achievements as never) : undefined,
      });

      // Add experiences (best effort).
      for (const exp of parsed.experiences || []) {
        if (!exp.title || !exp.company) continue;
        try {
          await buildApi.addExperience({
            title: exp.title,
            company: exp.company,
            city: exp.city ?? null,
            fromDate: exp.fromDate ?? null,
            toDate: exp.toDate ?? null,
            current: !!exp.current,
            description: exp.description ?? null,
          });
        } catch {}
      }
      // Add education (best effort).
      for (const ed of parsed.education || []) {
        if (!ed.institution) continue;
        try {
          await buildApi.addEducation({
            institution: ed.institution,
            degree: ed.degree ?? null,
            field: ed.field ?? null,
            fromYear: ed.fromYear ?? null,
            toYear: ed.toYear ?? null,
          });
        } catch {}
      }

      onApplied();
      setOpen(false);
      setParsed(null);
      setText("");
      setImageBase64(null);
      setImagePreview(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
      >
        ✨ Import resume — paste, voice, or scan
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-white">Import resume → AEVION schema</div>
          <div className="text-xs text-slate-400">
            Paste text, dictate, or upload a photo of your resume — Claude maps it into our schema.
          </div>
        </div>
        <button
          onClick={() => {
            setOpen(false);
            setParsed(null);
          }}
          className="text-slate-400 hover:text-white"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 p-1 text-xs">
        <button
          onClick={() => setMode("TEXT")}
          className={`rounded-full px-3 py-1 ${
            mode === "TEXT" ? "bg-emerald-500 text-emerald-950 font-semibold" : "text-slate-300"
          }`}
        >
          Text / voice
        </button>
        <button
          onClick={() => setMode("IMAGE")}
          className={`rounded-full px-3 py-1 ${
            mode === "IMAGE" ? "bg-emerald-500 text-emerald-950 font-semibold" : "text-slate-300"
          }`}
        >
          Photo / scan
        </button>
      </div>

      {mode === "TEXT" && (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Paste your resume here, or click 🎙 voice and dictate it. Claude will extract name, skills, experience, education, certifications, etc."
            className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
          />
          <VoiceInput
            onAppend={(chunk) => setText((prev) => (prev ? prev.trim() + " " + chunk : chunk))}
            size="md"
          />
        </div>
      )}

      {mode === "IMAGE" && (
        <div className="space-y-2">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={pickImage}
            className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-500 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-emerald-950 hover:file:bg-emerald-400"
          />
          {imagePreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePreview}
              alt="resume preview"
              className="max-h-72 w-auto rounded-lg border border-white/10"
            />
          )}
          <p className="text-xs text-slate-500">JPEG / PNG / WebP / GIF. Max 6 MB.</p>
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={parse}
          disabled={busy || (mode === "TEXT" && text.trim().length < 20) || (mode === "IMAGE" && !imageBase64)}
          className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? "Parsing…" : "Parse"}
        </button>
      </div>

      {parsed && (
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/60 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              ✓ Parsed preview
            </div>
            <button
              onClick={apply}
              disabled={applying}
              className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {applying ? "Applying…" : "Apply to my profile"}
            </button>
          </div>
          <ParsedSummary parsed={parsed} />
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-slate-400">View raw JSON</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-white/5 bg-black/30 p-2 text-[10px] text-slate-300">
              {JSON.stringify(parsed, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

function ParsedSummary({ parsed }: { parsed: ParsedResume }) {
  const lines: { label: string; value: string }[] = [];
  if (parsed.name) lines.push({ label: "Name", value: parsed.name });
  if (parsed.title) lines.push({ label: "Headline", value: parsed.title });
  if (parsed.city) lines.push({ label: "City", value: parsed.city });
  if (parsed.experienceYears != null) lines.push({ label: "Experience", value: `${parsed.experienceYears}y` });
  if (Array.isArray(parsed.skills) && parsed.skills.length)
    lines.push({ label: "Skills", value: parsed.skills.join(", ") });
  if (Array.isArray(parsed.toolsOwned) && parsed.toolsOwned.length)
    lines.push({ label: "Tools owned", value: parsed.toolsOwned.join(", ") });
  if (parsed.driversLicense) lines.push({ label: "Driver's license", value: parsed.driversLicense });
  if (Array.isArray(parsed.experiences) && parsed.experiences.length)
    lines.push({ label: "Experience entries", value: `${parsed.experiences.length}` });
  if (Array.isArray(parsed.education) && parsed.education.length)
    lines.push({ label: "Education entries", value: `${parsed.education.length}` });
  if (Array.isArray(parsed.certifications) && parsed.certifications.length)
    lines.push({ label: "Certifications", value: `${parsed.certifications.length}` });

  return (
    <dl className="space-y-1.5 text-xs">
      {lines.map((l) => (
        <div key={l.label} className="flex gap-3">
          <dt className="w-32 shrink-0 text-slate-500">{l.label}</dt>
          <dd className="text-slate-200">{l.value}</dd>
        </div>
      ))}
    </dl>
  );
}
