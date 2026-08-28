"use client";

import { useState } from "react";

/**
 * Маленький калькулятор отклонений: человек вводит свои цифры и сразу видит,
 * какие маркеры вне целевого диапазона.
 *
 * ЗАЧЕМ. У русской страницы протокола есть инструмент (панель маркеров и
 * персональный стек), у английской был только текст. Разница между «прочитал»
 * и «использовал» — это разница между посетителем и подписчиком.
 *
 * ПОЧЕМУ НА КЛИЕНТЕ, А НЕ ЧЕРЕЗ БЭКЕНД. Русский инструмент считает на
 * /api/longevity/*, но бэкенд отдаёт РУССКИЕ тексты (проверено: в ответе
 * health 20 русских слов). Английский вариант через тот же API показал бы
 * человеку кириллицу в разборе. Здесь считается ровно то, что можно посчитать
 * честно и без сервера: попадает ли число в границы, названные в самом
 * протоколе.
 *
 * ЧЕГО ЗДЕСЬ НЕТ И НЕ БУДЕТ. Никакого «биологического возраста», рейтинга и
 * персонального стека: это требует формул, которых нет в источнике, а
 * выдумывать их на странице о доказательности нельзя. Инструмент отвечает на
 * один вопрос — что вне диапазона, — и на нём останавливается.
 */

export type Bound = { min?: number; max?: number };
type Field = {
  key: string;
  label: string;
  unit: string;
  placeholder: string;
  bound: Bound;
  /** Текст границы — тот же, что в таблице выше по странице. */
  target: string;
};

// Границы взяты из английского издания протокола, дословно. Включены ТОЛЬКО
// маркеры с однозначным числовым порогом: то, что зависит от пола, возраста и
// лаборатории («by sex and age», «upper third of range»), машинно сравнивать
// нельзя, и в форме его нет.
export const FIELDS: Field[] = [
  { key: "vitD", label: "Vitamin D (25-OH)", unit: "ng/mL", placeholder: "35", bound: { min: 40, max: 60 }, target: "40–60" },
  { key: "b12", label: "Vitamin B12", unit: "pg/mL", placeholder: "420", bound: { min: 500 }, target: "> 500" },
  { key: "ferritin", label: "Ferritin", unit: "ng/mL", placeholder: "45", bound: { min: 50, max: 150 }, target: "50–150" },
  { key: "omega3", label: "Omega-3 index", unit: "%", placeholder: "6", bound: { min: 8 }, target: "> 8" },
  { key: "homocysteine", label: "Homocysteine", unit: "µmol/L", placeholder: "9", bound: { max: 8 }, target: "< 8" },
  { key: "glucose", label: "Fasting glucose", unit: "mg/dL", placeholder: "104", bound: { max: 99 }, target: "< 99" },
  { key: "hba1c", label: "HbA1c", unit: "%", placeholder: "5.6", bound: { max: 5.4 }, target: "< 5.4" },
  { key: "homaIr", label: "HOMA-IR", unit: "", placeholder: "2.0", bound: { max: 1.5 }, target: "< 1.5" },
  { key: "apob", label: "ApoB", unit: "mg/dL", placeholder: "95", bound: { max: 80 }, target: "< 80" },
  { key: "hsCrp", label: "hs-CRP", unit: "mg/L", placeholder: "1.8", bound: { max: 1.0 }, target: "< 1.0" },
  { key: "uricAcid", label: "Uric acid", unit: "mg/dL", placeholder: "6.1", bound: { max: 5.5 }, target: "< 5.5" },
];

/** Вынесено из компонента и экспортировано ради теста: инструмент СЧИТАЕТ, и
 *  ошибка в границе была бы тихой — человек увидел бы «в норме» на значении
 *  вне диапазона и ничего бы не заподозрил. */
export function verdict(value: number, b: Bound): "low" | "high" | "ok" {
  if (b.min !== undefined && value < b.min) return "low";
  if (b.max !== undefined && value > b.max) return "high";
  return "ok";
}

