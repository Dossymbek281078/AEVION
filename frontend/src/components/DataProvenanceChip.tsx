"use client";

import { InfoTip } from "@/components/InfoTip";
import { useI18nOptional } from "@/lib/i18n";
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
// `compact` renders a single "X% измерено · Y% {L.real}" line (for dense toolbars);
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
  /*
   * Подписи берутся ИЗ СЛОВАРЯ, а не из умолчаний компонента.
   *
   * 01.09.2026, поправка соседнего окна: вынести русский текст из разметки в
   * DEFAULT_PROVENANCE_LABELS было половиной дела. Умолчания русские, а три
   * страницы подписи не передают — значит на английской странице посетитель
   * читал ровно то же, что и раньше. Строка сменила МЕСТО, а не язык на экране.
   *
   * Проверка «нет литералов в разметке» при этом ЧЕСТНО зеленела: она про
   * форму, а вопрос был про следствие. Поэтому источник теперь один — словарь,
   * общий на все три страницы; передать подписи пропом по-прежнему можно, но
   * это уже осознанное исключение, а не единственный способ получить перевод.
   *
   * Хук берём необязательный: вне провайдера (в тестах) он вернёт null, и тогда
   * ключ покажется САМ СОБОЙ — видимая неполнота лучше молчаливо русской.
   */
  const i18n = useI18nOptional();
  if (!dataQuality || !dataQuality.total) return null;
  const fromDict: Partial<ProvenanceLabels> = i18n
    ? {
        measured: i18n.t("provenance.measured"),
        derived: i18n.t("provenance.derived"),
        guessed: i18n.t("provenance.guessed"),
        real: i18n.t("provenance.real"),
        tipMeasured: i18n.t("provenance.tipMeasured"),
        tipDerived: i18n.t("provenance.tipDerived"),
        tipGuessed: i18n.t("provenance.tipGuessed"),
        tipSource: i18n.t("provenance.tipSource"),
        tipTotal: i18n.t("provenance.tipTotal"),
        tipLabel: i18n.t("provenance.tipLabel"),
      }
    : {};
  const L: ProvenanceLabels = { ...DEFAULT_PROVENANCE_LABELS, ...fromDict, ...labels };
  const { measured, derived, guessed, total, measuredPct, realPct, source, note } = dataQuality;
  const unit = L.unit ? ` ${L.unit}` : "";
  const headTone = provenanceTone(measuredPct);

  /*
   * ⚠️ 01.09.2026: вся подсказка была зашита ПО-РУССКИ, хотя рядом стоят
   * настраиваемые L.measured / L.derived / L.guessed.
   *
   * Сторож языка нашёл только видимую подпись — подсказка живёт в атрибуте и
   * показывается по наведению, то есть его охвату недоступна. Шесть мест из
   * семи он не видел и не мог: он сравнивает ВИДИМЫЙ текст.
   *
   * Компонент используют три страницы, поэтому зашитое слово доезжало до всех
   * сразу: на английской человек читал «96% measured, 50.1% реальных».
   */
  const tip =
    (note ||
      `${L.measured} — ${L.tipMeasured}; ${L.derived} — ${L.tipDerived}; ${L.guessed} — ${L.tipGuessed}.`) +
    (source ? `
${L.tipSource}: ${source}.` : "") +
    `
${L.tipTotal}: ${total}${unit} · ${L.measured} ${measured} · ${L.derived} ${derived} · ${L.guessed} ${guessed}.`;

  if (compact) {
    return (
      <span style={{ fontFamily: "monospace", fontSize: 11, color: "#9fb0c4", display: "inline-flex", alignItems: "center" }}>
        📊 <span style={{ color: headTone, marginLeft: 4 }}>{measuredPct}% {L.measured}</span>, {realPct}% {L.real}
        <InfoTip label={L.tipLabel} text={tip} size={13} />
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
      <InfoTip label={L.tipLabel} text={tip} size={13} />
    </span>
  );
}
