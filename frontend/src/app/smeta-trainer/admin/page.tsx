"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import {
  fetchAdminStudents,
  fetchGroups,
  pingBackend,
  fetchWebhooks,
  createWebhook,
  deleteWebhook,
  testWebhook,
  type AdminStudentRecord,
  type GroupInfo,
  type WebhookConfig,
  type WebhookEvent,
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
    loadWebhooks(storedJwt);
  }, [storedJwt]);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [newSecret, setNewSecret] = useState<{ id: string; secret: string } | null>(null);
  const [whUrl, setWhUrl] = useState("");
  const [whLabel, setWhLabel] = useState("");
  const [whEvents, setWhEvents] = useState<Set<WebhookEvent>>(new Set());

  async function loadWebhooks(token: string) {
    try {
      const list = await fetchWebhooks(token);
      setWebhooks(list);
    } catch {}
  }

  async function handleCreateWebhook() {
    if (!storedJwt) return;
    try {
      const created = await createWebhook(storedJwt, {
        url: whUrl.trim(),
        label: whLabel.trim(),
        events: [...whEvents],
      });
      setNewSecret({ id: created.id, secret: created.secret });
      setWhUrl("");
      setWhLabel("");
      setWhEvents(new Set());
      setShowWebhookForm(false);
      await loadWebhooks(storedJwt);
    } catch {
      alert("Ошибка создания webhook'а — проверьте URL и JWT.");
    }
  }

  async function handleDeleteWebhook(id: string) {
    if (!storedJwt) return;
    if (!confirm("Удалить webhook?")) return;
    try {
      await deleteWebhook(storedJwt, id);
      await loadWebhooks(storedJwt);
    } catch {}
  }

  async function handleTestWebhook(id: string) {
    if (!storedJwt) return;
    try {
      const r = await testWebhook(storedJwt, id);
      if (r.ok) alert(`✓ Тест прошёл (${r.status})`);
      else alert(`✗ Тест не прошёл: ${r.status ? `HTTP ${r.status} ${r.statusText}` : r.error}`);
      await loadWebhooks(storedJwt);
    } catch {
      alert("Ошибка теста webhook'а.");
    }
  }

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

            {/* Charts: distribution per level + lessons */}
            {!loading && students.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <LevelChart students={students} />
                <LessonsChart students={students} />
              </div>
            )}

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

            {/* ── Webhooks (LMS integration) ─────────────────── */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mt-4">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">🔗 LMS Webhooks</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    POST на ваш URL при level/lesson/capstone/achievement событиях.
                    Подпись HMAC-SHA256 в <code className="text-[10px] bg-slate-100 px-1 rounded">X-Aevion-Signature</code>.
                  </p>
                </div>
                <button
                  onClick={() => setShowWebhookForm((v) => !v)}
                  className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700"
                >
                  {showWebhookForm ? "Отмена" : "+ Создать"}
                </button>
              </div>

              {newSecret && (
                <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 text-xs">
                  <div className="font-bold text-amber-900 mb-1">
                    ⚠ Сохраните секрет — он показывается ОДИН РАЗ
                  </div>
                  <div className="font-mono text-[11px] bg-white border border-amber-300 rounded p-2 break-all">
                    {newSecret.secret}
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(newSecret.secret)}
                    className="mt-1 text-[10px] text-amber-700 underline"
                  >
                    📋 Копировать
                  </button>
                  <button
                    onClick={() => setNewSecret(null)}
                    className="ml-3 mt-1 text-[10px] text-slate-500 underline"
                  >
                    Я записал, скрыть
                  </button>
                </div>
              )}

              {showWebhookForm && (
                <div className="px-4 py-3 border-b border-slate-200 space-y-2 bg-slate-50">
                  <input
                    type="text"
                    value={whLabel}
                    onChange={(e) => setWhLabel(e.target.value)}
                    placeholder="Имя (например: Moodle production)"
                    maxLength={60}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs"
                  />
                  <input
                    type="url"
                    value={whUrl}
                    onChange={(e) => setWhUrl(e.target.value)}
                    placeholder="https://lms.example.com/webhooks/aevion"
                    maxLength={500}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono"
                  />
                  <div className="text-[10px] text-slate-500">События (если не выбрано — все):</div>
                  <div className="flex gap-2 flex-wrap">
                    {(["level.completed", "lesson.completed", "capstone.passed", "achievement.unlocked"] as const).map((ev) => (
                      <label key={ev} className="flex items-center gap-1 text-[11px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={whEvents.has(ev)}
                          onChange={(e) => {
                            const next = new Set(whEvents);
                            if (e.target.checked) next.add(ev);
                            else next.delete(ev);
                            setWhEvents(next);
                          }}
                        />
                        <code className="text-[10px]">{ev}</code>
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={handleCreateWebhook}
                    disabled={!whUrl.trim() || !whLabel.trim()}
                    className="w-full py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 disabled:opacity-40"
                  >
                    Создать webhook
                  </button>
                </div>
              )}

              {webhooks.length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-400 text-xs">
                  Webhook'и не настроены. Создайте первый — и события курса начнут
                  отправляться на ваш URL.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600">
                      <th className="px-3 py-2 text-left">Имя / URL</th>
                      <th className="px-3 py-2 text-left">События</th>
                      <th className="px-3 py-2 text-center">Секрет</th>
                      <th className="px-3 py-2 text-center">Статус</th>
                      <th className="px-3 py-2 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webhooks.map((w) => (
                      <Fragment key={w.id}>
                        <tr className="border-t hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <div className="font-semibold text-slate-900">{w.label}</div>
                            <div className="text-[10px] font-mono text-slate-400 truncate max-w-[280px]">{w.url}</div>
                          </td>
                          <td className="px-3 py-2 text-[10px] text-slate-600">
                            {w.events.length === 0 ? <span className="text-emerald-600">все</span> : w.events.join(", ")}
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-[10px] text-slate-400">{w.secret}</td>
                          <td className="px-3 py-2 text-center">
                            {w.failureCount > 0 ? (
                              <span className="text-red-600 font-bold">⚠ {w.failureCount}</span>
                            ) : w.lastSentAt ? (
                              <span className="text-emerald-600">✓</span>
                            ) : (
                              <span className="text-slate-300">·</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right space-x-1">
                            <button
                              onClick={() => handleTestWebhook(w.id)}
                              className="text-[10px] text-emerald-600 hover:text-emerald-800 underline"
                            >
                              Тест
                            </button>
                            <button
                              onClick={() => handleDeleteWebhook(w.id)}
                              className="text-[10px] text-red-500 hover:text-red-700 underline"
                            >
                              Удалить
                            </button>
                          </td>
                        </tr>
                        {w.recentEvents && w.recentEvents.length > 0 && (
                          <tr className="bg-slate-50">
                            <td colSpan={5} className="px-3 py-1">
                              <details>
                                <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-emerald-700">
                                  📜 Журнал отправок (последние {w.recentEvents.length})
                                </summary>
                                <div className="mt-2 space-y-1 ml-4">
                                  {w.recentEvents.map((ev, i) => (
                                    <div key={i} className="text-[10px] flex items-center gap-2 font-mono">
                                      <span className="text-slate-400 w-32 shrink-0">
                                        {new Date(ev.ts).toLocaleString("ru-RU")}
                                      </span>
                                      <span className="text-slate-700 w-44 shrink-0">{ev.event}</span>
                                      <span className={`w-12 shrink-0 font-bold ${
                                        ev.status == null ? "text-red-600"
                                          : ev.status >= 200 && ev.status < 300 ? "text-emerald-600"
                                          : "text-amber-600"
                                      }`}>
                                        {ev.status ?? "ERR"}
                                      </span>
                                      <span className="text-slate-500 truncate flex-1">
                                        {ev.message} · {ev.payloadHint}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}

              <details className="px-4 py-3 border-t border-slate-100">
                <summary className="text-[11px] text-slate-600 font-semibold cursor-pointer">
                  📖 Документация payload + проверка подписи
                </summary>
                <div className="mt-2 text-[10px] text-slate-600 space-y-2">
                  <div>
                    <strong>HTTP-заголовки исходящего POST:</strong>
                    <pre className="bg-slate-900 text-emerald-300 rounded p-2 overflow-x-auto mt-1 text-[10px]">
{`Content-Type: application/json
User-Agent: AEVION-SmetaTrainer-Webhook/1
X-Aevion-Signature: sha256=<hex>
X-Aevion-Event: level.completed | lesson.completed | capstone.passed | achievement.unlocked`}
                    </pre>
                  </div>
                  <div>
                    <strong>Тело (JSON):</strong>
                    <pre className="bg-slate-900 text-emerald-300 rounded p-2 overflow-x-auto mt-1 text-[10px]">
{`{
  "event": "level.completed",
  "studentId": "smeta-abc123-xyz",
  "displayName": "Иван Петров",
  "group": "ПГС-201",
  "level": 3,
  "score": 87,
  "ts": 1729000000000
}`}
                    </pre>
                  </div>
                  <div>
                    <strong>Проверка подписи (Node.js):</strong>
                    <pre className="bg-slate-900 text-emerald-300 rounded p-2 overflow-x-auto mt-1 text-[10px]">
{`import crypto from "node:crypto";

const sig = req.headers["x-aevion-signature"]; // "sha256=..."
const expected = "sha256=" + crypto
  .createHmac("sha256", WEBHOOK_SECRET)
  .update(rawBody)
  .digest("hex");

if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
  return res.status(401).end();
}`}
                    </pre>
                  </div>
                </div>
              </details>
            </div>

            <div className="text-[10px] text-slate-400 text-center italic">
              JWT хранится в localStorage этого браузера. Выход чистит токен.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── SVG Charts ──────────────────────────────────────────────────────

function LevelChart({ students }: { students: AdminStudentRecord[] }) {
  const counts: Record<number, { open: number; inProgress: number; done: number }> = {};
  for (const lv of LEVELS) counts[lv.num] = { open: 0, inProgress: 0, done: 0 };
  for (const s of students) {
    for (const lv of LEVELS) {
      const lp = s.levels[String(lv.num)];
      if (lp?.status === "done") counts[lv.num].done++;
      else if (lp?.status === "in-progress") counts[lv.num].inProgress++;
      else counts[lv.num].open++;
    }
  }
  const total = students.length;
  const W = 360;
  const H = 200;
  const PAD = 40;
  const barW = (W - PAD * 2) / LEVELS.length - 8;

  return (
    <div>
      <div className="text-xs font-semibold text-slate-700 mb-2">
        Прогресс по уровням ({total} студентов)
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const y = H - PAD - p * (H - PAD - 20);
          return (
            <g key={p}>
              <line x1={PAD} y1={y} x2={W - 10} y2={y} stroke="#e2e8f0" strokeDasharray="2 2" />
              <text x={PAD - 4} y={y + 3} fontSize="9" textAnchor="end" fill="#94a3b8">
                {Math.round(p * total)}
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {LEVELS.map((lv, i) => {
          const c = counts[lv.num];
          const x = PAD + i * ((W - PAD * 2) / LEVELS.length) + 4;
          const baseY = H - PAD;
          const fullH = H - PAD - 20;
          const doneH = total ? (c.done / total) * fullH : 0;
          const ipH = total ? (c.inProgress / total) * fullH : 0;
          const openH = total ? (c.open / total) * fullH : 0;
          return (
            <g key={lv.num}>
              <rect x={x} y={baseY - doneH} width={barW} height={doneH} fill="#10b981" />
              <rect x={x} y={baseY - doneH - ipH} width={barW} height={ipH} fill="#f59e0b" />
              <rect x={x} y={baseY - doneH - ipH - openH} width={barW} height={openH} fill="#cbd5e1" />
              <text x={x + barW / 2} y={H - PAD + 14} fontSize="10" textAnchor="middle" fill="#475569">
                Ур.{lv.num}
              </text>
              <text x={x + barW / 2} y={baseY - doneH - 3} fontSize="9" textAnchor="middle" fill="#065f46" fontWeight="bold">
                {c.done > 0 ? c.done : ""}
              </text>
            </g>
          );
        })}
        {/* Legend */}
        <g transform={`translate(${PAD}, 6)`}>
          <rect width="10" height="10" fill="#10b981" />
          <text x="14" y="9" fontSize="9" fill="#475569">зачтено</text>
          <rect x="80" width="10" height="10" fill="#f59e0b" />
          <text x="94" y="9" fontSize="9" fill="#475569">в процессе</text>
          <rect x="180" width="10" height="10" fill="#cbd5e1" />
          <text x="194" y="9" fontSize="9" fill="#475569">не начат</text>
        </g>
      </svg>
    </div>
  );
}

function LessonsChart({ students }: { students: AdminStudentRecord[] }) {
  // Распределение студентов по «бакетам» пройденных уроков (0, 1-9, 10-19, ..., 40+)
  const buckets = [
    { label: "0", min: 0, max: 0 },
    { label: "1–9", min: 1, max: 9 },
    { label: "10–19", min: 10, max: 19 },
    { label: "20–29", min: 20, max: 29 },
    { label: "30–39", min: 30, max: 39 },
    { label: "40+", min: 40, max: Infinity },
  ];
  const counts = buckets.map((b) =>
    students.filter((s) => s.lessonsDone >= b.min && s.lessonsDone <= b.max).length,
  );
  const max = Math.max(1, ...counts);
  const W = 360;
  const H = 200;
  const PAD = 40;
  const barW = (W - PAD * 2) / buckets.length - 8;

  return (
    <div>
      <div className="text-xs font-semibold text-slate-700 mb-2">
        Распределение по урокам теории
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Y-axis */}
        {[0, 0.5, 1].map((p) => {
          const y = H - PAD - p * (H - PAD - 20);
          return (
            <g key={p}>
              <line x1={PAD} y1={y} x2={W - 10} y2={y} stroke="#e2e8f0" strokeDasharray="2 2" />
              <text x={PAD - 4} y={y + 3} fontSize="9" textAnchor="end" fill="#94a3b8">
                {Math.round(p * max)}
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {buckets.map((b, i) => {
          const x = PAD + i * ((W - PAD * 2) / buckets.length) + 4;
          const baseY = H - PAD;
          const h = (counts[i] / max) * (H - PAD - 20);
          return (
            <g key={b.label}>
              <rect x={x} y={baseY - h} width={barW} height={h} fill="#3b82f6" />
              <text x={x + barW / 2} y={H - PAD + 14} fontSize="9" textAnchor="middle" fill="#475569">
                {b.label}
              </text>
              {counts[i] > 0 && (
                <text x={x + barW / 2} y={baseY - h - 3} fontSize="9" textAnchor="middle" fill="#1e40af" fontWeight="bold">
                  {counts[i]}
                </text>
              )}
            </g>
          );
        })}
        <text x={W / 2} y={H - 4} fontSize="9" textAnchor="middle" fill="#94a3b8">
          Уроков пройдено (бакеты по 10)
        </text>
      </svg>
    </div>
  );
}
