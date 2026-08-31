'use client';

import { postGameSummary, odnaFraza, type PlyAnalysis } from "./postGameSummary";

/**
 * Разбор партии сразу после её конца.
 *
 * Прямая причина появления: основатель перенёс запуск словами «нет удобного
 * разбора партии сразу после её конца». Разбор в модуле был — но по кнопке и
 * через платный ИИ, то есть человек, только что получивший мат, не узнавал
 * ничего, пока сам не догадается нажать.
 *
 * Данные не считаются заново: после партии уже идёт runAnalysis(10) и
 * заполняет analysis[]. Пока он не закончил — карточка честно говорит, что
 * считает, а не молчит и не показывает нули.
 */
export default function PostGameCard({
  hist, analysis, pCol, schitaem, onPodrobnee,
}: {
  hist: string[];
  analysis: PlyAnalysis[];
  pCol: "w" | "b";
  schitaem: boolean;
  onPodrobnee?: () => void;
}) {
  const s = postGameSummary(hist, analysis, pCol);

  if (schitaem && s.vsego === 0) {
    return (
      <div style={obolochka} role="status">
        <div style={{ fontWeight: 800, marginBottom: 4 }}>🔍 Разбираю партию…</div>
        <div style={{ fontSize: 13, color: "#5d6b7a" }}>
          Считаю каждый ход — через пару секунд покажу, где решилась партия.
        </div>
      </div>
    );
  }

  // Партия короче шести полуходов: разбирать нечего, и анализ для неё даже
  // не запускается. Молчать здесь нельзя — человек только что видел, как у
  // соседней партии появился разбор, и решит, что сломалось. Говорим прямо.
  if (s.vsego === 0) {
    return (
      <div style={obolochka} role="status" data-testid="post-game-card-short">
        <div style={{ fontSize: 13, color: "#5d6b7a" }}>
          Партия слишком короткая для разбора — сыграйте подлиннее, и я покажу,
          где она решилась.
        </div>
      </div>
    );
  }

  return (
    <div style={obolochka} role="status" data-testid="post-game-card">
      <div style={{ fontWeight: 800, marginBottom: 6 }}>📊 Разбор партии</div>

      <div style={{ fontSize: 14, marginBottom: 10 }}>{odnaFraza(s)}</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: s.perelom ? 10 : 0 }}>
        <Chip label="точность" value={`${s.tochnost}%`} tone="#0f766e" />
        {s.blestyashchih > 0 && <Chip label="блестящих" value={String(s.blestyashchih)} tone="#7c3aed" />}
        {s.zevkov > 0 && <Chip label="зевков" value={String(s.zevkov)} tone="#b91c1c" />}
        {s.oshibok > 0 && <Chip label="ошибок" value={String(s.oshibok)} tone="#c2410c" />}
        {s.netochnostey > 0 && <Chip label="неточностей" value={String(s.netochnostey)} tone="#a16207" />}
      </div>

      {s.perelom && (
        <div style={{
          fontSize: 13, lineHeight: 1.5, padding: "8px 10px", borderRadius: 8,
          background: "#fff7ed", border: "1px solid #fed7aa", color: "#7c2d12",
        }}>
          <b>Где решилась партия:</b> ход {s.perelom.nomerHoda}, {s.perelom.zapis} —
          потеряно {s.perelom.poterya} пешки
          {s.perelom.luchshe ? <> . Сильнее было {s.perelom.luchshe}</> : null}
        </div>
      )}

      {onPodrobnee && (
        <button
          onClick={onPodrobnee}
          style={{
            marginTop: 10, padding: "7px 12px", borderRadius: 8, cursor: "pointer",
            border: "1px solid #c7d2fe", background: "#eef2ff", color: "#3730a3",
            fontSize: 13, fontWeight: 700,
          }}
        >
          Подробный разбор от тренера
        </button>
      )}
    </div>
  );
}

const obolochka: React.CSSProperties = {
  marginTop: 12, padding: "12px 14px", borderRadius: 12,
  background: "#f8fafc", border: "1px solid #e2e8f0", color: "#0f172a",
};

function Chip({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "baseline", gap: 4,
      padding: "4px 9px", borderRadius: 999, fontSize: 12,
      background: "#fff", border: `1px solid ${tone}33`, color: tone, fontWeight: 700,
    }}>
      <b style={{ fontSize: 13 }}>{value}</b>
      <span style={{ opacity: 0.8, fontWeight: 600 }}>{label}</span>
    </span>
  );
}
