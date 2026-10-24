"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { useI18nOptional } from "@/lib/i18n";

/**
 * Плашка зрелости модуля — из КАТАЛОГА, а не из текста страницы.
 *
 * Замер 06.09.2026: каталог (/api/pricing) честно называл 21 модуль «beta»,
 * а из 13 проверенных страниц слово о статусе несла ОДНА. Расходились не
 * данные, а экран с данными: у каждой страницы было своё мнение (обычно —
 * молчание). Класс уже записан: «страница честна своими словами, но каталога
 * не читает» — сегодня совпадают, разойдутся молча.
 *
 * Поэтому источник ЕДИНСТВЕННЫЙ — availability из каталога:
 *  - live        -> плашки нет (зрелый модуль о зрелости не докладывает);
 *  - beta        -> «Бета»;
 *  - on_request  -> «По запросу»;
 *  - soon        -> «Скоро»;
 *  - каталог не ответил / id не найден -> НИЧЕГО. Честное молчание: статуса
 *    мы не знаем, а выдуманная плашка хуже отсутствующей. Это то же
 *    поведение, что у страницы до появления компонента, — хуже не становится.
 */

type Язык = "ru" | "en" | "kk";
// 24.10.2026: плашка стоит на 17 страницах и на /en, /kk говорила по-русски.
// ⚠️ kk — черновой перевод, нужна вычитка носителя
const ТЕКСТ: Record<Язык, Record<string, { слово: string; пояснение: string }>> = {
  ru: {
    beta: { слово: "Бета", пояснение: "модуль открыт и работает, идёт доводка — о найденном пишите нам" },
    on_request: { слово: "По запросу", пояснение: "модуль включается после разговора — напишите нам" },
    soon: { слово: "Скоро", пояснение: "это анонс: модуль ещё не открыт" },
  },
  en: {
    beta: { слово: "Beta", пояснение: "the module is open and working, still being polished — tell us what you find" },
    on_request: { слово: "On request", пояснение: "the module is enabled after a conversation — write to us" },
    soon: { слово: "Soon", пояснение: "this is an announcement: the module is not open yet" },
  },
  kk: {
    beta: { слово: "Бета", пояснение: "модуль ашық және жұмыс істейді, әлі жетілдірілуде — тапқаныңызды бізге жазыңыз" },
    on_request: { слово: "Сұраныс бойынша", пояснение: "модуль сөйлескеннен кейін қосылады — бізге жазыңыз" },
    soon: { слово: "Жақында", пояснение: "бұл хабарландыру: модуль әлі ашылмаған" },
  },
};
const ПОДПИСЬ: Record<Язык, string> = { ru: "Статус модуля", en: "Module status", kk: "Модуль мәртебесі" };

export function ModuleMaturity({ id }: { id: string }) {
  const [статус, setСтатус] = useState<string | null>(null);
  const i18n = useI18nOptional();
  const язык: Язык = i18n?.lang === "en" ? "en" : i18n?.lang === "kk" ? "kk" : "ru";

  useEffect(() => {
    let отменено = false;
    fetch(apiUrl("/api/pricing"))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (отменено || !j) return;
        const m = (j.modules ?? []).find((x: { id?: string }) => x?.id === id);
        const a = typeof m?.availability === "string" ? m.availability : null;
        if (a && a !== "live" && ТЕКСТ.ru[a]) setСтатус(a);
      })
      .catch(() => {
        /* каталог не ответил — молчим, см. шапку */
      });
    return () => {
      отменено = true;
    };
  }, [id]);

  if (!статус) return null;
  const t = ТЕКСТ[язык][статус];
  return (
    <div
      role="note"
      aria-label={`${ПОДПИСЬ[язык]}: ${t.слово}`}
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        padding: "8px 14px",
        fontSize: 13,
        lineHeight: 1.45,
        background: "#fffbeb",
        borderBottom: "1px solid #fde68a",
        color: "#92400e",
      }}
    >
      <strong style={{ fontWeight: 800, letterSpacing: 0.3 }}>{t.слово}</strong>
      <span>· {t.пояснение}</span>
    </div>
  );
}
