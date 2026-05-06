"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LEVELS } from "../lib/levels";
import { useProgress } from "../lib/useProgress";
import {
  fetchAttempts,
  fetchLeaderboard,
  fetchStats,
  pingBackend,
  syncProgress,
  type AttemptRecord,
  type LeaderboardEntry,
  type SmetaStats,
} from "../lib/progressApi";

export default function DashboardPage() {
  const { progress } = useProgress();
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<SmetaStats | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [group, setGroup] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Bootstrap: проверка бэкенда + первичная загрузка
  useEffect(() => {
    pingBackend().then((ok) => {
      setBackendOk(ok);
      if (ok) {
        Promise.all([fetchAttempts(20), fetchLeaderboard(undefined, 10), fetchStats()]).then(
          ([a, l, s]) => {
            setAttempts(a);
            setLeaderboard(l);
            setStats(s);
          },
        );
      }
    });
  }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      await syncProgress(progress, displayName || undefined, group || undefined);
      setSyncMsg("✓ Синхронизировано");
      // обновим данные
      const [a, l, s] = await Promise.all([
        fetchAttempts(20),
        fetchLeaderboard(undefined, 10),
        fetchStats(),
      ]);
      setAttempts(a);
      setLeaderboard(l);
      setStats(s);
    } catch {
      setSyncMsg("✕ Ошибка синхронизации (бэкенд недоступен)");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 3500);
    }
  }

  const done = Object.values(progress.levels).filter((l) => l.status === "done").length;
  const total = LEVELS.length;
  const totalScore = Object.values(progress.levels).reduce(
    (a, l) => a + (l.score ?? 0),
    0,
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/smeta-trainer" className="text-xs text-slate-500 hover:text-slate-900">
            ← К курсу
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">Dashboard студента</h1>
            <p className="text-[11px] text-slate-500">
              Прогресс, история попыток, лидерборд курса · бэкенд:{" "}
              {backendOk === null ? (
                <span className="text-slate-400">проверка…</span>
              ) : backendOk ? (
                <span className="text-emerald-600 font-semibold">live</span>
              ) : (
                <span className="text-amber-600 font-semibold">оффлайн (только локальные данные)</span>
              )}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-4 grid grid-cols-12 gap-4">
        {/* ── Левая колонка: личный прогресс ─────────── */}
        <section className="col-span-7 space-y-4">
          {/* Карточка с общим счётом */}
          <div className="bg-white border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-slate-500">Уровней зачтено</div>
                <div className="text-3xl font-bold text-emerald-600">
                  {done}/{total}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Сумма скоров</div>
                <div className="text-3xl font-bold text-slate-900">{totalScore}</div>
              </div>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
          </div>

          {/* Прогресс по уровням */}
          <div className="bg-white border rounded-lg p-5">
            <div className="text-sm font-semibold text-slate-900 mb-3">
              Прогресс по уровням
            </div>
            <div className="space-y-2">
              {LEVELS.map((lv) => {
                const lp = progress.levels[lv.num] ?? { status: "open" as const };
                const status = lp.status;
                const colors: Record<string, string> = {
                  done: "border-emerald-300 bg-emerald-50",
                  "in-progress": "border-amber-300 bg-amber-50",
                  open: "border-slate-200 bg-white",
                  locked: "border-slate-200 bg-slate-50 opacity-60",
                };
                const labels: Record<string, string> = {
                  done: "Зачтён ✓",
                  "in-progress": "В процессе",
                  open: "Не начат",
                  locked: "Закрыт",
                };
                return (
                  <Link
                    key={lv.num}
                    href={`/smeta-trainer/level/${lv.num}`}
                    className={`block px-3 py-2 border-2 rounded-lg ${colors[status]}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{lv.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900">
                          Уровень {lv.num} · {lv.title}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {labels[status]}
                          {lp.score !== undefined && (
                            <span className="ml-2 text-emerald-700 font-semibold">
                              {lp.score}/100
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-slate-300 text-sm">→</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Sync */}
          <div className="bg-white border rounded-lg p-5">
            <div className="text-sm font-semibold text-slate-900 mb-3">
              Синхронизация с курсом
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              Сохранить локальный прогресс в облако курса (для просмотра куратором
              и cross-device sync). Данные привязываются к этому устройству.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <input
                type="text"
                placeholder="Ваше имя"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
                className="border rounded px-3 py-1.5 text-sm"
              />
              <input
                type="text"
                placeholder="Группа (необязательно)"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                maxLength={40}
                className="border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSync}
                disabled={syncing || backendOk === false}
                className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 disabled:opacity-50"
              >
                {syncing ? "Синхронизация…" : "Синхронизировать"}
              </button>
              {syncMsg && (
                <span
                  className={`text-xs ${
                    syncMsg.startsWith("✓") ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {syncMsg}
                </span>
              )}
            </div>
          </div>

          {/* История попыток */}
          {backendOk && attempts.length > 0 && (
            <div className="bg-white border rounded-lg p-5">
              <div className="text-sm font-semibold text-slate-900 mb-3">
                История попыток · последние {attempts.length}
              </div>
              <div className="space-y-1">
                {attempts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between text-xs px-2 py-1 hover:bg-slate-50 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400 w-32">
                        {new Date(a.ts).toLocaleString("ru-RU")}
                      </span>
                      <span className="text-slate-600">Ур. {a.level}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-700">{a.kind}</span>
                    </div>
                    {a.score !== null && (
                      <span
                        className={`font-mono font-semibold ${
                          a.score >= 80
                            ? "text-emerald-700"
                            : a.score >= 50
                              ? "text-amber-700"
                              : "text-red-700"
                        }`}
                      >
                        {a.score}/100
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Правая колонка: лидерборд + статистика ─────────── */}
        <aside className="col-span-5 space-y-4">
          {backendOk && stats && (
            <div className="bg-white border rounded-lg p-5">
              <div className="text-sm font-semibold text-slate-900 mb-3">
                Статистика курса
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <div className="text-[11px] text-slate-500">Студентов</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {stats.studentsTotal}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Попыток</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {stats.attemptsTotal}
                  </div>
                </div>
              </div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase mb-2">
                По уровням
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 text-[10px]">
                    <th className="py-1">Ур.</th>
                    <th className="py-1 text-right">Зачтено</th>
                    <th className="py-1 text-right">В процессе</th>
                    <th className="py-1 text-right">Ø балл</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map((lvl) => {
                    const b = stats.perLevel[lvl] ?? { open: 0, "in-progress": 0, done: 0, avgScore: 0 };
                    return (
                      <tr key={lvl} className="border-t">
                        <td className="py-1 font-mono">{lvl}</td>
                        <td className="py-1 text-right text-emerald-700">{b.done}</td>
                        <td className="py-1 text-right text-amber-700">{b["in-progress"]}</td>
                        <td className="py-1 text-right font-semibold">
                          {b.avgScore || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {backendOk && leaderboard.length > 0 && (
            <div className="bg-white border rounded-lg p-5">
              <div className="text-sm font-semibold text-slate-900 mb-3">
                Лидерборд · топ-{leaderboard.length}
              </div>
              <div className="space-y-1">
                {leaderboard.map((e, i) => (
                  <div
                    key={e.deviceId}
                    className="flex items-center gap-3 px-2 py-1.5 hover:bg-slate-50 rounded text-xs"
                  >
                    <span
                      className={`w-6 text-center font-bold ${
                        i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-600" : "text-slate-300"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {e.displayName || "Аноним"}
                      </div>
                      {e.group && (
                        <div className="text-[10px] text-slate-400">{e.group}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-semibold text-slate-700">
                        {e.totalScore}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {e.doneCount} ур.
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {backendOk === false && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
              <div className="font-semibold mb-1">Бэкенд курса недоступен</div>
              Локальный прогресс работает, но облачные функции (лидерборд,
              синхронизация между устройствами, статистика курса) требуют
              запущенного aevion-globus-backend на :4001.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
