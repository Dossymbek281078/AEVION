"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

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

const ТЕКСТ: Record<string, { слово: string; пояснение: string }> = {
  beta: {
    слово: "Бета",
    пояснение: "модуль открыт и работает, идёт доводка — о найденном пишите нам",
  },
  on_request: {
    слово: "По запросу",
    пояснение: "модуль включается после разговора — напишите нам",
  },
  soon: {
    слово: "Скоро",
    пояснение: "это анонс: модуль ещё не открыт",
  },
};

export function ModuleMaturity({ id }: { id: string }) {
  const [статус, setСтатус] = useState<string | null>(null);

  useEffect(() => {
    let отменено = false;
    fetch(apiUrl("/api/pricing"))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (отменено || !j) return;
        const m = (j.modules ?? []).find((x: { id?: string }) => x?.id === id);
        const a = typeof m?.availability === "string" ? m.availability : null;
        if (a && a !== "live" && ТЕКСТ[a]) setСтатус(a);
      })
      .catch(() => {
        /* каталог не ответил — молчим, см. шапку */
      });
    return () => {
      отменено = true;
    };
  }, [id]);

  if (!статус) return null;
  const t = ТЕКСТ[статус];
  return (
    <div
      role="note"
      aria-label={`Статус модуля: ${t.слово}`}
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
