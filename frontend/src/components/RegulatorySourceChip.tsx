"use client";

import { InfoTip } from "@/components/InfoTip";
import {
  type RegulatorySource,
  type RegulatoryLabels,
  DEFAULT_REGULATORY_LABELS,
  REGULATORY_COLORS,
  effectiveTier,
  regulatoryHeadline,
} from "@/lib/regulatorySource";

// AEVION Regulatory Source chip — one component, every module that shows a RULE
// rather than a measurement. Sits beside <DataProvenanceChip>, which covers the
// other axis (how the numbers were obtained).
//
//   <RegulatorySourceChip source={{ tier:"official", authority:"FAA",
//     title:"UAS Facility Map", effective:"7/9/2026",
//     scopeNote:"допуски Part 107 для малых БВС, не сертификация аэротакси",
//     upToDate:true, attested:true }} />
//
//   <RegulatorySourceChip source={{ tier:"illustrative" }}
//     labels={{ illustrative:"демо-зоны" }} />
//
// Design rule: the chip never renders a bare green badge. An `official` source
// shows its authority, and its scope limit is always one hover away — a citation
// without its scope is how "we ingest FAA data" quietly becomes "we are FAA
// approved". Freshness and attestation are shown only when actually known.

type Props = {
  source: RegulatorySource | null | undefined;
  labels?: Partial<RegulatoryLabels>;
  /** prefix shown before the source, e.g. "потолки" / "зоны" / "расценки" */
  subject?: string;
};

export function RegulatorySourceChip({ source, labels, subject }: Props) {
  const tier = effectiveTier(source);
  const L: RegulatoryLabels = { ...DEFAULT_REGULATORY_LABELS, ...labels };
  const color = REGULATORY_COLORS[tier];
  const headline = regulatoryHeadline(source, L);

  const lines: string[] = [];
  if (tier === "official") {
    lines.push(`Источник — ${source?.authority}${source?.title ? ", " + source.title : ""}: публикация регулятора, загружена как есть.`);
    if (source?.effective) lines.push(`Редакция: ${source.effective}.`);
    if (source?.scopeNote) lines.push(`Область действия: ${source.scopeNote}.`);
    if (source?.upToDate === true) lines.push("Сверено с живым фидом — снимок совпадает с тем, что публикует регулятор.");
    if (source?.upToDate === false) lines.push("⚠ Живой фид расходится со снимком — данные требуют обновления.");
    if (source?.upToDate == null) lines.push("Сверка с живым фидом ещё не выполнялась.");
    if (source?.attested) lines.push("Слой подписан Ed25519 — можно доказать, по какой редакции считали.");
  } else if (tier === "illustrative") {
    lines.push("Правдоподобная заглушка нашего авторства, НЕ выгрузка из официального источника. Годится для демонстрации механики, не для планирования реальной операции.");
    if (source?.scopeNote) lines.push(source.scopeNote);
  } else {
    lines.push("Ограничение здесь не применяется, и мы не делаем вид, что применяется.");
    if (source?.scopeNote) lines.push(source.scopeNote);
  }

  // Only two states earn a marker: drift (needs action) and attestation (a real
  // guarantee). "Fresh" gets no badge — silence means nothing is wrong.
  const marker = source?.upToDate === false ? " ⚠" : source?.attested && tier === "official" ? " ✓" : "";

  return (
    <span style={{ fontFamily: "monospace", fontSize: 11, color: "#9fb0c4", display: "inline-flex", alignItems: "center" }}>
      🛂{subject ? ` ${subject}:` : ""}
      <span style={{ color, marginLeft: 4 }}>
        {headline}{marker}
      </span>
      <InfoTip label="Источник ограничения" text={lines.join("\n")} size={13} />
    </span>
  );
}
