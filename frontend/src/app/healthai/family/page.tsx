"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const BACKEND =
  process.env.NEXT_PUBLIC_COACH_BACKEND?.trim() ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4001"
    : "https://api.aevion.app");

const LS_PROFILE_ID = "aevion:healthai:profileId";

interface Profile {
  id: string;
  name: string;
  age: number;
  sex: "male" | "female" | "other";
  heightCm?: number;
  weightKg?: number;
  conditions?: string[];
  allergies?: string[];
  medications?: string[];
}

const SEX_LABEL: Record<string, string> = {
  male: "Мужской",
  female: "Женский",
  other: "Другой",
};

const SEX_ICON: Record<string, string> = {
  male: "👨",
  female: "👩",
  other: "🧑",
};

function getActiveId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_PROFILE_ID);
}

function setActiveId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_PROFILE_ID, id);
}

function removeActiveId() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS_PROFILE_ID);
}

export default function FamilyPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form state
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formAge, setFormAge] = useState("");
  const [formSex, setFormSex] = useState<"male" | "female" | "other">("male");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setActiveIdState(getActiveId());
    fetchProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProfiles() {
    setLoading(true);
    setError("");
    // We don't have auth/ownerId, so we try to fetch each known profile
    // Strategy: fetch active profile + any stored list
    const stored = getStoredProfiles();
    const fetched: Profile[] = [];
    for (const id of stored) {
      try {
        const res = await fetch(`${BACKEND}/api/healthai/profile/${encodeURIComponent(id)}`);
        if (res.ok) {
          const data = await res.json();
          fetched.push(data);
        }
      } catch {
        // skip unreachable profiles
      }
    }
    setProfiles(fetched);
    setLoading(false);
  }

  function getStoredProfiles(): string[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("aevion:healthai:profileIds");
      if (raw) return JSON.parse(raw) as string[];
      // Fallback: if we at least have the active one
      const active = localStorage.getItem(LS_PROFILE_ID);
      return active ? [active] : [];
    } catch {
      return [];
    }
  }

  function saveStoredProfiles(ids: string[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem("aevion:healthai:profileIds", JSON.stringify(ids));
  }

  async function createProfile() {
    if (!formName.trim()) { setFormError("Введите имя"); return; }
    const age = parseInt(formAge, 10);
    if (!formAge || isNaN(age) || age < 1 || age > 120) { setFormError("Введите корректный возраст (1–120)"); return; }

    setCreating(true);
    setFormError("");
    try {
      const res = await fetch(`${BACKEND}/api/healthai/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          age,
          sex: formSex,
          conditions: [],
          allergies: [],
          medications: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка создания профиля");

      const newId: string = data.id ?? data.profileId ?? data.profile?.id;
      if (!newId) throw new Error("Сервер не вернул id профиля");

      // Save to local list
      const existing = getStoredProfiles();
      if (!existing.includes(newId)) {
        saveStoredProfiles([...existing, newId]);
      }

      // Auto-activate first profile or keep existing
      const currentActive = getActiveId();
      if (!currentActive) {
        setActiveId(newId);
        setActiveIdState(newId);
      }

      // Reset form
      setFormName("");
      setFormAge("");
      setFormSex("male");
      setShowForm(false);

      // Refresh list
      await fetchProfiles();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setCreating(false);
    }
  }

  function switchProfile(id: string) {
    setActiveId(id);
    setActiveIdState(id);
  }

  async function deleteProfile(id: string) {
    setDeleting(true);
    try {
      await fetch(`${BACKEND}/api/healthai/profile/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      // Remove from local list
      const existing = getStoredProfiles().filter((x) => x !== id);
      saveStoredProfiles(existing);
      if (getActiveId() === id) {
        if (existing.length > 0) {
          setActiveId(existing[0]);
          setActiveIdState(existing[0]);
        } else {
          removeActiveId();
          setActiveIdState(null);
        }
      }
      setDeleteId(null);
      await fetchProfiles();
    } catch {
      // ignore delete errors
      setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
        <Link href="/healthai" className="text-slate-400 hover:text-white text-sm transition-colors">
          ← HealthAI
        </Link>
        <span className="text-slate-700">·</span>
        <span className="text-sm font-semibold">Семейные профили</span>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-black mb-2">👨‍👩‍👧 Семья</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Управляйте профилями здоровья для всех членов семьи. Выберите активный профиль,
            чтобы получать персонализированные советы на главной странице HealthAI.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-800/50 rounded-xl text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-slate-400 text-sm">Загрузка профилей…</span>
          </div>
        ) : (
          <>
            {/* Profile grid */}
            {profiles.length === 0 && !showForm && (
              <div className="mb-8 p-8 bg-slate-900/60 border border-slate-800 rounded-2xl text-center">
                <div className="text-5xl mb-3">👤</div>
                <p className="text-slate-400 text-sm mb-4">Нет сохранённых профилей</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  + Добавить первый профиль
                </button>
              </div>
            )}

            {profiles.length > 0 && (
              <div className="grid gap-4 mb-8">
                {profiles.map((p) => {
                  const isActive = p.id === activeId;
                  const condCount = p.conditions?.length ?? 0;
                  return (
                    <div
                      key={p.id}
                      className={`relative p-5 rounded-2xl border transition-all ${
                        isActive
                          ? "bg-violet-950/40 border-violet-600/60"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {/* Active badge */}
                      {isActive && (
                        <span className="absolute top-4 right-4 text-xs bg-violet-600/30 text-violet-300 border border-violet-600/40 px-2 py-0.5 rounded-full font-medium">
                          Активный
                        </span>
                      )}

                      <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div
                          className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 ${
                            isActive ? "bg-violet-900/50" : "bg-slate-800"
                          }`}
                        >
                          {SEX_ICON[p.sex] ?? "🧑"}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-white text-base truncate">{p.name}</div>
                          <div className="text-sm text-slate-400 mt-0.5">
                            {p.age} лет · {SEX_LABEL[p.sex] ?? p.sex}
                            {condCount > 0 && (
                              <span className="ml-2 text-orange-400">
                                · {condCount} {condCount === 1 ? "диагноз" : condCount < 5 ? "диагноза" : "диагнозов"}
                              </span>
                            )}
                          </div>
                          {p.heightCm && p.weightKg && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              {p.heightCm} см · {p.weightKg} кг
                              {" · ИМТ "}
                              {(p.weightKg / Math.pow(p.heightCm / 100, 2)).toFixed(1)}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 shrink-0">
                          {!isActive && (
                            <button
                              onClick={() => switchProfile(p.id)}
                              className="px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 text-xs font-semibold rounded-lg border border-violet-600/30 transition-colors"
                            >
                              Выбрать
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteId(p.id)}
                            className="px-3 py-1.5 bg-red-950/30 hover:bg-red-900/40 text-red-400 text-xs font-semibold rounded-lg border border-red-900/40 transition-colors"
                          >
                            Удалить
                          </button>
                        </div>
                      </div>

                      {/* Profile ID (small) */}
                      <div className="mt-3 text-xs text-slate-600 font-mono truncate">
                        ID: {p.id}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add family member button */}
            {profiles.length > 0 && !showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="w-full py-3 bg-slate-900/60 hover:bg-slate-800/80 border border-dashed border-slate-700 hover:border-violet-600/50 text-slate-400 hover:text-violet-300 text-sm font-semibold rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <span className="text-lg">+</span>
                Добавить члена семьи
              </button>
            )}

            {/* Create form */}
            {showForm && (
              <div className="p-6 bg-slate-900/80 border border-violet-800/40 rounded-2xl">
                <h2 className="font-bold text-white mb-5 flex items-center gap-2">
                  <span>👤</span> Новый профиль
                </h2>

                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                      Имя *
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Например: Мама, Иван, Дочь Алия…"
                      maxLength={60}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 focus:border-violet-500 rounded-xl text-white text-sm placeholder-slate-500 outline-none transition-colors"
                    />
                  </div>

                  {/* Age + Sex */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                        Возраст *
                      </label>
                      <input
                        type="number"
                        value={formAge}
                        onChange={(e) => setFormAge(e.target.value)}
                        placeholder="35"
                        min={1}
                        max={120}
                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 focus:border-violet-500 rounded-xl text-white text-sm placeholder-slate-500 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                        Пол *
                      </label>
                      <select
                        value={formSex}
                        onChange={(e) => setFormSex(e.target.value as "male" | "female" | "other")}
                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 focus:border-violet-500 rounded-xl text-white text-sm outline-none transition-colors appearance-none cursor-pointer"
                      >
                        <option value="male">👨 Мужской</option>
                        <option value="female">👩 Женский</option>
                        <option value="other">🧑 Другой</option>
                      </select>
                    </div>
                  </div>

                  {/* Form error */}
                  {formError && (
                    <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-red-300 text-sm">
                      {formError}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={createProfile}
                      disabled={creating}
                      className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {creating ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                          Создание…
                        </>
                      ) : (
                        "Создать профиль"
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowForm(false);
                        setFormName("");
                        setFormAge("");
                        setFormSex("male");
                        setFormError("");
                      }}
                      disabled={creating}
                      className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Active profile hint */}
        {!loading && activeId && (
          <div className="mt-8 p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex items-start gap-3">
            <span className="text-lg shrink-0">ℹ️</span>
            <div>
              <p className="text-slate-400 text-sm">
                <span className="text-violet-300 font-semibold">Активный профиль</span> используется
                на главной странице HealthAI для симптом-чека, дневника и трендов.
              </p>
              <Link
                href="/healthai"
                className="mt-1.5 inline-flex text-violet-400 hover:text-violet-300 text-xs font-semibold underline underline-offset-2 transition-colors"
              >
                Перейти в HealthAI →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-white text-lg mb-2">Удалить профиль?</h3>
            <p className="text-slate-400 text-sm mb-6">
              Профиль и все его данные будут удалены безвозвратно. Это действие нельзя отменить.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => deleteProfile(deleteId)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                    Удаление…
                  </>
                ) : (
                  "Да, удалить"
                )}
              </button>
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
