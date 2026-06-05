"use client";

/**
 * Эмулятор LMS для проверки сквозного цикла интеграции:
 *   запуск модуля → студент сдаёт экзамен в iframe → зачёт возвращается сюда
 *   через postMessage (LMS_COMPLETION_TYPE).
 *
 * Это НЕ часть курса — инструмент разработчика/методиста для smoke-проверки
 * связки тренажёр ↔ LMS без реального LMS. Реальный курс слушает то же событие.
 */

import { useEffect, useRef, useState } from "react";
import {
  MODULE_DESTINATIONS,
  LMS_COMPLETION_TYPE,
  TRAINER_BASE,
  type LmsCompletion,
} from "../lib/lms";

interface ReceivedEvent {
  at: string;
  completion: LmsCompletion;
}

export default function LmsDemoPage() {
  const [module, setModule] = useState("2.3");
  const [src, setSrc] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [events, setEvents] = useState<ReceivedEvent[]>([]);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Слушаем зачёт из тренажёра (как это делал бы реальный LMS).
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return; // принимаем только свой origin
      const data = e.data as { type?: string; payload?: LmsCompletion };
      if (data?.type !== LMS_COMPLETION_TYPE || !data.payload) return;
      setEvents((prev) => [{ at: new Date().toLocaleTimeString("ru-RU"), completion: data.payload! }, ...prev].slice(0, 10));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function launch() {
    const ret = `${window.location.origin}${TRAINER_BASE}/lms-demo`;
    const url =
      `${TRAINER_BASE}/lms?module=${encodeURIComponent(module)}` +
      `&return=${encodeURIComponent(ret)}` +
      `&sid=demo-student` +
      `&origin=${encodeURIComponent(window.location.origin)}`;
    setSrc(url);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900">🧪 Эмулятор LMS</h1>
        <p className="text-sm text-slate-600 mt-1 mb-4">
          Запускает модуль во встроенном тренажёре и принимает зачёт обратно (как реальный курс).
        </p>

        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-600">
            <div className="mb-1 font-medium">Модуль курса</div>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm min-w-56"
            >
              {Object.entries(MODULE_DESTINATIONS).map(([m, d]) => (
                <option key={m} value={m}>
                  {m === "capstone" ? "кейс" : `мод. ${m}`} — {d.label}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={launch}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded hover:bg-emerald-700"
          >
            ▶ Запустить модуль
          </button>
          {origin && <span className="text-[11px] text-slate-400 ml-auto">parent origin: {origin}</span>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Встроенный тренажёр */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            {src ? (
              <iframe
                ref={iframeRef}
                src={src}
                title="Тренажёр (встроенный)"
                className="w-full"
                style={{ height: "72vh", border: "none" }}
              />
            ) : (
              <div className="h-[72vh] flex items-center justify-center text-slate-400 text-sm">
                Выберите модуль и нажмите «Запустить»
              </div>
            )}
          </div>

          {/* Принятые зачёты */}
          <aside className="bg-white border border-slate-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">📥 Принятые зачёты</h2>
            {events.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                Пока ничего. Внутри тренажёра откройте режим, сдайте экзамен — зачёт прилетит сюда.
              </p>
            ) : (
              <ul className="space-y-2">
                {events.map((ev, i) => (
                  <li
                    key={i}
                    className={`border rounded p-2 text-xs ${
                      ev.completion.passed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        {ev.completion.passed ? "✅ Зачёт" : "⚠️ Не зачёт"} · мод. {ev.completion.module}
                      </span>
                      <span className="text-slate-400">{ev.at}</span>
                    </div>
                    <div className="mt-1 text-slate-700">
                      {ev.completion.score}/100 ({ev.completion.grade})
                      {ev.completion.taskId && <span className="text-slate-400"> · {ev.completion.taskId}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px] text-slate-400 mt-3">
              Реальный LMS слушает событие <code>{LMS_COMPLETION_TYPE}</code> и/или принимает возврат по return-URL
              с параметрами score/grade/passed.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
