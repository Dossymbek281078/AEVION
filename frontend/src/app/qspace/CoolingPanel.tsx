"use client";

/**
 * QSpace — панель подбора сплит-системы.
 *
 * Отвечает на вопрос, с которым идут в магазин: какой типоразмер брать.
 * Солнечность комнаты из чертежа не видна — её называет человек, как и
 * назначение комнат в панели вентиляции.
 */

import { useMemo, useState } from "react";
import type { Room } from "./rooms";
import { coolingPlan, SUN_LABEL, totalPickedWatt, type SunLoad } from "./cooling";

interface Props {
  rooms: Room[];
}

const SUNS: SunLoad[] = ["shade", "normal", "sunny"];

export default function CoolingPanel({ rooms }: Props) {
  const [sun, setSun] = useState<Record<number, SunLoad>>({});
  const [people, setPeople] = useState<Record<number, number>>({});

  const res = useMemo(() => coolingPlan(rooms, { sun, people }), [rooms, sun, people]);
  const total = totalPickedWatt(res);

  if (rooms.length === 0) {
    return <p style={S.hint}>Мощность считается по помещениям — пока их нет, считать нечего.</p>;
  }

  return (
    <>
      <p style={S.hint}>
        Сколько солнца попадает в комнату, из чертежа не видно, а множитель это
        главный. Скажите — и подбор станет вашим, а не средним.
      </p>

      <table style={S.table}>
        <tbody>
          {res.rooms.map((r) => (
            <tr key={r.index}>
              <td style={S.td}>
                <div style={S.rowLabel}>
                  <span style={{ minWidth: 92, display: "inline-block" }}>
                    Помещение {r.index}
                  </span>
                  <select
                    value={sun[r.index] ?? "normal"}
                    aria-label={`Солнце в помещении ${r.index}`}
                    onChange={(e) =>
                      setSun((s) => ({ ...s, [r.index]: e.target.value as SunLoad }))
                    }
                    style={S.select}
                  >
                    {SUNS.map((k) => (
                      <option key={k} value={k}>{SUN_LABEL[k]}</option>
                    ))}
                  </select>
                  <label style={S.check}>
                    людей{" "}
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={people[r.index] ?? 1}
                      onChange={(e) =>
                        setPeople((p) => ({ ...p, [r.index]: Number(e.target.value) || 0 }))
                      }
                      style={S.num}
                    />
                  </label>
                </div>
                <br />
                <span style={S.small}>{r.how}</span>
              </td>
              <td style={S.tdNum}>
                {r.pick
                  ? <><strong>{r.pick.name}</strong><br /><span style={S.small}>
                      нужно {(r.needWatt / 1000).toFixed(1)} кВт</span></>
                  : <span style={S.small}>не подобрать</span>}
              </td>
            </tr>
          ))}
          <tr>
            <td style={S.td}><strong>Всего холода</strong></td>
            <td style={S.tdNum}><strong>{(total / 1000).toFixed(1)} кВт</strong></td>
          </tr>
        </tbody>
      </table>

      {res.warnings.length > 0 && (
        <ul style={S.warn}>
          {res.warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
      {res.notes.map((n, i) => <p key={i} style={S.hint}>{n}</p>)}
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
  num: { width: 48, padding: "3px 6px", border: "1px solid #c9c4bb", borderRadius: 6, fontSize: 12.5 },
  check: { fontSize: 12, color: "#6a645a" },
  small: { fontSize: 11.5, color: "#7a746b" },
  hint: { fontSize: 12.5, color: "#6a645a", margin: "6px 0 0" },
  warn: {
    fontSize: 12.5, color: "#7a5a1f", background: "#fbf3df",
    border: "1px solid #ecdbb2", borderRadius: 8,
    padding: "6px 10px 6px 24px", margin: "6px 0",
  },
};
