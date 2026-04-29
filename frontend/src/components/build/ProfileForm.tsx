"use client";

import { useState } from "react";
import { buildApi, type BuildProfile, type BuildRole } from "@/lib/build/api";

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await buildApi.upsertProfile({
        name: name.trim(),
        phone: phone.trim() || null,
        city: city.trim() || null,
        description: description.trim() || null,
        buildRole,
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
    <form onSubmit={submit} className="space-y-5">
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
        <Field label="Phone">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={32}
            placeholder="+1 555 0100"
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

      <Field label="About">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          maxLength={4000}
          placeholder="Experience, specialisations, references…"
          className="input-build"
        />
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
      {label}
      {required && <span className="ml-0.5 text-rose-400">*</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
