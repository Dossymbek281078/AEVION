"use client";

import { useEffect, useState } from "react";
import { useProgress } from "../lib/useProgress";

const STORAGE_KEY = "aevion-smeta-onboarding-v1";

const INFO_STEPS = [
  {
    icon: "🏫",
    title: "Добро пожаловать в Сметный тренажёр РК",
    text: "Это учебная платформа по сметному делу Казахстана. Сквозной кейс — капитальный ремонт школы №47, г. Алматы. Обучение по НДЦС РК 8.01-08-2022.",
  },
  {
    icon: "📚",
    title: "5 уровней от новичка до эксперта",
    text: "С нуля → Пользователь → ПТО → Проектировщик → Эксперт. Каждый уровень — новая роль и задача. Начните с уровня 1 если видите смету впервые.",
  },
  {
    icon: "✍️",
    title: "На уровне 2 составляете ЛСР сами",
    text: "Выберите расценку в левой панели → задайте объём → AI-советник проверит ошибки. Нажмите «+К» для коэффициентов (К=1.15 для действующего здания).",
  },
  {
    icon: "🤖",
    title: "AI-консультант отвечает на любые вопросы",
    text: "В правой панели — вкладка «💬 Спросить AI». Спросите «Как считается НР?» или «Что мне ещё добавить?» — консультант видит вашу смету и даст персональный совет.",
  },
  {
    icon: "📊",
    title: "Экспорт в Excel и PDF",
    text: "Кнопка «⬇ Экспорт» в редакторе — скачайте смету в CSV (Excel), PDF через браузер или JSON для резервной копии. Смета автоматически сохраняется в браузере.",
  },
];

export function OnboardingModal() {
  const { progress, setStudentInfo } = useProgress();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  // Name step state
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [nameError, setNameError] = useState(false);

  const totalSteps = INFO_STEPS.length + 1; // +1 for name step
  const isNameStep = step === INFO_STEPS.length;

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {}
  }, []);

  // Pre-fill name if already stored
  useEffect(() => {
    if (progress.studentName) setName(progress.studentName);
    if (progress.studentGroup) setGroup(progress.studentGroup);
  }, [progress.studentName, progress.studentGroup]);

  function finish() {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    setStudentInfo(name.trim(), group.trim() || undefined);
    try { localStorage.setItem(STORAGE_KEY, "done"); } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Прогресс */}
        <div className="flex">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 transition-colors ${i <= step ? "bg-emerald-500" : "bg-slate-200"}`} />
          ))}
        </div>

        {/* Контент */}
        {!isNameStep ? (
          <div className="px-8 py-8 text-center">
            <div className="text-5xl mb-4">{INFO_STEPS[step].icon}</div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">{INFO_STEPS[step].title}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{INFO_STEPS[step].text}</p>
          </div>
        ) : (
          <div className="px-8 py-8">
            <div className="text-4xl text-center mb-4">👤</div>
            <h2 className="text-lg font-bold text-slate-900 mb-1 text-center">Представьтесь перед началом</h2>
            <p className="text-xs text-slate-500 text-center mb-5">Имя появится в вашем сертификате по окончании курса</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ваше имя <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(false); }}
                  placeholder="Иванов Иван Иванович"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${nameError ? "border-red-400 bg-red-50" : "border-slate-300"}`}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) finish(); }}
                />
                {nameError && <p className="text-xs text-red-500 mt-1">Введите имя чтобы начать</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Группа / поток <span className="text-slate-400">(необязательно)</span>
                </label>
                <input
                  type="text"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  placeholder="СМД-101 или Поток 3"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  onKeyDown={(e) => { if (e.key === "Enter") finish(); }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Кнопки */}
        <div className="px-8 pb-6 flex items-center justify-between">
          <button
            onClick={() => step > 0 ? setStep(step - 1) : finish()}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            {step === 0 ? "Пропустить" : "← Назад"}
          </button>
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === step ? "bg-emerald-500" : "bg-slate-200"}`}
              />
            ))}
          </div>
          <button
            onClick={() => isNameStep ? finish() : setStep(step + 1)}
            className="px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
          >
            {isNameStep ? "Начать →" : "Далее →"}
          </button>
        </div>
      </div>
    </div>
  );
}
