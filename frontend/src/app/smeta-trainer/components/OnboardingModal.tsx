"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "aevion-smeta-onboarding-v1";

const STEPS = [
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
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {}
  }, []);

  function finish() {
    try { localStorage.setItem(STORAGE_KEY, "done"); } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Прогресс */}
        <div className="flex">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 transition-colors ${i <= step ? "bg-emerald-500" : "bg-slate-200"}`} />
          ))}
        </div>

        {/* Контент */}
        <div className="px-8 py-8 text-center">
          <div className="text-5xl mb-4">{s.icon}</div>
          <h2 className="text-lg font-bold text-slate-900 mb-3">{s.title}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{s.text}</p>
        </div>

        {/* Кнопки */}
        <div className="px-8 pb-6 flex items-center justify-between">
          <button
            onClick={() => step > 0 ? setStep(step - 1) : finish()}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            {step === 0 ? "Пропустить" : "← Назад"}
          </button>
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <button key={i} onClick={() => setStep(i)} className={`w-2 h-2 rounded-full transition-colors ${i === step ? "bg-emerald-500" : "bg-slate-200"}`} />
            ))}
          </div>
          <button
            onClick={() => isLast ? finish() : setStep(step + 1)}
            className="px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
          >
            {isLast ? "Начать →" : "Далее →"}
          </button>
        </div>
      </div>
    </div>
  );
}
