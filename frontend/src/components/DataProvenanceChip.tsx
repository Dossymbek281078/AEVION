"use client";

import { InfoTip } from "@/components/InfoTip";
import {
  type DataQuality,
  type ProvenanceLabels,
  DEFAULT_PROVENANCE_LABELS,
  PROVENANCE_COLORS,
  provenanceTone,
} from "@/lib/dataQuality";

// AEVION Data Provenance chip — one component, every module. Shows how much of a
// module's data is measured vs. derived vs. guessed, so a visitor (or regulator,
// or investor) sees at a glance what is provable and what is an estimate.
//
//   <DataProvenanceChip dataQuality={city.dataQuality} />                // QSkyway default
//   <DataProvenanceChip dataQuality={dq} labels={{ measured:"факт",      // any module
//     derived:"оценка", guessed:"допущение", unit:"позиций" }} />
//
// `compact` renders a single "X% измерено · Y% реальных" line (for dense toolbars);
// the default renders the three-tier breakdown with colour dots.

type Props = {
  dataQuality: DataQuality | undefined | null;
  labels?: Partial<ProvenanceLabels>;
  compact?: boolean;
};

const dotStyle = (color: string): React.CSSProperties => ({
  color,
  fontSize: 13,
  lineHeight: 1,
});

export function DataProvenanceChip({ dataQuality, labels, compact }: Props) {
  if (!dataQuality || !dataQuality.total) return null;
  const L: ProvenanceLabels = { ...DEFAULT_PROVENANCE_LABELS, ...labels };
  const { measured, derived, guessed, total, measuredPct, realPct, source, note } = dataQuality;
  const unit = L.unit ? ` ${L.unit}` : "";
  const headTone = provenanceTone(measuredPct);

  const tip =
    (note || `${L.measured} — реальный замер/запись; ${L.derived} — выведено из смежного сигнала; ${L.guessed} — дефолт-заглушка.`) +
    (source ? `\nИсточник: ${source}.` : "") +
    `\nВсего: ${total}${unit} · ${L.measured} ${measured} · ${L.derived} ${derived} · ${L.guessed} ${guessed}.`;

  if (compact) {
    return (
      <span style={{ fontFamily: "monospace", fontSize: 11, color: "#9fb0c4", display: "inline-flex", alignItems: "center" }}>
        📊 <span style={{ color: headTone, marginLeft: 4 }}>{measuredPct}% {L.measured}</span>, {realPct}% реальных
        <InfoTip label="Провенанс данных" text={tip} size={13} />
      </span>
    );
  }

  return (
    <span
      style={{
        fontFamily: "monospace",
        fontSize: 11,
        color: "#9fb0c4",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <span style={dotStyle(PROVENANCE_COLORS.measured)}>●</span>
        <span style={{ color: PROVENANCE_COLORS.measured }}>{measuredPct}%</span> {L.measured}
      </span>
      {derived > 0 && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={dotStyle(PROVENANCE_COLORS.derived)}>●</span>
          {Math.round((1000 * derived) / total) / 10}% {L.derived}
        </span>
      )}
      {guessed > 0 && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={dotStyle(PROVENANCE_COLORS.guessed)}>●</span>
          {Math.round((1000 * guessed) / total) / 10}% {L.guessed}
        </span>
      )}
      <InfoTip label="Провенанс данных" text={tip} size={13} />
    </span>
  );
}
