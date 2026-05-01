"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi, BuildApiError } from "@/lib/build/api";

export default function CreateProjectPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <CreateProjectForm />
      </RequireAuth>
    </BuildShell>
  );
}

function CreateProjectForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await buildApi.createProject({
        title: title.trim(),
        description: description.trim(),
        budget: budget ? Number(budget) : undefined,
        city: city.trim() || null,
      });
      router.push(`/build/project/${encodeURIComponent(created.id)}`);
    } catch (e) {
      setError((e as BuildApiError).code || (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold text-white">New construction project</h1>
      <p className="mb-6 text-sm text-slate-400">
        Describe the scope, budget, and location. You can add vacancies and files after the project is created.
      </p>

      <form onSubmit={submit} className="space-y-5 rounded-xl border border-white/10 bg-white/5 p-6">
        <Field label="Title" required>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
            maxLength={200}
            placeholder="3-storey residential block, downtown Almaty"
            className="input-build"
          />
        </Field>

        <Field label="Description" required>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={10}
            maxLength={10000}
            rows={6}
            placeholder="Scope of work, materials, expected timeline, special requirements…"
            className="input-build"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Budget (USD)">
            <input
              type="number"
              min={0}
              max={1e12}
              step="any"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="250000"
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
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create project"}
          </button>
        </div>

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
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-200">
      {label}
      {required && <span className="ml-0.5 text-rose-400">*</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
