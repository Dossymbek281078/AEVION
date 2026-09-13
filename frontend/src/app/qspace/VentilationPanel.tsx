"use client";

/**
 * QSpace — панель вентиляции и влажности.
 *
 * Назначение комнат модуль знать не может: из чертежа приходят только стены.
 * Поэтому человек сам говорит, где кухня, а где санузел — и от этого меняется
 * весь расчёт. Без этого шага панель честно предупреждает, что вытяжка не
 * посчитана, а не показывает правдоподобные нули.
 */

import { useMemo, useState } from "react";
import type { Room } from "./rooms";
import { KIND_LABEL, humidityAdvice, ventilationPlan, type RoomKind } from "./ventilation";

interface Props {
  rooms: Room[];
}

const KINDS: RoomKind[] = ["living", "kitchen", "bath", "toilet", "corridor"];

export default function VentilationPanel({ rooms }: Props) {
  const [kinds, setKinds] = useState<Record<number, RoomKind>>({});
  const [windowless, setWindowless] = useState<number[]>([]);

  const plan = useMemo(() => ventilationPlan(rooms, kinds), [rooms, kinds]);
  const humidity = useMemo(
    () => humidityAdvice(plan.rooms, windowless),
    [plan, windowless],
  );

  if (rooms.length === 0) {
    return <p style={S.hint}>Вентиляция считается по помещениям — пока их нет, считать нечего.</p>;
  }

  return (
    <>
      <p style={S.hint}>
        Скажите, где что: из чертежа назначение комнат не видно, а от него
        зависит весь расчёт.
      </p>

      <table style={S.table}>
        <tbody>
          {plan.rooms.map((r) => (
            <tr key={r.index}>
              <td style={S.td}>
                {/* не label: внутри уже есть свой label у флажка, а вложенные
                    label — недопустимая разметка и путают экранный диктор.
                    У select имя задано через aria-label. */}
                <div style={S.rowLabel}>
                  <span style={{ minWidth: 92, display: "inline-block" }}>
                    Помещение {r.index}
                  </span>
                  <select
                    value={r.kind}
                    aria-label={`Назначение помещения ${r.index}`}
                    onChange={(e) =>
                      setKinds((k) => ({ ...k, [r.index]: e.target.value as RoomKind }))
                    }
                    style={S.select}
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>{KIND_LABEL[k]}</option>
                    ))}
                  </select>
                  <label style={S.check}>
                    <input
                      type="checkbox"
                      checked={windowless.includes(r.index)}
                      onChange={(e) =>
                        setWindowless((w) =>
                          e.target.checked ? [...w, r.index] : w.filter((x) => x !== r.index),
                        )
                      }
                    />{" "}
                    без окна
                  </label>
                </div>
                <br />
                <span style={S.small}>{r.how}</span>
              </td>
              <td style={S.tdNum}>{r.flow > 0 ? `${Math.round(r.flow)} м³/ч` : "—"}</td>
            </tr>
          ))}
          <tr>
            <td style={S.td}><strong>Всего воздуха</strong></td>
            <td style={S.tdNum}><strong>{Math.round(plan.totalFlow)} м³/ч</strong></td>
          </tr>
        </tbody>
      </table>

      {plan.warnings.length > 0 && (
        <ul style={S.warn}>
          {plan.warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}

      {humidity.length > 0 && (
        <ul style={S.warn}>
          {humidity.map((h, i) => <li key={i}>{h}</li>)}
        </ul>
      )}

      {plan.notes.map((n, i) => <p key={i} style={S.hint}>{n}</p>)}

      <p style={S.hint}>
        Это подбор оборудования, а не расчёт системы вентиляции: настоящий
        учитывает число жильцов, тягу общедомового канала и герметичность окон —
        ничего этого мы не знаем.
      </p>
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 6 },
  td: { padding: "5px 6px 5px 0", borderBottom: "1px solid #eee9df", color: "#4a453d" },
  tdNum: {
    padding: "5px 0", borderBottom: "1px solid #eee9df",
    textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top",
  },
  rowLabel: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
  select: {
    padding: "3px 6px", border: "1px solid #c9c4bb", borderRadius: 6,
    fontSize: 12.5, background: "#fff",
  },
  check: { fontSize: 12, color: "#6a645a", cursor: "pointer" },
  small: { fontSize: 11.5, color: "#7a746b" },
  hint: { fontSize: 12.5, color: "#6a645a", margin: "6px 0 0" },
  warn: {
    fontSize: 12.5, color: "#7a5a1f", background: "#fbf3df",
    border: "1px solid #ecdbb2", borderRadius: 8,
    padding: "6px 10px 6px 24px", margin: "6px 0",
  },
};