export function LongevityTool() {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  // Считаем только по заполненным полям. Пустое поле — это «не знаю», а не
  // «в норме»: молчаливое превращение пропуска в норму и есть тот способ,
  // которым отчёт становится успокаивающим и неверным.
  const filled = FIELDS.filter((f) => {
    const raw = (vals[f.key] ?? "").trim().replace(",", ".");
    return raw !== "" && Number.isFinite(Number(raw));
  });

  const results = filled.map((f) => {
    const value = Number((vals[f.key] ?? "").trim().replace(",", "."));
    return { field: f, value, state: verdict(value, f.bound) };
  });

  const off = results.filter((r) => r.state !== "ok");

  return (
    <div style={styles.box}>
      <div style={styles.grid}>
        {FIELDS.map((f) => (
          <label key={f.key} style={styles.row}>
            <span style={styles.name}>
              {f.label}
              {f.unit ? <span style={styles.unit}> · {f.unit}</span> : null}
            </span>
            <span style={styles.inputWrap}>
              <input
                inputMode="decimal"
                value={vals[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
                style={styles.input}
                aria-label={f.label}
              />
              <span style={styles.target}>{f.target}</span>
            </span>
          </label>
        ))}
      </div>

      <button type="button" onClick={() => setChecked(true)} style={styles.button}>
        Check my numbers
      </button>

      {checked && filled.length === 0 && (
        <p style={styles.note}>
          Nothing to check yet — fill in at least one value. An empty field means
          &quot;unknown&quot;, not &quot;in range&quot;.
        </p>
      )}

      {checked && filled.length > 0 && (
        <div style={styles.result}>
          <p style={styles.resultHead}>
            {/* Числитель и знаменатель ОБА названы: «2 out of 3» и «2 out of 11»
                читаются совершенно по-разному, а без знаменателя человек
                достроит его сам и ошибётся. */}
            {off.length === 0
              ? `All ${filled.length} value${filled.length > 1 ? "s" : ""} you entered are within target.`
              : `${off.length} of ${filled.length} value${filled.length > 1 ? "s" : ""} you entered ${off.length === 1 ? "is" : "are"} outside target.`}
          </p>
          {off.map((r) => (
            <div key={r.field.key} style={styles.item}>
              <span style={styles.itemName}>{r.field.label}</span>
              <span style={styles.itemVal}>
                {r.value}
                {r.field.unit ? ` ${r.field.unit}` : ""} — {r.state === "low" ? "below" : "above"} target ({r.field.target})
              </span>
            </div>
          ))}
          <p style={styles.note}>
            Out-of-range does not mean disease, and in-range does not mean
            nothing to do. Target ranges depend on sex, age and laboratory — this
            is a reading aid for your own panel, not diagnosis. Start with the
            deficiencies block above: it is the fastest and best-evidenced part.
          </p>
          {/* Следующий шаг — ПОСЛЕ результата, а не рядом с формой.
              Русская воронка предлагает ступень сразу после протокола, у
              английской такого перехода не было вовсе: человек считал свои
              маркеры и упирался в конец страницы.
              Обычная ссылка, а не кнопка покупки: отсюда ведём на страницу с
              выбором, где рядом стоят и книга, и подписка, — предлагать
              конкретный товар сразу после медицинского разбора было бы
              продажей на чужом доверии. */}
          <p style={styles.next}>
            Everything AEVION sells sits on one page —{" "}
            <a href="/en/go" style={styles.nextLink}>
              the book behind the videos, the protocols and the subscription →
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

const INK = "#16161a";
const MUTED = "#5d5f66";
const LINE = "#e2e0d8";
const WARN = "#8a4b00";

const styles: Record<string, React.CSSProperties> = {
  box: { border: `1px solid ${LINE}`, borderRadius: 12, padding: "18px 18px 20px", background: "#fff", marginTop: 16 },
  grid: { display: "flex", flexDirection: "column", gap: 2 },
  row: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: `1px solid ${LINE}` },
  name: { fontSize: 14.5, color: INK },
  unit: { color: MUTED, fontSize: 13 },
  inputWrap: { display: "flex", alignItems: "center", gap: 10 },
  input: {
    width: 92,
    padding: "7px 9px",
    fontSize: 15,
    border: `1px solid ${LINE}`,
    borderRadius: 8,
    background: "#fbfaf7",
    color: INK,
  },
  target: { fontFamily: "monospace", fontSize: 12.5, color: MUTED, minWidth: 54, textAlign: "right" },
  button: {
    marginTop: 16,
    border: `1px solid ${INK}`,
    background: INK,
    color: "#fff",
    borderRadius: 8,
    padding: "10px 18px",
    fontSize: 14.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  result: { marginTop: 16, borderTop: `1px solid ${LINE}`, paddingTop: 14 },
  resultHead: { fontSize: 15.5, fontWeight: 600, margin: "0 0 10px" },
  item: { padding: "6px 0" },
  itemName: { fontSize: 14.5, fontWeight: 600, marginRight: 8 },
  itemVal: { fontSize: 14, color: WARN },
  note: { color: MUTED, fontSize: 13.5, lineHeight: 1.6, margin: "12px 0 0" },
  next: { fontSize: 14.5, lineHeight: 1.6, margin: "14px 0 0", color: INK },
  nextLink: { color: "#1d5f8a", textDecoration: "underline" },
};
