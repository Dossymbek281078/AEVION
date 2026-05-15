"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useToast } from "@/components/build/Toast";

interface JobAlert {
  id: string;
  keywords: string;
  skills: string;
  city: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const POPULAR_SKILLS = ["Сварщик", "Штукатур", "Электрик", "Плотник", "Прораб", "Каменщик", "Слесарь", "Маляр"];
const POPULAR_CITIES = ["Алматы", "Астана", "Шымкент", "Атырау", "Актобе", "Москва", "Санкт-Петербург"];

function AlertContent() {
  const toast = useToast();
  const [alert, setAlert] = useState<JobAlert | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [keywords, setKeywords] = useState("");
  const [skills, setSkills] = useState("");
  const [city, setCity] = useState("");

  async function load() {
    try {
      const r = await buildApi.myAlert();
      const a = r.alert ?? null;
      setAlert(a);
      if (a) {
        setKeywords(a.keywords ?? "");
        setSkills(a.skills ?? "");
        setCity(a.city ?? "");
      }
    } catch {
      setAlert(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      await buildApi.upsertAlert({ keywords, skills, city: city || undefined });
      toast.success("Алерт сохранён — вы будете получать письма о новых вакансиях");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function unsubscribe() {
    if (!confirm("Отписаться от job-алертов?")) return;
    try {
      await buildApi.deleteAlert();
      toast.success("Отписались от уведомлений");
      setAlert(null);
      setKeywords(""); setSkills(""); setCity("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  function addSkill(s: string) {
    const current = skills.split(",").map((x) => x.trim()).filter(Boolean);
    if (!current.includes(s)) {
      setSkills([...current, s].join(", "));
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Job-алерты</h1>
        <p className="text-slate-400 text-sm mt-1">
          Получайте письма на email когда появляются новые вакансии по вашему запросу.
        </p>
      </div>

      {loading && <div className="text-center py-12 text-slate-500 animate-pulse text-sm">Загрузка…</div>}

      {!loading && (
        <>
          {alert?.active && (
            <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-300">✓ Алерт активен</p>
                <p className="text-xs text-emerald-400/70 mt-0.5">
                  Вы получаете уведомления о новых вакансиях
                </p>
              </div>
              <button
                onClick={unsubscribe}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors"
              >
                Отписаться
              </button>
            </div>
          )}

          <div className="space-y-5">
            {/* Keywords */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Ключевые слова в названии или описании
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="сварщик, прораб, монтаж..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500"
              />
              <p className="text-xs text-slate-600 mt-1">Через запятую. Пусто = все вакансии</p>
            </div>

            {/* Skills */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Навыки
              </label>
              <input
                type="text"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="сварка, арматура, опалубка..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 mb-2"
              />
              <div className="flex gap-1.5 flex-wrap">
                {POPULAR_SKILLS.map((s) => (
                  <button
                    key={s}
                    onClick={() => addSkill(s)}
                    type="button"
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Город (опционально)
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Алматы"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 mb-2"
              />
              <div className="flex gap-1.5 flex-wrap">
                {POPULAR_CITIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCity(c)}
                    type="button"
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                      city === c
                        ? "bg-violet-600 border-violet-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold rounded-xl transition-colors"
            >
              {saving ? "Сохранение…" : alert?.active ? "Обновить алерт" : "Включить уведомления"}
            </button>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-500 space-y-1">
              <p>• Письма отправляются на email вашего аккаунта AEVION</p>
              <p>• Максимум 1 письмо в день при появлении новых вакансий</p>
              <p>• Отписаться можно в любой момент</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex gap-4 text-xs text-slate-600">
            <Link href="/build/vacancies" className="hover:text-slate-400">← Все вакансии</Link>
            <Link href="/build/profile" className="hover:text-slate-400">Мой профиль</Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function AlertsPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <AlertContent />
      </RequireAuth>
    </BuildShell>
  );
}
