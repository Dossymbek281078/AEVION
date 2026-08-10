"use client";

import { InfoTip } from "@/components/InfoTip";
import { useI18n } from "@/lib/i18n";
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
  // Keyed, not left to runtime machine translation: this chip's whole job is to
  // separate "an authority published this" from "we made it up", and those two
  // words are exactly the ones that must not be approximated by an MT service.
  const { t } = useI18n();
  const tier = effectiveTier(source);
  const L: RegulatoryLabels = {
    ...DEFAULT_REGULATORY_LABELS,
    official: t("reg.tier.official"),
    illustrative: t("reg.tier.illustrative"),
    none: t("reg.tier.none"),
    ...labels,
  };
  const color = REGULATORY_COLORS[tier];
  const headline = regulatoryHeadline(source, L);

  const lines: string[] = [];
  if (tier === "official") {
    lines.push(t("reg.tip.official", { authority: source?.authority ?? "", title: source?.title ? ", " + source.title : "" }));
    if (source?.effective) lines.push(t("reg.tip.edition", { edition: source.effective }));
    if (source?.scopeNote) lines.push(t("reg.tip.scope", { scope: source.scopeNote }));
    // A reissue with identical values is NOT drift — nothing needs regenerating
    // and routing stays correct — but it is also not "the snapshot matches what
    // the regulator publishes": the edition has moved. Both sentences would be
    // wrong here, so this case gets its own, narrower one.
    const reissued =
      source?.upToDate === true &&
      Boolean(source?.publishedEffective) &&
      Boolean(source?.effective) &&
      source.publishedEffective !== source.effective;
    if (reissued) lines.push(t("reg.tip.reissued", { edition: source!.publishedEffective as string }));
    else if (source?.upToDate === true) lines.push(t("reg.tip.fresh"));
    if (source?.upToDate === false) lines.push(t("reg.tip.drift"));
    if (source?.upToDate == null) lines.push(t("reg.tip.unchecked"));
    if (source?.attested) lines.push(t("reg.tip.attested"));
  } else if (tier === "illustrative") {
    lines.push(t("reg.tip.illustrative"));
    if (source?.scopeNote) lines.push(source.scopeNote);
  } else {
    lines.push(t("reg.tip.none"));
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
