// Shared health/wellness disclaimer banner for health-adjacent modules
// (QMelanin, QRenew, HealthAI...). Not medical advice.
import type { CSSProperties } from "react";

const box: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  margin: "14px 0 22px",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid rgba(180,120,20,0.35)",
  background: "rgba(230,178,74,0.08)",
  fontSize: 13,
  lineHeight: 1.5,
  color: "inherit",
};
const mark: CSSProperties = { fontSize: 15, lineHeight: 1.3, flex: "0 0 auto" };
const strong: CSSProperties = { fontWeight: 700 };

export function HealthDisclaimer() {
  return (
    <div style={box} role="note" aria-label="Медицинский дисклеймер">
      <span style={mark} aria-hidden="true">⚕</span>
      <span>
        <span style={strong}>Образовательный материал, а не медицинская помощь.</span>{" "}
        Не является диагнозом, назначением или заменой консультации врача. Любые протоколы,
        добавки и дозы — только по согласованию с вашим лечащим врачом.
      </span>
    </div>
  );
}

export default HealthDisclaimer;
