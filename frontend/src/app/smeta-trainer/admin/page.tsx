"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchAdminStudents,
  fetchGroups,
  pingBackend,
  type AdminStudentRecord,
  type GroupInfo,
} from "../lib/progressApi";
import { LEVELS } from "../lib/levels";

const JWT_KEY = "aevion-smeta-admin-jwt-v1";

export default function AdminPage() {
  const [jwt, setJwt] = useState("");
  const [storedJwt, setStoredJwt] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [students, setStudents] = useState<AdminStudentRecord[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [groupFilter, setGroupFilter] = useState("");
  const [totalInGroup, setTotalInGroup] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  useEffect(() => {
    pingBackend().then(setBackendOk);
    try {
      const saved = localStorage.getItem(JWT_KEY);
      if (saved) setStoredJwt(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (!storedJwt) return;
    fetchGroups().then(setGroups).catch(() => {});
    loadStudents(storedJwt, "");
  }, [storedJwt]);

  async function loadStudents(token: string, group: string) {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchAdminStudents(token, group || undefined);
      setStudents(r.students);
      setTotalInGroup(r.totalInGroup);
      setAuthed(true);
    } catch {
      setError("Ошибка загрузки. JWT неверный или бэкенд недоступен.");
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }

  function handleAuth() {
    if (!jwt.trim()) return;
    try { localStorage.setItem(JWT_KEY, jwt.trim()); } catch {}
    setStoredJwt(jwt.trim());
  }

  function handleLogout() {
    try { localStorage.removeItem(JWT_KEY); } catch {}
    setStoredJwt(null);
    setAuthed(false);
    setStudents([]);
    setJwt("");
  }

  function handleGroupFilter(g: string) {
    setGroupFilter(g);
    if (storedJwt) loadStudents(storedJwt, g);
  }

  if (backendOk === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white border border-amber-200 rounded-xl p-6 max-w-md text-center">
          <div className="text-3xl mb-2">⚠</div>
          <div className="text-base font-bold text-slate-900">Бэкенд недоступен</div>
          <p className="text-sm text-slate-600 mt-2">
            Страница куратора требует aevion-globus-backend на :4001. Запустите бэкенд
            и обновите страницу.
          </p>
          <Link href="/smeta-trainer" className="inline-block mt-4 text-emerald-600 underline text-sm">
            ← К курсу
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/smeta-trainer" className="text-xs text-slate-400 hover:text-white">
            ← К курсу
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Куратор · все студенты курса</h1>
            <p className="text-[11px] text-slate-400">
              Полный обзор прогресса. Требуется JWT токен AEVION (sub = userId куратора).
            </p>
          </div>
          {authed && (
            <button
              onClick={handleLogout}
              className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded"
            >
              Выйти
            </button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-4 space-y-4">
        {!storedJwt && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 max-w-lg mx-auto">
            <div className="text-sm font-semibold text-slate-900 mb-3">Аутентификация куратора</div>
            <p className="text-xs text-slate-600 mb-3">
              Вставьте JWT токен AEVION (получить можно через /api/auth/login или у админа).
              Токен хранится в localStorage и шлётся в Authorization: Bearer ...
            </p>
            <input
              type="password"
              placeholder="eyJhbGciOi..."
              value={jwt}
              onChange={(e) => setJwt(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-mono"
            />
            <button
              onClick={handleAuth}
              disabled={!jwt.trim()}
              className="mt-3 w-full py-2 bg-emerald-600 text-white text-sm font-semibold rounded hover:bg-emerald-700 disabled:opacity-40"
            >
              Войти
            </button>
            {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
          </div>
        )}

        {storedJwt && (
          <>
            {/* Filter bar */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3 flex-wrap">
              <div className="text-xs text-slate-500">Фильтр группы:</div>
              <button
                onClick={() => handleGroupFilter("")}
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  !groupFilter ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                Все
              </button>
              {groups.map((g) => (
                <button
                  key={g.name}
                  onClick={() => handleGroupFilter(g.name)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    groupFilter === g.name ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {g.name} ({g.count})
                </button>
              ))}
              <div className="ml-auto text-xs text-slate-500">
                Показано: <strong>{students.length}</strong> / в группе: <strong>{totalInGroup}</strong>
              </div>
            </div>

            {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
            {loading && <div className="text-sm text-slate-500 text-center py-4">Загрузка…</div>}

            {/* Table */}
            {!loading && students.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-400 text-sm">
                В этой группе пока нет студентов.
              </div>
            )}
            {students.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600">
                      <th className="px-3 py-2 text-left">Студент / Группа</th>
                      <th className="px-3 py-2 text-center" title="Зачтённые уровни">🏆</th>
                      {LEVELS.map((lv) => (
                        <th key={lv.num} className="px-1.5 py-2 text-center" title={lv.title}>L{lv.num}</th>
                      ))}
                      <th className="px-3 py-2 text-center" title="Уроков пройдено">📚</th>
                      <th className="px-3 py-2 text-center" title="Практик решено">🕵️</th>
                      <th className="px-3 py-2 text-center" title="Капстоун">📜</th>
                      <th className="px-3 py-2 text-center" title="Бейджей">🏅</th>
                      <th className="px-3 py-2 text-right">Активность</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => {
                      const totalScore = Object.values(s.levels).reduce((a, l) => a + (l.score ?? 0), 0);
                      const lastSeen = new Date(s.updatedAt);
                      const ago = Math.floor((Date.now() - s.updatedAt) / (1000 * 60 * 60 * 24));
                      return (
                        <tr key={s.deviceId} className="border-t hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <div className="font-semibold text-slate-900">
                              {s.displayName || <span className="text-slate-400 italic">аноним</span>}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {s.group || "без группы"} · {s.deviceId.slice(0, 14)}…
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center font-bold text-emerald-700">
                            {s.doneLevels}/5
                          </td>
                          {LEVELS.map((lv) => {
                            const lp = s.levels[String(lv.num)];
                            const status = lp?.status ?? "open";
                            return (
                              <td key={lv.num} className="px-1.5 py-2 text-center">
                                {status === "done" ? (
                                  <span className="text-emerald-600 font-bold" title={`${lp?.score ?? "?"} баллов`}>
                                    ✓
                                  </span>
                                ) : status === "in-progress" ? (
                                  <span className="text-amber-500" title="В процессе">⋯</span>
                                ) : (
                                  <span className="text-slate-300">·</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center font-mono text-sky-700">{s.lessonsDone}</td>
                          <td className="px-3 py-2 text-center font-mono text-purple-700">{s.practiceDone}</td>
                          <td className="px-3 py-2 text-center">
                            {s.capstonePassedAt ? (
                              <span className="text-purple-600">✓</span>
                            ) : (
                              <span className="text-slate-300">·</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-amber-600">{s.achievementsCount}</td>
                          <td className="px-3 py-2 text-right text-[10px] text-slate-500">
                            <div title={lastSeen.toLocaleString("ru-RU")}>
                              {ago === 0 ? "сегодня" : ago === 1 ? "вчера" : `${ago} дн назад`}
                            </div>
                            <div className="font-mono text-slate-400">∑{totalScore}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-[10px] text-slate-400 text-center italic">
              JWT хранится в localStorage этого браузера. Выход чистит токен.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
