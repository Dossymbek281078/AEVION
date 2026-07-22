"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useToast } from "@/components/build/Toast";
import { useI18n } from "@/lib/i18n";

interface JobAlert {
  id: string;
  keywords: string;
  skills: string;
  city: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const POPULAR_SKILLS = [
  { value: "Сварщик", key: "welder" },
  { value: "Штукатур", key: "plasterer" },
  { value: "Электрик", key: "electrician" },
  { value: "Плотник", key: "carpenter" },
  { value: "Прораб", key: "foreman" },
  { value: "Каменщик", key: "mason" },
  { value: "Слесарь", key: "fitter" },
  { value: "Маляр", key: "painter" },
];
const POPULAR_CITIES = [
  { value: "Алматы", key: "almaty" },
  { value: "Астана", key: "astana" },
  { value: "Шымкент", key: "shymkent" },
  { value: "Атырау", key: "atyrau" },
  { value: "Актобе", key: "aktobe" },
  { value: "Москва", key: "moscow" },
  { value: "Санкт-Петербург", key: "spb" },
];

function AlertContent() {
  const { t } = useI18n();
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
      toast.success(t("build.alerts.savedToast"));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("build.alerts.genericError"));
    } finally {
      setSaving(false);
    }
  }

  async function unsubscribe() {
    if (!confirm(t("build.alerts.unsubscribeConfirm"))) return;
    try {
      await buildApi.deleteAlert();
      toast.success(t("build.alerts.unsubscribedToast"));
      setAlert(null);
      setKeywords(""); setSkills(""); setCity("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("build.alerts.genericError"));
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
        <h1 className="text-xl font-bold">{t("build.alerts.title")}</h1>
        <p className="text-slate-400 text-sm mt-1">
          {t("build.alerts.subtitle")}
        </p>
      </div>

      {loading && <div className="text-center py-12 text-slate-500 animate-pulse text-sm">{t("build.alerts.loading")}</div>}

      {!loading && (
        <>
          {alert?.active && (
            <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-300">{t("build.alerts.activeLabel")}</p>
                <p className="text-xs text-emerald-400/70 mt-0.5">
                  {t("build.alerts.activeDescription")}
                </p>
              </div>
              <button
                onClick={unsubscribe}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors"
              >
                {t("build.alerts.unsubscribe")}
              </button>
            </div>
          )}

          <div className="space-y-5">
            {/* Keywords */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                {t("build.alerts.keywordsLabel")}
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder={t("build.alerts.keywordsPlaceholder")}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500"
              />
              <p className="text-xs text-slate-600 mt-1">{t("build.alerts.keywordsHint")}</p>
            </div>

            {/* Skills */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                {t("build.alerts.skillsLabel")}
              </label>
              <input
                type="text"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder={t("build.alerts.skillsPlaceholder")}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 mb-2"
              />
              <div className="flex gap-1.5 flex-wrap">
                {POPULAR_SKILLS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => addSkill(s.value)}
                    type="button"
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
                  >
                    + {t(`build.alerts.skill.${s.key}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                {t("build.alerts.cityLabel")}
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t("build.alerts.cityPlaceholder")}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 mb-2"
              />
              <div className="flex gap-1.5 flex-wrap">
                {POPULAR_CITIES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setCity(c.value)}
                    type="button"
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                      city === c.value
                        ? "bg-violet-600 border-violet-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    {t(`build.alerts.city.${c.key}`)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold rounded-xl transition-colors"
            >
              {saving ? t("build.alerts.saving") : alert?.active ? t("build.alerts.updateAlert") : t("build.alerts.enableNotifications")}
            </button>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-500 space-y-1">
              <p>{t("build.alerts.noteEmail")}</p>
              <p>{t("build.alerts.noteFrequency")}</p>
              <p>{t("build.alerts.noteUnsubscribe")}</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex gap-4 text-xs text-slate-600">
            <Link href="/build/vacancies" className="hover:text-slate-400">{t("build.alerts.allVacancies")}</Link>
            <Link href="/build/profile" className="hover:text-slate-400">{t("build.alerts.myProfile")}</Link>
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
