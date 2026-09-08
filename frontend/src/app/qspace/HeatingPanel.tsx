"use client";

/**
 * QSpace — панель тёплого пола.
 *
 * Отдельным компонентом, потому что у неё своё состояние (шаг укладки) и
 * своя таблица: класть это в общий компонент страницы значит растить его без
 * нужды. Расчёт живёт в heating.ts и здесь только показывается.
 */

import { useMemo, useState } from "react";
import type { Room } from "./rooms";
import { heatingPlan, stepHint } from "./heating";

interface Props {
  rooms: Room[];
  /**
   * Площадь под встроенной мебелью по номеру комнаты, м².
   *
   * У `heatingPlan` этот параметр был с самого начала и объяснён
   * комментарием, но НИКТО его не передавал: пока мебели в демо не было,
   * это ничего не меняло. С обставленной квартирой разница стала видна —
   * в санузле 4.4 м² под ванной и унитазом около 1.5 м², то есть треть
   * площади считалась тёплой ошибочно.
   */
  blockedAreaByRoom?: Record<number, number>;
}

const STEPS = [0.1, 0.15, 0.2, 0.25] as const;

export default function HeatingPanel({ rooms, blockedAreaByRoom }: Props) {
  const [step, setStep] = useState<number>(0.15);
  /** Сколько площади уже вычтено под встроенной мебелью, м². */
  const убрано = Object.values(blockedAreaByRoom ?? {}).reduce((s, v) => s + v, 0);
  const plan = useMemo(
    () => heatingPlan(rooms, step, blockedAreaByRoom),
    [rooms, step, blockedAreaByRoom],
  );

  if (rooms.length === 0) {
    return (
      <p style={S.hint}>
        Тёплый пол считается по помещениям — пока их не выделено, считать нечего.
      </p>
    );
  }

  return (
    <>
      <div style={S.row} role="group" aria-label="Шаг укладки трубы">
        {STEPS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            title={stepHint(s)}
            style={{
              ...S.btn,
              fontWeight: step === s ? 700 : 400,
              borderColor: step === s ? "#2f5e2a" : "#c9c4bb",
              background: step === s ? "#eef4ea" : "#fff",
            }}
          >
            {Math.round(s * 100)} см
          </button>
        ))}
      </div>
      <p style={S.hint}>{stepHint(step)}</p>

      {plan.warnings.length > 0 && (
        <ul style={S.warn}>
          {plan.warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}

      {plan.rooms.length > 0 && (
        <table style={S.table}>
          <tbody>
            {plan.rooms.map((r) => (
              <tr key={r.index}>
                <td style={S.td}>
                  Помещение {r.index}
                  <br />
                  <span style={S.small}>
                    греется {r.heatedArea.toFixed(1)} м² · {r.power.toFixed(0)} Вт
                    {r.loops > 1 ? ` · ${r.loops} контура` : ""}
                  </span>
                </td>
                <td style={S.tdNum}>{r.pipeLength.toFixed(0)} м</td>
              </tr>
            ))}
            <tr>
              <td style={S.td}><strong>Всего трубы</strong></td>
              <td style={S.tdNum}><strong>{plan.totals.pipeLength.toFixed(0)} м</strong></td>
            </tr>
            <tr>
              <td style={S.td}>Мощность системы</td>
              <td style={S.tdNum}>{(plan.totals.power / 1000).toFixed(1)} кВт</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* ⚠️ Прежде здесь стояло «эту площадь вычтите сами». Правда до 08.09,
          вредная ложь после: модуль вычитает её сам, и человек, послушавшись,
          вычел бы дважды и купил меньше трубы, чем нужно. Подсказка следует за
          поведением — говорит РАЗНОЕ в зависимости от того, есть ли что
          вычитать. */}
      <p style={S.hint}>
        Прикидка для закупки, а не гидравлический расчёт: раскладку и
        балансировку делает монтажник, а мощность зависит от утепления дома,
        которого мы не знаем.
        {убрано > 0
          ? ` Под встроенной мебелью и сантехникой трубу не кладут — ${убрано.toFixed(1)} м²
             уже вычтено из тёплой площади, отдельно вычитать не нужно.`
          : " Под встроенной мебелью и сантехникой трубу не кладут: расставьте её" +
            " в модели, и эта площадь вычтется сама."}
      </p>
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  row: { display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0" },
  btn: {
    padding: "5px 10px", border: "1px solid #c9c4bb", borderRadius: 7,
    cursor: "pointer", fontSize: 13, color: "#1f1d1a",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 6 },
  td: { padding: "3px 6px 3px 0", borderBottom: "1px solid #eee9df", color: "#4a453d" },
  tdNum: {
    padding: "3px 0", borderBottom: "1px solid #eee9df",
    textAlign: "right", whiteSpace: "nowrap",
  },
  small: { fontSize: 11.5, color: "#7a746b" },
  hint: { fontSize: 12.5, color: "#6a645a", margin: "6px 0 0" },
  warn: {
    fontSize: 12.5, color: "#7a5a1f", background: "#fbf3df",
    border: "1px solid #ecdbb2", borderRadius: 8,
    padding: "6px 10px 6px 24px", margin: "6px 0",
  },
};
