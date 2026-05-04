"use client";

import { useState } from "react";
import {
  buildApi,
  type BuildProfile,
  type BuildRole,
  type ShiftPreference,
  type AvailabilityType,
} from "@/lib/build/api";
import { VoiceInput } from "./VoiceInput";
import { AiImprove } from "./AiImprove";
import { phoneError, normalizePhone } from "@/lib/build/validate";

const SHIFTS: ShiftPreference[] = ["DAY", "NIGHT", "FLEX", "ANY"];
const AVAILS: AvailabilityType[] = ["FULL_TIME", "PART_TIME", "PROJECT", "SHIFT", "REMOTE"];

const ROLES: { value: BuildRole; label: string; hint: string }[] = [
  { value: "CLIENT", label: "Client", hint: "I post projects and hire" },
  { value: "CONTRACTOR", label: "Contractor", hint: "I run construction projects" },
  { value: "WORKER", label: "Worker", hint: "I'm looking for jobs on projects" },
];

export function ProfileForm({
  initial,
  onSaved,
}: {
  initial: BuildProfile | null;
  onSaved?: (p: BuildProfile) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [buildRole, setBuildRole] = useState<BuildRole>(
    (initial?.buildRole as BuildRole) ?? "CLIENT",
  );

  // Resume fields
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? []);
  const [skillInput, setSkillInput] = useState("");
  const [languages, setLanguages] = useState<string[]>(initial?.languages ?? []);
  const [languageInput, setLanguageInput] = useState("");
  const [salaryMin, setSalaryMin] = useState<string>(
    initial?.salaryMin != null ? String(initial.salaryMin) : "",
  );
  const [salaryMax, setSalaryMax] = useState<string>(
    initial?.salaryMax != null ? String(initial.salaryMax) : "",
  );
  const [salaryCurrency, setSalaryCurrency] = useState(initial?.salaryCurrency ?? "RUB");
  const [availability, setAvailability] = useState(initial?.availability ?? "");
  const [experienceYears, setExperienceYears] = useState<string>(
    initial?.experienceYears != null ? String(initial.experienceYears) : "0",
  );
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? "");
  const [openToWork, setOpenToWork] = useState<boolean>(initial?.openToWork ?? false);

  // Resume v2 — construction-vertical
  const [driversLicense, setDriversLicense] = useState(initial?.driversLicense ?? "");
  const [shiftPreference, setShiftPreference] = useState<ShiftPreference | "">(
    initial?.shiftPreference ?? "",
  );
  const [availabilityType, setAvailabilityType] = useState<AvailabilityType | "">(
    initial?.availabilityType ?? "",
  );
  const [readyFromDate, setReadyFromDate] = useState(initial?.readyFromDate ?? "");
  const [preferredLocations, setPreferredLocations] = useState<string[]>(
    initial?.preferredLocations ?? [],
  );
  const [locInput, setLocInput] = useState("");
  const [toolsOwned, setToolsOwned] = useState<string[]>(initial?.toolsOwned ?? []);
  const [toolInput, setToolInput] = useState("");
  const [medicalCheckValid, setMedicalCheckValid] = useState<boolean>(
    initial?.medicalCheckValid ?? false,
  );
  const [medicalCheckUntil, setMedicalCheckUntil] = useState(initial?.medicalCheckUntil ?? "");
  const [safetyTrainingValid, setSafetyTrainingValid] = useState<boolean>(
    initial?.safetyTrainingValid ?? false,
  );
  const [safetyTrainingUntil, setSafetyTrainingUntil] = useState(initial?.safetyTrainingUntil ?? "");
  const [introVideoUrl, setIntroVideoUrl] = useState(initial?.introVideoUrl ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function addSkill() {
    const v = skillInput.trim();
    if (!v) return;
    if (skills.includes(v)) {
      setSkillInput("");
      return;
    }
    setSkills([...skills, v].slice(0, 50));
    setSkillInput("");
  }
  function addLanguage() {
    const v = languageInput.trim();
    if (!v) return;
    if (languages.includes(v)) {
      setLanguageInput("");
      return;
    }
    setLanguages([...languages, v].slice(0, 20));
    setLanguageInput("");
  }
  function addLoc() {
    const v = locInput.trim();
    if (!v || preferredLocations.includes(v)) {
      setLocInput("");
      return;
    }
    setPreferredLocations([...preferredLocations, v].slice(0, 20));
    setLocInput("");
  }
  function addTool() {
    const v = toolInput.trim();
    if (!v || toolsOwned.includes(v)) {
      setToolInput("");
      return;
    }
    setToolsOwned([...toolsOwned, v].slice(0, 50));
    setToolInput("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const phoneIssue = phoneError(phone);
    if (phoneIssue) {
      setError(phoneIssue);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await buildApi.upsertProfile({
        name: name.trim(),
        phone: phone.trim() || null,
        city: city.trim() || null,
        description: description.trim() || null,
        buildRole,
        title: title.trim() || null,
        summary: summary.trim() || null,
        skills,
        languages,
        salaryMin: salaryMin ? Number(salaryMin) : null,
        salaryMax: salaryMax ? Number(salaryMax) : null,
        salaryCurrency: salaryCurrency || "RUB",
        availability: availability.trim() || null,
        experienceYears: experienceYears ? Number(experienceYears) : 0,
        photoUrl: photoUrl.trim() || null,
        openToWork,
        driversLicense: driversLicense.trim() || null,
        shiftPreference: shiftPreference || null,
        availabilityType: availabilityType || null,
        readyFromDate: readyFromDate.trim() || null,
        preferredLocations,
        toolsOwned,
        medicalCheckValid,
        medicalCheckUntil: medicalCheckUntil.trim() || null,
        safetyTrainingValid,
        safetyTrainingUntil: safetyTrainingUntil.trim() || null,
        introVideoUrl: introVideoUrl.trim() || null,
      });
      setSavedAt(new Date().toISOString());
      onSaved?.(saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <SectionTitle title="Identity" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Display name" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={200}
            className="input-build"
          />
        </Field>
        <Field label="Headline / job title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="e.g. Senior welder, 8 years"
            className="input-build"
          />
        </Field>
        <Field label="City">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={100}
            className="input-build"
          />
        </Field>
        <Field label="Phone">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => {
              const n = normalizePhone(phone);
              if (n && n !== phone) setPhone(n);
            }}
            maxLength={32}
            placeholder="+7 700 000 0000"
            inputMode="tel"
            autoComplete="tel"
            aria-invalid={phoneError(phone) ? true : undefined}
            className={`input-build ${phoneError(phone) ? "ring-1 ring-rose-500/40" : ""}`}
          />
          {phoneError(phone) && (
            <p className="mt-1 text-xs text-rose-300">{phoneError(phone)}</p>
          )}
        </Field>
        <Field label="Photo URL">
          <input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            maxLength={2000}
            placeholder="https://…"
            className="input-build"
          />
        </Field>
        <Field label="🎬 Intro video URL (YouTube / Vimeo / mp4)">
          <input
            value={introVideoUrl}
            onChange={(e) => setIntroVideoUrl(e.target.value)}
            maxLength={500}
            placeholder="https://youtu.be/… — 30s pitch makes you 10× more memorable"
            className="input-build"
          />
        </Field>
        <Field label="Role">
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <button
                type="button"
                key={r.value}
                onClick={() => setBuildRole(r.value)}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                  buildRole === r.value
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-white/30"
                }`}
              >
                <div className="font-semibold">{r.label}</div>
                <div className="opacity-70">{r.hint}</div>
              </button>
            ))}
          </div>
        </Field>
      </div>

      <SectionTitle title="Resume" hint="Visible on your public profile (/build/u/[id])." />

      <Field label="Summary">
        <div className="space-y-1.5">
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="2–3 lines about yourself: specialisation, key projects, what you're looking for."
            className="input-build"
          />
          <AiImprove
            value={summary}
            onAccept={(v) => setSummary(v)}
            kind="summary"
            hint="Сделать summary ярче и конкретнее"
          />
          <div className="flex items-center justify-between">
            <VoiceInput
              onAppend={(chunk) =>
                setSummary((prev) => (prev ? prev.trim() + " " + chunk : chunk))
              }
            />
            <span className="text-[10px] text-slate-500">
              Voice → finalized speech appends to the field. Lang switcher next to the mic.
            </span>
          </div>
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Skills (press Enter to add)">
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-white/10 bg-white/5 p-2">
            {skills.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200"
              >
                {s}
                <button
                  type="button"
                  onClick={() => setSkills(skills.filter((x) => x !== s))}
                  className="text-emerald-200/60 hover:text-emerald-200"
                  aria-label={`Remove ${s}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addSkill();
                }
              }}
              onBlur={addSkill}
              placeholder={skills.length === 0 ? "Welding, AutoCAD, Lifting permit…" : ""}
              className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>
        </Field>

        <Field label="Languages">
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-white/10 bg-white/5 p-2">
            {languages.map((l) => (
              <span
                key={l}
                className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-200"
              >
                {l}
                <button
                  type="button"
                  onClick={() => setLanguages(languages.filter((x) => x !== l))}
                  className="text-sky-200/60 hover:text-sky-200"
                  aria-label={`Remove ${l}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={languageInput}
              onChange={(e) => setLanguageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addLanguage();
                }
              }}
              onBlur={addLanguage}
              placeholder={languages.length === 0 ? "Russian native, English B2…" : ""}
              className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>
        </Field>

        <Field label="Years of experience">
          <input
            type="number"
            min={0}
            max={80}
            value={experienceYears}
            onChange={(e) => setExperienceYears(e.target.value.replace(/[^\d]/g, ""))}
            className="input-build"
          />
        </Field>

        <Field label="Availability">
          <input
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            maxLength={100}
            placeholder="Immediately / 2 weeks / part-time"
            className="input-build"
          />
        </Field>

        <Field label="Salary expectation — min">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="0"
              className="input-build flex-1"
            />
            <select
              value={salaryCurrency}
              onChange={(e) => setSalaryCurrency(e.target.value)}
              className="input-build w-24"
            >
              <option value="RUB">RUB</option>
              <option value="USD">USD</option>
              <option value="KZT">KZT</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </Field>
        <Field label="Salary expectation — max">
          <input
            type="number"
            min={0}
            value={salaryMax}
            onChange={(e) => setSalaryMax(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="optional"
            className="input-build"
          />
        </Field>
      </div>

      <Field label="">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={openToWork}
            onChange={(e) => setOpenToWork(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-white/5 accent-emerald-500"
          />
          <span>Open to work — show me in talent search</span>
        </label>
      </Field>

      <SectionTitle
        title="Construction-vertical"
        hint="Detailed signals that matter for on-site hiring — most platforms miss these. Filling them puts you on top of recruiter searches."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Driver's license categories">
          <input
            value={driversLicense}
            onChange={(e) => setDriversLicense(e.target.value)}
            placeholder="B, C, E (comma-separated)"
            maxLength={32}
            className="input-build"
          />
        </Field>
        <Field label="Ready from (date)">
          <input
            type="date"
            value={readyFromDate}
            onChange={(e) => setReadyFromDate(e.target.value)}
            className="input-build"
          />
        </Field>
        <Field label="Availability type">
          <div className="flex flex-wrap gap-1">
            {AVAILS.map((a) => (
              <button
                type="button"
                key={a}
                onClick={() => setAvailabilityType(availabilityType === a ? "" : a)}
                className={`rounded-md border px-2.5 py-1 text-xs transition ${
                  availabilityType === a
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-white/30"
                }`}
              >
                {a.replace("_", " ")}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Shift preference">
          <div className="flex flex-wrap gap-1">
            {SHIFTS.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setShiftPreference(shiftPreference === s ? "" : s)}
                className={`rounded-md border px-2.5 py-1 text-xs transition ${
                  shiftPreference === s
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-white/30"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Preferred locations">
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-white/10 bg-white/5 p-2">
            {preferredLocations.map((l) => (
              <span
                key={l}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200"
              >
                {l}
                <button
                  type="button"
                  onClick={() => setPreferredLocations(preferredLocations.filter((x) => x !== l))}
                  className="text-amber-200/60 hover:text-amber-200"
                  aria-label={`Remove ${l}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={locInput}
              onChange={(e) => setLocInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addLoc();
                }
              }}
              onBlur={addLoc}
              placeholder={preferredLocations.length === 0 ? "Almaty, Astana, Remote…" : ""}
              className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>
        </Field>

        <Field label="Tools / equipment owned">
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-white/10 bg-white/5 p-2">
            {toolsOwned.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-xs text-fuchsia-200"
              >
                {t}
                <button
                  type="button"
                  onClick={() => setToolsOwned(toolsOwned.filter((x) => x !== t))}
                  className="text-fuchsia-200/60 hover:text-fuchsia-200"
                  aria-label={`Remove ${t}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={toolInput}
              onChange={(e) => setToolInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTool();
                }
              }}
              onBlur={addTool}
              placeholder={toolsOwned.length === 0 ? "Welding mask, drill, scaffolding…" : ""}
              className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="">
          <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
            <input
              type="checkbox"
              checked={medicalCheckValid}
              onChange={(e) => setMedicalCheckValid(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-emerald-500"
            />
            <div className="flex-1">
              <div className="font-medium text-slate-200">Medical check valid</div>
              <input
                type="date"
                value={medicalCheckUntil}
                onChange={(e) => setMedicalCheckUntil(e.target.value)}
                disabled={!medicalCheckValid}
                placeholder="valid until"
                className="input-build mt-1.5 text-xs disabled:opacity-50"
              />
            </div>
          </label>
        </Field>
        <Field label="">
          <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
            <input
              type="checkbox"
              checked={safetyTrainingValid}
              onChange={(e) => setSafetyTrainingValid(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-emerald-500"
            />
            <div className="flex-1">
              <div className="font-medium text-slate-200">Safety training current</div>
              <input
                type="date"
                value={safetyTrainingUntil}
                onChange={(e) => setSafetyTrainingUntil(e.target.value)}
                disabled={!safetyTrainingValid}
                placeholder="valid until"
                className="input-build mt-1.5 text-xs disabled:opacity-50"
              />
            </div>
          </label>
        </Field>
      </div>

      <Field label="About (long-form)">
        <div className="space-y-1.5">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            maxLength={4000}
            placeholder="References, certifications, equipment owned, recent projects…"
            className="input-build"
          />
          <VoiceInput
            onAppend={(chunk) =>
              setDescription((prev) => (prev ? prev.trim() + " " + chunk : chunk))
            }
          />
        </div>
      </Field>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {savedAt && !error && (
        <p className="text-sm text-emerald-300">Saved · {new Date(savedAt).toLocaleTimeString()}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {saving ? "Saving…" : initial ? "Update profile" : "Create profile"}
      </button>

      <style>{`
        .input-build {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          color: white;
        }
        .input-build:focus { outline: none; border-color: rgba(16,185,129,0.5); }
        .input-build::placeholder { color: rgb(100,116,139); }
      `}</style>
    </form>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border-b border-white/10 pb-1">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-slate-200">
      {label && (
        <>
          {label}
          {required && <span className="ml-0.5 text-rose-400">*</span>}
        </>
      )}
      <div className={label ? "mt-1.5" : ""}>{children}</div>
    </label>
  );
}
